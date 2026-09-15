# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es esto

Backend de **una tienda online real**, en NestJS (v11) + MySQL + TypeORM. Arrancó como
"base-auth-backend" — una plantilla de auth reutilizable ("proyectos hijos de esta base", según
los comentarios del código) — y a partir de ahí se le construyó encima el dominio de negocio real
de la tienda. Trae auth por JWT, roles, hasheo de passwords con argon2, subida de imágenes,
recuperación de contraseña por email, y logging/auditoría estructurada con Winston. Base de datos:
`tienda` (MySQL local). Prefijo global de la API: `tienda/v1` (no `auth/v2`, el de la plantilla
sin modificar).

**Módulos**: `auth`/`users` (heredados de la plantilla, sin tocar su arquitectura) + `products` y
`categories` (negocio real de la tienda, agregados después — ver más abajo). Roles: `ADMIN`,
`USER`, `GUEST` (`src/common/enums/role.enum.ts`).

Los comentarios en todo el código están en español y suelen ser sustanciosos (explican el *por
qué*, no solo el *qué* — sobre todo en los trade-offs de seguridad). Leelos antes de tocar lógica
cercana, y mantené ese mismo estilo (español, con la razón por delante) en comentarios nuevos, en
vez de pasarte a inglés.

## Comandos

```bash
npm run start:dev      # servidor de dev con watch (nest start --watch)
npm run start:debug     # servidor de dev con --inspect + watch
npm run build           # nest build -> dist/
npm run start:prod      # node dist/main (después de build)

npm run lint            # eslint --fix sobre src/apps/libs/test
npm run format           # prettier --write src/**/*.ts test/**/*.ts

npm test                 # tests unitarios (jest, rootDir: src, *.spec.ts junto al código fuente)
npm run test:watch
npm run test:cov
npm run test:e2e         # tests e2e, config en test/jest-e2e.json

# un solo archivo de test:
npx jest src/auth/auth.service.spec.ts
# un solo test por nombre:
npx jest src/auth/auth.service.spec.ts -t "nombre del test"
```

El CI (`.github/workflows/ci.yml`) corre en cada push/PR: `npm ci`, `lint`, `build`, `test`,
`test:e2e`, contra un contenedor real de MySQL 8. `DB_PASSWORD` es obligatoria pero puede ser un
string vacío (`Joi.string().allow('').required()`); `SECRET_WORD` debe tener al menos 16
caracteres.

**Gotcha de dev — no correr `npm run build` mientras `npm run start:dev` está corriendo**: los
dos compilan a `dist/` en paralelo y se pisan (`MODULE_NOT_FOUND` / `EADDRINUSE` al reiniciar).
Si necesitás un build limpio con el watcher activo, primero matá el proceso de `start:dev` (o
dejá que su propia recompilación incremental valide el cambio) y recién ahí corré `build`.

**Gotcha de editor — VS Code puede marcar errores en `tsconfig.json` que el build real no tiene**
(reporte del usuario, con captura del panel de Problemas). Dos causas distintas, dos arreglos
distintos:
- **`rootDir` y `test/**/*` no coincidían**: `tsconfig.json` (el que usan el editor y `ts-jest` —
  `package.json` no le pasa un `tsConfig` propio) tenía `rootDir: "./src"` pero también incluye
  `test/**/*` en su `include`, que queda fuera de ese `rootDir` — TS6059 en el editor. Nunca
  rompió nada real porque `npm run build` (`nest build`) usa `tsconfig.build.json`, que excluye
  `test/` y **no** tenía `rootDir` propio (lo heredaba del padre). Arreglo: `rootDir` se movió de
  `tsconfig.json` a `tsconfig.build.json` (el único que de verdad compila a `dist/`) — la
  estructura de `dist/` queda idéntica (verificado con `rm -rf dist && npm run build`), y
  `tsconfig.json` ya no fuerza un `rootDir` que test/ viola.
