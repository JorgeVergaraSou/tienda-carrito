// Fase 3 de la guía: recuperación de contraseña. Regla de oro: el enlace solo
// se manda al email que YA estaba registrado, nunca al que escribe quien lo pide.
import { randomUUID } from 'crypto';
import {
  api,
  clearMails,
  createTestApp,
  crearUsuario,
  grepLogs,
  PASSWORD,
  sentMails,
  sleep,
  TestContext,
} from './helpers';

const tokenDelMail = (html: string) =>
  /token=([0-9a-f-]{36})/.exec(html)?.[1] as string;

describe('Recuperación de contraseña (fase 3)', () => {
  let ctx: TestContext;
  let http: ReturnType<typeof api>;

  beforeAll(async () => {
    ctx = await createTestApp();
    http = api(ctx);
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(() => {
    ctx.clearRateLimits();
    clearMails();
  });

  const pedir = (nickUsuario: any, email: any) =>
    http.post('/auth/requestResetPassword').send({ nickUsuario, email });

  it('usuario SIN email + email del atacante: no se asocia ni se manda nada (robo de cuenta)', async () => {
    const victima = await crearUsuario(ctx, { email: null });
    await pedir(victima.nickUsuario, 'atacante@example.com');

    expect(sentMails().filter((m) => m.to === 'atacante@example.com')).toEqual(
      [],
    );
    const [fila] = await ctx.ds.query(
      'SELECT email FROM users WHERE id_user = ?',
      [victima.idUser],
    );
    expect(fila.email).toBeNull();
  });

  it('email que NO coincide con el registrado: no se manda nada', async () => {
    const u = await crearUsuario(ctx, { email: 'real@example.com' });
    await pedir(u.nickUsuario, 'otro@example.com');
    expect(sentMails()).toEqual([]);
  });

  it('usuario inexistente: misma respuesta que uno real', async () => {
    const u = await crearUsuario(ctx, { email: 'real2@example.com' });
    const real = await pedir(u.nickUsuario, 'real2@example.com');
    ctx.clearRateLimits();
    const falso = await pedir('no_existe_e2e', 'real2@example.com');
    expect(falso.status).toBe(real.status);
    expect(falso.body).toEqual(real.body);
  });

  it('con usuario y email coincidentes se manda UN mail, al email registrado', async () => {
    const u = await crearUsuario(ctx, { email: 'dueno@example.com' });
    await pedir(u.nickUsuario, 'dueno@example.com');
    expect(sentMails()).toHaveLength(1);
    expect(sentMails()[0].to).toBe('dueno@example.com');
  });

  it('el token vence a los 10 minutos', async () => {
    const u = await crearUsuario(ctx, { email: 'ttl@example.com' });
    await pedir(u.nickUsuario, 'ttl@example.com');
    const [{ ms }] = await ctx.ds.query(
      'SELECT TIMESTAMPDIFF(SECOND, NOW(), reset_password_token_expires_at) AS ms FROM users WHERE id_user = ?',
      [u.idUser],
    );
    expect(Number(ms)).toBeGreaterThan(9 * 60);
    expect(Number(ms)).toBeLessThanOrEqual(10 * 60 + 5);
  });

  describe('confirmar el reseteo', () => {
    it.each([
      ['inventado', () => randomUUID()],
      ['no es un uuid', () => 'no-es-un-uuid'],
      ['objeto', () => ({ $gt: '' })],
      ['número', () => 12345],
    ])('token %s → 400', async (_n, token) => {
      await http
        .post('/auth/resetPassword')
        .send({ resetPasswordToken: (token as any)(), password: 'NuevaClave9' })
        .expect(400);
    });

    it('un solo uso: el segundo intento con el mismo token da 400', async () => {
      const u = await crearUsuario(ctx, { email: 'uso@example.com' });
      await pedir(u.nickUsuario, 'uso@example.com');
      const token = tokenDelMail(sentMails()[0].html);

      await http
        .post('/auth/resetPassword')
        .send({ resetPasswordToken: token, password: 'NuevaClave9' })
        .expect(201);
      await http
        .post('/auth/resetPassword')
        .send({ resetPasswordToken: token, password: 'OtraClave99' })
        .expect(400);

      // y la clave nueva es la que quedó
      await http
        .post('/auth/login')
        .send({ nickUsuario: u.nickUsuario, password: 'NuevaClave9' })
        .expect(200);
    });

    it('token vencido → 400', async () => {
      const u = await crearUsuario(ctx, { email: 'venc@example.com' });
      await pedir(u.nickUsuario, 'venc@example.com');
      const token = tokenDelMail(sentMails()[0].html);
      await ctx.ds.query(
        'UPDATE users SET reset_password_token_expires_at = NOW() - INTERVAL 1 MINUTE WHERE id_user = ?',
        [u.idUser],
      );
      await http
        .post('/auth/resetPassword')
        .send({ resetPasswordToken: token, password: 'NuevaClave9' })
        .expect(400);
    });

    it('resetear la clave invalida los tokens de sesión emitidos antes', async () => {
      const u = await crearUsuario(ctx, { email: 'sesion@example.com' });
      await http
        .get('/auth/profile')
        .set({ Authorization: `Bearer ${u.token}` })
        .expect(200);

      await pedir(u.nickUsuario, 'sesion@example.com');
      await http
        .post('/auth/resetPassword')
        .send({
          resetPasswordToken: tokenDelMail(sentMails()[0].html),
          password: 'NuevaClave9',
        })
        .expect(201);

      await http
        .get('/auth/profile')
        .set({ Authorization: `Bearer ${u.token}` })
        .expect(401);
    });
  });

  describe('pedido con tipos raros', () => {
    it('formulario clásico con objeto escondido (nickUsuario[$gt]=) → 400, no 500', async () => {
      await http
        .post('/auth/requestResetPassword')
        .type('form')
        .send('nickUsuario[$gt]=&email=a@example.com')
        .expect(400);
    });

    it.each([
      ['nick número', { nickUsuario: 123, email: 'a@example.com' }],
      ['nick objeto', { nickUsuario: {}, email: 'a@example.com' }],
      ['email array', { nickUsuario: 'x', email: ['a@example.com'] }],
      [
        'email con salto de línea',
        { nickUsuario: 'x', email: 'a@example.com\r\nBcc: b@example.com' },
      ],
    ])('%s → 400', async (_n, body) => {
      await http.post('/auth/requestResetPassword').send(body).expect(400);
    });
  });

  it('el 4.º pedido de recuperación seguido da 429', async () => {
    const estados: number[] = [];
    for (let i = 0; i < 4; i++) {
      estados.push((await pedir('x_e2e', 'a@example.com')).status);
    }
    expect(estados[3]).toBe(429);
  });

  describe('el token no se filtra', () => {
    it('no aparece en las respuestas de listados ni perfil', async () => {
      const u = await crearUsuario(ctx, { email: 'fuga@example.com' });
      await pedir(u.nickUsuario, 'fuga@example.com');
      const token = tokenDelMail(sentMails()[0].html);

      const respuestas = [
        await http.get('/auth/listar-usuarios').set(ctx.auth('ADMIN')),
        await http
          .get('/auth/profile')
          .set({ Authorization: `Bearer ${u.token}` }),
      ];
      for (const r of respuestas) {
        expect(JSON.stringify(r.body)).not.toContain(token);
        expect(JSON.stringify(r.body)).not.toMatch(/resetPassword|password/i);
      }
    });

    it('no queda escrito en los archivos de log', async () => {
      const u = await crearUsuario(ctx, { email: 'logs@example.com' });
      await pedir(u.nickUsuario, 'logs@example.com');
      const token = tokenDelMail(sentMails()[0].html);
      await ctx.ds.query(
        'UPDATE users SET reset_password_token_expires_at = NOW() - INTERVAL 1 MINUTE WHERE id_user = ?',
        [u.idUser],
      );
      // fuerza un error de negocio (token vencido) que loguea su contexto
      await http
        .post('/auth/resetPassword')
        .send({ resetPasswordToken: token, password: PASSWORD })
        .expect(400);
      await sleep(800); // winston escribe a disco de forma asíncrona
      expect(grepLogs(token)).toEqual([]);
    });
  });
});
