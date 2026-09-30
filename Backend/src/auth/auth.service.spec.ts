import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { UsersService } from '@/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@/common/enums/role.enum';
import { padToMinDuration } from '@/common/utils/timing-safe.util';
import { getTransporter } from '@/config/mailer';

// Los loggers son singletons de Winston que escriben a disco (logs/*.txt) —
// se mockean para que el test no dependa del filesystem ni lo ensucie.
jest.mock('@/config/module-loggers', () => ({
  authErrorLogger: { error: jest.fn(), warn: jest.fn(), log: jest.fn() },
}));
jest.mock('@/config/db-loggers', () => ({
  selectLogger: { info: jest.fn(), warn: jest.fn() },
  insertLogger: { info: jest.fn() },
}));
// argon2 es un binding nativo (propiedades no configurables) — jest.spyOn
// no puede reemplazarlas, hace falta mockear el módulo entero.
jest.mock('argon2');
// login() aplica un piso de tiempo (padToMinDuration) para parejar la rama
// "nickUsuario no existe" con la rama real — se mockea acá para que los
// tests de arriba no paguen ese delay real de forma innecesaria; el
// comportamiento del padding en sí se prueba aparte, más abajo.
jest.mock('@/common/utils/timing-safe.util', () => ({
  padToMinDuration: jest.fn().mockResolvedValue(undefined),
}));
// getTransporter() crea un transporter real de nodemailer — se mockea para
// que requestResetPassword() no intente conectarse a un SMTP real.
jest.mock('@/config/mailer', () => ({
  getTransporter: jest.fn(),
}));

