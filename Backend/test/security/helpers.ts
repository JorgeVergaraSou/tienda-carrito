// Utilidades compartidas por las baterías de seguridad (test/security/*).
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerStorage } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import * as argon2 from 'argon2';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import * as http from 'http';
import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';
import { MercadoPagoService } from '@/mercadopago/mercadopago.service';
import { OrderEntity } from '@/orders/entities/order.entity';
import type { SentMail } from './setup-after-env';

export const PASSWORD = 'Passw0rd!';
export const PREFIX = '/tienda-carrito/v1';

export type Identity = 'ADMIN' | 'ADMIN2' | 'USER_A' | 'USER_B' | 'GUEST';

export interface TestUser {
  idUser: number;
  nickUsuario: string;
  role: 'ADMIN' | 'USER' | 'GUEST';
  token: string;
}

/** Pagos "de Mercado Pago" que consultarPago puede devolver — nada sale a
 * la red real. Cada test los registra con `fakePayments.set(id, {...})`. */
export const fakePayments = new Map<string, Record<string, unknown>>();

export const fakeMercadoPago = {
  crearPreferencia: jest.fn(async (order: OrderEntity) => ({
    id: `pref-${order.idOrden}`,
    initPoint: 'https://sandbox.mercadopago.test/checkout',
  })),
  consultarPago: jest.fn(
    async (id: string) => fakePayments.get(String(id)) ?? null,
  ),
};

export const sentMails = (): SentMail[] => (global as any).__sentMails;
export const clearMails = () => ((global as any).__sentMails.length = 0);

export interface TestContext {
  app: NestExpressApplication;
  server: any;
  ds: DataSource;
  users: Record<Identity, TestUser>;
  port: number;
  clearRateLimits: () => void;
  auth: (identity: Identity | string) => { Authorization: string };
}

/** Levanta la app igual que main.ts (configureApp) contra la base de tests,
 * con Mercado Pago simulado, y crea un usuario descartable por rol. */
export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MercadoPagoService)
    .useValue(fakeMercadoPago)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: false,
  });
  configureApp(app, {
    log: () => undefined,
    error: () => undefined,
    warn: () => undefined,
  });
  await app.init();
  // escucha en un puerto libre de 127.0.0.1: hace falta para las pruebas
  // "crudas" (rawRequest) donde el cliente HTTP no debe normalizar la URL.
  await app.listen(0, '127.0.0.1');

  const ds = app.get(DataSource);

  // segunda barrera (la primera está en setup-env.ts): la conexión REAL
  // tiene que apuntar a una base de tests.
  const [{ db }] = await ds.query('SELECT DATABASE() AS db');
  if (!/_e2e$/.test(db)) {
    await app.close();
    throw new Error(`ABORTADO: conectado a "${db}", no es una base _e2e`);
  }

  const ctx: TestContext = {
    app,
    server: app.getHttpServer(),
    port: (app.getHttpServer().address() as { port: number }).port,
    ds,
    users: {} as Record<Identity, TestUser>,
    clearRateLimits: () => {
      (app.get(ThrottlerStorage) as any).storage.clear();
    },
    auth: (identity) => ({
      Authorization: `Bearer ${
        (ctx.users as any)[identity]?.token ?? identity
      }`,
    }),
  };

  await resetDatabase(ds);
  await seedUsers(ctx);
  return ctx;
}

const TABLAS = [
  'order_items',
  'orders',
  'product_images',
  'products',
  'categories',
  'contact_settings',
  'users',
];

/** vacía TODAS las tablas de la base de tests (nunca la real: ver guardas) */
export async function resetDatabase(ds: DataSource): Promise<void> {
  await ds.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of TABLAS) await ds.query(`DELETE FROM \`${t}\``);
  await ds.query('SET FOREIGN_KEY_CHECKS = 1');
}

/** cuenta filas de todas las tablas: se usa al cerrar para verificar que no
 * queda ningún dato de prueba (guía, punto 0.6). */
export async function countAllRows(ds: DataSource): Promise<number> {
  let total = 0;
  for (const t of TABLAS) {
    const [{ n }] = await ds.query(`SELECT COUNT(*) AS n FROM \`${t}\``);
    total += Number(n);
  }
  return total;
}

