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

  it('deja pasar y adjunta el payload a request.user si el token y el usuario son válidos', async () => {
    const payload = {
      idUser: 1,
      nickUsuario: 'user1',
      role: 'USER',
      name: 'User',
    };
    jwtService.verifyAsync.mockResolvedValue(payload);
    usersService.findOneById.mockResolvedValue({ idUser: 1 } as any);
    const { context, request } = buildContext('Bearer un-jwt-valido');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(payload);
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