describe('AuthService.login', () => {
  let authService: AuthService;
  let usersService: jest.Mocked<Pick<UsersService, 'findByNickWithPassword'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync'>>;

  const baseUser = {
    idUser: 1,
    nickUsuario: 'user1',
    nombre: 'User',
    role: Role.USER,
    password: 'hashed-password',
  };

  beforeEach(() => {
    usersService = { findByNickWithPassword: jest.fn() };
    jwtService = { signAsync: jest.fn() };
    (padToMinDuration as jest.Mock).mockClear();

    authService = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
    );
  });

  it('devuelve el mismo mensaje genérico si el nickUsuario no existe', async () => {
    usersService.findByNickWithPassword.mockResolvedValue(null);

    await expect(
      authService.login({ nickUsuario: 'no-existe', password: 'lo-que-sea' }),
    ).rejects.toMatchObject({
      message: 'Usuario o contraseña inválidos',
    });
  });

  it('devuelve el mismo mensaje genérico si la contraseña es incorrecta', async () => {
    usersService.findByNickWithPassword.mockResolvedValue(baseUser as any);
    (argon2.verify as jest.Mock).mockResolvedValue(false);

    await expect(
      authService.login({
        nickUsuario: baseUser.nickUsuario,
        password: 'incorrecta',
      }),
    ).rejects.toMatchObject({
      message: 'Usuario o contraseña inválidos',
    });
  });

  it('ambos casos de fallo lanzan la misma excepción (no hay forma de distinguirlos desde afuera)', async () => {
    usersService.findByNickWithPassword.mockResolvedValueOnce(null);
    let errorNickInexistente: unknown;
    try {
      await authService.login({ nickUsuario: 'no-existe', password: 'x' });
    } catch (error) {
      errorNickInexistente = error;
    }

    usersService.findByNickWithPassword.mockResolvedValueOnce(baseUser as any);
    (argon2.verify as jest.Mock).mockResolvedValueOnce(false);
    let errorPasswordIncorrecta: unknown;
    try {
      await authService.login({
        nickUsuario: baseUser.nickUsuario,
        password: 'x',
      });
    } catch (error) {
      errorPasswordIncorrecta = error;
    }

    expect(errorNickInexistente).toBeInstanceOf(UnauthorizedException);
    expect(errorPasswordIncorrecta).toBeInstanceOf(UnauthorizedException);
    expect((errorNickInexistente as UnauthorizedException).message).toBe(
      (errorPasswordIncorrecta as UnauthorizedException).message,
    );
  });

  it('devuelve un token cuando el nickUsuario y la contraseña son correctos', async () => {
    usersService.findByNickWithPassword.mockResolvedValue(baseUser as any);
    (argon2.verify as jest.Mock).mockResolvedValue(true);
    jwtService.signAsync.mockResolvedValue('un-jwt-cualquiera');

    const result = await authService.login({
      nickUsuario: baseUser.nickUsuario,
      password: 'correcta',
    });

    expect(result).toEqual({ token: 'un-jwt-cualquiera' });
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      idUser: baseUser.idUser,
      nickUsuario: baseUser.nickUsuario,
      role: baseUser.role,
      name: baseUser.nombre,
      // versión de la contraseña (0 = nunca la cambió): ver AuthGuard
      pv: 0,
    });
  });

  it('el claim pv del token es el passwordChangedAt del usuario en milisegundos', async () => {
    const cambiada = new Date('2026-01-02T03:04:05.678Z');
    usersService.findByNickWithPassword.mockResolvedValue({
      ...baseUser,
      passwordChangedAt: cambiada,
    } as any);
    (argon2.verify as jest.Mock).mockResolvedValue(true);
    jwtService.signAsync.mockResolvedValue('jwt');

    await authService.login({
      nickUsuario: baseUser.nickUsuario,
      password: 'x',
    });

    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ pv: cambiada.getTime() }),
    );
  });

  it('con un nickUsuario inexistente igual se verifica contra un hash (sin oráculo de tiempo)', async () => {
    (argon2.verify as jest.Mock).mockClear();
    usersService.findByNickWithPassword.mockResolvedValue(null);

    await expect(
      authService.login({ nickUsuario: 'no-existe', password: 'x' }),
    ).rejects.toThrow(UnauthorizedException);

    expect(argon2.verify).toHaveBeenCalledTimes(1);
  });

  it('empareja el tiempo de respuesta (padToMinDuration) en las tres ramas, para cerrar el oráculo de tiempo', async () => {
    // rama "nickUsuario no existe"
    usersService.findByNickWithPassword.mockResolvedValueOnce(null);
    await expect(
      authService.login({ nickUsuario: 'no-existe', password: 'x' }),
    ).rejects.toThrow(UnauthorizedException);

    // rama "contraseña incorrecta"
    usersService.findByNickWithPassword.mockResolvedValueOnce(baseUser as any);
    (argon2.verify as jest.Mock).mockResolvedValueOnce(false);
    await expect(
      authService.login({ nickUsuario: baseUser.nickUsuario, password: 'x' }),
    ).rejects.toThrow(UnauthorizedException);

    // rama "login exitoso"
    usersService.findByNickWithPassword.mockResolvedValueOnce(baseUser as any);
    (argon2.verify as jest.Mock).mockResolvedValueOnce(true);
    jwtService.signAsync.mockResolvedValueOnce('un-jwt-cualquiera');
    await authService.login({
      nickUsuario: baseUser.nickUsuario,
      password: 'correcta',
    });

    expect(padToMinDuration).toHaveBeenCalledTimes(3);
  });
});

