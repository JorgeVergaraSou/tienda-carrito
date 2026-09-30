// Fase 4 (5.11 de la guía): reglas de negocio de pedidos y webhook de Mercado
// Pago — estados imposibles, doble descuento de stock, concurrencia y pagos falsos.
import { InternalServerErrorException } from '@nestjs/common';
import {
  api,
  cerrar,
  createTestApp,
  crearProducto,
  fakeMercadoPago,
  fakePayments,
  TestContext,
} from './helpers';

describe('Pedidos y webhook de Mercado Pago (5.11)', () => {
  let ctx: TestContext;
  let http: ReturnType<typeof api>;
  let sigPago = 1000;

  beforeAll(async () => {
    ctx = await createTestApp();
    http = api(ctx);
  });
  afterAll(async () => cerrar(ctx));
  beforeEach(() => {
    ctx.clearRateLimits();
    fakePayments.clear();
    fakeMercadoPago.consultarPago.mockClear();
    fakeMercadoPago.crearPreferencia.mockClear();
  });

  const cuerpo = (items: { idProducto: number; cantidad: number }[]) => ({
    nombreContacto: 'Cliente Prueba',
    email: 'cliente@example.com',
    telefono: '1155551234',
    items,
  });
  const stockDe = async (id: number) =>
    Number(
      (
        await ctx.ds.query('SELECT stock FROM products WHERE id_producto = ?', [
          id,
        ])
      )[0].stock,
    );
  const filaOrden = async (id: number) =>
    (
      await ctx.ds.query(
        'SELECT estado, mercado_pago_payment_id AS pid FROM orders WHERE id_orden = ?',
        [id],
      )
    )[0];

  async function ordenar(idProducto: number, cantidad = 1) {
    const res = await http
      .post('/ordenes')
      .send(cuerpo([{ idProducto, cantidad }]))
      .expect(201);
    return res.body as { idOrden: number; total: number };
  }
  function pago(
    idOrden: number,
    status: string,
    extra: Record<string, unknown> = {},
  ) {
    const id = String(++sigPago);
    fakePayments.set(id, {
      id: Number(id),
      status,
      external_reference: String(idOrden),
      ...extra,
    });
    return id;
  }
  const notificar = (id: string | number) =>
    http
      .post('/ordenes/webhook')
      .send({ type: 'payment', data: { id: String(id) } });

  describe('crear el pedido', () => {
    it('el total y los precios salen de la base, el stock NO se descuenta y queda PENDING', async () => {
      const a = await crearProducto(ctx, { precio: 1500.5, stock: 10 });
      const b = await crearProducto(ctx, { precio: 200, stock: 10 });
      const res = await http
        .post('/ordenes')
        .send(
          cuerpo([
            { idProducto: a, cantidad: 2 },
            { idProducto: b, cantidad: 3 },
          ]),
        )
        .expect(201);
      expect(res.body.total).toBeCloseTo(1500.5 * 2 + 200 * 3, 2);
      expect(res.body.estado).toBe('PENDING');
      expect(await stockDe(a)).toBe(10);
      // a Mercado Pago se le mandan los precios de la base
      const orden = fakeMercadoPago.crearPreferencia.mock.calls[0][0];
      expect(
        orden.items
          .map((i: any) => Number(i.precioUnitario))
          .sort((x: number, y: number) => x - y),
      ).toEqual([200, 1500.5]);
    });

    it('el mismo producto repetido en dos renglones no permite superar el stock', async () => {
      const id = await crearProducto(ctx, { stock: 5 });
      const res = await http.post('/ordenes').send(
        cuerpo([
          { idProducto: id, cantidad: 5 },
          { idProducto: id, cantidad: 5 },
        ]),
      );
      expect(res.status).toBe(400);
    });

    it('un producto dado de baja no se puede pedir (400)', async () => {
      const id = await crearProducto(ctx, { stock: 5 });
      await ctx.ds.query(
        'UPDATE products SET deleted_at = NOW() WHERE id_producto = ?',
        [id],
      );
      await http
        .post('/ordenes')
        .send(cuerpo([{ idProducto: id, cantidad: 1 }]))
        .expect(400);
    });

    it('un producto sin stock no se puede pedir (400)', async () => {
      const id = await crearProducto(ctx, { stock: 0 });
      await http
        .post('/ordenes')
        .send(cuerpo([{ idProducto: id, cantidad: 1 }]))
        .expect(400);
    });

    it('un total que no entra en decimal(10,2) da 400, no 500', async () => {
      const id = await crearProducto(ctx, { precio: 99999999.99, stock: 100 });
      const res = await http
        .post('/ordenes')
        .send(cuerpo([{ idProducto: id, cantidad: 100 }]));
      expect(res.status).toBe(400);
    });

    it('si Mercado Pago falla no queda un pedido fantasma en la base', async () => {
      const id = await crearProducto(ctx, { stock: 5 });
      const [{ antes }] = await ctx.ds.query(
        'SELECT COUNT(*) AS antes FROM orders',
      );
      fakeMercadoPago.crearPreferencia.mockRejectedValueOnce(
        new InternalServerErrorException('MP caído'),
      );
      await http
        .post('/ordenes')
        .send(cuerpo([{ idProducto: id, cantidad: 1 }]))
        .expect(500);
      const [{ despues }] = await ctx.ds.query(
        'SELECT COUNT(*) AS despues FROM orders',
      );
      expect(Number(despues)).toBe(Number(antes));
    });
  });

  describe('webhook: el estado real se pide a Mercado Pago, no se confía en el body', () => {
    it('un pago aprobado marca PAID y descuenta el stock UNA vez', async () => {
      const id = await crearProducto(ctx, { stock: 10 });
      const o = await ordenar(id, 3);
      const p = pago(o.idOrden, 'approved');
      await notificar(p).expect(200);
      expect((await filaOrden(o.idOrden)).estado).toBe('PAID');
      expect(await stockDe(id)).toBe(7);
    });

    it('la misma notificación repetida (secuencial) no descuenta dos veces', async () => {
      const id = await crearProducto(ctx, { stock: 10 });
      const o = await ordenar(id, 2);
      const p = pago(o.idOrden, 'approved');
      for (let i = 0; i < 3; i++) await notificar(p).expect(200);
      expect(await stockDe(id)).toBe(8);
    });

    it('la misma notificación llegando EN PARALELO descuenta el stock una sola vez (concurrencia)', async () => {
      const id = await crearProducto(ctx, { stock: 100 });
      const o = await ordenar(id, 1);
      const p = pago(o.idOrden, 'approved');
      await Promise.all(Array.from({ length: 10 }, () => notificar(p)));
      expect(await stockDe(id)).toBe(99);
      expect((await filaOrden(o.idOrden)).estado).toBe('PAID');
    });

    it('pagos DISTINTOS del mismo producto llegando en paralelo no pierden descuentos (lost update)', async () => {
      const id = await crearProducto(ctx, { stock: 100 });
      const ordenes = [];
      for (let i = 0; i < 10; i++) ordenes.push(await ordenar(id, 1));
      await Promise.all(
        ordenes.map((o) => notificar(pago(o.idOrden, 'approved'))),
      );
      expect(await stockDe(id)).toBe(90);
    });

    it('el body dice "approved" pero Mercado Pago dice "pending" → no cambia nada', async () => {
      const id = await crearProducto(ctx, { stock: 10 });
      const o = await ordenar(id);
      const p = pago(o.idOrden, 'pending');
      await http
        .post('/ordenes/webhook')
        .send({
          type: 'payment',
          status: 'approved',
          data: { id: p, status: 'approved' },
        })
        .expect(200);
      expect((await filaOrden(o.idOrden)).estado).toBe('PENDING');
      expect(await stockDe(id)).toBe(10);
    });

    it('un id de pago que no existe en Mercado Pago → 200 y no cambia nada', async () => {
      const id = await crearProducto(ctx, { stock: 10 });
      const o = await ordenar(id);
      await notificar('999999999').expect(200);
      expect((await filaOrden(o.idOrden)).estado).toBe('PENDING');
    });

    it('un pago con external_reference de un pedido inexistente → 200, sin efectos', async () => {
      const p = pago(99999999, 'approved');
      await notificar(p).expect(200);
    });

    it.each([
      ['id con recorrido de ruta', '1/../../customers/search'],
      ['id con query', '1?access_token=x'],
      ['id con letras', 'abc'],
      ['id enorme', '9'.repeat(200)],
    ])(
      '%s: el id NUNCA se manda tal cual a la API de Mercado Pago',
      async (_n, raro) => {
        await notificar(raro).expect(200);
        expect(fakeMercadoPago.consultarPago).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['type objeto', { type: { a: 1 }, data: { id: '1' } }],
      ['data null', { type: 'payment', data: null }],
      ['data.id objeto', { type: 'payment', data: { id: { $gt: 0 } } }],
      ['body vacío', {}],
      ['array', [1, 2, 3]],
    ])('body raro (%s) → 200 sin 500', async (_n, body) => {
      const res = await http.post('/ordenes/webhook').send(body as any);
      expect(res.status).toBe(200);
    });

    it('formato IPN viejo por GET (?topic=payment&id=) funciona igual', async () => {
      const id = await crearProducto(ctx, { stock: 10 });
      const o = await ordenar(id);
      const p = pago(o.idOrden, 'approved');
      await http
        .get('/ordenes/webhook')
        .query({ topic: 'payment', id: p })
        .expect(200);
      expect((await filaOrden(o.idOrden)).estado).toBe('PAID');
    });

    it('un pago rechazado y luego reintentado y aprobado en el mismo pedido termina PAID (Mercado Pago permite reintentar)', async () => {
      const id = await crearProducto(ctx, { stock: 10 });
      const o = await ordenar(id, 2);
      await notificar(pago(o.idOrden, 'rejected')).expect(200);
      await notificar(pago(o.idOrden, 'approved')).expect(200);
      expect((await filaOrden(o.idOrden)).estado).toBe('PAID');
      expect(await stockDe(id)).toBe(8);
    });

    it('un pedido ya PAID no vuelve atrás por una notificación posterior de rechazo', async () => {
      const id = await crearProducto(ctx, { stock: 10 });
      const o = await ordenar(id);
      await notificar(pago(o.idOrden, 'approved')).expect(200);
      await notificar(pago(o.idOrden, 'rejected')).expect(200);
      expect((await filaOrden(o.idOrden)).estado).toBe('PAID');
    });

    it('el stock nunca queda negativo si hubo sobreventa (queda en 0)', async () => {
      const id = await crearProducto(ctx, { stock: 2 });
      const o1 = await ordenar(id, 2);
      const o2 = await ordenar(id, 2);
      await notificar(pago(o1.idOrden, 'approved')).expect(200);
      await notificar(pago(o2.idOrden, 'approved')).expect(200);
      expect(await stockDe(id)).toBe(0);
    });

    it('el webhook (público, dispara consultas a Mercado Pago) tiene límite por IP', async () => {
      const estados: number[] = [];
      for (let i = 0; i < 150; i++) estados.push((await notificar('1')).status);
      expect(estados).toContain(429);
    });
  });

  describe('ajuste masivo de precio', () => {
    it('un ajuste válido cambia el precio y nunca deja negativos', async () => {
      const id = await crearProducto(ctx, { precio: 100 });
      await http
        .patch('/productos/precios/ajuste-masivo')
        .set(ctx.auth('ADMIN'))
        .send({ tipo: 'FIJO', valor: -5000 })
        .expect(200);
      const [{ precio }] = await ctx.ds.query(
        'SELECT precio FROM products WHERE id_producto = ?',
        [id],
      );
      expect(Number(precio)).toBe(0);
    });
  });
});
