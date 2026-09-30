// Fase 1 de la guía: inventario automático de endpoints + matriz de permisos.
// Cada endpoint × cada identidad, con ids inexistentes y cuerpos vacíos para
// no modificar nada. Falla si aparece un endpoint privado sin roles
// declarados o un endpoint público que no está en la lista aprobada.
import { RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';
import request from 'supertest';
import { ROLES_KEY } from '@/auth/decorators/roles.decorator';
import { createTestApp, Identity, PREFIX, TestContext } from './helpers';

interface RouteInfo {
  method: 'get' | 'post' | 'patch' | 'put' | 'delete';
  path: string;
  isPublic: boolean;
  roles?: string[];
}

/** Endpoints públicos aprobados a propósito (checkout de invitado,
 * catálogo, login, recuperación, contacto y webhook de Mercado Pago). Un
 * endpoint público nuevo NO está acá → el test falla y obliga a revisarlo. */
const PUBLICOS_APROBADOS = new Set([
  'POST /auth/login',
  'POST /auth/requestResetPassword',
  'POST /auth/resetPassword',
  'GET /productos',
  'GET /productos/:id',
  'GET /categorias',
  'POST /ordenes',
  'POST /ordenes/webhook',
  'GET /ordenes/webhook',
  'POST /contacto',
  'GET /contacto/whatsapp',
]);

function discoverRoutes(ctx: TestContext): RouteInfo[] {
  const routes: RouteInfo[] = [];
  const clean = (p: string) => p.replace(/^\/+|\/+$/g, '');

  for (const module of ctx.app.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      const controller = wrapper.metatype as any;
      if (!controller) continue;
      const base = clean(Reflect.getMetadata(PATH_METADATA, controller) ?? '');

      for (const name of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = controller.prototype[name];
        if (name === 'constructor' || typeof handler !== 'function') continue;
        const path = Reflect.getMetadata(PATH_METADATA, handler);
        if (path === undefined) continue;

        const guards: any[] = [
          ...(Reflect.getMetadata(GUARDS_METADATA, handler) ?? []),
          ...(Reflect.getMetadata(GUARDS_METADATA, controller) ?? []),
        ];
        const roles =
          Reflect.getMetadata(ROLES_KEY, handler) ??
          Reflect.getMetadata(ROLES_KEY, controller);

        routes.push({
          method: RequestMethod[
            Reflect.getMetadata(METHOD_METADATA, handler)
          ].toLowerCase() as RouteInfo['method'],
          path: `/${[base, clean(path)].filter(Boolean).join('/')}`,
          isPublic: !guards.some((g) => g?.name === 'AuthGuard'),
          roles,
        });
      }
    }
  }
  return routes;
}

type Esperado = 'allow' | 'deny' | 'unauthenticated' | 'undeclared';

function expectedAccess(route: RouteInfo, role: string | null): Esperado {
  if (route.isPublic) return 'allow';
  if (role === null) return 'unauthenticated';
  if (!route.roles?.length) return 'undeclared';
  if (role === 'ADMIN') return 'allow'; // ADMIN pasa el RolesGuard siempre
  return route.roles.includes(role) ? 'allow' : 'deny';
}

describe('Matriz de permisos (fase 1)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('descubre los endpoints desde el código', () => {
    const routes = discoverRoutes(ctx);
    // si esto baja de golpe, el descubrimiento dejó de funcionar
    expect(routes.length).toBeGreaterThanOrEqual(35);
  });

  it('solo hay endpoints públicos aprobados, y todo endpoint privado declara roles', () => {
    const fallas: string[] = [];
    for (const r of discoverRoutes(ctx)) {
      const clave = `${r.method.toUpperCase()} ${r.path}`;
      if (r.isPublic && !PUBLICOS_APROBADOS.has(clave)) {
        fallas.push(`${clave}: es público y no está en la lista aprobada`);
      }
      if (!r.isPublic && !r.roles?.length) {
        fallas.push(
          `${clave}: es privado pero no declara qué roles pueden usarlo`,
        );
      }
    }
    expect(fallas).toEqual([]);
  });

  it('cada endpoint responde según la matriz (401 / 403 / pasa) y nunca 500', async () => {
    const identidades: { role: string | null; id: Identity | null }[] = [
      { role: null, id: null },
      { role: 'ADMIN', id: 'ADMIN' },
      { role: 'USER', id: 'USER_A' },
      { role: 'GUEST', id: 'GUEST' },
    ];
    const fallas: string[] = [];

    for (const route of discoverRoutes(ctx)) {
      for (const ident of identidades) {
        const url = PREFIX + route.path.replace(/:\w+/g, '999999');
        ctx.clearRateLimits();

        let req = (request(ctx.server) as any)[route.method](url);
        if (ident.id) req = req.set(ctx.auth(ident.id));
        const res = ['get', 'delete'].includes(route.method)
          ? await req
          : await req.send({});

        const guardDenied =
          res.status === 403 && res.body?.message === 'Forbidden resource';
        const esperado = expectedAccess(route, ident.role);
        const etiqueta = `${route.method.toUpperCase()} ${route.path} como ${ident.role ?? 'anónimo'}`;

        if (esperado === 'undeclared') {
          fallas.push(`${etiqueta}: no declara quién puede usarlo`);
        } else if (esperado === 'unauthenticated' && res.status !== 401) {
          fallas.push(`${etiqueta}: esperaba 401, dio ${res.status}`);
        } else if (esperado === 'deny' && !guardDenied) {
          fallas.push(`${etiqueta}: esperaba 403 del guard, dio ${res.status}`);
        } else if (
          esperado === 'allow' &&
          (res.status === 401 || guardDenied)
        ) {
          fallas.push(`${etiqueta}: debía pasar el guard, dio ${res.status}`);
        }
        if (res.status >= 500) {
          fallas.push(`${etiqueta}: error interno ${res.status}`);
        }
      }
    }
    expect(fallas).toEqual([]);
  });

  it('la matriz no dejó datos de prueba en tablas de negocio', async () => {
    // con ids inexistentes y cuerpos vacíos nada debe haberse creado
    // (contact_settings y users se ignoran: la fila única de contacto se
    // crea sola al primer uso, y los 5 usuarios son los descartables)
    for (const t of ['products', 'categories', 'orders', 'order_items']) {
      const [{ n }] = await ctx.ds.query(`SELECT COUNT(*) AS n FROM \`${t}\``);
      expect([t, Number(n)]).toEqual([t, 0]);
    }
  });
});