describe('AuthService.requestResetPassword', () => {
  let authService: AuthService;
  let usersService: jest.Mocked<
    Pick<UsersService, 'findOneByNick' | 'updateTokenResetPassword'>
  >;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync'>>;
  let sendMail: jest.Mock;

  const baseUser = {
    idUser: 1,
    nickUsuario: 'user1',
    email: null as string | null,
  };

  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, MAIL_USER: 'soporte@example.com' };

    usersService = {
      findOneByNick: jest.fn(),
      updateTokenResetPassword: jest.fn(),
    };
    jwtService = { signAsync: jest.fn() };
    sendMail = jest.fn().mockResolvedValue(undefined);
    (getTransporter as jest.Mock).mockReturnValue({ sendMail });
    (padToMinDuration as jest.Mock).mockClear();

    authService = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
    );
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('responde sin mandar mail ni tocar la base si el nickUsuario no existe (anti-enumeración)', async () => {
    usersService.findOneByNick.mockResolvedValue(null);

    await expect(
      authService.requestResetPassword({
        nickUsuario: 'no-existe',
        email: 'quien-sea@example.com',
      }),
    ).resolves.toBeUndefined();

    expect(sendMail).not.toHaveBeenCalled();
    expect(usersService.updateTokenResetPassword).not.toHaveBeenCalled();
    expect(padToMinDuration).toHaveBeenCalledTimes(1);
  });

  it('manda el token al email registrado cuando el email pedido coincide (sin distinguir mayúsculas)', async () => {
    usersService.findOneByNick.mockResolvedValue({
      ...baseUser,
      email: 'Guardado@Example.com',
    } as any);
    usersService.updateTokenResetPassword.mockResolvedValue({ success: true });

    await authService.requestResetPassword({
      nickUsuario: baseUser.nickUsuario,
      email: ' guardado@example.com ',
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'Guardado@Example.com' }),
    );
  });

  it('si el email pedido NO coincide con el registrado, no manda nada ni genera token (respuesta idéntica a un pedido exitoso)', async () => {
    usersService.findOneByNick.mockResolvedValue({
      ...baseUser,
      email: 'guardado@example.com',
    } as any);

    await expect(
      authService.requestResetPassword({
        nickUsuario: baseUser.nickUsuario,
        email: 'otro-email-cualquiera@example.com',
      }),
    ).resolves.toBeUndefined();

    expect(usersService.updateTokenResetPassword).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
    expect(padToMinDuration).toHaveBeenCalledTimes(1);
  });

  it('regresión (robo de cuenta): un usuario SIN email no recibe el token en el email que escribe quien lo pide', async () => {
    usersService.findOneByNick.mockResolvedValue({
      ...baseUser,
      email: null,
    } as any);

    await expect(
      authService.requestResetPassword({
        nickUsuario: baseUser.nickUsuario,
        email: 'atacante@example.com',
      }),
    ).resolves.toBeUndefined();

    // ni se asocia el email a la cuenta, ni se genera token, ni se manda mail
    expect(usersService.updateTokenResetPassword).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('empareja el tiempo también cuando falla la generación del token (usuario ya existente)', async () => {
    usersService.findOneByNick.mockResolvedValue({
      ...baseUser,
      email: 'guardado@example.com',
    } as any);
    usersService.updateTokenResetPassword.mockResolvedValue({ success: false });

    await expect(
      authService.requestResetPassword({
        nickUsuario: baseUser.nickUsuario,
        email: 'guardado@example.com',
      }),
    ).rejects.toMatchObject({
      message: 'No se pudo generar el token de recuperación.',
    });
    // el throw pasa por handleServiceError — si el padding no estuviera en
    // el finally, esta rama respondería casi al instante (oráculo de tiempo)
    expect(padToMinDuration).toHaveBeenCalledTimes(1);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('el link del mail lleva el mismo token que se guarda en la base', async () => {
    usersService.findOneByNick.mockResolvedValue({
      ...baseUser,
      email: 'guardado@example.com',
    } as any);
    usersService.updateTokenResetPassword.mockResolvedValue({ success: true });

    await authService.requestResetPassword({
      nickUsuario: baseUser.nickUsuario,
      email: 'guardado@example.com',
    });

    const [, tokenGuardado] =
      usersService.updateTokenResetPassword.mock.calls[0];
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining(`token=${tokenGuardado}`),
      }),
    );
  });

  it('empareja el tiempo de respuesta con padToMinDuration tanto si el usuario existe como si no', async () => {
    usersService.findOneByNick.mockResolvedValueOnce(null);
    await authService.requestResetPassword({
      nickUsuario: 'no-existe',
      email: 'x@example.com',
    });

    usersService.findOneByNick.mockResolvedValueOnce({
      ...baseUser,
      email: 'guardado@example.com',
    } as any);
    usersService.updateTokenResetPassword.mockResolvedValueOnce({
      success: true,
    });
    await authService.requestResetPassword({
      nickUsuario: baseUser.nickUsuario,
      email: 'guardado@example.com',
    });

    expect(padToMinDuration).toHaveBeenCalledTimes(2);
  });
});