async function seedUsers(ctx: TestContext): Promise<void> {
  const hash = await argon2.hash(PASSWORD);
  const jwt = ctx.app.get(JwtService);
  const defs: [Identity, string, 'ADMIN' | 'USER' | 'GUEST'][] = [
    ['ADMIN', 'admin_e2e', 'ADMIN'],
    ['ADMIN2', 'admin2_e2e', 'ADMIN'],
    ['USER_A', 'user_a_e2e', 'USER'],
    ['USER_B', 'user_b_e2e', 'USER'],
    ['GUEST', 'guest_e2e', 'GUEST'],
  ];

  for (const [identity, nick, role] of defs) {
    const res = await ctx.ds.query(
      `INSERT INTO users (nick_usuario, nombre, apellido, email, password, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nick, nick, 'E2E', `${nick}@example.com`, hash, role],
    );
    const idUser = Number(res.insertId);
    ctx.users[identity] = {
      idUser,
      nickUsuario: nick,
      role,
      token: await jwt.signAsync({
        idUser,
        nickUsuario: nick,
        role,
        name: nick,
      }),
    };
  }
}

let contadorUsuarios = 0;

/** crea un usuario descartable extra (con su token) — para los tests que
 * modifican al usuario (baja, cambio de rol/clave) sin ensuciar a los 5
 * usuarios base que comparten las demás pruebas. */
export async function crearUsuario(
  ctx: TestContext,
  opts: {
    role?: 'ADMIN' | 'USER' | 'GUEST';
    email?: string | null;
    password?: string;
    nick?: string;
  } = {},
): Promise<TestUser & { password: string }> {
  const nick = opts.nick ?? `extra${++contadorUsuarios}_${process.pid}`;
  const role = opts.role ?? 'USER';
  const password = opts.password ?? PASSWORD;
  const email = opts.email === undefined ? `${nick}@example.com` : opts.email;
  const res = await ctx.ds.query(
    `INSERT INTO users (nick_usuario, nombre, apellido, email, password, role)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [nick, nick, 'E2E', email, await argon2.hash(password), role],
  );
  const idUser = Number(res.insertId);
  const token = await ctx.app
    .get(JwtService)
    .signAsync({ idUser, nickUsuario: nick, role, name: nick });
  return { idUser, nickUsuario: nick, role, token, password };
}

/** crea una categoría + producto directo en la base (rápido, sin pasar por
 * la API) para los tests que necesitan datos de partida. */
export async function crearProducto(
  ctx: TestContext,
  opts: {
    nombre?: string;
    precio?: number;
    stock?: number;
    creadoPor?: Identity | null;
  } = {},
): Promise<number> {
  const res = await ctx.ds.query(
    `INSERT INTO products (nombre, precio, stock, creado_por_id) VALUES (?, ?, ?, ?)`,
    [
      opts.nombre ?? `Producto e2e ${Math.random().toString(36).slice(2, 8)}`,
      opts.precio ?? 1000,
      opts.stock ?? 10,
      opts.creadoPor === null
        ? null
        : ctx.users[opts.creadoPor ?? 'ADMIN'].idUser,
    ],
  );
  return Number(res.insertId);
}

export const api = (ctx: TestContext) => ({
  get: (url: string) => request(ctx.server).get(PREFIX + url),
  post: (url: string) => request(ctx.server).post(PREFIX + url),
  patch: (url: string) => request(ctx.server).patch(PREFIX + url),
  delete: (url: string) => request(ctx.server).delete(PREFIX + url),
});

/** busca un texto en todos los archivos de log escritos durante la corrida */
export function grepLogs(needle: string): string[] {
  const dir = join(process.env.E2E_WORKDIR as string, 'logs');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => readFileSync(join(dir, f), 'utf8').includes(needle))
    .map((f) => f);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** cierre de cada batería: borra TODO dato de prueba y verifica con una
 * consulta que la cuenta es 0 (guía, punto 0.6) antes de cerrar la app. */
export async function cerrar(ctx: TestContext): Promise<void> {
  await resetDatabase(ctx.ds);
  const restantes = await countAllRows(ctx.ds);
  await ctx.app.close();
  if (restantes !== 0) {
    throw new Error(`Quedaron ${restantes} filas de prueba en la base _e2e`);
  }
}

/** PNG válido de 1×1 px (para las pruebas de subida de archivos) */
export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** archivos actuales de uploads/<subcarpeta> del directorio de trabajo de
 * los tests (nunca el uploads/ real: setup-env hace chdir a un temporal) */
export function archivosSubidos(sub: 'products' | 'avatars'): string[] {
  const dir = join(process.env.E2E_WORKDIR as string, 'uploads', sub);
  return existsSync(dir) ? readdirSync(dir) : [];
}

/** pedido HTTP sin ninguna normalización de la URL (`..`, `%2e%2e`, `%5c`
 * viajan tal cual) — supertest/fetch los "arreglarían" antes de enviarlos. */
export function rawRequest(
  ctx: TestContext,
  path: string,
  opts: {
    method?: string;
    headers?: Record<string, string>;
    body?: string | Buffer;
  } = {},
): Promise<{
  status: number;
  body: string;
  headers: http.IncomingHttpHeaders;
}> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: ctx.port,
        path,
        method: opts.method ?? 'GET',
        headers: opts.headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
            headers: res.headers,
          }),
        );
      },
    );
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}