- **`moduleResolution`/`baseUrl` "deprecados"**: el editor pedía `"ignoreDeprecations": "6.0"`,
  pero la versión real de TypeScript de este proyecto (5.8.3, `package.json`) **no reconoce ese
  valor** — probado: romper `npm run build` con `TS5103: Invalid value for --ignoreDeprecations`
  en el momento. Quedó en `"5.0"` (el valor correcto para la versión instalada). Si VS Code sigue
  marcándolo, es porque el editor está tipando con una versión de TypeScript más nueva que la
  instalada acá — se soluciona desde VS Code (`Ctrl+Shift+P` → "TypeScript: Select TypeScript
  Version" → "Use Workspace Version"), no subiendo este número a algo que el compilador real de
  este proyecto no entiende.
- Verificado: `rm -rf dist && npm run build` limpio, `npx tsc --noEmit -p tsconfig.json` sin
  errores (antes tiraba TS6059), `npx jest` 37/37.

## Variables de entorno

La configuración se valida de entrada al bootear, con un schema de Joi en
[app.module.ts](src/app.module.ts) — la app **se niega a arrancar** si falta alguna variable
requerida, en vez de bootear silenciosamente con, por ejemplo, un secreto de JWT undefined. Ver
[.env.example](.env.example) para la lista completa con comentarios por variable. Las más
relevantes:

- `SEED_ADMIN_NICK` / `SEED_ADMIN_PASSWORD` (+ `SEED_ADMIN_EMAIL` opcional): como crear usuarios
  requiere ya tener un ADMIN (`POST /auth/nuevo-usuario` es solo para ADMIN, no hay signup
  público), una base nueva no tiene forma de crear su primer usuario. Si están seteadas y todavía
  no existe ningún ADMIN, se crea uno automáticamente al arrancar
  (`AppService.seedInitialAdmin`, en [app.service.ts](src/app.service.ts)). Sacar estas variables
  del `.env` después del primer arranque.
- `CORS_ORIGIN`: lista de orígenes permitidos separada por comas; sin definir, cae a `*`
  (comportamiento de desarrollo).
- `FRONTEND_URL`: se usa para armar el link de recuperación de contraseña que se manda por mail.

## Arquitectura

**Estructura de módulos**: `AppModule` arma la infraestructura global (Config/validación con Joi,
Winston, Throttler, TypeORM) e importa `AuthModule`, que a su vez importa `UsersModule`.
`UsersModule`/`UsersService` son dueños de `UserEntity` (tabla `users`) y de todo el acceso a la
base; `AuthController`/`AuthService` son la única capa expuesta por HTTP — no hay un
`UsersController` separado (la gestión de usuarios se expone a través de rutas `/auth/*`:
`nuevo-usuario`, `listar-usuarios`, `dar-de-baja-usuario/:id`, `activar-usuario/:id`,
`updateUser/:id`, `foto`, `profile`).

**Productos y categorías** (`ProductsModule`/`CategoriesModule`, agregados sobre la base de auth):
- `CategoryEntity` (tabla `categories`): `idCategoria`, `nombre` (único), soft-delete. El ADMIN
  las crea/renombra/da de baja/reactiva libremente desde `CategoriesController`
  (`GET /categorias` público, resto `@Auth(Role.ADMIN)`) — a propósito no es un enum: así agregar
  una categoría nueva no requiere tocar código ni rebuildear ni el back ni el front.
- `ProductEntity` (tabla `products`): `nombre`, `descripcion`, `precio` (decimal con transformer a
  number — el driver de MySQL devuelve DECIMAL como string), `stock`, `imageFile` (mismo patrón
  que `UserEntity.imageFile`: solo el nombre de archivo, servido desde `/uploads/products/`) como
  **portada/imagen principal**, soft-delete, `categoria` como relación
  `@ManyToOne(() => CategoryEntity)` (FK `id_categoria`, nullable), y `creadoPor` como relación
  `@ManyToOne(() => UserEntity)` (FK `creado_por_id`, nullable) — quién cargó el producto, seteado
  una sola vez al crear (ver más abajo). `ProductsService` valida el `idCategoria` que manda el
  cliente contra una categoría real (`CategoriesService.findActivaByIdOrThrow`, 400 si no existe)
  — `ProductsModule` importa `CategoriesModule` para esto.
- **Galería de fotos** (`ProductImageEntity`, tabla `product_images`, agregada después de
  `imageFile`): un producto puede tener además **0 o más fotos adicionales**, cada una su propia
  fila (`id_producto_imagen`, `producto_id` FK a `products`, `image_file`, `created_at`) — se
  agregan/eliminan de a una, nunca se reemplazan todas juntas. Deliberadamente **no** reemplaza a
  `imageFile`: la portada sigue siendo `imageFile` con su mismo endpoint de siempre
  (`POST /productos/:id/imagen`, que la reemplaza); la galería es un mecanismo aparte y conviven
  los dos (menor radio de impacto: no rompe los 5 lugares del frontend que ya leían
  `imageUrl` como string único). Sin soft-delete en `ProductImageEntity` a propósito — no hay caso
  de uso de "restaurar una foto borrada", así que `eliminarFoto` borra la fila y el archivo del
  disco a la vez. **Migración de datos legacy**: como no hay sistema de migraciones en este
  proyecto (`synchronize: true`, ver más abajo), `ProductsService` implementa
  `OnApplicationBootstrap` y en cada arranque (`migrarImagenesLegacy`, idempotente) recorre los
  productos con `imageFile` no nulo y sin ninguna fila todavía en `product_images`, y les crea una
  — pero **duplicando el archivo** (nombre nuevo por UUID) en vez de referenciar el mismo nombre
  que `imageFile`: si compartieran archivo, un reemplazo posterior de la portada
  (`actualizarImagen`, que borra el archivo viejo del disco) dejaría la foto migrada apuntando a
  un archivo borrado. Con la copia, portada y galería quedan desacopladas para siempre desde el
  momento de la migración.
- **Permisos de `ProductsController`**: `GET /productos` y `GET /productos/:id` públicos
  (catálogo). `POST /productos` (crear), `POST /productos/:id/imagen` (subir/cambiar portada),
  `POST /productos/:id/fotos` (agregar una foto a la galería) y
  `DELETE /productos/:id/fotos/:idFoto` (eliminar una foto puntual de la galería, por su ID) son
  `@Auth(Role.ADMIN, Role.USER)` — el resto (`PATCH/DELETE /productos/:id`, `/activar`,
  `GET /productos/admin/listado`, `GET /productos/admin/:id`) sigue siendo `@Auth(Role.ADMIN)`
  exclusivo. Un USER puede cargar productos nuevos y subirles/agregarles/quitarles fotos, pero
  **no** editarlos, darlos de baja/reactivarlos, ni tocar categorías — ese límite no lo puede
  expresar el `RolesGuard` (no sabe de quién es cada producto), así que
  `ProductsService.actualizarImagen`/`agregarFoto`/`eliminarFoto` chequean a mano
  `product.creadoPor?.idUser === activeUser.idUser` cuando `activeUser.role !== Role.ADMIN`, y
  tiran `ForbiddenException` si no coincide — el chequeo es siempre sobre el dueño del *producto*,
  nunca sobre la foto en sí (`ProductImageEntity` no tiene su propio `creadoPor`). `ADMIN` no tiene
  esta restricción. `eliminarFoto` además valida que la foto (`idFoto`) pertenezca al producto
  (`:id`) de la URL — si no, 404, no solo 403 — para que un USER dueño de su propio producto no
  pueda borrar, adivinando el ID, una foto de un producto ajeno. Controller y service reciben el
  usuario activo vía `@ActiveUser()` (mismo decorador que usa `auth/`).
- `GET /productos`, `GET /productos/:id`, `GET /productos/admin/:id` y
  `GET /productos/mis-productos` devuelven `ProductResponseDto` con `imageUrl` (portada, como
  siempre) **y** `fotos: ProductImageResponseDto[]` (galería, siempre un array — vacío si no tiene
  fotos adicionales, nunca `undefined`).
- **Visibilidad del stock** (`ProductEntity.mostrarStock`, `boolean`, `default: true` — pedido
  explícito del usuario): el dueño de un producto puede elegir que el número de `stock` no se
  muestre a los clientes. La columna no cambia nada de la lógica de stock en sí, solo si las
  lecturas **públicas** revelan el número real: `ProductsService.toPublicResponseDto` envuelve a
  `toResponseDto` y devuelve `stock: null` en vez del número cuando `mostrarStock` es `false` — se
  usa en `findOneActivo` (`GET /productos/:id`) y en `buscarProductos` cuando
  `incluirInactivos: false` (`GET /productos`, es decir `findAllActivos`). Las vistas privilegiadas
  (`findAllAdmin`, `findMisProductos`, `findOneAdmin`, y la respuesta de cualquier mutación) siempre
  usan `toResponseDto` directo — ADMIN y el USER dueño del producto necesitan ver el stock real para
  gestionar su inventario, la preferencia solo afecta lo que ve un cliente anónimo. `mostrarStock`
  en sí viaja siempre con su valor real en el DTO, incluso en las respuestas públicas — no es dato
  sensible, y el frontend lo necesita para no confundir "stock null porque está oculto" con "stock
  0 porque no hay". `CreateProductDto`/`UpdateProductDto` aceptan `mostrarStock` opcional (si se
  omite, aplica el default de la columna). Como `PATCH /productos/:id` (el edit general) sigue
  siendo `@Auth(Role.ADMIN)` exclusivo, existe un endpoint dedicado
  `PATCH /productos/:id/visibilidad-stock` (`UpdateStockVisibilityDto`, body `{ mostrarStock }`)
  `@Auth(Role.ADMIN, Role.USER)` con el mismo chequeo de ownership que `actualizarImagen`/`activar` —
  así un USER puede tocar únicamente este campo en un producto propio sin que haga falta abrirle el
  PATCH general (que sigue dejando editar nombre/precio/etc. solo a ADMIN).
