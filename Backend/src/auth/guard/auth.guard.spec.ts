import {
  InternalServerErrorException,
  UnauthorizedException,
  ExecutionContext,
} from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '@/users/users.service';

function buildContext(authHeader?: string) {
  const request: any = {
    headers: authHeader ? { authorization: authHeader } : {},
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return { context, request };
}

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtService: jest.Mocked<Pick<JwtService, 'verifyAsync'>>;
  let usersService: jest.Mocked<Pick<UsersService, 'findOneById'>>;
  const configService = {
    get: jest.fn().mockReturnValue('un-secreto-cualquiera'),
  };

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() };
    usersService = { findOneById: jest.fn() };

    guard = new AuthGuard(
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      usersService as unknown as UsersService,
    );
  });

  it('rechaza sin token (sin header Authorization)', async () => {
    const { context } = buildContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('deja pasar y adjunta a request.user el payload del token si el token y el usuario son válidos', async () => {
    const payload = {
      idUser: 1,
      nickUsuario: 'user1',
      role: 'USER',
      name: 'User',
    };
    jwtService.verifyAsync.mockResolvedValue(payload);
    usersService.findOneById.mockResolvedValue({
      idUser: 1,
      nickUsuario: 'user1',
      nombre: 'User',
      role: 'USER',
      passwordChangedAt: null,
    } as any);
    const { context, request } = buildContext('Bearer un-jwt-valido');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(payload);
  });

  it('el rol de request.user sale de la BASE, no del token (un ADMIN degradado pierde el acceso al instante)', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      idUser: 1,
      nickUsuario: 'viejo-nick',
      role: 'ADMIN',
      name: 'Viejo',
    });
    usersService.findOneById.mockResolvedValue({
      idUser: 1,
      nickUsuario: 'nick-actual',
      nombre: 'Actual',
      role: 'USER',
      passwordChangedAt: null,
    } as any);
    const { context, request } = buildContext('Bearer un-jwt-valido');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({
      idUser: 1,
      role: 'USER',
      nickUsuario: 'nick-actual',
      name: 'Actual',
    });
  });

  it('rechaza un token emitido antes del último cambio de contraseña', async () => {
    jwtService.verifyAsync.mockResolvedValue({ idUser: 1, pv: 0 });
    usersService.findOneById.mockResolvedValue({
      idUser: 1,
      role: 'USER',
      passwordChangedAt: new Date('2026-05-01T10:00:00.123Z'),
    } as any);
    const { context } = buildContext('Bearer un-jwt-viejo');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('acepta un token emitido con la contraseña actual (mismo pv, con milisegundos)', async () => {
    const cambiada = new Date('2026-05-01T10:00:00.123Z');
    jwtService.verifyAsync.mockResolvedValue({
      idUser: 1,
      pv: cambiada.getTime(),
    });
    usersService.findOneById.mockResolvedValue({
      idUser: 1,
      role: 'USER',
      passwordChangedAt: cambiada,
    } as any);
    const { context } = buildContext('Bearer un-jwt-vigente');

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('un token viejo sin claim pv sigue valiendo mientras el usuario nunca cambió la clave', async () => {
    jwtService.verifyAsync.mockResolvedValue({ idUser: 1 });
    usersService.findOneById.mockResolvedValue({
      idUser: 1,
      role: 'USER',
      passwordChangedAt: null,
    } as any);
    const { context } = buildContext('Bearer un-jwt-anterior-al-cambio');

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rechaza si el JWT es inválido/expirado (error plano de jsonwebtoken)', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    const { context } = buildContext('Bearer un-jwt-vencido');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rechaza si el usuario del token ya no existe o fue dado de baja', async () => {
    jwtService.verifyAsync.mockResolvedValue({ idUser: 99 });
    usersService.findOneById.mockResolvedValue(null);
    const { context } = buildContext('Bearer un-jwt-de-usuario-dado-de-baja');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('propaga un error interno real (ej. la base caída) en vez de pisarlo con un 401 genérico', async () => {
    // regresión: antes, cualquier error dentro del try (incluido un 500
    // real de usersService.findOneById) quedaba tapado por un catch que
    // siempre tiraba UnauthorizedException — esto hacía que un blip de
    // infraestructura se viera como "sesión inválida" para todo el mundo.
    jwtService.verifyAsync.mockResolvedValue({ idUser: 1 });
    usersService.findOneById.mockRejectedValue(
      new InternalServerErrorException('Error al buscar el usuario'),
    );
    const { context } = buildContext('Bearer un-jwt-valido');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
