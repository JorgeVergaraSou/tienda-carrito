// Fase 2 de la guía: login y sesiones (JWT).
import { JwtService } from '@nestjs/jwt';
import * as jsonwebtoken from 'jsonwebtoken';
import {
  api,
  createTestApp,
  crearUsuario,
  PASSWORD,
  TestContext,
} from './helpers';

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

describe('Login y sesiones (fase 2)', () => {
  let ctx: TestContext;
  let http: ReturnType<typeof api>;

  beforeAll(async () => {
    ctx = await createTestApp();
    http = api(ctx);
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(() => ctx.clearRateLimits());

  const profile = (headers: Record<string, string>) =>
    http.get('/auth/profile').set(headers);

  describe('tokens inválidos → 401', () => {
    it('sin token', async () => {
      await http.get('/auth/profile').expect(401);
    });

    it.each([
      ['inventado', 'esto.no.es.un.jwt'],
      ['basura', 'x'],
    ])('token %s', async (_n, token) => {
      await profile({ Authorization: `Bearer ${token}` }).expect(401);
    });

    it('alg:none sin firma', async () => {
      const t = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
        idUser: ctx.users.ADMIN.idUser,
        role: 'ADMIN',
        nickUsuario: 'admin_e2e',
      })}.`;
      await profile({ Authorization: `Bearer ${t}` }).expect(401);
    });

    it('firmado con otro secreto', async () => {
      const t = jsonwebtoken.sign(
        {
          idUser: ctx.users.ADMIN.idUser,
          role: 'ADMIN',
          nickUsuario: 'admin_e2e',
        },
        'otro-secreto-cualquiera-de-mas-de-16',
      );
      await profile({ Authorization: `Bearer ${t}` }).expect(401);
    });

    it('vencido', async () => {
      const t = await ctx.app
        .get(JwtService)
        .signAsync(
          { idUser: ctx.users.USER_A.idUser, role: 'USER', nickUsuario: 'x' },
          { expiresIn: '-10s' },
        );
      await profile({ Authorization: `Bearer ${t}` }).expect(401);
    });

    it('esquema distinto de Bearer', async () => {
      await profile({
        Authorization: `Basic ${ctx.users.USER_A.token}`,
      }).expect(401);
    });
  });

  describe('estado del usuario se consulta en la base en cada pedido', () => {
    it('token de usuario dado de baja → 401, y reactivado vuelve a servir', async () => {
      const u = await crearUsuario(ctx);
      await profile({ Authorization: `Bearer ${u.token}` }).expect(200);

      await ctx.ds.query(
        'UPDATE users SET deleted_at = NOW() WHERE id_user = ?',
        [u.idUser],
      );
      await profile({ Authorization: `Bearer ${u.token}` }).expect(401);

      await ctx.ds.query(
        'UPDATE users SET deleted_at = NULL WHERE id_user = ?',
        [u.idUser],
      );
      await profile({ Authorization: `Bearer ${u.token}` }).expect(200);
    });

    it('ADMIN degradado a USER en la base pierde el acceso de ADMIN en el siguiente pedido', async () => {
      // el token dice ADMIN, la base dice USER: manda la base
      const u = await crearUsuario(ctx, { role: 'ADMIN' });
      await http
        .get('/auth/listar-usuarios')
        .set({ Authorization: `Bearer ${u.token}` })
        .expect(200);

      await ctx.ds.query("UPDATE users SET role = 'USER' WHERE id_user = ?", [
        u.idUser,
      ]);
      await http
        .get('/auth/listar-usuarios')
        .set({ Authorization: `Bearer ${u.token}` })
        .expect(403);
    });

    it('USER ascendido a ADMIN en la base pasa a tener acceso de ADMIN sin volver a loguearse', async () => {
      const u = await crearUsuario(ctx, { role: 'USER' });
      await http
        .get('/auth/listar-usuarios')
        .set({ Authorization: `Bearer ${u.token}` })
        .expect(403);

      await ctx.ds.query("UPDATE users SET role = 'ADMIN' WHERE id_user = ?", [
        u.idUser,
      ]);
      await http
        .get('/auth/listar-usuarios')
        .set({ Authorization: `Bearer ${u.token}` })
        .expect(200);
    });

    it('cambiar la contraseña (autoservicio) invalida los tokens emitidos antes', async () => {
      const u = await crearUsuario(ctx);
      const login = await http
        .post('/auth/login')
        .send({ nickUsuario: u.nickUsuario, password: PASSWORD })
        .expect(200);
      const tokenViejo = login.body.token;
      await profile({ Authorization: `Bearer ${tokenViejo}` }).expect(200);

      await http
        .patch(`/auth/updateUser/${u.idUser}`)
        .set({ Authorization: `Bearer ${tokenViejo}` })
        .send({ currentPassword: PASSWORD, password: 'NuevaClave9' })
        .expect(200);

      // el token viejo (y cualquier otro emitido antes) tiene que morir
      await profile({ Authorization: `Bearer ${tokenViejo}` }).expect(401);

      // pero un login nuevo con la clave nueva sigue funcionando
      const nuevo = await http
        .post('/auth/login')
        .send({ nickUsuario: u.nickUsuario, password: 'NuevaClave9' })
        .expect(200);
      await profile({ Authorization: `Bearer ${nuevo.body.token}` }).expect(
        200,
      );
    });

    it('cambiar la contraseña de un usuario como ADMIN también invalida sus tokens', async () => {
      const u = await crearUsuario(ctx);
      await http
        .patch(`/auth/editar-usuario/${u.idUser}`)
        .set(ctx.auth('ADMIN'))
        .send({ password: 'ClaveDelAdmin7' })
        .expect(200);
      await profile({ Authorization: `Bearer ${u.token}` }).expect(401);
    });
  });

  describe('login', () => {
    it('mismo mensaje para usuario inexistente y clave incorrecta', async () => {
      const a = await http
        .post('/auth/login')
        .send({ nickUsuario: 'no_existe_e2e', password: 'Cualquiera1' });
      const b = await http.post('/auth/login').send({
        nickUsuario: ctx.users.USER_A.nickUsuario,
        password: 'Incorrecta1',
      });
      expect(a.status).toBe(401);
      expect(b.status).toBe(401);
      expect(a.body.message).toBe(b.body.message);
    });

    it('mismo tiempo (±30 ms de promedio) para usuario inexistente y clave incorrecta', async () => {
      const medir = async (nick: string) => {
        const muestras: number[] = [];
        for (let i = 0; i < 6; i++) {
          ctx.clearRateLimits();
          const t0 = process.hrtime.bigint();
          await http
            .post('/auth/login')
            .send({ nickUsuario: nick, password: 'Incorrecta1' });
          muestras.push(Number(process.hrtime.bigint() - t0) / 1e6);
        }
        return muestras.reduce((a, b) => a + b, 0) / muestras.length;
      };
      const inexistente = await medir('no_existe_e2e');
      const real = await medir(ctx.users.USER_A.nickUsuario);
      expect(Math.abs(inexistente - real)).toBeLessThan(30);
    });

    it('el 6.º intento seguido da 429', async () => {
      const estados: number[] = [];
      for (let i = 0; i < 6; i++) {
        const r = await http
          .post('/auth/login')
          .send({ nickUsuario: 'fuerza_bruta', password: 'Incorrecta1' });
        estados.push(r.status);
      }
      expect(estados.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
      expect(estados[5]).toBe(429);
    });

    it('los pedidos inválidos también cuentan para el límite', async () => {
      for (let i = 0; i < 5; i++)
        await http.post('/auth/login').send({}).expect(400);
      await http.post('/auth/login').send({}).expect(429);
    });

    it('los intentos fallidos contra UN usuario no bloquean el login de OTRO desde la misma red', async () => {
      // compañeros de la misma IP no deben bloquearse entre sí (guía 3.2)
      for (let i = 0; i < 5; i++) {
        await http
          .post('/auth/login')
          .send({ nickUsuario: 'victima_e2e', password: 'Incorrecta1' });
      }
      await http
        .post('/auth/login')
        .send({ nickUsuario: ctx.users.USER_B.nickUsuario, password: PASSWORD })
        .expect(200);
    });

    it.each([
      ['número', { nickUsuario: 123, password: 'Passw0rd!' }],
      ['objeto', { nickUsuario: { $gt: '' }, password: 'Passw0rd!' }],
      ['array', { nickUsuario: ['a'], password: ['b'] }],
      ['null', { nickUsuario: null, password: null }],
      ['vacío', { nickUsuario: '', password: '' }],
    ])('tipo raro (%s) → 400, nunca 500', async (_n, body) => {
      await http.post('/auth/login').send(body).expect(400);
    });
  });

  describe('último ADMIN y autobaja', () => {
    /** deja activo únicamente al ADMIN base (los demás ADMIN de la base de
     * tests se dan de baja) y los restaura al terminar — así el test no
     * depende de qué dejaron los anteriores. */
    async function conUnicoAdmin(fn: () => Promise<void>) {
      const otros: { id_user: number }[] = await ctx.ds.query(
        "SELECT id_user FROM users WHERE role = 'ADMIN' AND deleted_at IS NULL AND id_user <> ?",
        [ctx.users.ADMIN.idUser],
      );
      const ids = otros.map((o) => o.id_user);
      if (ids.length) {
        await ctx.ds.query(
          'UPDATE users SET deleted_at = NOW() WHERE id_user IN (?)',
          [ids],
        );
      }
      try {
        await fn();
      } finally {
        if (ids.length) {
          await ctx.ds.query(
            'UPDATE users SET deleted_at = NULL WHERE id_user IN (?)',
            [ids],
          );
        }
      }
    }

    it('no se puede dar de baja al único ADMIN activo', async () => {
      await conUnicoAdmin(async () => {
        await http
          .delete(`/auth/dar-de-baja-usuario/${ctx.users.ADMIN.idUser}`)
          .set(ctx.auth('ADMIN'))
          .expect(400);
      });
    });

    it('no se puede quitar el rol al único ADMIN activo', async () => {
      await conUnicoAdmin(async () => {
        await http
          .patch(`/auth/editar-usuario/${ctx.users.ADMIN.idUser}`)
          .set(ctx.auth('ADMIN'))
          .send({ role: 'USER' })
          .expect(400);
      });
    });

    it('un ADMIN no puede darse de baja a sí mismo (aunque haya otros ADMIN)', async () => {
      const yo = await crearUsuario(ctx, { role: 'ADMIN' });
      const res = await http
        .delete(`/auth/dar-de-baja-usuario/${yo.idUser}`)
        .set({ Authorization: `Bearer ${yo.token}` });
      // limpieza por si la app lo permitió
      await ctx.ds.query(
        'UPDATE users SET deleted_at = NULL WHERE id_user = ?',
        [yo.idUser],
      );
      expect(res.status).toBe(400);
    });
  });
});
