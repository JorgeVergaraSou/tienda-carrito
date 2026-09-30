// Fase 4 (5.1, 5.2 y 6.4 de la guía): asignación masiva, tipos y formatos
// inesperados, y límites de columna. Siempre se espera 400 — NUNCA 500.
import {
  api,
  cerrar,
  createTestApp,
  crearProducto,
  TestContext,
} from './helpers';

describe('Asignación masiva, tipos raros y límites de columna', () => {
  let ctx: TestContext;
  let http: ReturnType<typeof api>;
  let idProducto: number;

  beforeAll(async () => {
    ctx = await createTestApp();
    http = api(ctx);
    idProducto = await crearProducto(ctx, { stock: 10, precio: 1000 });
  });
  afterAll(async () => cerrar(ctx));
  beforeEach(() => ctx.clearRateLimits());

  const contar = async (tabla: string) =>
    Number((await ctx.ds.query(`SELECT COUNT(*) AS n FROM \`${tabla}\``))[0].n);

  const pedidoValido = (over: Record<string, unknown> = {}) => ({
    nombreContacto: 'Cliente Prueba',
    email: 'cliente@example.com',
    telefono: '1155551234',
    items: [{ idProducto, cantidad: 1 }],
    ...over,
  });

  describe('5.1 asignación masiva: campos que el formulario no manda', () => {
    it.each([
      ['estado', { estado: 'PAID' }],
      ['total', { total: 1 }],
      ['id', { idOrden: 1 }],
      ['mercadoPagoPaymentId', { mercadoPagoPaymentId: 'x' }],
      ['createdAt', { createdAt: '2000-01-01' }],
    ])(
      'POST /ordenes rechaza el campo extra "%s" y no guarda nada',
      async (_c, extra) => {
        const antes = await contar('orders');
        await http.post('/ordenes').send(pedidoValido(extra)).expect(400);
        expect(await contar('orders')).toBe(antes);
      },
    );

    it.each([
      ['precioUnitario', { precioUnitario: 1 }],
      ['nombreProducto', { nombreProducto: 'gratis' }],
      ['producto', { producto: { idProducto: 1 } }],
    ])(
      'POST /ordenes rechaza "%s" dentro de un item (objeto anidado)',
      async (_c, extra) => {
        const antes = await contar('orders');
        await http
          .post('/ordenes')
          .send(
            pedidoValido({ items: [{ idProducto, cantidad: 1, ...extra }] }),
          )
          .expect(400);
        expect(await contar('orders')).toBe(antes);
      },
    );

    it.each([
      ['creadoPor', { creadoPor: { idUser: 1 } }],
      ['idProducto', { idProducto: 1 }],
      ['deletedAt', { deletedAt: null }],
      ['imageFile', { imageFile: 'x.png' }],
    ])('POST /productos rechaza "%s"', async (_c, extra) => {
      const antes = await contar('products');
      await http
        .post('/productos')
        .set(ctx.auth('USER_A'))
        .send({ nombre: 'Producto x', precio: 10, ...extra })
        .expect(400);
      expect(await contar('products')).toBe(antes);
    });

    it('un USER no puede subirse el rol a ADMIN por PATCH /auth/updateUser/:id', async () => {
      const u = ctx.users.USER_B;
      await http
        .patch(`/auth/updateUser/${u.idUser}`)
        .set(ctx.auth('USER_B'))
        .send({ role: 'ADMIN', currentPassword: 'Passw0rd!' })
        .expect(400);
      const [fila] = await ctx.ds.query(
        'SELECT role FROM users WHERE id_user = ?',
        [u.idUser],
      );
      expect(fila.role).toBe('USER');
    });

    it('un ADMIN no puede fijar campos internos al editar un usuario', async () => {
      await http
        .patch(`/auth/editar-usuario/${ctx.users.USER_B.idUser}`)
        .set(ctx.auth('ADMIN'))
        .send({ deletedAt: null, resetPasswordToken: 'x' })
        .expect(400);
    });

    it('PATCH /contacto/configuracion rechaza campos extra', async () => {
      await http
        .patch('/contacto/configuracion')
        .set(ctx.auth('ADMIN'))
        .send({ email: 'a@example.com', idContactSettings: 99 })
        .expect(400);
    });
  });

  describe('5.2 POST /ordenes (público): tipos y formatos raros', () => {
    it.each([
      ['nombreContacto número', { nombreContacto: 123 }],
      ['nombreContacto objeto', { nombreContacto: { a: 1 } }],
      ['nombreContacto array', { nombreContacto: ['x'] }],
      ['nombreContacto null', { nombreContacto: null }],
      ['nombreContacto solo espacios', { nombreContacto: '     ' }],
      [
        'nombreContacto de 10000 caracteres',
        { nombreContacto: 'a'.repeat(10000) },
      ],
      [
        'nombreContacto con HTML',
        { nombreContacto: '<img src=x onerror=alert(1)>' },
      ],
      ['email número', { email: 12345 }],
      ['email objeto', { email: { $gt: '' } }],
      [
        'email con inyección de cabecera',
        { email: 'a@example.com\r\nBcc: b@example.com' },
      ],
      ['telefono número', { telefono: 1155551234 }],
      ['telefono largo', { telefono: '1'.repeat(200) }],
      ['notas número', { notas: 12345 }],
      ['notas largas', { notas: 'n'.repeat(5000) }],
      ['items no es array', { items: 'x' }],
      ['items null', { items: null }],
      ['items vacío', { items: [] }],
      ['items con null', { items: [null] }],
      ['items con string', { items: ['1'] }],
    ])('%s → 400', async (_n, over) => {
      const antes = await contar('orders');
      const res = await http.post('/ordenes').send(pedidoValido(over));
      expect(res.status).toBe(400);
      expect(await contar('orders')).toBe(antes);
    });

    it.each([
      ['idProducto con SQL', { idProducto: '1 OR 1=1', cantidad: 1 }],
      ['idProducto array', { idProducto: [1, 2], cantidad: 1 }],
      ['idProducto objeto', { idProducto: { $gt: 0 }, cantidad: 1 }],
      ['idProducto decimal', { idProducto: 1.5, cantidad: 1 }],
      ['idProducto null', { idProducto: null, cantidad: 1 }],
      ['cantidad 0', { idProducto: 1, cantidad: 0 }],
      ['cantidad negativa', { idProducto: 1, cantidad: -5 }],
      ['cantidad decimal', { idProducto: 1, cantidad: 2.5 }],
      ['cantidad enorme', { idProducto: 1, cantidad: 99999999999 }],
      ['cantidad como texto', { idProducto: 1, cantidad: '1' }],
      ['cantidad null', { idProducto: 1, cantidad: null }],
    ])('item con %s → 400', async (_n, item) => {
      const it = item.idProducto === 1 ? { ...item, idProducto } : item;
      const antes = await contar('orders');
      await http
        .post('/ordenes')
        .send(pedidoValido({ items: [it] }))
        .expect(400);
      expect(await contar('orders')).toBe(antes);
    });

    it('un pedido con cientos de items se rechaza (400) en vez de disparar cientos de consultas', async () => {
      const items = Array.from({ length: 500 }, () => ({
        idProducto,
        cantidad: 1,
      }));
      const antes = await contar('orders');
      await http.post('/ordenes').send(pedidoValido({ items })).expect(400);
      expect(await contar('orders')).toBe(antes);
    });
  });

  describe('5.2 / 6.4 POST /productos: tipos y límites de columna (products.nombre es varchar(120))', () => {
    const crear = (body: Record<string, unknown>) =>
      http
        .post('/productos')
        .set(ctx.auth('ADMIN'))
        .send({ nombre: 'Producto ok', precio: 10, ...body });

    it.each([
      ['nombre número', { nombre: 123 }],
      ['nombre objeto', { nombre: {} }],
      ['nombre null', { nombre: null }],
      ['nombre de 200 caracteres (columna: 120)', { nombre: 'n'.repeat(200) }],
      ['nombre con HTML', { nombre: '<script>alert(1)</script>' }],
      ['descripcion número', { descripcion: 123 }],
      ['precio negativo', { precio: -1 }],
      ['precio con 3 decimales', { precio: 1.234 }],
      ['precio enorme (columna decimal(10,2))', { precio: 1e12 }],
      ['precio 100000000 (justo fuera de rango)', { precio: 100000000 }],
      ['precio como texto', { precio: '10' }],
      ['precio null', { precio: null }],
      ['stock decimal', { stock: 2.5 }],
      ['stock negativo', { stock: -1 }],
      ['stock enorme (columna int unsigned)', { stock: 99999999999 }],
      ['stock 5 mil millones', { stock: 5000000000 }],
      ['idCategoria texto', { idCategoria: 'x' }],
      ['idCategoria inexistente', { idCategoria: 999999 }],
      ['mostrarStock texto', { mostrarStock: 'true' }],
    ])('%s → 400', async (_n, over) => {
      const antes = await contar('products');
      const res = await crear(over);
      expect(res.status).toBe(400);
      expect(await contar('products')).toBe(antes);
    });

    it('nombre solo con espacios → 400 (no se guarda vacío)', async () => {
      await crear({ nombre: '        ' }).expect(400);
    });
  });

  describe('5.2 PATCH /productos/:id y ajuste masivo', () => {
    it.each([
      ['nombre de 200 caracteres', { nombre: 'n'.repeat(200) }],
      ['nombre número', { nombre: 5 }],
      ['precio enorme', { precio: 1e12 }],
      ['stock enorme', { stock: 99999999999 }],
    ])('PATCH con %s → 400', async (_n, body) => {
      await http
        .patch(`/productos/${idProducto}`)
        .set(ctx.auth('ADMIN'))
        .send(body)
        .expect(400);
    });

    it.each([
      [
        'porcentaje enorme (desbordaría decimal(10,2))',
        { tipo: 'PORCENTAJE', valor: 1e9 },
      ],
      ['fijo enorme', { tipo: 'FIJO', valor: 1e12 }],
      ['valor como texto', { tipo: 'FIJO', valor: '10' }],
      ['tipo inventado', { tipo: 'SUPER', valor: 10 }],
      ['porcentaje menor a -100', { tipo: 'PORCENTAJE', valor: -150 }],
      [
        'idCategoria inexistente',
        { tipo: 'FIJO', valor: 10, idCategoria: 999999 },
      ],
    ])('ajuste masivo: %s → 400 y ningún precio cambia', async (_n, body) => {
      const antes = await ctx.ds.query(
        'SELECT precio FROM products WHERE id_producto = ?',
        [idProducto],
      );
      await http
        .patch('/productos/precios/ajuste-masivo')
        .set(ctx.auth('ADMIN'))
        .send(body)
        .expect(400);
      const despues = await ctx.ds.query(
        'SELECT precio FROM products WHERE id_producto = ?',
        [idProducto],
      );
      expect(despues).toEqual(antes);
    });
  });

  describe('5.2 query strings y ids en la URL', () => {
    it.each([
      ['limit=abc', '/productos?limit=abc'],
      ['limit=1000000', '/productos?limit=1000000'],
      ['limit=0', '/productos?limit=0'],
      ['limit=-5', '/productos?limit=-5'],
      ['page=0', '/productos?page=0'],
      ['page=abc', '/productos?page=abc'],
      ['page enorme', '/productos?page=99999999999999999999'],
      ['categoriaId=abc', '/productos?categoriaId=abc'],
      ['search como array', '/productos?search[]=a&search[]=b'],
      ['search como objeto', '/productos?search[$gt]=a'],
      ['estado inventado en pedidos', '/ordenes/admin/listado?estado=HACKEADO'],
      ['limit enorme en pedidos', '/ordenes/admin/listado?limit=1000000'],
    ])('%s → 400', async (_n, url) => {
      const res = await http.get(url).set(ctx.auth('ADMIN'));
      expect(res.status).toBe(400);
    });

    it.each(['abc', '1.5', '-1abc'])(
      'GET /productos/%s → 400, nunca 500',
      async (id) => {
        const res = await http.get(`/productos/${id}`);
        expect(res.status).toBe(400);
      },
    );

    // Nest interpreta "1e3" y "0x10" como números: no es una falla, pero nunca puede ser 500
    it.each(['1e3', '0x10'])('GET /productos/%s no da 500', async (id) => {
      const res = await http.get(`/productos/${id}`);
      expect(res.status).toBeLessThan(500);
    });

    it.each(['99999999999', '-1', '0'])(
      'GET /productos/%s → 404, nunca 500',
      async (id) => {
        const res = await http.get(`/productos/${id}`);
        expect(res.status).toBe(404);
      },
    );
  });

  describe('6.4 límites de columna en usuarios, categorías y contacto (columnas varchar(60) / varchar(255))', () => {
    const registrar = (over: Record<string, unknown>) =>
      http
        .post('/auth/nuevo-usuario')
        .set(ctx.auth('ADMIN'))
        .send({
          nickUsuario: `nuevo_${Math.random().toString(36).slice(2, 8)}`,
          nombre: 'Nombre',
          apellido: 'Apellido',
          email: `n${Math.random().toString(36).slice(2, 8)}@example.com`,
          role: 'USER',
          password: 'Passw0rd!',
          ...over,
        });

    it.each([
      ['nombre número', { nombre: 123 }],
      ['nombre objeto', { nombre: {} }],
      ['nombre de 100 caracteres (columna: 60)', { nombre: 'n'.repeat(100) }],
      [
        'apellido de 100 caracteres (columna: 60)',
        { apellido: 'a'.repeat(100) },
      ],
      ['apellido número', { apellido: 5 }],
      [
        'nick de 100 caracteres (columna: 60)',
        { nickUsuario: 'n'.repeat(100) },
      ],
      ['email de 300 caracteres', { email: `${'a'.repeat(300)}@example.com` }],
      ['rol inventado', { role: 'SUPERADMIN' }],
      [
        'contraseña de 5000 caracteres (costo de argon2 sin tope)',
        { password: `A1${'x'.repeat(5000)}` },
      ],
    ])('registro con %s → 400', async (_n, over) => {
      const res = await registrar(over);
      expect(res.status).toBe(400);
    });

    it('editar-usuario con nombre número → 400 (no 500)', async () => {
      await http
        .patch(`/auth/editar-usuario/${ctx.users.USER_B.idUser}`)
        .set(ctx.auth('ADMIN'))
        .send({ nombre: 123 })
        .expect(400);
    });

    it('updateUser (autoservicio) con nombre número → 400 (no 500)', async () => {
      await http
        .patch(`/auth/updateUser/${ctx.users.USER_B.idUser}`)
        .set(ctx.auth('USER_B'))
        .send({ nombre: 123, currentPassword: 'Passw0rd!' })
        .expect(400);
    });

    it.each([
      [
        'categoría con nombre número',
        () =>
          http.post('/categorias').set(ctx.auth('ADMIN')).send({ nombre: 123 }),
      ],
      [
        'categoría con nombre de 300 caracteres (columna más corta)',
        () =>
          http
            .post('/categorias')
            .set(ctx.auth('ADMIN'))
            .send({ nombre: 'c'.repeat(300) }),
      ],
      [
        'contacto con nombre número',
        () =>
          http.post('/contacto').send({
            nombre: 123,
            email: 'a@example.com',
            mensaje: 'mensaje de prueba largo',
          }),
      ],
      [
        'contacto con mensaje número',
        () =>
          http.post('/contacto').send({
            nombre: 'Ana',
            email: 'a@example.com',
            mensaje: 1234567890123,
          }),
      ],
    ])('%s → 400', async (_n, llamar) => {
      const res = await llamar();
      expect(res.status).toBe(400);
    });

    it('un nombre de categoría duplicado da 409/400 con mensaje, no 500', async () => {
      await http
        .post('/categorias')
        .set(ctx.auth('ADMIN'))
        .send({ nombre: 'Duplicada' })
        .expect(201);
      const res = await http
        .post('/categorias')
        .set(ctx.auth('ADMIN'))
        .send({ nombre: 'Duplicada' });
      expect([400, 409]).toContain(res.status);
    });
  });
});