- `GET /productos/admin/:id` (ADMIN): a diferencia del `GET /productos/:id` público, sí devuelve
  productos dados de baja — lo usa la página de editar producto del frontend, que se puede cargar
  directo por URL (no solo navegando desde un listado que ya tiene los datos en memoria).
  Declarado DESPUÉS de `admin/listado` en el controller — misma forma de ruta
  (`admin/<segmento>`), así que si se invierte el orden Nest intentaría matchear "listado" como si
  fuera el `:id`.
- `GET /productos/mis-productos` (`@Auth(Role.ADMIN, Role.USER)`): los productos que el usuario
  activo cargó él mismo (`creadoPor.idUser === activeUser.idUser`), incluidos los dados de baja —
  mismo criterio que `admin/:id`, para que el dueño de un producto lo pueda encontrar y reactivar
  si lo dio de baja por error. Reutiliza `FindProductsQueryDto`/`PaginatedProductsResponseDto`
  (misma convención que `admin/listado`): `ProductsService.buscarProductos` ganó un tercer
  parámetro opcional `creadoPorId` que arma `where.creadoPor = { idUser: creadoPorId }`, en vez de
  duplicar la query. **Ojo con el orden de rutas**: `mis-productos` tiene la misma forma que el
  público `GET /productos/:id` (`productos/<segmento>`), así que está declarado ANTES de ese
  `:id` — mismo motivo que `admin/listado` vs `admin/:id`.
- `PATCH /productos/:id/activar` (reactivar) es `@Auth(Role.ADMIN, Role.USER)` — ADMIN puede
  reactivar cualquier producto; USER solo el que él mismo cargó (mismo chequeo de ownership que
  `actualizarImagen`: `product.creadoPor?.idUser === activeUser.idUser` cuando
  `activeUser.role !== Role.ADMIN`, `ForbiddenException` si no coincide). Editar
  (`PATCH /productos/:id`) y dar de baja (`DELETE /productos/:id`) siguen siendo
  `@Auth(Role.ADMIN)` exclusivo — **no** tienen el mismo tratamiento que `activar`/`actualizarImagen`,
  ojo con asumir que USER puede tocar cualquiera de las cuatro acciones "de su propio producto" por
  igual: solo puede crear, subir imagen y reactivar; nunca editar ni dar de baja.
- **Gotcha de TypeORM ya resuelto**: al soft-deletear una categoría, cualquier query con
  `relations: ['categoria']` que NO pida `withDeleted: true` filtra la fila relacionada del JOIN
  aunque el producto en sí siga activo — el producto terminaba mostrando `categoria: null` para el
  cliente público apenas alguien daba de baja su categoría. Se resuelve pidiendo siempre
  `withDeleted: true` en `ProductsService.buscarProductos`/`findOneActivo` y agregando el filtro de
  "solo activos" a mano con `where.deletedAt = IsNull()` — así dar de baja una categoría nunca
  rompe los productos que ya la tenían asignada, solo deja de ofrecerse para asignaciones nuevas.
- Ambos módulos siguen al pie la letra las mismas convenciones que `users`: soft-delete +
  `restore()` para dar de baja/reactivar, `handleServiceError` en cada catch, un logger de módulo
  propio en `module-loggers.ts` (`productsErrorLogger`, `categoriesErrorLogger`), y
  `insertLogger`/`updateLogger`/`deleteLogger` de `db-loggers.ts` después de cada mutación.

**CRUD de usuarios para ADMIN** (pedido explícito del usuario): además de lo que ya existía
(`POST /auth/nuevo-usuario` crear, `GET /auth/listar-usuarios` listar, `DELETE
/auth/dar-de-baja-usuario/:id` + `PATCH /auth/activar-usuario/:id` dar de baja/reactivar — los
cuatro `@Auth(Role.ADMIN)`, todos ya existían), se agregó `PATCH /auth/editar-usuario/:id`
(`@Auth(Role.ADMIN)`, `AdminUpdateUserDto`) — antes un ADMIN no tenía forma de editar los datos de
**otro** usuario: el único endpoint de edición (`PATCH /auth/updateUser/:id`, autoservicio) exige
que `:id` coincida con el propio usuario del JWT (`ForbiddenException` si no) y pide
`currentPassword` para confirmar. El nuevo `UsersService.actualizarUsuarioAdmin`
(`AdminUpdateUserDto`: `nickUsuario`/`nombre`/`apellido`/`email`/`role`/`password`, todos
opcionales) es deliberadamente distinto de `updateUser` (autoservicio, sin tocar): no pide
contraseña — ni la del usuario editado (el ADMIN no la conoce) ni la propia (el ADMIN ya está
autenticado por su JWT) — y además permite cambiar `role` y setear una `password` nueva
directamente, pensado para recuperar el acceso de un usuario que la perdió (no pasa por el flujo
de reset por email).

