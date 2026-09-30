// Fase 4 (5.3 a 5.10 de la guía): IDOR/BOLA, escalada, inyección, abuso,
// denegación de servicio barata, filtración de información y formatos de cuerpo.
import request from 'supertest';
import {
  api,
  cerrar,
  clearMails,
  createTestApp,
  crearProducto,
  PNG_1X1,
  PREFIX,
  rawRequest,
  sentMails,
  TestContext,
} from './helpers';

describe('IDOR, inyección, abuso y filtraciones', () => {
  let ctx: TestContext;
  let http: ReturnType<typeof api>;
  let productoDeA: number;

  beforeAll(async () => {
    ctx = await createTestApp();
    http = api(ctx);
    productoDeA = await crearProducto(ctx, {
      creadoPor: 'USER_A',
      nombre: 'Producto de A',
    });
  });
  afterAll(async () => cerrar(ctx));
  beforeEach(() => {
    ctx.clearRateLimits();
    clearMails();
  });

  describe('5.3 IDOR / BOLA: USER_B intenta tocar lo de USER_A', () => {
    const conFoto = (req: request.Test) =>
      req.attach('file', PNG_1X1, {
        filename: 'a.png',
        contentType: 'image/png',
      });

    it('subir portada a un producto ajeno → 403', async () => {
      await conFoto(
        http.post(`/productos/${productoDeA}/imagen`).set(ctx.auth('USER_B')),
      ).expect(403);
    });

    it('agregar foto a la galería de un producto ajeno → 403', async () => {
      await conFoto(
        http.post(`/productos/${productoDeA}/fotos`).set(ctx.auth('USER_B')),
      ).expect(403);
    });

    it('reactivar un producto ajeno → 403', async () => {
      await http
        .patch(`/productos/${productoDeA}/activar`)
        .set(ctx.auth('USER_B'))
        .expect(403);
    });

    it('cambiar la visibilidad del stock de un producto ajeno → 403 y no cambia nada', async () => {
      await http
        .patch(`/productos/${productoDeA}/visibilidad-stock`)
        .set(ctx.auth('USER_B'))
        .send({ mostrarStock: false })
        .expect(403);
      const [fila] = await ctx.ds.query(
        'SELECT mostrar_stock AS m FROM products WHERE id_producto = ?',
        [productoDeA],
      );
      expect(Number(fila.m)).toBe(1);
    });

    it('eliminar una foto de un producto ajeno → 403', async () => {
      const subida = await conFoto(
        http.post(`/productos/${productoDeA}/fotos`).set(ctx.auth('USER_A')),
      ).expect(201);
      const idFoto = subida.body.fotos[0].idProductoImagen;
      await http
        .delete(`/productos/${productoDeA}/fotos/${idFoto}`)
        .set(ctx.auth('USER_B'))
        .expect(403);
    });

    it('USER_A no puede borrar la foto de OTRO producto usando su propio :id', async () => {
      const ajeno = await crearProducto(ctx, { creadoPor: 'ADMIN' });
      const propio = await crearProducto(ctx, { creadoPor: 'USER_A' });
      const subida = await conFoto(
        http.post(`/productos/${ajeno}/fotos`).set(ctx.auth('ADMIN')),
      ).expect(201);
      const idFotoAjena = subida.body.fotos[0].idProductoImagen;
      await http
        .delete(`/productos/${propio}/fotos/${idFotoAjena}`)
        .set(ctx.auth('USER_A'))
        .expect(404);
    });

    it('"mis-productos" solo devuelve los propios', async () => {
      const res = await http
        .get('/productos/mis-productos')
        .set(ctx.auth('USER_B'))
        .expect(200);
      expect(res.body.items.map((p: any) => p.nombre)).not.toContain(
        'Producto de A',
      );
    });

    it('un USER no accede a la vista ADMIN de productos ni a los pedidos', async () => {
      await http
        .get(`/productos/admin/${productoDeA}`)
        .set(ctx.auth('USER_A'))
        .expect(403);
      await http
        .get('/ordenes/admin/listado')
        .set(ctx.auth('USER_A'))
        .expect(403);
      await http.get('/ordenes/admin/1').set(ctx.auth('USER_A')).expect(403);
    });

    it('editar el perfil de otro usuario por :id → 403', async () => {
      await http
        .patch(`/auth/updateUser/${ctx.users.USER_A.idUser}`)
        .set(ctx.auth('USER_B'))
        .send({ nombre: 'Hackeado', currentPassword: 'Passw0rd!' })
        .expect(403);
      const [fila] = await ctx.ds.query(
        'SELECT nombre FROM users WHERE id_user = ?',
        [ctx.users.USER_A.idUser],
      );
      expect(fila.nombre).not.toBe('Hackeado');
    });
  });

  describe('5.4 escalada de privilegios', () => {
    it.each(['USER_A', 'GUEST'] as const)(
      '%s no puede crear usuarios ni cambiar roles ni dar de baja',
      async (id) => {
        const nuevo = {
          nickUsuario: 'esc_1',
          nombre: 'Esc',
          apellido: 'Alada',
          role: 'ADMIN',
          password: 'Passw0rd!',
        };
        await http
          .post('/auth/nuevo-usuario')
          .set(ctx.auth(id))
          .send(nuevo)
          .expect(403);
        await http
          .patch(`/auth/editar-usuario/${ctx.users.USER_B.idUser}`)
          .set(ctx.auth(id))
          .send({ role: 'ADMIN' })
          .expect(403);
        await http
          .delete(`/auth/dar-de-baja-usuario/${ctx.users.ADMIN.idUser}`)
          .set(ctx.auth(id))
          .expect(403);
        await http
          .patch('/productos/precios/ajuste-masivo')
          .set(ctx.auth(id))
          .send({ tipo: 'FIJO', valor: 1 })
          .expect(403);
      },
    );

    it('no existe un registro público', async () => {
      await http
        .post('/auth/nuevo-usuario')
        .send({
          nickUsuario: 'pub_1',
          nombre: 'Pub',
          apellido: 'Lico',
          role: 'ADMIN',
          password: 'Passw0rd!',
        })
        .expect(401);
    });

    it('un USER no puede tocar la configuración de contacto ni categorías', async () => {
      await http
        .patch('/contacto/configuracion')
        .set(ctx.auth('USER_A'))
        .send({ email: 'a@example.com' })
        .expect(403);
      await http
        .post('/categorias')
        .set(ctx.auth('USER_A'))
        .send({ nombre: 'Cat' })
        .expect(403);
    });
  });

  describe('5.5 inyección', () => {
    const payloads = [
      "' OR '1'='1",
      "'; DROP TABLE products;--",
      "1' UNION SELECT password FROM users--",
      '" OR ""="',
      "'; SELECT SLEEP(3);--",
    ];

    it.each(payloads)(
      'search=%s se busca como texto literal (200) y las tablas siguen existiendo',
      async (p) => {
        const t0 = Date.now();
        const r1 = await http.get('/productos').query({ search: p });
        const r2 = await http
          .get('/ordenes/admin/listado')
          .set(ctx.auth('ADMIN'))
          .query({ search: p });
        expect(r1.status).toBe(200);
        expect(r2.status).toBe(200);
        expect(r1.body.items).toEqual([]);
        expect(Date.now() - t0).toBeLessThan(2500); // SLEEP(3) no se ejecutó
        const [{ n }] = await ctx.ds.query(
          'SELECT COUNT(*) AS n FROM products',
        );
        expect(Number(n)).toBeGreaterThan(0);
      },
    );

    it.each(['%', '_', '\\', '%%'])(
      'buscar el comodín LIKE "%s" no devuelve todo el catálogo',
      async (c) => {
        const res = await http
          .get('/productos')
          .query({ search: c })
          .expect(200);
        expect(res.body.items).toEqual([]);
      },
    );

    it('un nombre de producto con sintaxis SQL se guarda y se lee literal', async () => {
      const nombre = "Robert'); DROP TABLE users;--";
      const creado = await http
        .post('/productos')
        .set(ctx.auth('ADMIN'))
        .send({ nombre, precio: 10 })
        .expect(201);
      const leido = await http
        .get(`/productos/${creado.body.idProducto}`)
        .expect(200);
      expect(leido.body.nombre).toBe(nombre);
      const [{ n }] = await ctx.ds.query('SELECT COUNT(*) AS n FROM users');
      expect(Number(n)).toBeGreaterThan(0);
    });

    it('el mensaje de contacto con HTML sale ESCAPADO en el mail', async () => {
      await ctx.ds.query(
        "INSERT INTO contact_settings (id_contact_settings, email) VALUES (1, 'negocio@example.com') ON DUPLICATE KEY UPDATE email = 'negocio@example.com'",
      );
      await http
        .post('/contacto')
        .send({
          nombre: 'Ana',
          email: 'ana@example.com',
          mensaje: '<script>alert(1)</script> <a href="http://evil">click</a>',
        })
        .expect(201);
      const html = sentMails()[0]?.html ?? '';
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('<a href');
      expect(html).toContain('&lt;script&gt;');
    });

    it('el nombre del formulario de contacto no puede llevar saltos de línea (inyección de cabeceras en el asunto)', async () => {
      await http
        .post('/contacto')
        .send({
          nombre: 'Ana\r\nBcc: victima@example.com',
          email: 'ana@example.com',
          mensaje: 'mensaje de prueba largo',
        })
        .expect(400);
      expect(sentMails()).toEqual([]);
    });

    it('el email del formulario de contacto no acepta inyección de cabeceras', async () => {
      await http
        .post('/contacto')
        .send({
          nombre: 'Ana',
          email: 'ana@example.com\r\nBcc: v@example.com',
          mensaje: 'mensaje de prueba largo',
        })
        .expect(400);
    });
  });

  describe('5.7 fuerza bruta y abuso en endpoints públicos', () => {
    it('POST /contacto limita a 5 por ventana (el 6.º da 429)', async () => {
      const estados: number[] = [];
      for (let i = 0; i < 6; i++) {
        estados.push(
          (
            await http.post('/contacto').send({
              nombre: 'Ana',
              email: 'a@example.com',
              mensaje: 'mensaje de prueba largo',
            })
          ).status,
        );
      }
      expect(estados[5]).toBe(429);
    });

    it('POST /ordenes (público, crea una preferencia en Mercado Pago) tiene límite por IP', async () => {
      const id = await crearProducto(ctx, { stock: 1000 });
      const cuerpo = {
        nombreContacto: 'Cliente',
        email: 'c@example.com',
        telefono: '1155551234',
        items: [{ idProducto: id, cantidad: 1 }],
      };
      const estados: number[] = [];
      for (let i = 0; i < 40; i++)
        estados.push((await http.post('/ordenes').send(cuerpo)).status);
      expect(estados).toContain(429);
    });
  });

  describe('5.8 denegación de servicio "barata"', () => {
    it.each([
      ['200 KB', 200 * 1024],
      ['1 MB', 1024 * 1024],
    ])('cuerpo JSON de %s → 413 (no 500)', async (_n, bytes) => {
      const res = await http
        .post('/contacto')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ nombre: 'a'.repeat(bytes) }));
      expect(res.status).toBe(413);
    });

    it('JSON mal formado → 400 sin detalles internos', async () => {
      const res = await http
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send('{roto');
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).not.toMatch(/node_modules|\.ts:|\.js:/);
    });

    it('JSON con anidado muy profundo no rompe el servidor', async () => {
      const profundo = `${'{"a":'.repeat(5000)}1${'}'.repeat(5000)}`;
      const res = await http
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send(profundo);
      expect(res.status).toBeLessThan(500);
    });

    it('un GET con limit gigante no devuelve miles de filas (400)', async () => {
      await http.get('/productos?limit=1000000').expect(400);
    });
  });

  describe('5.9 filtración de información', () => {
    it('ninguna respuesta de las lecturas principales incluye password, hashes ni tokens de recuperación', async () => {
      await ctx.ds.query(
        'UPDATE users SET reset_password_token = UUID(), reset_password_token_expires_at = NOW() + INTERVAL 5 MINUTE WHERE id_user = ?',
        [ctx.users.USER_A.idUser],
      );
      const respuestas = await Promise.all([
        http.get('/auth/listar-usuarios').set(ctx.auth('ADMIN')),
        http.get('/auth/profile').set(ctx.auth('USER_A')),
        http.get('/productos'),
        http.get(`/productos/${productoDeA}`),
        http.get('/productos/admin/listado').set(ctx.auth('ADMIN')),
        http.get('/productos/mis-productos').set(ctx.auth('USER_A')),
        http.get('/categorias'),
        http.get('/contacto/whatsapp'),
        http.get('/ordenes/admin/listado').set(ctx.auth('ADMIN')),
      ]);
      for (const r of respuestas) {
        expect(r.status).toBe(200);
        expect(JSON.stringify(r.body)).not.toMatch(
          /"password"|"resetPasswordToken|argon2|\$argon/i,
        );
      }
    });

    it('el catálogo público no revela quién cargó cada producto', async () => {
      const res = await http.get(`/productos/${productoDeA}`).expect(200);
      expect(JSON.stringify(res.body)).not.toMatch(
        /creadoPor|idUser|nickUsuario/,
      );
    });

    it('la respuesta de "no encontrado" no trae stack ni rutas del servidor', async () => {
      const res = await http.get('/no-existe');
      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).not.toMatch(
        /node_modules|\.ts:|stack|C:\\\\/i,
      );
    });

    it('no se anuncia la tecnología en las cabeceras (X-Powered-By) y hay cabeceras de seguridad', async () => {
      const res = await http.get('/productos');
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('un producto con stock oculto no revela su stock real en el error de "sin stock" del checkout', async () => {
      const id = await crearProducto(ctx, { stock: 7 });
      await ctx.ds.query(
        'UPDATE products SET mostrar_stock = 0 WHERE id_producto = ?',
        [id],
      );
      const res = await http.post('/ordenes').send({
        nombreContacto: 'Cliente',
        email: 'c@example.com',
        telefono: '1155551234',
        items: [{ idProducto: id, cantidad: 8 }],
      });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).not.toMatch(/\b7\b/);
    });
  });

  describe('5.10 formatos de cuerpo (pedidos sin formulario)', () => {
    it.each([
      ['texto plano', 'text/plain', 'nickUsuario=admin&password=x'],
      [
        'JSON declarado text/plain',
        'text/plain',
        '{"nickUsuario":"a","password":"b"}',
      ],
      ['XML', 'application/xml', '<login><nick>a</nick></login>'],
      ['Content-Type vacío', '', '{"nickUsuario":"a","password":"b"}'],
    ])('login con cuerpo %s → 400', async (_n, tipo, cuerpo) => {
      const req = http.post('/auth/login');
      if (tipo) req.set('Content-Type', tipo);
      else req.unset('Content-Type');
      const res = await req.send(cuerpo);
      expect(res.status).toBe(400);
    });

    it('formulario clásico con un campo de más (role=ADMIN) → 400', async () => {
      await http
        .post('/auth/login')
        .type('form')
        .send('nickUsuario=a&password=b&role=ADMIN')
        .expect(400);
    });

    it('texto plano a un endpoint privado que escribe → 400 y 0 filas nuevas', async () => {
      const [{ antes }] = await ctx.ds.query(
        'SELECT COUNT(*) AS antes FROM products',
      );
      const res = await http
        .post('/productos')
        .set(ctx.auth('ADMIN'))
        .set('Content-Type', 'text/plain')
        .send('nombre=Hack&precio=1');
      expect(res.status).toBe(400);
      const [{ despues }] = await ctx.ds.query(
        'SELECT COUNT(*) AS despues FROM products',
      );
      expect(Number(despues)).toBe(Number(antes));
    });
  });

  describe('7. servidor: archivos estáticos y CORS', () => {
    it.each([
      '/uploads/../.env',
      '/uploads/..%2f.env',
      '/uploads/%2e%2e/%2e%2e/.env',
      '/uploads/..%5c.env',
      '/uploads/../package.json',
    ])('GET %s → 404 (nunca sale de uploads/)', async (ruta) => {
      const res = await rawRequest(ctx, ruta);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body).not.toMatch(/DB_PASSWORD|SECRET_WORD|"name"/);
    });

    it('/uploads/ no lista el contenido de la carpeta', async () => {
      const res = await rawRequest(ctx, '/uploads/');
      expect(res.body).not.toMatch(/Index of|<a href/i);
    });

    it('CORS: un sitio ajeno NO recibe Access-Control-Allow-Origin', async () => {
      const res = await request(ctx.server)
        .get(`${PREFIX}/productos`)
        .set('Origin', 'https://sitio-malo.com');
      expect(res.headers['access-control-allow-origin']).not.toBe('*');
      expect(res.headers['access-control-allow-origin']).not.toBe(
        'https://sitio-malo.com',
      );
    });
  });
});