**Protección del último ADMIN** (pedido explícito del usuario, motivado por el CRUD de arriba: con
un panel que hace mucho más fácil dar de baja o cambiar el rol de cualquiera por error, hacía falta
esta protección que antes no existía): `UsersService.esUnicoAdminActivo()` (privado, cuenta
`role: ADMIN` con `.count()` sin `withDeleted:true` — ya excluye soft-deleted por default) se
consulta en dos lugares, siempre cuando el usuario en cuestión YA es `ADMIN` activo (si el conteo
da `<= 1` en ese momento, tiene que ser justo ese): `darDeBajaUsuario` (400 "No podés dar de baja al
único administrador activo") y `actualizarUsuarioAdmin` cuando `dto.role` cambia a algo distinto de
`ADMIN` (400 "No podés quitarle el rol de administrador al único administrador activo"). No hay
protección equivalente contra editar/dar de baja tu propia cuenta desde este panel siendo el único
ADMIN de otra forma que no sea cambiar el rol o darte de baja — ambas caen en los mismos chequeos.

**Página pública de contacto** (`ContactModule`, nuevo — pedido explícito del usuario: los
clientes tienen que poder mandarle un mensaje al negocio). Un solo módulo cubre las dos caras
(configuración + envío):
- `ContactSettingsEntity` (tabla `contact_settings`) es una fila **única** — `@PrimaryColumn` con
  la PK fija en `1` (no `@PrimaryGeneratedColumn`), a propósito: nunca hay más de una config de
  contacto, así que no tiene sentido un id autoincremental. `ContactService.getOrCrearSettings`
  (privado) la crea con `email`/`whatsapp` en `null` la primera vez que hace falta, sin necesidad de
  seed.
- `PATCH /contacto/configuracion` (`@Auth(Role.ADMIN)`, `UpdateContactSettingsDto`) — el email y el
  WhatsApp donde el negocio recibe los mensajes. **No** es parte de `UpdateUserDto`/`User` — es una
  config del negocio, no de una cuenta personal (puede haber varios ADMIN, ver `users/`). A
  diferencia del resto de los PATCH de este proyecto (donde omitir un campo = no tocarlo),
  `email`/`whatsapp` aceptan `null` explícito para vaciarlos — el form de configuración del frontend
  siempre manda los dos campos con lo que haya en los inputs, no hace falta la distinción
  "no tocar" vs "vaciar".
- `POST /contacto` (público, sin `@Auth`, `SendContactMessageDto`: `nombre`/`email`/`mensaje`) — le
  manda un mail a `settings.email` reusando `getTransporter()` (`config/mailer.ts`, el mismo que ya
  usaba `requestResetPassword` para recuperación de clave) con `replyTo: dto.email`, así el ADMIN
  puede responderle al cliente directo desde su cliente de correo. Si todavía no hay `email`
  configurado, `BadRequestException` con un mensaje claro (nunca falla en silencio). Throttle igual
  que `requestResetPasswordByEmail` en `auth/` (mismo criterio: endpoint público que dispara un
  mail, hay que limitar abuso) — 5 mensajes cada 10 min por IP. El HTML del mail escapa
  `nombre`/`email`/`mensaje` (helper `escapeHtml` local al service) porque son datos del cliente, no
  confiables — es el primer lugar de este proyecto que interpola datos de un usuario anónimo en un
  mail.
- **WhatsApp: no hay ninguna integración de backend con ningún proveedor** (Twilio, Meta Cloud API,
  CallMeBot, etc.) — pedido explícito del usuario, decisión deliberada. En cambio, `GET
  /contacto/whatsapp` (público, sin `@Auth` — a propósito separado de `GET /contacto/configuracion`,
  que sigue siendo ADMIN-only y expone el email también) solo devuelve el número guardado, para que
  el frontend arme un link `wa.me` — mismo mecanismo (100% client-side, sin backend de por medio)
  que ya usa este usuario en otro proyecto propio (`sweet-moment-candy/Servicios.tsx`): un
  `window.open('https://wa.me/<numero>?text=<mensaje>')` que abre WhatsApp con el mensaje
  precargado, lo termina enviando el propio cliente. Si en el futuro se quiere un envío realmente
  automático (sin que el cliente tenga que confirmar nada), ahí sí hace falta un proveedor real, y el
  lugar natural sería adentro de `ContactService.enviarMensaje`, al lado del envío del mail.
- Logger propio (`contactErrorLogger`, `module-loggers.ts`), mismo patrón que el resto de los
  módulos.

**Carrito de compra + Mercado Pago** (nuevo modelo de negocio de esta copia del proyecto —
`tienda-carrito` es una copia de `tienda-basica`, que no tiene esto; pedido explícito del usuario).
Se va a implementar por fases, cada una documentada acá a medida que se completa — todavía **no**
hay ninguna integración real con Mercado Pago, esta primera fase es solo el modelo de datos y la
creación del pedido.

Decisiones de negocio ya tomadas (antes de escribir código, respuestas explícitas del usuario —
importantes para no reinterpretarlas al tocar este módulo más adelante):
- **Checkout como invitado, sin cuenta obligatoria**: un pedido no se asocia a ningún `UserEntity`,
  solo a datos de contacto. El rol `GUEST` (ver `role.enum.ts`, existía sin usar) queda reservado
  para una futura función de "reclamar" un pedido logueándose después — todavía sin implementar,
  no asumir que ya funciona.
- **Carrito client-side**: el carrito en sí (armar/editar cantidades antes de pagar) vive en el
  frontend (Redux + `localStorage`, mismo patrón que `user.ts`) — el backend no sabe nada de un
  carrito "en progreso", solo recibe el pedido ya armado en `POST /ordenes`.
- **Mercado Pago Checkout Pro** (no Bricks/API): el backend va a crear una Preferencia y redirigir
  a la página hospedada por Mercado Pago — se define en una fase siguiente, junto con el webhook
  que confirma el pago.
- **Argentina, moneda ARS**, arrancando con credenciales de sandbox.
- **Sin delivery**: no hay ni va a haber un campo de dirección de envío formal — se coordina el
  retiro en el local por WhatsApp/mail, mismo mecanismo que ya usa `ContactModule`. Por eso
  `OrderEntity` solo tiene datos de contacto + `notas` libres (ej. horario de retiro), no una
  dirección.
- **Negocio único, sin multi-vendedor ni split de pagos**: aunque `ProductEntity.creadoPor`
  permite que un `USER` cargue productos propios, el dinero de cualquier venta entra siempre a la
  única cuenta de Mercado Pago del negocio — `creadoPor` sigue siendo solo trazabilidad interna de
  quién cargó el producto, sin relación con el checkout.
- **El stock se descuenta recién cuando el pago se confirma** (webhook de Mercado Pago, fase
  pendiente), nunca al crear el pedido — evita descontar stock de un pedido que nunca se termina de
  pagar.

**Fase 1 — modelo de datos y `POST /ordenes` (hecha)**: `OrdersModule` nuevo, mismas convenciones
que el resto (logger propio `ordersErrorLogger` en `module-loggers.ts`, `handleServiceError`,
DTOs con `class-validator`).
- `OrderEntity` (tabla `orders`): `nombreContacto`/`email`/`telefono` (obligatorios, reemplazan a
  una cuenta de usuario) + `notas` (texto libre, opcional). `estado` (`OrderStatus`, nuevo enum en
  `common/enums/`: `PENDING`/`PAID`/`FAILED`/`CANCELLED`) arranca en `PENDING` y es lo que
  representa el ciclo de vida del pedido — **sin soft-delete a propósito**, un pedido nunca se
  "borra". `total` es la suma de los items, calculada una sola vez al crear el pedido (mismo patrón
  DECIMAL(10,2)+transformer que `ProductEntity.precio`). `mercadoPagoPreferenceId`/
  `mercadoPagoPaymentId` existen ya en la entidad pero quedan `null` hasta las fases siguientes
  (creación de la Preferencia y webhook, todavía sin implementar).
- `OrderItemEntity` (tabla `order_items`): FK a `ProductEntity` (`producto`, nullable, `onDelete:
  'SET NULL'` — mismo criterio que `creadoPor` en `ProductEntity`, por las dudas, aunque en la
  práctica los productos nunca se borran físicamente) **solo para trazabilidad**. El dato real que
  usa el pedido es el snapshot congelado al momento de la compra: `nombreProducto` + `precioUnitario`
  se copian del producto real en `OrdersService.crearOrden` y nunca se vuelven a leer de
  `ProductEntity` después — si el producto cambia de nombre/precio o se da de baja más adelante, el
  historial de este pedido no se ve afectado.
- `POST /ordenes` (público, sin `@Auth` — checkout de invitado): `OrdersService.crearOrden` resuelve
  cada item del carrito contra la base real vía `ProductsService.findActivoByIdOrThrow` (método
  nuevo, mismo patrón que `CategoriesService.findActivaByIdOrThrow` que `ProductsService` ya
  consumía) — nunca confía en precio/nombre que mande el cliente, `CreateOrderItemDto` ni siquiera
  acepta esos campos, solo `idProducto`+`cantidad`. Valida `cantidad <= stock` actual y rechaza con
  400 si no alcanza, pero es **una validación informativa, no una reserva**: no bloquea el stock
  para otro comprador armando el mismo carrito en paralelo — la validación (y el descuento real de
  stock) se repite recién en el webhook de la fase pendiente, que es el único lugar que
  efectivamente compromete stock.
- Probado a mano contra la base real (`npm run start:dev` + `curl`, verificado en MySQL que
  `synchronize: true` creó `orders`/`order_items` sin errores): producto inexistente → 400,
  producto sin stock → 400 con el mensaje específico, DTO inválido (falta email) → 400 de
  `class-validator`, pedido válido con dos items → 201 con el total bien calculado. El pedido de
  prueba se borró de la base después de verificar.

**Fase 2 — carrito en el frontend (hecha)**: Redux + `localStorage`, acotado por ahora a un solo
catálogo de los 7 que tiene el proyecto — el detalle completo está en `Frontend/CLAUDE.md`, sección
"Carrito de compra (Fase 2)", no acá.

**Fase 3 — Checkout Pro de Mercado Pago (hecha)**: `POST /ordenes` ahora crea el pedido **y** la
Preferencia de pago en la misma request, y devuelve la URL a la que el frontend redirige
(`initPoint`). Sin webhook todavía — eso es la Fase 4, ver más abajo.

- `MercadoPagoModule`/`MercadoPagoService`, nuevo (`src/mercadopago/`), sin controller propio: hoy
  el único consumidor es `OrdersService`. `crearPreferencia(order: OrderEntity)` arma la Preferencia
  vía el SDK oficial (`mercadopago`, `MercadoPagoConfig` + `Preference`) a partir de los **items ya
  guardados** del pedido (`OrderItemEntity`, snapshot congelado) — nunca del carrito crudo que mandó
  el cliente. `currency_id: 'ARS'` fijo (cuenta Argentina, pedido explícito del usuario).
  `external_reference` es el `idOrden` — así el webhook de la Fase 4 va a poder encontrar el pedido a
  partir del pago que le llegue. Las tres `back_urls` (success/pending/failure) apuntan a la
  **misma** página del frontend (`FRONTEND_URL/checkout/resultado`) — no hace falta una ruta por
  resultado porque Mercado Pago agrega sus propios parámetros de query al volver (`status`, etc.),
  que esa página lee (ver `Frontend/CLAUDE.md`).
- **Variables de entorno nuevas** (Joi en `app.module.ts` + `.env.example`): `MERCADOPAGO_ACCESS_TOKEN`
  (opcional — mismo criterio que `MAIL_USER`/`MAIL_PASSWORD`: sin configurar, el resto de la app
  arranca igual, `MercadoPagoService` recién tira un error claro al intentar crear un pedido) y
  `MERCADOPAGO_SANDBOX` (`boolean`, default `true` — controla si `crearPreferencia` devuelve
  `sandbox_init_point` o `init_point`; con un Access Token de prueba, Mercado Pago **exige**
  redirigir a `sandbox_init_point`, no al de producción).
- **`OrdersService.crearOrden` ahora usa una transacción** (`dataSource.transaction`, inyectando
  `DataSource` directo — mismo patrón que ya usaba `AppService`, no hace falta ningún módulo/import
  extra porque `TypeOrmCoreModule` lo provee global): antes de esta fase, crear un pedido era una
  sola escritura sin efectos externos; ahora tiene uno (la llamada a la API de Mercado Pago), que
  puede fallar por su cuenta (red, credenciales, etc.). Si `crearPreferencia` tira, la transacción
  entera se revierte — no queda en la base un pedido "fantasma" en `PENDING` sin ninguna forma de
  pagarlo. **Verificado a mano**: con `MERCADOPAGO_ACCESS_TOKEN` sin configurar, `POST /ordenes`
  devuelve 500 con un mensaje claro y `SELECT COUNT(*) FROM orders` da `0` — no quedó ninguna fila
  huérfana.
- `OrderResponseDto` ganó `initPoint: string` (siempre presente — un pedido nunca se persiste sin su
  Preferencia, por la transacción de arriba).
- **Probado con un Access Token real de un usuario de prueba** (el usuario lo consiguió del panel
  de Mercado Pago — ojo, no todas las credenciales de test llevan el prefijo `TEST-`: un usuario de
  prueba tiene su propio Access Token con formato `APP_USR-` igual que uno de producción, la
  diferencia la marca el panel, no el prefijo del string). Dos hallazgos reales al probar contra la
  API de verdad (no se habrían visto solo con `class-validator`/mocks):
  - **Bug real, corregido**: `auto_return: 'approved'` se mandaba siempre, con el comentario (ahora
    corregido) de que sin https era "cosmético". Mercado Pago en realidad **rechaza la creación
    entera de la Preferencia** si `auto_return` está presente y `back_urls.success` no es https
    (error real de la API: `"auto_return invalid. back_url.success must be defined"`) — con
    `FRONTEND_URL=http://localhost:5173` (dev), esto tiraba abajo cualquier intento de pago.
    `MercadoPagoService.crearPreferencia` ahora solo manda `auto_return` cuando
    `FRONTEND_URL` empieza con `https://` — en producción (con https real) se activa solo, no hace
    falta tocar nada.
  - **Confirmado — creación de la Preferencia funciona de punta a punta**: `POST /ordenes` devuelve
    un `initPoint` real (`https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=...`) y el
    frontend redirige ahí de verdad (verificado con Playwright: la URL del browser cambia al dominio
    de Mercado Pago, sin errores de JS).
  - **Sin confirmar — completar un pago en sandbox**: la página de Mercado Pago devuelve `403` al
    abrirla desde este entorno de desarrollo (navegador automatizado corriendo en la nube, casi
    seguro fuera de Argentina — Mercado Pago geolocaliza/bloquea el checkout por país). No es un bug
    de este proyecto: la URL es válida, el 403 lo tira el servidor de Mercado Pago, no el nuestro.
    Queda pendiente que el usuario abra el link desde su propio navegador (en Argentina) para
    confirmar el pago con una tarjeta de prueba y ver la vuelta a `/checkout/resultado`.

**Fase 4 — webhook de confirmación de pago (hecha)**: `POST /ordenes/webhook` (público, en
`OrdersController` — `MercadoPagoModule` sigue sin controller propio, ver el comentario en
`mercadopago.module.ts`: le pasa el estado del pedido a actualizar, `OrdersController` es quien
sabe de `OrderEntity`).

- **Nunca confía en el body de la notificación más allá de "qué id de pago consultar"**: el estado
  real siempre se vuelve a pedir a la API de Mercado Pago (`MercadoPagoService.consultarPago`, nuevo
  — `new Payment(client).get({ id })`). Cualquiera puede mandarnos un POST fingiendo ser Mercado
  Pago, pero solo un pago que exista de verdad en su API (con un `external_reference` que coincida
  con un pedido nuestro) puede terminar marcando algo como pagado.
- **`OrdersService.procesarWebhookMercadoPago` es el único método de todo el proyecto que no usa
  `handleServiceError`** (que loguea y **tira** una excepción HTTP) — un webhook tiene que poder
  responderle 200 a Mercado Pago siempre que sea posible, porque un 4xx/5xx solo logra que reintente
  la misma notificación sin que cambie nada. Cualquier problema (pago no encontrado, pedido no
  encontrado, notificación de un tipo que no es `payment`, error de red) se loguea y se sale en
  silencio — nunca se propaga. `OrdersController.webhook` tampoco tipa `body`/`query` con un DTO de
  `class-validator` a propósito (`Record<string, unknown>`/`Record<string, string>` — el
  `ValidationPipe` global de `main.ts` salta la validación entera para un tipo "objeto" genérico),
  porque la forma del body la define Mercado Pago, no nuestro frontend, y varía según el tipo de
  notificación.
- **Idempotente**: si la notificación de un mismo pago llega más de una vez (Mercado Pago no
  garantiza entrega única), un pedido que ya salió de `PENDING` no se vuelve a tocar — evita
  descontar stock dos veces por el mismo pago. `pending`/`in_process`/etc. dejan el pedido en
  `PENDING` sin tocar nada (el webhook puede volver a llegar más adelante cuando el pago se termine
  de resolver, ej. un pago en efectivo).
- **El descuento de stock** (`OrdersService.descontarStockDePedido`, privado) corre en la misma
  transacción que marca el pedido como `PAID` — las dos cosas pasan juntas o ninguna. Clampeado a 0
  en vez de restar de más: `ProductEntity.stock` es una columna `unsigned`, y aunque no lo fuera no
  tendría sentido un stock negativo. Si hay sobreventa (alguien más compró el mismo producto entre
  que se creó el pedido y se confirmó el pago), se loguea como advertencia pero **no bloquea nada**
  — el pago ya está aprobado y cobrado de verdad, no hay forma de "cancelarlo" desde acá.
- `MercadoPagoService.crearPreferencia` ahora manda `notification_url` (adonde llega el webhook) si
  `MERCADOPAGO_WEBHOOK_URL` está configurada — nueva env var opcional (Joi + `.env.example`, con
  instrucciones de `ngrok` para dev). Sin configurar, los pedidos se siguen pagando igual, solo que
  el backend nunca se entera de la confirmación por este canal (habría que consultarlo a mano).
- **Bug real, encontrado en una pasada final de QA y corregido**: el endpoint solo mapeaba
  `POST /ordenes/webhook`, pero `extraerPaymentId` ya contemplaba el formato IPN viejo de Mercado
  Pago (`?topic=payment&id=...`) — ese formato se entrega históricamente por **GET**, no POST. Sin
  un handler para eso, esas notificaciones caían en un 404 silencioso y nunca se procesaban.
  Se agregó `GET /ordenes/webhook` (`OrdersController.webhookPorGet`), mismo servicio, body vacío
  siempre (un GET no trae body). Verificado con curl: ya no da 404, y el log de Mercado Pago
  confirma que efectivamente llega a consultar el pago.
- **Verificado**: el endpoint responde 200 ante una notificación de otro tipo (`merchant_order`), un
  body vacío (ping de prueba del panel de Mercado Pago), un `payment id` inexistente (log
  "Payment not found", sin crash) y el formato IPN viejo por query string
  (`?topic=payment&id=...`) — en ningún caso se tocó la tabla `orders`. **Sin verificar todavía**:
  el camino feliz completo (un pago realmente aprobado llegando por webhook y descontando stock de
  verdad) — depende de completar un pago real en sandbox, que quedó bloqueado del lado del usuario
  (el botón "Pagar" de Mercado Pago no se habilitaba, causa todavía sin identificar — ver la
  conversación) y de tener un túnel público (`MERCADOPAGO_WEBHOOK_URL`) configurado.

**Fase 5 — panel de pedidos ADMIN-only (hecha)**: `GET /ordenes/admin/listado` y
`GET /ordenes/admin/:id`, los dos `@Auth(Role.ADMIN)` exclusivo (pedido explícito del usuario: "para
esta v1 dejalo solo accesible para ADMIN" — `USER` no tiene ningún acceso a pedidos, ni siquiera a
los que incluyan productos que él mismo cargó). Declarados en el mismo orden que ya usan
`products`/`categories` (`admin/listado` antes de `admin/:id` — misma forma de ruta
`admin/<segmento>`, si se invierte Nest matchearía "listado" como si fuera el `:id`).

- `FindOrdersQueryDto` (nuevo) — mismo patrón que `FindProductsQueryDto`: `search` (solo busca por
  `nombreContacto`, no también por email — criterio de simpleza para esta v1), `estado` (filtro
  exacto por `OrderStatus`), `page`/`limit` (máximo 50).
- `OrderAdminResponseDto`/`PaginatedOrdersResponseDto` (nuevos) — distinto de `OrderResponseDto` (el
  del checkout): sin `initPoint` (no se está armando ningún pago nuevo acá) y con
  `mercadoPagoPreferenceId`/`mercadoPagoPaymentId` visibles, para poder buscar el pago a mano en el
  panel de Mercado Pago si hace falta investigar algo. `OrdersService` ganó un `mapItems` privado
  compartido entre los dos DTOs de respuesta (antes `toResponseDto` repetía ese `.map` a mano).
- `findAllAdmin` ordena por `createdAt DESC` (el más reciente primero) — a diferencia de
  `buscarProductos`, que ordena alfabético: acá importa qué pasó último, no un orden por nombre.
- **De solo lectura a propósito**: no hay ningún endpoint para que un ADMIN cambie el estado de un
  pedido a mano — el único lugar que lo hace es el webhook de la Fase 4. Si en el futuro hace falta
  (ej. cancelar un pedido `PENDING` manualmente), es una fase aparte.
- **Verificado**: sin token → 401; con el ADMIN sembrado → listado ordenado por fecha, filtro por
  `estado=PENDING` funcionando, detalle de un pedido puntual con sus items, y 404 ante un id
  inexistente.

**Ajuste masivo de precio** (`ProductsModule`, pedido explícito del usuario: editar el precio de a
un producto por vez no escala con un catálogo de miles — "aumento masivo por categoría" y "masivo
general" son los dos casos que pidió). Un único endpoint (`PATCH /productos/precios/ajuste-masivo`,
`@Auth(Role.ADMIN)` exclusivo — a diferencia del resto de las mutaciones de `ProductsController`,
acá no hay noción de "propios", puede tocar el catálogo entero de un saque, así que ni siquiera deja
pasar a `USER`) cubre los dos casos con el mismo `BulkPriceAdjustmentDto` en vez de duplicar la
lógica: `idCategoria` presente = "por categoría", ausente/`null` = "general, todo el catálogo".
Declarado ANTES de `PATCH :id` en el controller — mismo motivo que `admin/listado` antes de
`admin/:id`: si se invirtiera el orden, Nest intentaría matchear `precios` como si fuera el `:id`.

- `TipoAjustePrecio` (`common/enums/`, nuevo): `PORCENTAJE` | `FIJO`. `valor` es el mismo campo
  numérico para los dos tipos y para aumento/descuento — positivo aumenta, negativo baja, así que no
  hace falta un campo booleano "aumentar"/"bajar" aparte. Para `PORCENTAJE` hay un piso de validación
  a nivel DTO (`@Min(-100)`, con `@ValidateIf` para que no aplique a `FIJO`, que no tiene ese límite
  natural).
- **`ProductsService.ajustarPreciosMasivo`**: un único `UPDATE` con una expresión SQL
  (`createQueryBuilder().update(ProductEntity).set({ precio: () => 'GREATEST(ROUND(precio * (1 +
  :valor / 100), 2), 0)' })`, o el equivalente con `+` para `FIJO`) en vez de un `find()` + loop de N
  `save()` — con miles de productos, MySQL resuelve la fórmula para todas las filas que matcheen en
  una sola pasada, mucho más rápido que traer todo a memoria. `GREATEST(...,0)` es el piso de
  seguridad: ningún ajuste puede dejar un precio negativo, sin tener que leer cada precio de
  antemano para validarlo en JS. `:valor` viaja como parámetro real de TypeORM (`.setParameter`),
  nunca interpolado a mano en el string SQL.
- **Afecta productos dados de baja también, a propósito**: un `UPDATE` de TypeORM no filtra
  soft-delete automáticamente (a diferencia de `find`/`findOne`), y acá se dejó así deliberadamente
  — un producto pausado conserva el precio ajustado para cuando se reactive, en vez de quedar
  desactualizado. Si `idCategoria` viene, se valida contra `CategoriesService.findActivaByIdOrThrow`
  antes de tocar nada (mismo criterio que `resolverCategoria`) — sin este chequeo, un id inexistente
  no rompería nada (el `WHERE` no matchearía ninguna fila), pero el ADMIN recibiría "0 productos
  afectados" sin saber si la categoría está vacía o el id está mal.
- `BulkPriceAdjustmentResponseDto` solo devuelve `productosAfectados` (un conteo, no la lista — con
  miles de filas no tendría sentido devolver cada producto actualizado).
- **Verificado contra la base real** (no mockeado): +10% a la categoría "zapatillas" (2 productos,
  $25000→$27500 y $15000→$16500), +$500 fijo a "pelotas" (3 productos), -5% general a todo el
  catálogo incluyendo un producto dado de baja a propósito para la prueba (confirmado que también
  bajó de precio estando inactivo), categoría inexistente → 400, porcentaje -150 → 400 de
  `class-validator`, rol `USER` → 403. El frontend (panel ADMIN) muestra un preview de cuántos
  productos afecta la selección antes de aplicar — ver `Frontend/CLAUDE.md`.

**Auditoría de seguridad (pedido explícito del usuario) — sin vulnerabilidades reales, un hallazgo
menor corregido**. Se probó en vivo contra el backend real (no solo revisión de código): inyección
SQL en los dos buscadores (`GET /productos?search=`, `GET /ordenes/admin/listado?search=`) con
payloads UNION-based, boolean-based (`' OR '1'='1`), ciegos por tiempo (`SLEEP(4)`) y destructivos
(`DROP TABLE`); bypass de login por SQLi; fuerza bruta de login; manipulación de JWT (payload
alterado, `alg:"none"`); asignación masiva de campos prohibidos al crear un producto; inyección en
parámetros tipados (`:id`, `categoriaId`, `page`/`limit`); inyección de segundo orden (nombre de
producto con sintaxis SQL, verificado que se guarda y se lee literal, nunca se ejecuta). **Ningún
ataque tuvo éxito** — TypeORM parametriza todo (nunca hay SQL armado por concatenación de texto de
usuario, salvo el ajuste masivo de precio de arriba, que ya usa `:valor` bindeado) y
`class-validator` con `whitelist`+`forbidNonWhitelisted` rechaza cualquier campo o tipo inesperado
antes de que llegue a la base.

- **Único hallazgo real, de severidad baja, corregido**: los dos buscadores (`ILike`) no escapaban
  los comodines de SQL `LIKE` (`%` y `_`) en el texto que manda el usuario — no era una falla de
  seguridad (nunca permite ejecutar SQL ajeno, el catálogo ya es público), pero significaba que
  buscar literalmente `%` devolvía "todo" en vez de nada, porque `%` se interpreta como "cualquier
  secuencia de caracteres". `common/utils/escape-like.util.ts`, nuevo: `escapeLikeWildcards(value)`
  escapa `\`, `%` y `_` (el backslash primero, para no terminar escapando el escape) antes de armar
  el patrón `%texto%` — aplicado en `ProductsService.buscarProductos` y en la búsqueda de
  `OrdersService` (por `nombreContacto`). Con test unitario (`escape-like.util.spec.ts`, 6 casos).
  Verificado en vivo: antes del fix, buscar `%` devolvía los 5 productos/25 pedidos existentes;
  después, 0 (ningún nombre real contiene un `%` literal) — sin afectar una búsqueda normal
  (`search=adidas` sigue devolviendo exactamente ese producto). `npm run build` + `npx jest`
  (37/37) limpios.

**Identidad de login**: `nickUsuario`, no `email`, es el identificador de login — el email es
opcional y solo queda asociado a una cuenta la primera vez que se pide recuperar la contraseña
para esa cuenta (ver `AuthService.requestResetPassword`); una vez seteado, el flujo de reset ya no
lo pisa (el email existente en la cuenta siempre gana sobre el que llega en el pedido).

**Flujo de auth**: `@Auth(...roles)`
([auth.decorator.ts](src/auth/decorators/auth.decorator.ts)) es azúcar sintáctica para
`@Roles(...roles)` + `@UseGuards(AuthGuard, RolesGuard)`. `AuthGuard` verifica el JWT *y* además
vuelve a buscar el usuario en la base en cada request — esto es lo que hace que el token de un
usuario dado de baja deje de funcionar antes de que el JWT expire naturalmente (TypeORM excluye
las filas con soft-delete por default). `RolesGuard` deja pasar a un ADMIN sin importar qué roles
pida la ruta. Si la búsqueda en la base dentro de `AuthGuard` tira una `HttpException` que no es
`UnauthorizedException` (por ejemplo, la base caída), eso deliberadamente **no** se colapsa en un
401 genérico — solo se normalizan a 401 los fallos reales de verificación del JWT — así un blip de
infraestructura no aparenta ser "tu sesión es inválida" (ver el comentario largo en
[auth.guard.ts](src/auth/guard/auth.guard.ts)).

**Soft delete**: dar de baja a un usuario (`dar-de-baja-usuario`) es un soft-delete de TypeORM
(`deletedAt`), que se revierte con `activar-usuario` (`restore()`). Todo lo que necesite ver
usuarios dados de baja (listado de admin, reactivación, el chequeo de `AuthGuard` que rechaza
usuarios borrados) tiene que pasar `withDeleted: true` explícitamente — ver
`UsersService.getUserWithDeleted` / `findAllUsers`.

**Manejo de errores**: los servicios nunca dejan que una excepción cruda se propague — cada bloque
catch llama a `handleServiceError(error, logger, serviceName, defaultMessage, context?)`
([error-handler.util.ts](src/common/utils/error-handler.util.ts)), que loguea con el logger de
Winston que se le pase y relanza la `HttpException` que corresponda (deja pasar las
`HttpException` ya existentes, mapea un `QueryFailedError` de constraint único a 409, y todo lo
demás relacionado a TypeORM o desconocido a 500). Al agregar un método de servicio nuevo, seguí
este mismo patrón de try/catch + `handleServiceError` en vez de tirar excepciones directamente.

**Logging** está repartido en varios sets de loggers de Winston independientes, todos escribiendo
a `logs/`:
- [winston.config.ts](src/config/winston.config.ts): logger general de la app (`nest-winston`),
  alimenta `error.log` / la consola, se conecta como logger global de Nest en `main.ts` y lo usa
  `AllExceptionsFilter`.
- [module-loggers.ts](src/config/module-loggers.ts): un logger de errores dedicado por módulo de
  feature (`authErrorLogger`, `usersErrorLogger`) que escribe a
  `logs/<modulo>-errors-*.txt` con rotación diaria (retención de 60 días) — es lo que se le pasa a
  `handleServiceError`. Módulo nuevo = agregar una llamada a
  `buildModuleErrorLogger('nombreDelModulo')` acá.
- [db-loggers.ts](src/config/db-loggers.ts): loggers de auditoría de base de datos transversales,
  por *tipo de operación* (`insertLogger`, `updateLogger`, `deleteLogger`, `selectLogger`),
  también con rotación diaria en `logs/{inserts,updates,deletes,selects}-*.txt`. Se llaman
  explícitamente en cada lugar donde corresponda, después de que una mutación/consulta tuvo éxito
  (no es automático) — por ejemplo `insertLogger.info(...)` después de un registro exitoso.
  **Nunca loguear secretos**: las actualizaciones de password/token loguean qué campos cambiaron o
  que se generó un token, nunca los valores en sí (ver `UsersService.updateUser`,
  `updateTokenResetPassword`).

**Respuestas a tiempo constante**: los handlers de login y de pedido de reset de contraseña
acolchan (padding) el tiempo de respuesta a un piso mínimo (`padToMinDuration`, en bloques
`finally`) para que "el usuario no existe" no responda notoriamente más rápido que "contraseña
incorrecta" o el envío real de un mail — ver las constantes y los comentarios al principio de
[auth.service.ts](src/auth/auth.service.ts). Es una mitigación deliberada y parcial (el propio
código documenta que no cierra del todo el oráculo de tiempos contra un atacante paciente que
promedie muchas mediciones) — si tocás estos métodos, mantené el padding en el `finally` (no en
cada return/throw individual), para que ningún return/throw nuevo pueda saltearlo sin querer.

**Subida de archivos** (avatares de usuario e imágenes de producto): se sirve como estático desde
`/uploads` (montado en `main.ts` *antes* del prefijo global `tienda/v1`, así que las URLs quedan
como `/uploads/avatars/<uuid>.<ext>` o `/uploads/products/<uuid>.<ext>` sin prefijo). La extensión
del archivo subido siempre se deriva del mimetype ya validado
([avatar-upload.config.ts](src/common/upload/avatar-upload.config.ts),
[product-image-upload.config.ts](src/common/upload/product-image-upload.config.ts) — mismo
mecanismo, mismos mimetypes aceptados, carpeta de destino distinta), nunca del nombre de archivo
que manda el cliente, para evitar que se cuele una extensión tipo `.php` a través del nombre de
archivo.

**Cuidado al limpiar `uploads/`**: es una carpeta compartida entre datos de prueba y datos reales
— nunca correr un borrado por glob amplio ahí (`rm uploads/products/*.png`, etc.). Un borrado así
se llevó puesta la imagen real de un producto real durante una sesión de pruebas. Borrar siempre
por nombre de archivo específico (el que devolvió el upload/el que tiene el producto en la base
antes de reemplazarlo), nunca por patrón.

**Prefijo de la API**: todas las rutas quedan montadas bajo `tienda/v1`
(`app.setGlobalPrefix` en [main.ts](src/main.ts)) excepto el mount estático de `/uploads`, que
queda deliberadamente afuera de ese prefijo.

**Alias de paths**: `@/*` mapea a `src/*` (ver `tsconfig.json` y el `moduleNameMapper` de Jest) —
usalo para imports entre módulos en vez de rutas relativas `../../`, siguiendo el estilo del
código existente.

**Validación**: `ValidationPipe` global con `whitelist: true` + `forbidNonWhitelisted: true` — los
DTOs tienen que declarar cada campo que aceptan con decoradores de `class-validator`/
`class-transformer`; los campos no declarados en el body de un request se rechazan, no se
descartan en silencio.
