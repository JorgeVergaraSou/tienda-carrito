# base-auth-react (contexto para Claude Code)

## Qué es este proyecto

Frontend de **una tienda online real**, en React + TypeScript + Vite. Arrancó como
"base-auth-react" — una **base/plantilla** con autenticación, sesión y llamadas HTTP ya
resueltas, pensada para arrancar proyectos nuevos sin reescribir esa parte cada vez — y a partir
de ahí se conectó a un backend real (NestJS, prefijo `tienda/v1`) y se le construyó encima el
dominio de negocio de la tienda: catálogo público, panel de administración de productos y
categorías. Ver "Historia reciente" más abajo para el detalle de qué se hizo y en qué orden.

**Ya no aplica** la advertencia original de "acá no hay dominio de negocio" para
`pages/Public/Catalog`, `pages/Private/Admin/Admin.tsx` (panel real de productos/categorías),
`pages/Private/User/User.tsx` (carga de productos para el rol USER) ni para
`components/NavBars/DropdownMenu.tsx` (links reales) — mantenerlos con cuidado como al resto del
código. Sigue siendo contenido de ejemplo sin uso real: `pages/Private/Guest/Guest.tsx` (no se le
definió ninguna función propia de la tienda todavía) y `pages/Register/Register.tsx` (ver más
abajo, ruta deshabilitada).

## Historia reciente (por qué está como está)

El repo arrancó como un clon/experimento (`<title>TESTEO</title>` original,
sin `node_modules` instalado nunca, **nunca se había corrido un build real**
hasta la limpieza descripta abajo). Tenía bastante código pegado de otro
proyecto a medio adaptar. Se hizo una limpieza completa en una
sesión (ver git log) que:

1. Agregó el alias `@/` (`vite.config.ts` + `tsconfig.app.json`).
2. Reemplazó un interceptor de axios que no hacía nada (`src/interceptors/`,
   **ya no existe**) por una instancia real con manejo de token/errores
   (`src/api/axios.ts`).
3. Agregó manejo centralizado de errores (`getErrorMessage`) y alertas
   (`alert.utils.ts`, `session-alerts.utils.ts`, SweetAlert2 — se agregó
   como dependencia nueva).
4. Arregló la seguridad de sesión: validación de expiración del JWT al
   hidratar el store (antes no existía, el "usuario viejo" podía quedar
   logueado con un token vencido), guard de auth simplificado, `RoleGuard`
   pasado de un solo rol a `roles: Roles[]`.
5. Limpieza general: borró imports/exports colgantes que apuntaban a
   archivos inexistentes (`IngresoProductos`, `Admin/Profile.tsx` duplicado
   — el proyecto nunca se había buildeado, así que nadie lo había notado),
   sacó una ruta (`INGRESO_PRODUCTOS`) y una imagen (`bgfarma.jpg`) que eran
   residuo de ese código pegado, migró `.eslintrc.cjs` (formato viejo) a
   `eslint.config.js` (flat config, lo que pide ESLint 9).

Point de partida: **`npx tsc -b --noEmit`, `npm run lint` y
`npx vite build` corren limpios.** Si alguno de los tres falla al arrancar
una sesión nueva, algo se rompió después de esto — no es el estado normal.

### Conexión al backend real + tienda (fases 1 y 2, ya hechas)

Con la plantilla ya limpia, se conectó a un backend real (`../Backend`, NestJS, roles
ADMIN/USER/GUEST, prefijo `tienda/v1`) y se construyó encima el dominio de negocio de la tienda,
en dos fases:

**Fase 1 — conectar al backend real** (sin tocar todavía las páginas de ejemplo):
1. `VITE_API_BASE_URL=http://localhost:3006/tienda/v1` en `.env`.
2. `decode.token.interface.ts`, `user.model.ts`, `users.interface.ts` y los services
   (`auth.service.ts`, `profile.service.ts`) ajustados a la forma real del backend: login es
   `{nickUsuario, password}` (no `email`), el JWT no trae `email` (trae `idUser, nickUsuario,
   role, name`), y `/auth/profile` devuelve el perfil directo (sin envolver en `{profile: ...}`).
3. Roles/rutas: no hizo falta tocar `roles.enum.ts` ni `routes.ts` — ya traían exactamente
   `ADMIN`/`USER`/`GUEST`.
4. `register.service.ts` y `pages/Register/Register.tsx` **no se tocaron ni se usan**: el
   backend no tiene signup público (`POST /auth/nuevo-usuario` es `@Auth(Role.ADMIN)`), así que la
   ruta pública de registro se sacó de `App.tsx` (no hay forma de que un visitante anónimo la use)
   y los archivos quedaron sin conectar, sin borrarlos.
5. `axios.ts`, los guards y `redux/states/user.ts` no se tocaron — el backend usa JWT estándar
   por header `Authorization`, mismo contrato que ya asumía la plantilla.

**Fase 2 — páginas de la tienda** (recién arrancada cuando la Fase 1 compiló y funcionó real,
verificado con curl contra el backend corriendo, no solo con el build):
- `pages/Public/Catalog/Catalog.tsx`: catálogo público (sin login), montado en `/` (la home del
  sitio — antes `/` redirigía a `/private`). Búsqueda por nombre + filtro por categoría +
  paginación, contra `GET /productos`.
- `pages/Private/Admin/Admin.tsx`: reemplazó el contenido de ejemplo por el panel real —
  listar/crear/editar/dar de baja/reactivar productos, subida de imagen, y su propia sección de
  gestión de categorías (crear/renombrar/dar de baja/reactivar). Más adelante se separó en
  páginas propias por responsabilidad — ver la entrada de "Historia reciente" correspondiente.
- `components/NavBars/DropdownMenu.tsx`: reemplazó los links placeholder (`/admin/1`, `/link3`)
  por los reales (Catálogo, Panel de administración [solo ADMIN], Cargar producto [solo USER],
  Perfil, Cerrar sesión). Más adelante se rediseñó visualmente — ver la entrada de "Historia
  reciente" correspondiente.
- Carrito: **hecho, client-side, acotado a `Catalog.tsx` por ahora** — ver `Backend/CLAUDE.md`,
  sección "Carrito de compra + Mercado Pago", para el plan de fases completo (nuevo modelo de
  negocio de esta copia del proyecto, `tienda-carrito`), y la entrada de "Historia reciente" más
  abajo ("Carrito de compra (Fase 2)") para el detalle. Checkout y el pago con Mercado Pago
  **todavía no están** — Fase 3 en adelante, sin arrancar.

**Categorías como entidad, no enum** (pedido explícito del usuario después de la Fase 2): el
campo "categoría" de un producto **no** es un string libre ni un enum de valores fijos — es una
relación a una tabla `categories` real en el backend, gestionable por el ADMIN desde
`Admin.tsx` (crear/renombrar/dar de baja/reactivar categorías) sin tocar código ni rebuildear.
`Product.categoria` es `{ idCategoria, nombre } | null` (no un string), y el form de productos
usa un `<select>` poblado desde `GET /categorias` en vez de un input de texto. Ver
`services/categories.service.ts` e `interfaces/category.interface.ts`.

**USER también puede cargar productos** (pedido explícito del usuario, después de lo de
categorías): `pages/Private/User/User.tsx` dejó de ser contenido de ejemplo — es un form de
"Cargar producto" (nombre, descripción, precio, stock, categoría, imagen). USER solo puede
**crear** productos y subirles imagen (incluida la del producto que acaba de crear, gracias a la
trazabilidad `creadoPor` agregada en el backend) — no puede editar, dar de baja/reactivar
productos existentes (ni siquiera los propios) ni tocar categorías; esos límites los aplica el
backend (`@Auth`, y en el caso de la imagen un chequeo de "es tuyo" en `ProductsService`), no el
frontend — la página de USER simplemente no ofrece esas acciones en su UI.

Nuevos archivos de esta etapa (no estaban en la plantilla original): `interfaces/product.interface.ts`,
`interfaces/category.interface.ts`, `services/products.service.ts`,
`services/categories.service.ts`, `pages/Public/Catalog/`, `utilities/apiUrl.utility.ts` ganó
`apiOrigin` (resuelve URLs de imágenes, que el backend sirve fuera del prefijo `tienda/v1`).

**Rediseño del menú** (pedido explícito del usuario, tomando como referencia visual otro
proyecto propio del mismo usuario — sin relación de código entre ambos): `DropdownMenu.tsx` pasó
de un header claro a uno oscuro (`bg-slate-800`), con "Hola, {nombre}" a la izquierda y los links
a la derecha marcando la página activa con un borde inferior celeste; "Cerrar sesión" en rojo
para distinguirlo del resto. Nuevo `hooks/useClickOutside.ts` (genérico, reutilizable) para
cerrar el menú mobile al clickear afuera. Sin submenús desplegables a propósito: la tienda hoy
tiene links planos nomás — si en el futuro se agrupan secciones, ahí sí conviene esa complejidad.
`components/ui/SubmenuItem.tsx`/`MenuToggleButton.tsx` quedaron sin uso (no se borraron).

**Panel admin separado por páginas** (pedido explícito del usuario: "todo vivía en la misma
página" — crear categoría, nuevo producto y listado de productos mezclados): `Admin.tsx` dejó de
ser una única página larga y pasó a ser un layout con tabs (`NavLink`) + sub-ruteo propio
(`RoutesWithNotFound` anidado, mismo patrón que ya usaba `Private.tsx`):
- `pages/Private/Admin/Products/ProductsListPage.tsx` — listado (antes la tabla vivía en
  `Admin.tsx`); "Editar" navega a su propia página en vez de un form inline.
- `pages/Private/Admin/Products/ProductFormPage.tsx` — mismo componente para crear
  (`/admin/productos/nuevo`, sin `:id`) y editar (`/admin/productos/:id/editar`, con `:id` —
  hace falta un `GET /productos/admin/:id` nuevo en el backend, porque la página de editar se
  puede abrir directo por URL/refresh y el público `GET /productos/:id` excluye los dados de
  baja).
- `pages/Private/Admin/Categories/CategoriesPage.tsx` — gestión de categorías (antes vivía
  inline en `Admin.tsx`).

`App.tsx` y `Private.tsx` montan `Admin` con `admin/*` (antes exacto) para que el sub-ruteo
anidado funcione en los dos lugares donde se puede llegar a `Admin` (`/admin` directo y
`/private/admin`).

**Buscador en vivo de productos** (pedido explícito del usuario, tomando como referencia un
componente de búsqueda en vivo de otro proyecto propio del mismo usuario — sin relación de código
entre ambos): `components/ProductSearch/InputBuscarProductos.tsx`, nuevo. Tipeás y a los 300ms
(debounce, sin pegarle al backend en cada tecla) muestra un desplegable de resultados clickeable,
con navegación por teclado (flechas + Enter) y cierre al clickear afuera (`useClickOutside`).
**No agrega ningún endpoint nuevo** — reutiliza `GET /productos` (catálogo) o
`GET /productos/admin/listado` (prop `admin`), que ya soportaban `search` + `limit`; ahí es donde
esta réplica se aparta a propósito del proyecto de referencia (que sí tenía endpoints de
búsqueda dedicados, por una razón específica de ese dominio — insumos con un concepto de "stock
disponible" que acá no existe).

Integrado en los dos buscadores que ya existían, como complemento del botón "Buscar" (que sigue
haciendo lo mismo que antes, filtra la grilla/tabla completa):
- `pages/Public/Catalog/Catalog.tsx`: seleccionar un resultado filtra el catálogo a ese producto
  exacto.
- `pages/Private/Admin/Products/ProductsListPage.tsx` (`admin` prop): seleccionar un resultado
  navega directo a `/admin/productos/:id/editar` — atajo para no tener que buscar+scrollear la
  tabla para encontrar un producto puntual.

**Detalle de producto + "Mis productos" para USER** (pedido explícito del usuario, después del
buscador en vivo):
- `pages/Public/ProductDetail/ProductDetail.tsx`, nuevo — detalle público (imagen grande, nombre,
  categoría, precio, stock, descripción), montado en `productos/:id` (público, sin login, junto a
  `Catalog` en `App.tsx`). Las tarjetas de `Catalog.tsx` pasaron de `<div>` a `<Link to={\`/productos/${id}\`}>`
  — antes no eran clickeables, no existía ninguna vista ampliada. Nuevo
  `getProductService(idProducto)` en `products.service.ts` (`GET /productos/:id`, público — no
  tenía wrapper todavía, solo existía la variante admin `getAdminProductService`).
- `pages/Private/User/User.tsx` dejó de ser una sola página y pasó a ser un layout con tabs
  (mismo patrón `NavLink` + `RoutesWithNotFound` anidado que ya usa `Admin.tsx`):
  - `User/CargarProducto/CargarProductoPage.tsx` — el form que antes vivía directo en `User.tsx`,
    sin cambios de comportamiento.
  - `User/MisProductos/MisProductosPage.tsx`, nuevo — lista los productos que el propio USER
    cargó (`GET /productos/mis-productos`, nuevo `getMisProductosService` en
    `products.service.ts`), incluidos los dados de baja. **A propósito de solo lectura + reactivar,
    no un editor completo**: no tiene "Editar" ni "Dar de baja" — el backend real solo le permite a
    USER crear, subir imagen y (después de este cambio) reactivar sus propios productos, nunca
    editarlos ni darlos de baja (ver CLAUDE.md del backend, sección de permisos de
    `ProductsController`). El botón "Reactivar" solo se muestra si `product.deletedAt` está
    seteado, y reutiliza el `activateProductService` que ya existía — no hizo falta un service
    nuevo para esa acción, la ruta ya se usaba desde el panel de ADMIN.
  - `App.tsx` y `Private.tsx` montan `UserPage` con `user/*` (antes exacto), mismo motivo que
    `Admin`. `DropdownMenu.tsx` no se tocó: el link de USER ("Cargar producto") sigue apuntando a
    `/user`, que ahora es la pestaña por default del layout nuevo.
  - **Backend**: para que "reactivar" funcionara acá, `PATCH /productos/:id/activar` pasó de
    `@Auth(Role.ADMIN)` exclusivo a `@Auth(Role.ADMIN, Role.USER)` + chequeo de ownership en
    `ProductsService.activarProducto` (mismo patrón que `actualizarImagen`) — ver CLAUDE.md del
    backend. Editar y dar de baja siguen siendo ADMIN-only, sin cambios.

**Detalle de producto en modal** (pedido explícito del usuario, después de que el backend ganó
galería de fotos — ver CLAUDE.md del backend, sección "Galería de fotos"): clickear una tarjeta de
`Catalog.tsx` ya **no navega** a `productos/:id` — abre `ProductDetailModal.tsx` (nuevo, en
`pages/Public/Catalog/`) con el `Product` que el catálogo ya tenía en memoria (la lista de
`GET /productos` ya trae `descripcion`/`imageUrl`/`fotos` completos), sin repetir ningún fetch.
`pages/Public/ProductDetail/ProductDetail.tsx` y su ruta **no se tocaron ni se borraron** —
quedaron sin enlazar desde la UI, igual que `Register.tsx`, para que una URL directa
`/productos/:id` (bookmark, link compartido) siga funcionando; se confirmó primero que ningún otro
lugar del frontend armaba un link a esa ruta.
- `components/ui/Modal.tsx`, nuevo — modal genérico sobre `@headlessui/react` (`Dialog` +
  `DialogBackdrop` + `DialogPanel`; era dependencia del proyecto desde el arranque de la
  plantilla, sin usarse en ningún componente hasta ahora). Resuelve ESC/click afuera/foco atrapado
  sin reimplementarlo a mano; no impone contenido, cualquier página nueva que necesite un modal
  puede reusarlo.
- `ProductDetailModal.tsx`: galería simple de **miniaturas + foto grande seleccionada** (no
  carrusel — más simple de implementar bien para un catálogo, sin gestos de swipe que mantener).
  Muestra como "las fotos" la unión de `product.imageUrl` (portada, primera) + `product.fotos[]`
  (galería), armada en el propio componente sin tocar el backend. La descripción va en un bloque
  con su propio `max-h-40 overflow-y-auto` — scroll interno, no estira el modal ni corta texto sin
  forma de verlo. El índice de la miniatura seleccionada se resetea al cambiar de producto
  ajustando el estado durante el render (comparando contra el `idProducto` anterior guardado en
  estado), no con un `useEffect` — la regla `react-hooks/set-state-in-effect` del linter no deja
  llamar a `setState` síncrono dentro de un efecto.
- `interfaces/product.interface.ts` ganó `ProductImage` (`{ idProductoImagen, imageUrl }`) y
  `Product.fotos: ProductImage[]` (siempre array, nunca `undefined`) — reflejaba la forma vieja del
  backend, sin el array de galería.

**Visibilidad del stock** (pedido explícito del usuario, después del backend agregar
`ProductEntity.mostrarStock`): ADMIN (en `ProductFormPage.tsx`, crear y editar) y USER (en
`CargarProductoPage.tsx` al crear, y en `MisProductosPage.tsx` para tocarlo después — es la única
vista de USER que no es un form, así que ahí el check llama directo a
`updateStockVisibilityService`, nuevo en `products.service.ts`, `PATCH /:id/visibilidad-stock`)
tienen un checkbox "Mostrar stock a los clientes". `Product.stock` pasó de `number` a
`number | null`: **null solo en las vistas públicas** (`Catalog.tsx`, `ProductDetailModal.tsx`)
cuando el dueño lo ocultó — ahí se muestra "Consultar disponibilidad" en vez del número (no
confundir con `stock === 0`, que sigue siendo "Sin stock"). Las vistas privilegiadas
(`ProductsListPage.tsx`, `MisProductosPage.tsx`, los forms) nunca reciben `null` en la práctica —
usan `product.stock ?? 0` solo para satisfacer el tipo compartido con las vistas públicas.

**Subir varias fotos desde el form** (pedido explícito del usuario: el backend ya soportaba
galería desde antes — `POST /:id/fotos`, `DELETE /:id/fotos/:idFoto` — pero ningún form la usaba
todavía). Campo nuevo "Fotos adicionales" (`<input type="file" multiple>`) separado del campo
"Imagen (portada)" existente — a propósito dos campos distintos en vez de uno solo con
`multiple` (que el primer archivo se vuelva portada automáticamente sería más "mágico" y menos
obvio que replicar el mismo criterio portada/galería que ya tiene el backend). Los archivos
elegidos se guardan en estado (`photoFiles: File[]`) y se suben recién al guardar el form, una
request por archivo, secuencial (`addProductPhotoService`/`deleteProductPhotoService`, nuevos en
`products.service.ts`):
- `CargarProductoPage.tsx` (USER, solo crear): sube portada + fotos adicionales después de crear
  el producto, mismo momento que ya subía la portada.
- `ProductFormPage.tsx` (ADMIN, crear y editar): mismo campo de fotos nuevas + en modo edición
  además muestra la galería que el producto ya tiene (`product.fotos`, cargada junto con el resto
  del form) con un botón "×" por foto para borrarla — acción inmediata (no espera al submit del
  form), mismo criterio que "Reactivar"/"Dar de baja" en las otras páginas del panel.
- El preview de la portada actual (`currentImageUrl`) pasó de `object-cover` a `object-contain`
  de paso, mismo motivo que `Catalog.tsx`/`ProductDetailModal.tsx` (ver más arriba, sección
  "Detalle de producto en modal").

**Perfil rediseñado** (pedido explícito del usuario: "replicá lo del perfil de mi otro proyecto" —
`FRONTENDS/siscofar-frontend/src/pages/Private/Profile.tsx`, sin relación de código entre ambos
proyectos, solo se portó el diseño/comportamiento). El `Profile.tsx` viejo (sin estilar, un campo
fijo de "contraseña actual" reusado para cualquier cambio) se reemplazó por:
- Avatar circular con iniciales de fallback (`getIniciales`) + botón "✎" superpuesto que abre un
  `<input type="file">` oculto — sube con `actualizarFotoService` (nuevo en `auth.service.ts`,
  `POST /auth/foto`, mismo mecanismo multipart que `uploadProductImageService`). El backend ya
  tenía este endpoint (`AuthController.actualizarFoto`) y `User.fotoUrl` en la interfaz — el
  frontend nunca los usaba.
- `components/Profile/ProfileField.tsx`, nuevo — un campo por fila, en reposo muestra el valor +
  link "Editar"; al click abre input + Guardar/Cancelar. Puerto del componente homónimo del otro
  proyecto, con sus clases custom (`field-input`/`btn-primary`/`btn-secondary`, CSS que ese
  proyecto tiene y este no) cambiadas por utilidades de Tailwind directas y el `Button` de
  `components/ui` que ya existía acá.
- Confirmación con contraseña **por cada campo**, vía un prompt de SweetAlert2 en el momento de
  guardar (no un campo fijo al pie reusado para todo): `PATCH /auth/updateUser/:id` ya exigía
  `currentPassword` en cada llamada (`UsersService.updateUser`, 400 si falta o es incorrecta) — el
  frontend viejo lo pedía una sola vez y listo, sin repetir la confirmación en cada guardado.
- Si el campo actualizado es `nickUsuario` o `email` (los dos identificadores de cuenta — ver
  "Identidad de login" en `Backend/CLAUDE.md`), se cierra la sesión y se manda a `/login` después
  de avisar con un Swal — a mano (`dispatch(resetUser())` + `navigate`), **no** con el hook
  `useLogout()` que ya tiene este proyecto: ese hook siempre pide confirmación con otro Swal
  ("¿Querés cerrar la sesión?"), inapropiado acá porque no es una decisión del usuario, es
  consecuencia obligada de haber cambiado su propio identificador de login.
- Roles del badge adaptados a los reales de este proyecto (`ADMIN`/`USER`/`GUEST`) — el original
  tenía un cuarto rol (`SOLICITANTE`) que acá no existe. Campos `nombre`/`apellido` (no
  `name`/`surname` del original) — misma diferencia que ya documentaba "Conexión al backend real"
  más arriba.

**CRUD de usuarios para ADMIN** (pedido explícito del usuario: "creame un CRUD para dar de alta
usuarios, solo el admin puede tener acceso"). Nueva pestaña `pages/Private/Admin/Users/`, cuarta
del panel (junto a Productos/Categorías), montada en `admin/usuarios` — protegida igual que el
resto de `Admin.tsx` (`RoleGuard` de `App.tsx`, ADMIN exclusivo):
- `UsersPage.tsx` — listado (`GET /auth/listar-usuarios`, nuevo `getUsersService` en
  `services/users.service.ts`) + "Dar de baja"/"Reactivar" por fila, mismo patrón que
  `CategoriesPage.tsx`/`ProductsListPage.tsx` (Swal de confirmación, `reloadToken` para refrescar).
- `UserFormModal.tsx` — crear y editar en el mismo modal (reutiliza `components/ui/Modal.tsx`),
  diferenciado por si le pasan un `UserListItem` (editar, precarga el form) o `null` (crear, form
  vacío). El índice/estado que arranca el form de nuevo al abrir se resetea comparando el `open`
  anterior contra el actual y ajustando el estado durante el render (mismo patrón que
  `ProductDetailModal.tsx` — ver "Detalle de producto en modal" — para no pisar
  `react-hooks/set-state-in-effect`), no con un `useEffect`.
- **Editar es la pieza que faltaba en el backend**: `POST /auth/nuevo-usuario` (crear),
  `GET /auth/listar-usuarios` (listar) y dar de baja/reactivar ya existían — pero no había ningún
  endpoint para que un ADMIN editara los datos de OTRO usuario (el único que editaba,
  `PATCH /auth/updateUser/:id`, es autoservicio: solo tu propia cuenta, pide tu contraseña actual).
  Se agregó `PATCH /auth/editar-usuario/:id` en el backend — ver `Backend/CLAUDE.md`, sección "CRUD
  de usuarios para ADMIN". Nuevo `updateUserAdminService` en `services/users.service.ts`, **no**
  reutiliza `updateUserService` de `profile.service.ts` (ese pega a la ruta de autoservicio, con
  otra semántica de permisos).
- El form de `UserFormModal.tsx` deja setear una contraseña nueva sin pedir la actual (a diferencia
  de `ProfileField` en `Profile.tsx`) — es una acción administrativa (recuperar acceso), no
  autoservicio; en blanco al editar = no se toca la contraseña existente.
- El backend puede devolver 400 "no podés dar de baja/quitarle el rol de administrador al único
  administrador activo" (protección nueva, ver `Backend/CLAUDE.md`) — el frontend no hace nada
  especial con ese caso, llega como cualquier otro error a `showError(getErrorMessage(error))`.

**Paginado en el listado de ADMIN** (pedido explícito del usuario: la tabla de
`ProductsListPage.tsx` pedía hasta 50 productos de una sola vez sin paginar — "con el tiempo se va
a llenar y va a ser imposible de controlar"). Se evaluaron dos opciones — paginado por letra inicial
vs. paginado por cantidad — y se eligió **por cantidad** (`PAGE_SIZE = 30`): agrupar por letra no
acota nada de verdad (una letra con cientos de productos seguiría siendo una lista larga que
también habría que paginar), y ya existía el buscador en vivo (`InputBuscarProductos`) para
encontrar un producto puntual por nombre. Mismo patrón que ya usaba `Catalog.tsx` (estado
`page`/`total`, botones Anterior/Siguiente, `Math.ceil(total / PAGE_SIZE)`) — no hizo falta tocar el
backend, `GET /productos/admin/listado` ya aceptaba `page`/`limit` (máximo 50, ver
`FindProductsQueryDto`). El buscador resetea `page` a 1 al escribir una búsqueda nueva, para no
quedar en una página que ya no existe con los resultados filtrados.

**Página pública de contacto** (pedido explícito del usuario — ver `Backend/CLAUDE.md`, sección
"Página pública de contacto", para el diseño completo incluida la decisión de WhatsApp):
- `pages/Public/Contact/ContactPage.tsx`, nuevo — montada en `contacto` (público, sin login).
  Deliberadamente **no** está en `models/routes.ts` → `PublicRoutes` como `LOGIN`/
  `SERVICE_UNAVAILABLE`: ese objeto lo usa `Header.tsx` para decidir cuándo ocultar el menú privado
  de un usuario logueado ("estás afuera de la app"), y acá un ADMIN/USER logueado tiene que poder
  seguir viendo su navegación al visitar esta página — mismo criterio que `Catalog`/`ProductDetail`,
  que tampoco están ahí.
- Enlazada desde dos lugares, porque son dos audiencias con navegación distinta: un link
  "Contacto" en el header de `Catalog.tsx` (para un visitante anónimo, que no ve ningún menú — ver
  `Header.tsx`, no renderiza nada sin sesión) y otro en `DropdownMenu.tsx` (para cualquier usuario
  logueado).
- `pages/Private/Admin/Contact/ContactSettingsPage.tsx`, nuevo — quinta pestaña del panel ADMIN
  (`admin/contacto`), el email/WhatsApp donde le llegan al negocio los mensajes. **No** vive en
  `Profile.tsx`: es una config del negocio (puede haber varios ADMIN, ver "CRUD de usuarios para
  ADMIN" más abajo), no de una cuenta personal — ni tiene relación con el email de *login* de nadie.
- `services/contact.service.ts`, nuevo (`sendContactMessageService`, `getContactWhatsappService`,
  `getContactSettingsService`, `updateContactSettingsService`) — el de actualizar manda
  `email`/`whatsapp` siempre los dos, con `null` si el input quedó vacío (el backend sí distingue
  "vaciar" de "no tocar" acá, a diferencia de la mayoría de los PATCH de este proyecto).

**Envío por WhatsApp al mandar el formulario** (pedido explícito del usuario, después de la página
de contacto: "quiero que repliques este mismo sistema" — refiriéndose a
`FRONTENDS/sweet-moment-candy/src/pages/Public/Servicios.tsx`, otro proyecto propio del mismo
usuario, sin relación de código entre ambos). `ContactPage.tsx` pide el número apenas se monta
(`getContactWhatsappService`, `GET /contacto/whatsapp`, público) y lo guarda en estado — hace falta
tenerlo *antes* de que el cliente clickee "Enviar", no recién ahí, por lo que sigue. Al hacer submit,
si hay un número cargado, se abre `window.open('https://wa.me/<numero>?text=<mensaje>')` con el
mensaje precargado (mismo mecanismo exacto que `Servicios.tsx` — `wa.me` no es una API, es un link
que abre WhatsApp; lo termina mandando el propio cliente) **antes** de cualquier `await` — el envío
del mail (`sendContactMessageService`) recién se dispara después. El orden importa: si se esperara
a que el mail termine para recién ahí abrir la ventana, la mayoría de los navegadores bloquean el
popup por no venir de una interacción directa del usuario (el `await` "rompe" el gesto de click). El
número se limpia con `.replace(/\D/g, '')` antes de armar el link — `wa.me` espera solo dígitos, sin
`+` ni espacios, aunque en la configuración se haya guardado con `+` adelante.

**Rediseño visual del catálogo, estilo Mercado Libre** (pedido explícito del usuario, en dos
pasos — primero "quiero que esta página tenga un estilo visual parecido a como Mercado Libre
muestra sus productos", después "quiero lograr algo parecido a [una captura del home de ML], no
usar los mismos colores, sino la forma de mostrar todo"). Solo toca `Catalog.tsx` — el resto del
sitio (Header, Admin, Profile) sigue con su paleta/tipografía de siempre:
- `index.css` ganó tokens de Tailwind v4 (`@theme`) usados **solo** por esta página:
  `font-catalog` (tipografía "Plus Jakarta Sans", cargada por `<link>` en `index.html` — no pisa
  el `font-sans` global) y la paleta `ink`/`canvas`/`line`/`brand`/`brand-dark` (azul propio, no el
  amarillo/celeste de ML — pedido explícito: "no usar los mismos colores"). Los tokens quedan
  definidos globalmente (Tailwind v4 es así por naturaleza) pero ningún otro componente los usa.
- Estructura de la página calcada del *ritmo* del home de ML, no de su contenido: franja de marca
  full-bleed arriba (`bg-brand`, nombre + buscador + Contacto, siempre visible sin scrollear),
  hero grande debajo (degradado `brand`→`brand-dark`, el único texto que afirma algo: "Bazar y
  juguetería..."), pills de categoría, título de sección real ("Todos los productos") antes de la
  grilla. **A propósito NO tiene** nada de lo que ML sí muestra pero acá sería inventado: badges de
  "% OFF", "Envío gratis", cuotas — `Product` no tiene precio de oferta ni hay ninguna política de
  envío configurada en el proyecto, mostrar eso sería mentirle a un cliente real.
- Grilla más densa (hasta 5 columnas), cards con borde fino en reposo y sombra/borde `brand` solo
  al hover (no sombra pareja en todas por default), precio como elemento más grande/pesado de la
  card (en `brand`, `tabular-nums` para que alineen en columna), categoría como pill discreta
  (sentence case, no un eyebrow en mayúsculas).
- El `<select>` de categoría se reemplazó por pills — filtran al toque, mismo comportamiento
  inmediato que ya tenía `handleCategoriaChange`.
- **Pills en marquesina** (pedido explícito posterior del usuario, sobre una captura de las pills):
  se mueven solas de izquierda a derecha (`@keyframes catalog-marquee` en `index.css`, contenido
  duplicado x2 dentro de la cinta para que el loop no se note), salvo el botón "Todo", que queda
  fijo afuera de la cinta. Se pausa con `hover:`/`focus-within:[animation-play-state:paused]` — si
  no, sería imposible clickear una categoría puntual mientras se desliza. Respeta
  `prefers-reduced-motion` (`motion-reduce:animate-none` + vuelve al scroll manual de siempre, la
  copia decorativa se oculta con `motion-reduce:hidden` para no duplicar cada categoría en ese
  caso). La copia duplicada lleva `aria-hidden` + `tabIndex={-1}` (`renderCategoriaPills(true)`)
  para que un lector de pantalla o la navegación por teclado no la anuncien/tabulen dos veces.
- Verificado visualmente con capturas (Playwright vía `npx playwright screenshot`, no hay
  `chromium-cli` instalado en este entorno) en desktop y mobile — encontró y corrigió un bug real
  de responsive: el buscador quedaba apretado en una sola fila con "Catálogo"/"Contacto" en mobile,
  ahora pasa a su propia fila (`flex-wrap` + `order-*` + `basis-full` en sm).

**Footer global** (pedido explícito del usuario, después de preguntar qué era el footer que veía
en otros sitios — Western Union, Emol — y si correspondía sumarlo acá): `components/Footer.tsx`,
nuevo, montado en `App.tsx` junto a `Header` — a diferencia de `Header`, este SÍ se muestra
siempre, en cualquier ruta, con o sin sesión. A propósito **no** tiene nada de lo que esos
ejemplos mostraban pero acá sería inventado: sin redes sociales (no hay ninguna cuenta configurada
en el proyecto), sin Términos/Privacidad (esas páginas no existen, un link ahí rompería), sin
razón social en el copyright (el proyecto no tiene un nombre de negocio definido en ningún lado).
Solo contenido real: links a Catálogo/Contacto, y el WhatsApp de contacto si está configurado
(mismo `getContactWhatsappService` público que ya usa `ContactPage.tsx`). Estilo neutro (blanco/
gris, el azul de link de siempre) — no usa los tokens `font-catalog`/`brand` del catálogo, porque
este componente aparece también en Admin/Perfil/Login.

**Listados del panel con íconos + scroll interno** (pedido explícito del usuario, en dos pasos —
primero solo en `CategoriesPage.tsx`, sobre una captura de esa pantalla: "se ve bastante feo al
cliente, quiero reemplazar los botones... por íconos y que la lista sea más homogénea"; después
"replicalo" a Productos/Usuarios + "quiero que las listas no crezcan infinitamente hacia abajo,
crea un scroll... según alto de pantalla"):
- `components/ui/icons.tsx`, nuevo — `PencilIcon`/`BanIcon`/`CheckCircleIcon`, SVGs propios (sin
  librería nueva), `stroke="currentColor"` para heredar el color de texto del botón que los
  envuelve. `BanIcon`/`CheckCircleIcon` comparten la misma base (círculo) con una marca interior
  distinta a propósito, para que el par activo/inactivo se lea como opuestos de una misma acción.
  Cada botón-ícono lleva `title` + `aria-label` con el nombre de la fila (ej. `Editar ${nombre}`)
  — sin texto visible, un botón sin nombre accesible es invisible para un lector de pantalla.
- `CategoriesPage.tsx` (Categories/), `ProductsListPage.tsx` (Products/) y `UsersPage.tsx` (Users/)
  — las tres listas del panel ADMIN, mismo tratamiento en las tres: los botones de texto
  "Editar"/"Dar de baja"/"Reactivar" pasaron a estos íconos, y `CategoriesPage.tsx` además pasó de
  una lista de "pills" de ancho variable (se veía irregular con muchas categorías) a una tabla —
  mismo patrón de columnas que ya usaban `ProductsListPage.tsx`/`UsersPage.tsx`, ahora las tres
  quedan visualmente homogéneas entre sí.
- **Scroll interno con header sticky**: cada tabla vive en un
  `<div className="overflow-auto max-h-[60vh]">` (antes `overflow-x-auto` nomás) — `60vh`, relativo
  al alto de la ventana y no un píxel fijo, para que se adapte a cualquier tamaño de pantalla (pedido
  explícito: "según alto de pantalla"). Cada `<th>` lleva `sticky top-0 z-10 bg-white` (en vez de
  ponerlo en el `<thead>` — el soporte de `position: sticky` en `<thead>` es menos consistente entre
  navegadores que ponerlo directo en cada celda), así el encabezado no se pierde de vista al
  scrollear una lista larga. Verificado de verdad con una captura full-page (no solo con el viewport
  recortado): con 11 categorías la tabla corta antes de la última fila y el footer aparece pegado
  después, sin que la tabla haya crecido para hacerle lugar — confirma que el `overflow-auto`
  interno realmente está limitando el alto, no es solo el borde del viewport de la captura.
- Para verificar esto en el navegador hizo falta una sesión de ADMIN real (las páginas están detrás
  de `AuthGuard`+`RoleGuard`) — se firmó un JWT de prueba a mano con el `SECRET_WORD` del `.env` del
  backend y el `id_user` de un ADMIN ya existente en la base (mismo payload que arma
  `AuthService.login`: `idUser`/`nickUsuario`/`role`/`name`), inyectado en `localStorage` vía
  `--load-storage` de Playwright — no se creó ningún usuario nuevo ni se tocó ningún dato, y el
  archivo con el token se borró al terminar de verificar.

## Arquitectura (esto sí hay que mantener con cuidado)

### Alias `@/`
Apunta a `src/` (`vite.config.ts` → `resolve.alias`, `tsconfig.app.json` →
`compilerOptions.paths`). Usarlo para cualquier import que cruce de un
módulo a otro (`@/models`, `@/services`, `@/utilities`, `@/interfaces`,
`@/redux/store`). Dentro de un mismo módulo (ej. entre dos componentes de
`src/components/`), una ruta relativa corta (`../Logout/Logout`) está bien
— no forzar el alias ahí.

### Cliente HTTP centralizado — `src/api/axios.ts`
Instancia única `api` (axios) que **todos** los services deben usar en vez
de `axios` importado directo:
- Interceptor de **request**: agrega `Authorization: Bearer <token>` leyendo
  el usuario de `localStorage` (`UserKey`, en `redux/states/user.ts`). Por
  esto **los services no reciben `token` como parámetro** — si ves un
  service pidiendo `token`, es código viejo sin migrar.
- Interceptor de **response**:
  - `401` → limpia `localStorage` y redirige a `/login`.
  - Sin respuesta del servidor (caído / sin red / `ERR_CONNECTION_REFUSED`)
    → limpia sesión igual que en un 401, pero **redirige a
    `/servicio-no-disponible`, no a `/login`** (bug corregido, pedido explícito
    del usuario): un visitante anónimo navegando el catálogo público nunca tuvo
    sesión, y mandarlo a un login que tampoco va a poder autenticar (el
    servidor sigue caído) no tenía sentido. `pages/Public/ServiceUnavailable/`
    es una página nueva, pública, que a propósito no le pega a la API al
    montarse (si lo hiciera, aterrizar ahí con el servidor todavía caído
    dispararía el mismo error de nuevo) — solo un mensaje + botón "Volver al
    catálogo". Usa una bandera de módulo (`redirigiendoPorServidorCaido`) para
    no disparar varias redirecciones si hay varios requests en paralelo
    fallando a la vez; como el redirect es un `window.location.href` (recarga
    dura), el módulo se reinstancia solo en la página nueva, así que no hace
    falta resetear la bandera a mano. `servidorNoDisponibleAlert()` (el
    `SweetAlert2` que se mostraba antes de redirigir) se sacó de
    `session-alerts.utils.ts` — quedaba redundante con la página nueva, y su
    texto ("vas a ser redirigido al login") ya no era cierto.
  - Cualquier otro error se normaliza a `new Error(mensaje)` (tomado de
    `error.response?.data?.message`), así el `catch` del consumidor nunca
    necesita leer `error.response.data.message` a mano.

### Errores y alertas
- `src/utilities/errors/getErrorMessage.utility.ts` → `getErrorMessage(error)`.
  Usar en **todo** `catch`, en vez de `error.message`/`error?.message` a mano.
- `src/utilities/alerts/alert.utils.ts` → `showSuccess(title, text?)` /
  `showError(text, title?)`, wrappers de SweetAlert2. Si un proyecto nuevo
  necesita alertas de negocio propias (mensajes específicos repetidos),
  agregarlas en un archivo nuevo (ej. `<proyecto>-alerts.utils.ts`), sin
  tocar `session-alerts.utils.ts` (esa es solo del interceptor).

### Sesión y seguridad de páginas
- `src/redux/states/user.ts`: `getInitialUserState()` valida, al hidratar
  el store desde `localStorage`, que el JWT no esté vencido (lo decodifica
  con `jwt-decode`). Si expiró o el storage está corrupto, arranca en
  `EmptyUserState` en vez de dejar una sesión "logueada" que no puede pedir
  nada real. **Esta es la única validación de expiración que debe existir**
  — no duplicarla en un guard o en un `useEffect` de cada página.
- `src/guards/auth.guard.tsx` (`AuthGuard`): decide si hay o no usuario
  logueado (`!!userState.token`). No revalida expiración (ya la hizo
  `getInitialUserState`) ni hace polling — para eso está el interceptor,
  que cierra sesión ante cualquier 401 en cualquier momento.
- `src/guards/rol.guard.tsx` (`RoleGuard`): recibe `roles: Roles[]` (no un
  solo `role`), para poder proteger una ruta que permite más de un rol:
  `<RoleGuard roles={[Roles.ADMIN, Roles.USER]} />`.
- `src/components/Header.tsx`: el menú privado (`DropdownMenu`) solo se
  muestra si hay token **y** la ruta actual no es pública. Si solo se
  chequea el token, un token viejo en `localStorage` hace que el menú
  aparezca un instante sobre la pantalla de login al recargar — bug real
  ya visto antes en otro proyecto similar, cuidado con reintroducirlo.

### Interfaces
`src/interfaces/index.ts` es un barrel — **los nombres de las interfaces
tienen que ser únicos entre archivos** (`GuardProps`, `RoleProps`,
`NotFoundProps`, no `Props` genérico repetido), porque un `export *`
duplicado no compila. Si se agrega una interfaz nueva de props, no llamarla
`Props` a secas.

## Convenciones de trabajo (heredadas de cómo trabaja este usuario)

- **Cambio mínimo necesario.** No proponer reescrituras grandes ni cambiar
  de librería/arquitectura sin que se pida explícitamente.
- Analizar antes de tocar, aplicar el cambio, **compilar y buildear
  después de cada modificación importante** (`npx tsc -b --noEmit` +
  `npx vite build`, y `npm run lint` si el cambio toca algo que el linter
  pueda opinar). No dar algo por terminado sin correr los tres.
- Nunca eliminar algo (`service`, `hook`, `componente`, export) solo porque
  "parece" no usarse — buscar referencias primero. (Así se encontraron los
  exports colgantes a `IngresoProductos`/`Admin/Profile.tsx`: nadie los
  había buscado, y tampoco nadie había buildeado el proyecto para que
  fallaran solos.)
- Entregar el código completo del archivo tocado, no fragmentos sueltos.
- Este proyecto **ya tiene dominio de negocio propio** (productos, categorías — ver "Historia
  reciente" arriba): a diferencia de cuando era solo la plantilla, ahora sí hay que preservar
  nombres de campos y reglas de negocio reales al tocar `pages/Public/Catalog`,
  `pages/Private/Admin/Admin.tsx` o los services de `products`/`categories`. Lo que no cambia es
  que hay que preservar la arquitectura de la sección anterior (auth/HTTP/sesión).

## Al arrancar un proyecto real a partir de esta base

**Esto ya se hizo para este proyecto** (ver "Historia reciente" más arriba, sección "Conexión al
backend real + tienda") — queda acá como referencia del checklist genérico que se siguió, útil si
alguna vez se clona esta base de nuevo para otro proyecto.

1. Cambiar `VITE_API_BASE_URL` en `.env`.
2. Ajustar a la forma real del backend nuevo:
   - `src/interfaces/decode.token.interface.ts` (payload del JWT)
   - `src/models/user.model.ts` (`UserInfo`)
   - `src/interfaces/users.interface.ts` (`User`, lo que devuelve `/auth/profile`)
   - `src/services/auth.service.ts`, `profile.service.ts`, `register.service.ts`
     (rutas y forma de la respuesta del backend)
3. `src/models/roles.enum.ts` y `src/models/routes.ts`: reemplazar los
   roles/rutas de ejemplo (`ADMIN`/`USER`/`GUEST`) por los reales del
   proyecto nuevo.
4. Reemplazar las páginas de ejemplo (`pages/Private/Admin`, `User`,
   `Guest`, `Profile.tsx`) y el menú (`components/NavBars/DropdownMenu.tsx`,
   que todavía tiene links placeholder tipo `/admin/1`, `/link3`) por las
   páginas reales.
5. No hace falta tocar `src/api/axios.ts`, los guards, ni
   `redux/states/user.ts` salvo que el backend nuevo tenga un contrato de
   auth realmente distinto (ej. refresh tokens, cookies en vez de
   `Authorization` header).

## Estructura

```
src/
├─ index.css                           (@import "tailwindcss" + tokens propios de Catalog.tsx:
│                                        font-catalog, ink/canvas/line/brand/brand-dark,
│                                        @keyframes catalog-marquee; + font-catalog2 (Catalog2.tsx),
│                                        font-catalog3 (Catalog3.tsx), font-catalog4-display +
│                                        --color-c4-* (Catalog4.tsx), font-catalog5 + --color-c5-*
│                                        (Catalog5.tsx), font-catalog6 + --color-c6-* (Catalog6.tsx)
│                                        — ver "Historia reciente",
│                                        secciones "Rediseño visual del catálogo" y "Múltiples
│                                        diseños de catálogo + Landing")
├─ api/axios.ts                        (instancia axios + interceptors — no tocar sin razón)
├─ catalogs/                           (registro central de diseños de catálogo — catalog.types.ts
│                                        + catalogs.config.ts, barrel en index.ts; ver "Historia
│                                        reciente", sección "Múltiples diseños de catálogo +
│                                        Landing". Agregar un diseño nuevo = una página en
│                                        pages/Public/CatalogN/ + una entrada acá, nada más — ni
│                                        Home.tsx ni App.tsx necesitan tocarse)
├─ components/
│  ├─ Header.tsx                       (chequea token + ruta pública — menú privado, NO el footer)
│  ├─ Footer.tsx                       (pie de página global, se ve en toda ruta — ver "Historia
│  │                                     reciente")
│  ├─ Cart/CartLink.tsx                (ícono + badge de cantidad, link a /carrito — por ahora solo
│  │                                     lo usa Catalog.tsx, ver "Historia reciente", sección
│  │                                     "Carrito de compra (Fase 2)")
│  ├─ Logout/Logout.tsx                (hook useLogout)
│  ├─ NavBars/DropdownMenu.tsx         (menú real, header oscuro — ver "Historia reciente")
│  ├─ ProductSearch/InputBuscarProductos.tsx  (buscador en vivo, debounce + teclado — ver
│  │                                     "Historia reciente")
│  ├─ Profile/ProfileField.tsx         (campo editable de Profile.tsx — ver "Historia reciente",
│  │                                     sección "Perfil rediseñado")
│  └─ ui/                              (Button, Modal [sobre @headlessui/react], FormField
│                                        [+ inputClass/checkboxClass], PageHeader, EmptyState,
│                                        PasswordConfirmModal, MenuToggleButton, SubmenuItem —
│                                        barrel en ui/index.ts; los primeros 5 son el "App Shell",
│                                        ver "Historia reciente")
├─ guards/                             (AuthGuard, RoleGuard)
├─ hooks/useClickOutside.ts            (genérico — cierra menús/desplegables al clickear afuera)
├─ interfaces/                         (barrel: @/interfaces — nombres únicos; incluye
│                                        product.interface.ts, category.interface.ts,
│                                        contact.interface.ts, users.interface.ts [User +
│                                        UserListItem], cart.interface.ts [CartItem])
├─ models/                             (Roles, PublicRoutes/PrivateRoutes, UserInfo)
├─ pages/
│  ├─ Login/                           (formulario básico, sin estilar)
│  ├─ Register/                        (SIN USAR — no hay signup público en el backend, ver
│  │                                     "Historia reciente"; ruta sacada de App.tsx)
│  ├─ Public/
│  │  ├─ Home/Home.tsx                 (Landing — home del sitio, montada en '/'; arma las cards a
│  │  │                                 partir de src/catalogs/, no conoce los diseños en
│  │  │                                 particular — ver "Historia reciente")
│  │  ├─ Catalog/                      (diseño "clásico" de catálogo, montado en '/catalog' — el
│  │  │                                 detalle de un producto se abre en ProductDetailModal.tsx,
│  │  │                                 no navega)
│  │  ├─ Catalog2/                     (diseño "moderno", estilo pcfactory.cl, montado en
│  │  │                                 '/catalog2' — mismos datos que Catalog/, reutiliza su
│  │  │                                 ProductDetailModal.tsx; ver "Historia reciente")
│  │  ├─ Catalog3/                     (diseño "tienda departamental", estilo paris.cl, montado en
│  │  │                                 '/catalog3' — mismos datos, reutiliza ProductDetailModal.tsx
│  │  │                                 de Catalog/; ver "Historia reciente")
│  │  ├─ Catalog4/                     (diseño "vidriera boutique", editorial/serif, montado en
│  │  │                                 '/catalog4' — mismos datos, reutiliza ProductDetailModal.tsx
│  │  │                                 de Catalog/; ver "Historia reciente")
│  │  ├─ Catalog5/                     (diseño "galería" oscuro/dorado, carrusel de productos,
│  │  │                                 montado en '/catalog5' con sub-ruteo propio —
│  │  │                                 Catalog5.tsx [shell], CatalogoCarrusel.tsx [listado],
│  │  │                                 DetalleProducto.tsx [página de detalle, NO modal, en
│  │  │                                 'detalleproducto/:id']; único catálogo con
│  │  │                                 hasSubRoutes: true — ver "Historia reciente")
│  │  ├─ Catalog6/                     (landing densa "tienda por departamentos", montada en
│  │  │                                 '/catalog6' — Catalog6.tsx [página], HeroCarousel.tsx,
│  │  │                                 CategoryDrawer.tsx, ProductCarousel.tsx, ProductCard.tsx
│  │  │                                 [reutilizable]; datos reales, reutiliza
│  │  │                                 ProductDetailModal.tsx de Catalog/ — ver "Historia reciente")
│  │  ├─ Catalog7/                     (grilla técnica densa, acento índigo, montada en
│  │  │                                 '/catalog7' — Catalog7.tsx [página], ProductCard.tsx
│  │  │                                 [+ ProductCardSkeleton, reutilizables]; único catálogo sin
│  │  │                                 tokens propios en index.css (usa la tipografía del sistema
│  │  │                                 a propósito) — ver "Historia reciente")
│  │  ├─ ProductDetail/                (detalle público de un producto por URL directa, montada en
│  │  │                                 'productos/:id' — sin enlazar desde la UI, ver "Historia
│  │  │                                 reciente")
│  │  ├─ ServiceUnavailable/           (destino del interceptor de axios cuando el servidor no
│  │  │                                 responde, montada en 'servicio-no-disponible' — ver
│  │  │                                 "Cliente HTTP centralizado" más abajo)
│  │  ├─ Contact/ContactPage.tsx       (form público de contacto, montada en 'contacto' — NO está
│  │                                    en PublicRoutes, ver "Historia reciente")
│  └─ Cart/CartPage.tsx             (carrito, montada en 'carrito' — NO está en PublicRoutes,
│                                       mismo criterio que Contact/; estilo "App Shell", no el de
│                                       ningún catálogo — ver "Historia reciente", sección
│                                       "Carrito de compra (Fase 2)")
│  └─ Private/
│     ├─ Admin/Admin.tsx               (layout + tabs + sub-ruteo, solo ADMIN — ver Admin/Products/,
│     │                                 Admin/Categories/, Admin/Users/, Admin/Contact/,
│     │                                 Admin/Orders/, y "Historia reciente")
│     ├─ Admin/Products/                (ProductsListPage, ProductFormPage [crear y editar])
│     ├─ Admin/Categories/              (CategoriesPage)
│     ├─ Admin/Users/                   (UsersPage, UserFormModal [crear y editar, en un modal])
│     ├─ Admin/Contact/                 (ContactSettingsPage — email/WhatsApp de contacto, no es
│     │                                  parte de Profile.tsx)
│     ├─ Admin/Orders/                  (OrdersPage, OrderDetailModal, orderStatus.utils — panel de
│     │                                  pedidos, de solo lectura, ver "Historia reciente" sección
│     │                                  "Panel de pedidos (Fase 5)")
│     ├─ User/User.tsx                 (layout + tabs + sub-ruteo, solo USER — ver
│     │                                 User/CargarProducto/, User/MisProductos/, y "Historia
│     │                                 reciente")
│     ├─ User/CargarProducto/          (CargarProductoPage — crear producto + imagen)
│     ├─ User/MisProductos/            (MisProductosPage — solo lectura + reactivar)
│     ├─ Guest/                        (CONTENIDO DE EJEMPLO todavía, sin función propia)
│     └─ Profile.tsx
├─ redux/
│  ├─ states/user.ts                   (sesión: createUser/updateUser/resetUser + getInitialUserState)
│  ├─ states/cart.ts                   (carrito client-side: addToCart/setCantidad/removeFromCart/
│  │                                     clearCart + getInitialCartState — mismo patrón que user.ts,
│  │                                     ver "Historia reciente", sección "Carrito de compra (Fase 2)")
│  └─ store.ts
├─ services/                           (auth, profile, products, categories, contact, users —
│                                        todos vía `api`, sin `token` param; register.service.ts
│                                        sin usar)
└─ utilities/
   ├─ apiUrl.utility.ts                (apiUrl + apiOrigin, para URLs de imágenes)
   ├─ errors/getErrorMessage.utility.ts
   └─ alerts/ (alert.utils.ts, session-alerts.utils.ts)
```

**Empaquetado como app Android con Capacitor** (pedido explícito del usuario: probar la tienda
como app nativa en el emulador de Android Studio, todavía **sin** pensar en publicación real —
esa etapa queda para cuando el backend esté en un servidor con HTTPS):
- `@capacitor/core`/`@capacitor/cli`/`@capacitor/android` (`8.5.1`, la última al momento, pide
  `node >=22`), `capacitor.config.ts` (`appId: com.tiendabasica.tienda`, `appName: Tienda
  Básica`, `webDir: dist`) y la carpeta `android/` (proyecto Gradle nativo generado por `npx cap
  add android`, se versiona junto al resto — es el estándar de Capacitor, no un build artifact).
- **URL del backend para el emulador**: `.env.mobile`, nuevo (`VITE_API_BASE_URL=http://10.0.2.2:3006/tienda/v1`)
  — `10.0.2.2` es la dirección con la que el emulador ve al `localhost` de la PC que lo hostea;
  `localhost` a secas desde adentro del emulador apunta al propio emulador, no al backend. Separado
  del `.env` normal (que sigue con `localhost:3006` para `npm run dev` en el navegador) vía el
  mecanismo de modos de Vite: `npm run build:mobile` (nuevo script, `tsc -b && vite build --mode
  mobile`) usa `.env.mobile` en vez de `.env`. No es secreto, se versiona (a diferencia de `.env`).
- **Cleartext HTTP solo hacia `10.0.2.2`**: Android 9+ bloquea HTTP plano por default y el backend
  de desarrollo no tiene HTTPS. `android/app/src/main/res/xml/network_security_config.xml`, nuevo
  — un `domain-config` que habilita `cleartextTrafficPermitted` únicamente para el dominio
  `10.0.2.2` (no global), referenciado desde `AndroidManifest.xml`
  (`android:networkSecurityConfig="@xml/network_security_config"` en `<application>`).
- **Mixed Content — el segundo bloqueo, aparte del anterior**: con el `network_security_config` ya
  andando, las llamadas seguían sin llegar — el WebView servía la app bajo `https://localhost`
  (el `androidScheme` default de Capacitor) y bloqueaba como "Mixed Content" cualquier XHR HTTP
  hecha desde ahí, sin importar que el cleartext estuviera permitido (son dos políticas
  distintas). Se diagnosticó con `adb logcat` filtrando por `Capacitor/Console` (el error de
  Mixed Content aparece ahí, no como un error de red genérico). Arreglo: `server.androidScheme:
  'http'` en `capacitor.config.ts` — sirve la app también por HTTP, así deja de ser "mixed".
  **Revertir a `https` (el default, sacando el bloque `server`) cuando el backend tenga HTTPS
  real** — ver el comentario en el archivo.
- Después de tocar `capacitor.config.ts` o `.env.mobile`: `npm run build:mobile` + `npx cap sync
  android`, y recién ahí Run desde Android Studio (`npx cap open android` para abrirlo) — `cap
  sync` no dispara un rebuild de Android Studio solo.

**Múltiples diseños de catálogo + Landing** (pedido explícito del usuario: poder ofrecer varios
diseños visuales del mismo catálogo, elegibles desde una página de entrada, sin duplicar la lógica
de datos ni tocar el backend):
- `src/catalogs/` (nuevo) — registro central (`CatalogDefinition[]`, en `catalogs.config.ts`):
  `id`, `name`, `description`, `path` (sin slash inicial), `component` (`React.lazy`, así la
  Landing no trae el JS de cada diseño con ella) y `previewClassName` (degradé Tailwind puramente
  decorativo para la card de la Landing — no una captura real, así no se desactualiza si el diseño
  cambia). **Agregar un catálogo nuevo (`Catalog3`, etc.) es una página nueva en
  `pages/Public/Catalog3/` + una entrada acá — no hace falta tocar `Home.tsx` ni `App.tsx`.**
- `App.tsx`: las rutas de cada diseño se generan con `catalogs.map(...)` (`<Route path={catalog.path}
  element={<catalog.component />} />`) en vez de una `<Route>` a mano por diseño — sumar una
  entrada al registro alcanza. `'/'` pasó de montar `Catalog` directo a montar la Landing nueva.
- `pages/Public/Home/Home.tsx` (nuevo) — la Landing en sí: recorre `catalogs` y arma una card por
  diseño (preview + nombre + descripción + botón "Ver catálogo" a `/${catalog.path}`). No pide
  nada al backend, es pura navegación.
- `pages/Public/Catalog2/Catalog2.tsx` (nuevo) — segundo diseño, inspirado visualmente en
  pcfactory.cl (navbar oscura, acento rojo, sidebar de categorías en vez de la marquesina de pills
  de `Catalog.tsx`, grilla más densa). Usa **exactamente** `getProductsService`/
  `getCategoriesService` (mismo backend, mismos datos que `Catalog.tsx` — ninguna lógica de acceso
  a datos duplicada) y reutiliza `ProductDetailModal` de `Catalog/` para el detalle en vez de
  reimplementarlo. Tipografía propia ("Inter", token `--font-catalog2` en `index.css`, agregada
  sin tocar los tokens de `Catalog.tsx`; fuente sumada al mismo `<link>` de Google Fonts de
  `index.html`) — el resto de la paleta usa los colores default de Tailwind (`red-*`/`neutral-*`)
  directo, sin tokens nuevos. A propósito **no** tiene nada que el modelo de datos no respalde
  (specs técnicas, comparador, cuotas, carrito — no hay carrito en este proyecto): mismo criterio
  de "no inventarle funciones a la tienda" que ya documenta `Catalog.tsx`.
- **`Catalog.tsx` no se tocó** — se movió de `/` a `/catalog` (solo cambió dónde lo monta
  `App.tsx`), su contenido/comportamiento quedó intacto.
- Ajustes de navegación, por el corrimiento de `/` (antes catálogo, ahora Landing) — 3 cambios de
  una línea, sin tocar lógica: `Footer.tsx` (el link que decía "Catálogo" ahora dice "Inicio",
  sigue en `/` — sigue funcionando como "volver al inicio" desde cualquier página, catálogos
  nuevos incluidos); `ContactPage.tsx`/`ProductDetail.tsx` ("← Volver al catálogo" pasa de `to="/"`
  a `to="/catalog"` — mismo destino exacto que antes); `DropdownMenu.tsx` (nav privada de
  ADMIN/USER: el link "Catálogo" pasa de `path: '/'` a `path: '/catalog'` — mismo destino exacto
  que antes).
- **Bug encontrado de paso, causado por el path nuevo**: `DropdownMenu.isActive` marcaba un link
  como activo con `location.pathname.startsWith(path)` — con `path: '/catalog'` y una ruta real
  `/catalog2` en el sitio, `'/catalog2'.startsWith('/catalog')` da `true`, así que el link
  "Catálogo" se marcaba activo estando en `/catalog2`. Se corrigió a exigir coincidencia exacta o
  que el siguiente carácter sea `/` (mismo criterio que ya tenía el caso especial de `'/'`).
- `eslint.config.js` ganó `android` a los `ignores` (junto a `dist`) — quedó pendiente de la etapa
  de Capacitor: `npm run lint` fallaba con cientos de errores sobre el JS empaquetado de
  `android/app/build/`, que no es código fuente de este proyecto.

**Tercer diseño de catálogo — `Catalog3.tsx`** (pedido explícito del usuario, sobre
`https://www.paris.cl/` como referencia visual): mismo patrón que `Catalog2.tsx` — una página
nueva en `pages/Public/Catalog3/` + una entrada en `catalogs.config.ts`, sin tocar `Home.tsx` ni
`App.tsx` (confirma que el registro central cumple lo que promete). Montado en `/catalog3`.
- Estética "tienda departamental": paleta rosa/fucsia (`fuchsia-*`/`pink-*` default de Tailwind,
  sin tokens de color nuevos, mismo criterio que `Catalog2.tsx`), tipografía redondeada ("Poppins",
  token `--font-catalog3` en `index.css`, sumada al mismo `<link>` de Google Fonts de
  `index.html`), buscador en formato píldora, banner grande muy redondeado, y pestañas de
  categoría con subrayado (una variante más de "un solo filtro seleccionado a la vez" — pills en
  `Catalog.tsx`, sidebar en `Catalog2.tsx`, tabs acá). Mismos servicios
  (`getProductsService`/`getCategoriesService`) y mismo `ProductDetailModal` reutilizado que los
  otros dos diseños — ninguna lógica de datos duplicada. Sin nada que el modelo de datos no
  respalde (% de descuento, cuotas, favoritos, carrito) — mismo criterio ya documentado en
  `Catalog.tsx`/`Catalog2.tsx`.
- Primer uso real de `@heroicons/react` en el proyecto (`MagnifyingGlassIcon`, decorativo dentro
  del input de búsqueda) — era dependencia de la plantilla original, nunca se había usado hasta
  ahora (mismo caso que `@headlessui/react`/`Modal.tsx` antes de `ProductDetailModal.tsx`).
- **Gotcha de dev encontrado acá**: al agregar `@heroicons/react` como import nuevo, el ícono se
  renderizaba gigante (cientos de px) en el dev server ya corriendo — Vite no había re-optimizado
  la dependencia nueva en caliente. Se resolvió solo reiniciando `npm run dev`; no es un bug de
  código. Si un ícono/dependencia nueva se ve "roto" justo después de agregarla, reiniciar el dev
  server antes de asumir que el CSS/componente está mal.

**Rediseño UI/UX completo, usando la skill `frontend-design`** (pedido explícito del usuario:
"una verdadera revisión y mejora de diseño UI/UX", no solo cambiar colores — con la skill cargada
como guía activa durante todo el proceso, no solo consultada de pasada). Metodología en 2 pasos:
primero un diagnóstico completo (problemas visuales/UX, qué mantener/rediseñar, dirección
propuesta) presentado y confirmado por el usuario **antes** de tocar código; después, la
implementación. El diagnóstico completo (con capturas reales del estado anterior) quedó en la
conversación, no acá — lo que sigue es el resultado.

- **Dos sistemas de diseño separados, a propósito**: los 3 catálogos (`Catalog`/`Catalog2`/
  `Catalog3`) ya tenían identidad visual propia (ver la sección anterior) y **no se tocó su
  estructura** — solo un refinamiento acotado (ver más abajo). Lo que no tenía ningún sistema
  real era el resto del sitio (Login, Perfil, panel Admin/User, Contacto, ProductDetail viejo,
  ServiceUnavailable, 404): cada página repetía a mano las mismas clases de Tailwind
  (`border-gray-300`, botones azules sin foco visible), y `Login.tsx` no tenía **ninguna** clase
  — HTML crudo. Se le dio a todo eso un sistema propio, "App Shell":
  - **Paleta**: `slate-900/700/50` (ya lo venían estableciendo `DropdownMenu.tsx`/`Home.tsx` como
    el neutro del sitio, acá se formaliza) + `teal-600` como acento de acción — deliberadamente
    **distinto** de los colores de cada catálogo (brand/red/fuchsia), para que nunca se confunda
    "estoy en una herramienta interna" con "estoy en un catálogo". `red-600` reservado para lo
    realmente destructivo.
  - **Tipografía**: Inter — ya estaba cargada para `Catalog2.tsx`, se reutiliza acá seteándola
    como `font-family` de `body` en `index.css` (no un token `font-*` nuevo: como los 3
    catálogos ya pisan la fuente en su propio div raíz, alcanza con el default de `body`, así no
    hizo falta tocar 14 archivos solo para la fuente).
  - Componentes nuevos en `components/ui/` (ver el barrel `index.ts`), todos sin lógica propia
    (reciben `value`/`onChange`/`error`/`children`, igual que ya hacía `Button.tsx`):
    `FormField.tsx` (label + control + error/hint, + exporta `inputClass`/`checkboxClass`
    compartidos), `PageHeader.tsx` (título + descripción + acción), `EmptyState.tsx` (reemplaza
    los `<p>` sueltos de "no hay nada todavía"), `PasswordConfirmModal.tsx` (ver más abajo).
    `Button.tsx`: variante `primary` pasó de azul a teal, ganó `danger` (para futuro uso —
    destructivo de verdad, no "dar de baja" que se puede reactivar) y foco visible
    (`focus-visible:ring-2`), que antes no tenía ninguna variante.
  - Aplicado a las 14 páginas del "App Shell": `Login.tsx` se reconstruyó de cero (no había nada
    que refinar); el resto (Admin: `Admin.tsx`, `ProductsListPage`, `ProductFormPage`,
    `CategoriesPage`, `UsersPage` + `UserFormModal`, `ContactSettingsPage`; User: `User.tsx`,
    `CargarProductoPage`, `MisProductosPage`; público: `ContactPage`, `ProductDetail`,
    `ServiceUnavailable`, el 404 de `RoutesWithNotFound.utility.tsx`) migraron sus inputs/tablas/
    botones a los componentes de arriba sin tocar ninguna lógica de fetch/estado/permisos.
  - **`MisProductosPage.tsx` ganó el scroll interno + header sticky que ya tenían las otras 3
    tablas del panel** (`ProductsListPage`/`CategoriesPage`/`UsersPage`) y no ella — inconsistencia
    real que apareció en el diagnóstico, no solo un cambio de color.
  - **`Profile.tsx` — el cambio más delicado**: el `Swal.fire({ input: 'password' })` que pedía
    confirmar cada actualización se reemplazó por `PasswordConfirmModal` (propio, sobre
    `Modal.tsx`). Mismo contrato hacia `ProfileField` (`onSave` sigue siendo `() =>
    Promise<boolean>`) — `handleUpdate` ahora abre el modal y devuelve una promesa que se resuelve
    recién cuando el usuario confirma (éxito) o cancela, guardada en un `ref` porque JS no tiene
    forma nativa de "esperar" a un modal de React como si fuera un `Swal.fire` bloqueante. Un
    error del backend (ej. contraseña incorrecta) deja el modal abierto con el error inline en vez
    de mandar a un toast aparte, para poder reintentar sin perder el flujo. El resto de los
    `Swal.fire` del proyecto (confirmaciones de "dar de baja", toasts de éxito/error en las otras
    páginas) **no se tocó** — quedó fuera de alcance a propósito, ver "Alcance" más abajo.
  - Se sacaron las etiquetas en mayúscula ("DATOS DE LA CUENTA", el header de la sidebar de
    categorías en `Catalog2.tsx`, el tag de categoría en sus cards) — la skill `frontend-design`
    marca el uppercase-label como uno de los tells más reconocibles de diseño genérico. Sentence
    case en su lugar, mismo criterio que ya usaban `Catalog.tsx`/`Catalog3.tsx` sin que nadie se
    lo señalara.

- **Refinamiento acotado de los 3 catálogos** (no reescritura — `Catalog.tsx` en particular pidió
  explícitamente no tocarse de más):
  - `Catalog.tsx`: el hero (gradiente lineal liso) ganó una textura de puntos sutil (capa
    `radial-gradient` decorativa aparte del degradé de marca, `aria-hidden`) — evoca la variedad
    de un bazar sin depender de una foto ni cambiar la paleta/copy/estructura existente.
  - `Home.tsx`: pasó de 2 cards "imagen arriba, texto abajo" (el kit de card genérico que marca
    la skill) a láminas tipo póster — el degradé de cada diseño ocupa toda la tarjeta, con el
    nombre superpuesto (scrim oscuro para legibilidad) en vez de vivir aparte en una franja de
    texto. Grilla a 3 columnas (antes pensada para 2 catálogos). El CTA de cada card se probó
    primero con una flecha `→` al final — la skill la marca explícitamente como tell genérico, se
    sacó, queda solo el texto con subrayado al hover.
  - `Catalog2.tsx`: la etiqueta de categoría de cada card y el título "Categorías" de la sidebar
    pasaron de mayúscula a sentence case (ver arriba).
  - `ProductDetailModal.tsx` (compartido por los 3 catálogos): el borde de la miniatura
    seleccionada era `border-blue-600` fijo — coincidía por casualidad con `Catalog.tsx` pero
    desentonaba en `Catalog2`/`Catalog3`. Pasó a `border-slate-800` (neutro, funciona en los 3
    contextos).

- **Bug real encontrado y corregido durante la Etapa 5 (revisión)**: el botón "Buscar" de
  `Catalog2.tsx`/`Catalog3.tsx` usaba `<Button className="bg-red-600...">`/`<Button
  className="bg-fuchsia-600...">` para pisar el color `primary` de `Button.tsx` — dependía de que
  Tailwind generara la clase del color pisado *después* de la del variant en el CSS final (CSS
  gana por orden de aparición cuando dos clases de igual especificidad tocan la misma propiedad).
  Con `primary` en azul, esto por casualidad funcionaba (alfabéticamente "blue" < "red"/"fuchsia");
  al pasar `primary` a teal ("teal" > "red"/"fuchsia") el orden se invirtió y los dos botones se
  veían teal en vez de su color de marca — **regresión silenciosa, sin ningún error de build/lint**
  que la delatara, solo visible en pantalla. Se corrigió sacando esos dos botones de `<Button>` y
  escribiéndolos como `<button>` con su color completo a mano (mismo criterio que ya usan sus
  otros botones propios, como "Ver detalle"/"Ver producto") — un color de marca fijo no debe
  depender del orden de generación de clases de otro componente. Si en el futuro hace falta pisar
  el color de `<Button>` por `className`, mejor no hacerlo: usar un `<button>` propio.

- **Alcance — qué quedó deliberadamente afuera de esta pasada**: `pages/Private/Guest/Guest.tsx`
  (sigue siendo contenido de ejemplo sin función real, ver el principio de este archivo —
  rediseñarlo sería inventarle una función que no tiene); los `Swal.fire` de confirmación
  ("¿Confirmás dar de baja...?") y de éxito/error en el resto del proyecto (solo se tocó el de
  `Profile.tsx`, el único que pedía **datos** en vez de solo confirmar/avisar).

**Cuarto diseño de catálogo — `Catalog4.tsx`** (pedido explícito del usuario, con la skill
`frontend-design` como guía activa — ver esa skill en `~/.claude/skills/frontend-design/`). Mismo
patrón de siempre: página nueva en `pages/Public/Catalog4/` + una entrada en
`catalogs.config.ts`, sin tocar `Home.tsx` ni `App.tsx`. Montado en `/catalog4`.
- Identidad "vidriera boutique" — la que ninguno de los otros 3 cubría (marketplace clásico,
  técnico denso, tienda departamental colorida): casi blanco + tinta + verde esmeralda (paleta
  propia nueva, `--color-c4-*` en `index.css` — a diferencia de Catalog2/Catalog3, que reusan la
  paleta default de Tailwind, acá hizo falta un tono de verde que Tailwind no tiene tal cual),
  serif con carácter (**Fraunces**, agregada al mismo `<link>` de Google Fonts) **solo** para
  títulos/nombres de producto — el cuerpo usa el sans del sistema, no se sumó una segunda fuente
  nueva. Sin banner-degradé (apertura editorial: título + párrafo, sin bloque de color), sin
  cards redondeadas ni con sombra (separadas por aire + una imagen en `aspect-[4/5]`, no
  cuadrada), filtro de categoría como lista de texto con la activa en itálica (pill en
  `Catalog.tsx`, sidebar en `Catalog2.tsx`, pestañas subrayadas en `Catalog3.tsx` — esta es la
  cuarta variante distinta del mismo patrón "un filtro seleccionado a la vez"). Mismos servicios
  (`getProductsService`/`getCategoriesService`) y mismo `ProductDetailModal` reutilizado — sin
  carrito (este proyecto no tiene checkout en ningún lado) ni badges de descuento/cuotas
  inventados, mismo criterio que los otros 3.
- Cada card es un único `<button>` (imagen + nombre + precio + "Ver detalle" adentro) — la
  primera versión tenía dos botones apilados haciendo exactamente lo mismo (una redundancia real
  para navegación por teclado/lector de pantalla), se corrigió antes de terminar la pasada.
- El buscador (`InputBuscarProductos`, reutilizado) se restyleó a línea simple (sin caja) vía
  `[&_input]:` en el `className` del wrapper — mismo mecanismo que ya usó `Catalog3.tsx` para su
  buscador en píldora. A diferencia del bug de `Button.tsx` documentado arriba, este patrón **sí**
  es seguro contra el orden de generación de Tailwind: un selector descendiente (`.wrapper input`)
  tiene más especificidad que una clase suelta en el propio input, gana siempre, no depende de
  qué se generó primero.
- **`Home.tsx` — bug de contenido encontrado de paso**: el título decía "tres formas de
  mirarlo", ya desactualizado con este cuarto catálogo (y ya le había pasado antes con el
  tercero). Se sacó el número del título ("muchas formas de mirarlo") para que no vuelva a
  quedar mal la próxima vez que se agregue un diseño al registro.

**Quinto diseño de catálogo — `Catalog5.tsx`, el primero con página de detalle propia** (pedido
explícito del usuario, con la skill `frontend-design` como guía activa — dos preguntas se le
hicieron antes de implementar: estructura del carrusel y dirección del fondo, ver la respuesta
del usuario en la conversación). Montado en `/catalog5`.
- Identidad "vidriera de noche": el único de los 5 con fondo oscuro en toda la página (no solo
  la navbar, como `Catalog2.tsx`) — negro carbón + acento dorado/bronce (`--color-c5-*` en
  `index.css`, paleta propia como `Catalog4.tsx`) + tipografía Space Grotesk (`--font-catalog5`,
  agregada al `<link>` de Google Fonts). Pedido explícito del usuario: "no quiero el blanco
  plano de IA".
- **Galería como carrusel horizontal** (scroll-snap nativo de CSS, sin librería) en vez de
  grilla estática — filtro de categoría (chips) decide qué entra al carrusel, flechas
  funcionales (`ChevronLeftIcon`/`ChevronRightIcon` de heroicons) arriba a la derecha además del
  swipe/drag nativo. Se evaluó también un carrusel por categoría estilo Netflix — se descartó
  porque con el catálogo real de hoy (pocas categorías, ~1 producto c/u) cada fila quedaría casi
  vacía; un solo carrusel + filtro aprovecha mejor los datos que hay.
- **Clickear un producto NAVEGA a una página nueva, no abre un modal** — a diferencia de los
  otros 4 catálogos (todos reutilizan `ProductDetailModal.tsx`), acá cada card es un `<Link>` a
  `/catalog5/detalleproducto/:id` (`DetalleProducto.tsx`, nuevo). Reutiliza `getProductService`
  (el mismo service público que ya usaba la vieja `pages/Public/ProductDetail/ProductDetail.tsx`
  para esto, sin endpoint nuevo) y arma su propia mini-galería de fotos (imagen grande +
  miniaturas, mismo concepto que `ProductDetailModal` pero como layout de página completa en vez
  de modal — no se compartió el componente porque `ProductDetailModal` está atado a
  `Modal.tsx`/`@headlessui`; la lógica que se duplica es mínima, ~15 líneas). "← Volver al
  catálogo" en la página de detalle vuelve puntualmente a `/catalog5`, no a la Landing.
- **Cambio real en la arquitectura del registro, no solo una página nueva**: `CatalogDefinition`
  (`catalog.types.ts`) ganó `hasSubRoutes?: boolean`. Necesario porque el `path` del registro se
  usa en dos lugares con requisitos distintos — `App.tsx` arma la `<Route>` (necesita `catalog5/*`
  para que matchee las sub-rutas) y `Home.tsx` arma el link de la card (`/${path}`, que con un `*`
  literal quedaría roto). `App.tsx` ahora arma el path de la ruta como `` `${catalog.path}/*` ``
  solo cuando `hasSubRoutes` es `true`; el resto de los catálogos (sin el flag) siguen exactamente
  igual que antes. `Catalog5.tsx` en sí es un shell fino (`<Routes>` con `/` →
  `CatalogoCarrusel.tsx` y `detalleproducto/:id` → `DetalleProducto.tsx`, + un catch-all que
  redirige a `/catalog5`) — mismo patrón que ya usan `Admin.tsx`/`User.tsx` para su sub-ruteo,
  aplicado por primera vez a un catálogo público.
- El buscador se restyleó a píldora oscura vía `[&_input]:` en el wrapper (mismo mecanismo que
  `Catalog3.tsx`/`Catalog4.tsx` — selector descendiente, no depende del orden de generación de
  Tailwind, a diferencia del bug de `Button.tsx` documentado más arriba).

**Sexto diseño de catálogo — `Catalog6.tsx`, landing densa "tienda por departamentos"** (pedido
explícito del usuario, con la skill `frontend-design` como guía activa, a partir de un spec
externo — análisis de la estructura/layout/funcionalidad de una landing de e-commerce retail
multicategoría, tipo paris.cl). Montado en `/catalog6`, sin `hasSubRoutes` (usa
`ProductDetailModal`, no página propia como `Catalog5`).

**Antes de implementar se confirmaron dos cosas con el usuario** (preguntadas explícitamente,
ver la conversación): que la landing usara **productos reales del backend** en vez del
clon con datos 100% inventados que pedía el spec original, y un outline de archivos.

- **Qué se adaptó del spec y por qué** (todo documentado también inline en `Catalog6.tsx`, acá
  el resumen): sin "marcas hermanas" (no existen — la top bar usa links reales del sitio); sin
  selector de "entregar en [ciudad]" (no hay delivery en el backend); **sin carrito, ni
  siquiera simulado** (un contador que no suma nada real sería la misma clase de problema que
  ya se evitó en los otros 5 — cada producto abre `ProductDetailModal`, como
  `Catalog.tsx`–`Catalog4.tsx`); "Ingresá o registrate" pasó a reflejar la sesión real (link a
  `/perfil` si hay sesión, a `/login` si no — sin "registrate", no hay alta pública); **sin
  ofertas flash ni countdown ni % de descuento/precio tachado** — `Product` no tiene precio de
  oferta en este proyecto, se reemplazó por una sección real "Explorá el catálogo" (carrusel +
  filtro de categoría por `<select>`, sexta variante distinta del mismo patrón de filtro que ya
  usan los otros 5); tiles de categoría con la imagen de un producto real de esa categoría (no
  foto de stock); banner ancho sin "marcas participantes" inventadas (CTA real a Contacto,
  imagen de fondo de un producto real); grid de 2 banners → 2 categorías reales con "Ver
  categoría"; **sin banner de descarga de app** (la app Android de este proyecto — ver la
  sección de Capacitor más arriba — no está publicada en ningún lado accesible, un QR ahí
  prometería algo que no existe); "tendencias de búsqueda" → categorías reales como accesos
  rápidos, sin afirmar analítica de búsquedas que no se mide; **sin footer propio** (el
  `<Footer />` global de `App.tsx` ya cubre esto, mismo criterio que los otros 5).
- **Qué se mantuvo del spec, funcionando de verdad**: top bar, header sticky con shrink al
  scroll (clase de padding condicional según `window.scrollY`), drawer de categorías deslizante
  (`CategoryDrawer.tsx`, cierra con la X, click afuera, o Escape — sin subcategorías: las
  categorías de este proyecto son planas, no hay jerarquía que mostrar), hero carousel con
  autoplay de 5s + pausa on-hover + flechas + dots + swipe táctil (`HeroCarousel.tsx`,
  `transform: translateX` + `transition-transform`, sin librería), carrusel horizontal de
  productos con scroll-snap (`ProductCarousel.tsx`, reutilizable), card de producto reutilizable
  (`ProductCard.tsx`, pedido explícito del spec).
- **Bug de accesibilidad real, encontrado y corregido en la revisión**: los 5 slides del hero
  están todos en el DOM a la vez (`HeroCarousel.tsx` solo los desplaza con `translateX`, no los
  desmonta) — sin nada más, los botones "Ver producto" de los slides que NO se ven quedaban
  igual alcanzables con Tab y anunciados por un lector de pantalla. Se corrigió con
  `aria-hidden`/`inert` en el slide no activo + `tabIndex={-1}` en su botón — mismo criterio que
  ya resuelve la marquesina de `Catalog.tsx` para su copia decorativa.
- **Bug de responsive real, encontrado probando en mobile**: el padding horizontal del contenido
  del hero (`px-6` en mobile) dejaba el precio tapado por la flecha "anterior" (absoluta,
  `left-3` + 40px de ancho ≈ 52px de zona ocupada). Se subió a `px-14` en mobile —
  encontrado con una captura real de 390px de ancho, no se habría visto en desktop.
- `getProductsService` se llama dos veces con propósitos distintos: una vez sin filtrar
  (`allProducts`, límite 50, alimenta el hero + las miniaturas de categoría, una sola vez al
  montar) y otra que reacciona a búsqueda/categoría (`products`, para la sección "Explorá el
  catálogo") — separadas a propósito para que filtrar no le vuele los slides del hero ni las
  miniaturas de categorías que no tienen ningún producto en el resultado filtrado.

**Séptimo diseño de catálogo — `Catalog7.tsx`, grilla técnica densa** (pedido explícito del
usuario, a partir de un spec externo de card de e-commerce de tecnología tipo "grilla densa con
doble precio"). Montado en `/catalog7`, reutiliza `ProductDetailModal` (no página propia).

- **El spec original pedía redecorar `Catalog3.tsx`, no crear uno nuevo** — se le marcó al
  usuario antes de tocar nada que eso chocaba con la identidad ya aprobada de `Catalog3.tsx`
  (paris.cl, redondeado, rosa/fucsia) y la acercaría a la de `Catalog2.tsx` (que ya es el diseño
  técnico/denso), y que el spec pedía campos que no existen en `Product` en este proyecto
  (marca, SKU con formato propio, precio de descuento, precio por medio de pago) y un botón de
  carrito que este proyecto no tiene en ningún lado. El usuario confirmó: catálogo nuevo
  (`Catalog7`), sin esos campos, sin carrito ni siquiera como placeholder. `Catalog3.tsx` no se
  tocó.
- **Acento índigo** (el único de los 7 que lo usa) + tipografía del sistema sin sumar una fuente
  nueva — pedido explícito del spec original ("no importes una nueva sin avisar"), así que
  `Catalog7` no agregó ningún token a `index.css` ni `<link>` a `index.html` (el único de los 7
  catálogos sin tokens propios).
- `ProductCard.tsx` (nuevo, propio de este catálogo — no compartido con los otros 6, mismo
  criterio que ya estableció `Catalog6.tsx`: cada catálogo tiene su propia card visual, solo se
  comparten datos/lógica) — pedido explícito del spec ("extraelo como subcomponente
  reutilizable"). Indicador de stock con 4 estados reales: `null` → "Consultar disponibilidad"
  (mismo criterio que los otros 6), `0` → "Sin stock", `>20` → "+20 Unid.", `<10` → número exacto
  en naranja de alerta — el rango 10–20 que el spec no definía se resolvió mostrando el número
  exacto en tono neutro, para no dejar un salto sin criterio.
- `ProductCardSkeleton.tsx` (mismo archivo que `ProductCard.tsx`) — pedido explícito del spec
  ("skeletons, no un spinner genérico"), usa `animate-pulse` nativo de Tailwind. Es el único de
  los 7 catálogos con loading skeleton en vez de un `<p>Cargando...</p>` — se muestra mientras
  `loading` es `true`, con la misma forma que la card real.
- Estado vacío reutiliza `EmptyState` de `components/ui/` (el mismo del "App Shell") en vez de
  reimplementarlo — pedido explícito del spec ("mensaje claro con ícono, no una grilla en
  blanco"), y ya existía el componente para exactamente esto.
- `idProducto` se muestra como "ID {idProducto}" (pedido explícito del spec, "SKU o ID si
  existe ese campo") — es un ID real, no un SKU con formato propio inventado.

**Carrito de compra (Fase 2)** — primer paso del nuevo modelo de negocio de esta copia del
proyecto (`tienda-carrito`, pedido explícito del usuario, ver `CLAUDE.md` raíz y
`Backend/CLAUDE.md` sección "Carrito de compra + Mercado Pago" para el plan completo por fases).
Decisiones ya tomadas antes de tocar código, confirmadas explícitamente por el usuario:
- **Carrito 100% client-side** (Redux + `localStorage`, mismo patrón que `redux/states/user.ts`)
  — sin backend hasta el checkout (Fase 3, todavía sin conectar). `redux/states/cart.ts`, nuevo:
  mismo estilo que `user.ts` (reducers que arman y devuelven un estado nuevo en vez de mutar,
  `persistLocalStorage`/`clearLocalStorage` en cada acción), `CartItem` nueva en `interfaces/` (no
  es un `Product` completo, solo lo que hace falta para mostrar el carrito y armar el pedido más
  adelante — incluye `stockDisponible`, snapshot de `Product.stock` al agregar, usado únicamente
  para limitar la cantidad en el carrito del lado del cliente; el backend vuelve a validar el stock
  real al crear el pedido, ver `ProductsService.findActivoByIdOrThrow`). `AppStore` ganó la clave
  `cart` junto a `user`.
- **Alcance acotado a un solo catálogo, `Catalog.tsx`** (pedido explícito del usuario, preguntado
  antes de implementar: el proyecto tiene 7 diseños de catálogo distintos, agregar el carrito a
  los 7 de una sola vez no era necesario para esta fase — "vamos por partes"). Los otros 6
  (`Catalog2`–`Catalog7`) **no tienen ningún botón de carrito todavía**, ni se tocaron.
- `ProductDetailModal.tsx` (compartido por 6 de los 7 catálogos — todos menos `Catalog5`, que
  tiene su propia página de detalle) ganó una prop **opcional** `onAddToCart` con un stepper de
  cantidad + botón "Agregar al carrito", deshabilitado si `stock === 0`. Al ser opcional, el modal
  se comporta exactamente igual que antes para los 5 catálogos que no la pasan (`Catalog2`,
  `Catalog3`, `Catalog4`, `Catalog6`, `Catalog7`) — solo `Catalog.tsx` la conecta. La cantidad
  elegida se resetea a 1 al cambiar de producto, mismo patrón (ajustar el estado durante el
  render, no un `useEffect`) que ya usaba el índice de la miniatura seleccionada.
- `Catalog.tsx`: cada card del grid pasó de ser un único `<button>` (todo el área abría el modal) a
  un `<div>` con dos acciones — un `<button>` interno que envuelve imagen+texto (abre el modal,
  comportamiento sin cambios) y un `<button>` "Agregar al carrito" aparte debajo (un `<button>`
  dentro de otro `<button>` no es HTML válido, por eso el cambio de tag en el contenedor; `group`
  para el zoom de la imagen en hover se mantuvo en el `<div>` exterior). Deshabilitado con
  "Sin stock" cuando `stock === 0` (no cuando es `null` — ahí el dueño solo ocultó el número, sigue
  pudiéndose agregar).
- `components/Cart/CartLink.tsx`, nuevo — ícono con badge (cantidad total de unidades en el
  carrito), link a `/carrito`. Vive en la franja de marca propia de `Catalog.tsx` (junto a
  "Contacto"), no en `Header.tsx`: los 7 catálogos arman su propia cabecera pública, no hay un
  header compartido para ellas (`Header.tsx` solo muestra `DropdownMenu` para sesiones logueadas,
  ver la sección "Sesión y seguridad de páginas" más abajo) — mismo motivo por el que este
  componente queda aparte, listo para sumarse a otro catálogo más adelante sin duplicar la lógica
  del contador. `components/ui/icons.tsx` ganó `ShoppingCartIcon` (mismo estilo que
  `PencilIcon`/`BanIcon`/`CheckCircleIcon`, sin librería nueva).
- `pages/Public/Cart/CartPage.tsx`, nuevo, montada en `/carrito` (público, sin login — mismo
  criterio que `contacto`: no va en `PublicRoutes`, un ADMIN/USER logueado tiene que poder seguir
  viendo su navegación acá). Estilo "App Shell" (slate/teal, como `ContactPage`/`Profile`), no la
  paleta propia de `Catalog.tsx` — es infraestructura compartida entre catálogos, no parte del
  diseño de uno en particular. Lista de items con miniatura, stepper de cantidad, "Quitar" por
  ítem, "Vaciar carrito" y total. "Finalizar compra" navega a `/checkout` — ver la entrada de
  "Historia reciente" "Checkout + Mercado Pago (Fase 3)" más abajo, ahí sí hace algo real.
- Agregar un producto (desde la card o el modal) dispara un `showSuccess` con el nombre del
  producto — mismo mecanismo que ya usa el resto del proyecto para confirmar una acción sin
  interrumpir el flujo con un modal propio.
- Verificado en el navegador real (Playwright, backend + frontend corriendo): agregar desde la
  card, agregar desde el modal con cantidad 2, badge del header actualizado, carrito con el total
  correcto, vaciar carrito y estado vacío — sin errores de consola. El único hallazgo fue del test
  en sí, no de la app: el `<div role="dialog">` raíz de `@headlessui/react` tiene `height: 0` (sus
  hijos son `position: fixed`, no aportan alto al padre) — no sirve como referencia de "visible"
  para un test automatizado aunque el modal se vea perfecto en pantalla; hay que apuntar al panel
  real (`DialogPanel`) en cualquier test futuro que interactúe con este modal.

**Checkout + Mercado Pago (Fase 3)** — sigue a "Carrito de compra (Fase 2)" de arriba, mismo nuevo
modelo de negocio (`tienda-carrito`, ver `CLAUDE.md` raíz y `Backend/CLAUDE.md` sección "Carrito de
compra + Mercado Pago" para el plan completo por fases). El backend ya tiene el detalle de qué
cambió de su lado (transacción en `OrdersService.crearOrden`, `MercadoPagoModule` nuevo) — acá el
resumen del lado del frontend:

- `services/orders.service.ts`, nuevo (`crearOrdenService`) — `POST /ordenes`, público. La
  respuesta ya trae `initPoint` (la URL de Checkout Pro): el backend crea el pedido **y** la
  Preferencia de Mercado Pago en la misma request, no hacen falta dos llamadas. `interfaces/order.interface.ts`,
  nuevo (`Order`/`OrderItem`), espejo de los DTOs de respuesta del backend.
- `pages/Public/Checkout/CheckoutPage.tsx`, nuevo, montado en `/checkout` (público, sin login,
  mismo criterio que `/carrito`/`contacto`). Form de datos de contacto (nombre/email/teléfono/notas
  — mismo patrón que `ContactPage.tsx`: `FormField`/`inputClass` del "App Shell") + resumen del
  pedido tomado del carrito. Si el carrito está vacío, no muestra el form — un mensaje corto +
  link al catálogo (no tiene sentido pagar nada). Al confirmar:
  1. `crearOrdenService` con los items del carrito (`idProducto`+`cantidad` nomás — nunca precio,
     ver `Backend/CLAUDE.md`).
  2. Si sale bien, recién ahí `dispatch(clearCart())` — **no antes**: si el paso 1 falla, el
     carrito tiene que seguir intacto para poder reintentar sin rearmarlo.
  3. `window.location.href = orden.initPoint` — navegación dura a propósito, no
     `useNavigate`/`<Link>`: es una URL de `mercadopago.com`, no una ruta de esta SPA.
- `pages/Public/Checkout/CheckoutResultPage.tsx`, nuevo, montado en `/checkout/resultado` — adonde
  apuntan las tres `back_urls` (success/pending/failure) de la Preferencia, **la misma ruta para
  las tres**: Mercado Pago agrega sus propios parámetros de query al volver (`status`, mayormente;
  `collection_status` en algunos flujos viejos, se prueban los dos) y esta página los lee para
  armar un mensaje inmediato (aprobado/pendiente/rechazado/sin dato). **A propósito documentado como
  no autoritativo** (comentario largo en el archivo): un parámetro de URL lo puede mandar cualquiera
  (compartir el link, manipularlo a mano), nunca hay que confiar en él para nada que importe de
  verdad — eso es del webhook de la Fase 4, todavía sin implementar. Por ahora es puramente
  informativo para el comprador que vuelve de pagar.
- `CartPage.tsx`: "Finalizar compra" pasó de un `showInfo` placeholder a `navigate('/checkout')`
  (`useNavigate`, nuevo en este archivo) — el carrito en sí no se toca acá, se vacía recién en
  `CheckoutPage` si el pedido se crea con éxito.
- **Verificado con un Access Token real** (ver `Backend/CLAUDE.md`, sección "Carrito de compra +
  Mercado Pago", para el bug de `auto_return` que apareció recién al probar contra la API real):
  con Playwright, agregar al carrito → checkout → completar el form → "Pagar con Mercado Pago"
  termina de verdad en `sandbox.mercadopago.com.ar` (`window.location.href` funciona, sin errores de
  JS). Sin ese token configurado, el error del backend llega limpio hasta el form
  (`getErrorMessage`, mismo mecanismo de siempre) y el carrito no se pierde — se probaron los dos
  caminos.

**Bug: pantalla de "carrito vacío" antes de llegar a Mercado Pago** (reporte explícito del usuario,
con captura). `window.location.href = initPoint` no reemplaza el documento en el mismo instante — el
browser sigue mostrando esta SPA mientras carga la página de Mercado Pago (puede tardar unos
segundos de verdad), y en ese momento el carrito ya estaba vacío (`clearCart()` se dispara antes de
asignar `location.href`, ver arriba), así que `CheckoutPage` volvía a renderizar el estado de
"Tu carrito está vacío" de más abajo — el cliente veía ese mensaje justo después de apretar "Pagar"
y podía pensar que tenía que hacer algo más. Fix: nuevo estado `redirigiendoAMercadoPago`, seteado
`true` justo antes de `clearCart()`/`location.href`, chequeado **antes** que `items.length === 0` en
el render — mientras está en `true` muestra "Procesando tu pedido..." con un spinner, sin botones ni
links (no hay nada que el cliente tenga que hacer, la redirección es automática).
- Verificado con Playwright de una forma no trivial: interceptar la navegación real a
  `sandbox.mercadopago.com.ar` y abortarla hace que Chromium la corte de golpe (error de navegación,
  no reproduce el caso real); hubo que interceptarla y **demorar la respuesta unos segundos** en vez
  de abortarla, para simular la espera real de red que reporta el usuario. Además, tanto
  `page.locator(...).innerText()` como `page.screenshot()` de Playwright se quedan esperando a que
  la navegación en curso termine antes de devolver algo (aunque el documento viejo siga pintado en
  pantalla) — hubo que capturar por `CDPSession.send('Page.captureScreenshot')` directo, sin pasar
  por esa espera, para poder ver el estado intermedio real. Con eso confirmado: "Procesando tu
  pedido..." se ve en pantalla durante toda la espera de red a Mercado Pago, nunca "carrito vacío".
  `npx tsc -b --noEmit` + `npx vite build` + `npm run lint` limpios.
- **Sin confirmar todavía**: completar un pago de verdad en la página de Mercado Pago y volver a
  `/checkout/resultado` — la página de Mercado Pago devuelve 403 al abrirla desde este entorno de
  desarrollo (probablemente geobloqueo, el navegador automatizado no está en Argentina). No es nada
  de este proyecto — la URL a la que se redirige es válida, el 403 lo tira el servidor de Mercado
  Pago. `CheckoutResultPage.tsx` en sí (lectura de los parámetros de query) no se pudo probar contra
  una vuelta real todavía, solo con parámetros armados a mano.

**Panel de pedidos (Fase 5)** — última fase del plan original del carrito (ver
`Backend/CLAUDE.md`, sección "Carrito de compra + Mercado Pago", para el detalle del lado del
backend: `GET /ordenes/admin/listado`/`GET /ordenes/admin/:id`, los dos ADMIN-only). Pedido
explícito del usuario, ya definido desde el análisis inicial: "para esta v1 dejalo solo accesible
para ADMIN" — `USER` no ve nada de esto, ni siquiera pedidos con productos que él mismo cargó.

- Sexta pestaña del panel ADMIN (`admin/pedidos`, junto a Productos/Categorías/Usuarios/Contacto),
  mismo patrón `NavLink` + `RoutesWithNotFound` que ya usa `Admin.tsx`.
- `pages/Private/Admin/Orders/OrdersPage.tsx`, nuevo — listado con buscador (por nombre de
  contacto, mismo patrón simple que el resto del panel), `<select>` de filtro por estado, scroll
  interno + header sticky (mismo criterio que `ProductsListPage`/`CategoriesPage`/`UsersPage`) y
  paginado por cantidad (30 por página, igual que las otras listas). **De solo lectura a
  propósito**: no hay ningún botón de editar/cancelar/dar de baja — el estado de un pedido lo
  cambia únicamente el webhook de Mercado Pago, nunca un ADMIN a mano en esta v1.
- `pages/Private/Admin/Orders/OrderDetailModal.tsx`, nuevo — reutiliza `components/ui/Modal.tsx`
  (mismo mecanismo que `ProductDetailModal.tsx`/`UserFormModal.tsx`), y reutiliza el pedido que
  `OrdersPage.tsx` ya tiene en memoria del listado en vez de repetir el fetch (mismo criterio que
  `ProductDetailModal.tsx` con el catálogo). Muestra contacto/email/teléfono/notas, el detalle de
  items, y los ids de Mercado Pago (Preferencia/Pago) — útiles para buscar el pago a mano en el
  panel de Mercado Pago si hace falta investigar algo, no le interesan a nadie más que al ADMIN.
- `pages/Private/Admin/Orders/orderStatus.utils.tsx`, nuevo — `estadoBadge`/`formatPrice`
  compartidos entre `OrdersPage`/`OrderDetailModal` (mismo tratamiento visual que el badge
  Activo/Inactivo de `ProductsListPage.tsx`, un color por estado: pendiente ámbar, pagado esmeralda,
  rechazado rojo, cancelado gris).
- `components/ui/icons.tsx` ganó `EyeIcon` ("ver detalle") — mismo estilo que
  `PencilIcon`/`BanIcon`/`CheckCircleIcon`/`ShoppingCartIcon`, sin librería nueva.
- `interfaces/order.interface.ts` ganó `AdminOrder` (espejo de `OrderAdminResponseDto` — sin
  `initPoint`, con los ids de Mercado Pago) y `PaginatedOrders`; `services/orders.service.ts` ganó
  `getAdminOrdersService`/`getAdminOrderService`. Este último queda sin usar por ahora (el modal
  reutiliza el pedido que ya está en memoria, ver arriba) — se deja igual porque es el espejo
  directo de un endpoint real del backend (`GET /ordenes/admin/:id`), mismo criterio que otros
  services de este proyecto que exponen la API completa aunque la UI actual no llame a todos.
- Verificado en el navegador real (Playwright, login real como ADMIN contra el backend): listado
  con los pedidos reales creados durante las pruebas de las fases anteriores, filtro por
  `estado=PENDING`, detalle en modal con toda la información — sin errores de consola.

Con esta fase se completa el plan original de 6 fases del carrito — queda pendiente, fuera de ese
plan, confirmar a mano un pago aprobado de punta a punta en sandbox (ver la entrada anterior).

**Pasada final de QA del carrito — un bug real encontrado y corregido** (pedido explícito del
usuario: "hacé unas últimas pruebas de todas las fases a ver si aparece algún bug"). Casos límite
del backend (validaciones de `POST /ordenes`, paginado/filtros de `GET /ordenes/admin/listado`,
límite de rol USER vs ADMIN, payloads raros del webhook) salieron todos bien — el detalle de un bug
del webhook que sí apareció está en `Backend/CLAUDE.md`, sección "Carrito de compra + Mercado
Pago". Del lado del frontend:

- **Bug real, preexistente en el template base (no de esta feature, pero la hereda toda página
  nueva del panel — Pedidos incluida)**: `App.tsx` protege bien `/admin/*` y `/user/*` con
  `RoleGuard`, pero `/private/*` solo exigía estar logueado (`AuthGuard`, sin chequear rol) —
  `Private.tsx` redirigía `/` siempre a `/private/admin` **sin mirar el rol**, y sus rutas internas
  (`/private/admin/*`, `/private/user/*`) no tenían su propio `RoleGuard`. Resultado: un USER (o
  cualquier rol logueado) que navegara directo a `/private/admin/pedidos` veía el **layout** del
  panel ADMIN — tabs, buscador, formularios vacíos. **Sin fuga de datos real** (el backend rechaza
  cada request con 403, `@Auth(Role.ADMIN)`, así que la tabla quedaba vacía con "Forbidden
  resource"), pero sí una falla de control de acceso del lado del frontend. Verificado con
  Playwright + un usuario USER de prueba creado y dado de baja al terminar.
- **Arreglo**: `Private.tsx` ahora calcula la ruta de `/` según el rol activo (`rutaPorRol`, un
  `Record<Roles, string>`) en vez de ir siempre a `PrivateRoutes.ADMIN`, y sus rutas internas
  quedaron envueltas en el mismo `RoleGuard` que ya protegía `/admin`/`/user` a nivel de `App.tsx`.
- **Segundo bug, encontrado al verificar el primer arreglo — este si lo introduje yo mismo,
  corregido antes de dar nada por terminado**: envolver las rutas de `Private.tsx` en `RoleGuard`
  disparó un loop real de redirecciones (`/private/private/private/...` creciendo sin fin).
  Causa: `RoleGuard` redirige con `<Navigate to={PrivateRoutes.PRIVATE}>`, y `PrivateRoutes.PRIVATE`
  es el string `"private"` — **relativo**, sin `/` adelante. Mientras `RoleGuard` solo se usaba en
  el router de nivel superior (`App.tsx`), esa navegación relativa coincidía por casualidad con la
  raíz del sitio; al reusarlo dentro del router *anidado* de `Private.tsx` (que ya vive bajo
  `/private`), la misma navegación relativa resolvía contra esa base anidada y volvía a pegar
  `/private` sobre la URL actual en cada redirect. Arreglo de una línea en `rol.guard.tsx`: la
  `Navigate` ahora usa una ruta **absoluta** (`` `/${PrivateRoutes.PRIVATE}` ``), que resuelve
  siempre al mismo destino sin importar en qué router (de nivel superior o anidado) esté montado el
  guard — corrige los dos usos (el de siempre en `App.tsx` y el nuevo en `Private.tsx`) con el mismo
  cambio. Reverificado con Playwright: USER forzando `/private/admin/pedidos` termina en
  `/private/user` sin loop; el flujo normal de ADMIN (login → `/admin`, `/private` → `/private/admin`)
  no cambió.
- Encontrado también, en el camino, que el propio `ThrottlerGuard` de `/auth/login` (20
  intentos/60s) se activa solo con las pruebas automatizadas de una sesión seguida — comportamiento
  correcto del backend, no un bug, pero a tener en cuenta si un test de QA futuro loguea muchas
  veces en poco tiempo: hay que espaciar los intentos o reusar un mismo token en vez de loguear de
  nuevo en cada paso.

**Segundo catálogo con carrito — `Catalog2.tsx`** (pedido explícito del usuario, después de la
pasada de QA: "aplicá al siguiente catálogo los cambios que ya hicimos" — el siguiente en la
secuencia después de `Catalog.tsx`, que fue el único con carrito hasta acá, ver "Carrito de compra
(Fase 2)"). Mismo patrón exacto, sin ninguna lógica nueva:

- Handlers `handleAgregarAlCarrito`/`handleAgregarDesdeModal` copiados tal cual de `Catalog.tsx` —
  mismo `redux/states/cart.ts`, sin nada propio de este diseño.
- `CartLink` (reutilizado, ya preparado desde la Fase 2 justamente para esto) en la navbar oscura,
  junto a "Contacto" — con `className` para que el ícono salga en gris claro/blanco al hover, igual
  que el resto de esa barra, en vez del blanco/90 que usa `Catalog.tsx` sobre su franja azul.
- Cada card ganó un segundo botón "Agregar al carrito" (rojo sólido) debajo de "Ver detalle" (que
  ya existía, outline rojo) — acá no hizo falta el cambio de `<button>` a `<div>` que sí necesitó
  `Catalog.tsx`: las cards de este diseño ya eran `<div>` con un botón interno, nunca un único
  `<button>` envolviendo toda la card.
- `ProductDetailModal` (compartido, ver `Catalog.tsx`) ganó `onAddToCart={handleAgregarDesdeModal}`
  acá también — no hizo falta tocar el componente en sí, la prop ya era opcional desde que se armó.
- **`Catalog3`–`Catalog7` seguían sin ningún botón de carrito en esta pasada** — verificado
  explícitamente (Playwright) que `Catalog3` no ganó nada de esto de rebote. `Catalog3` ganó el
  suyo propio en la pasada siguiente, ver la entrada de abajo.
- Verificado con Playwright: agregar desde la card, agregar desde el modal con cantidad 2, badge
  actualizado, 2 items distintos en `/carrito` — sin errores de consola.

**Tercer catálogo con carrito — `Catalog3.tsx`** (pedido explícito del usuario: "vayamos de a 1
confirmando por vez" — mismo patrón que `Catalog2.tsx`, una pasada por catálogo, cada una
verificada y confirmada antes de seguir con el siguiente). Mismo patrón exacto otra vez, sin
ninguna lógica nueva:

- Handlers `handleAgregarAlCarrito`/`handleAgregarDesdeModal` copiados tal cual — mismo
  `redux/states/cart.ts`.
- `CartLink` en la navbar blanca, junto a "Contacto" (gris, hover a fucsia — la paleta propia de
  este diseño).
- Cada card ganó un segundo botón "Agregar al carrito" — acá, a diferencia de `Catalog2.tsx` (donde
  ambos botones quedaron sólidos), se armó en **outline fucsia** (`border-fuchsia-600
  text-fuchsia-600`, se rellena al hover) para distinguirse del "Ver producto" ya sólido — mismo
  criterio de "dos acciones, dos pesos visuales distintos" que ya resolvió `Catalog2.tsx` al revés
  (ahí "Ver detalle" era el outline). `rounded-full` en los dos botones, coherente con la estética
  redondeada de este diseño (el buscador en píldora, el banner con esquinas muy curvas).
- `ProductDetailModal` ganó `onAddToCart={handleAgregarDesdeModal}` acá también, mismo mecanismo.
- **`Catalog4`–`Catalog7` verificados sin ningún botón de carrito en esta pasada** (Playwright,
  regresión explícita contra `Catalog4`). `Catalog4` ganó el suyo propio en la pasada siguiente.
- Verificado con Playwright: agregar desde la card, agregar desde el modal con cantidad 2, badge
  actualizado, 2 items distintos en `/carrito` — sin errores de consola.

**Cuarto catálogo con carrito — `Catalog4.tsx`** (mismo criterio de "de a uno, confirmando cada
vez"). Acá, a diferencia de `Catalog2.tsx`/`Catalog3.tsx`, la card entera **era** un único
`<button>` (mismo caso que tuvo `Catalog.tsx` originalmente) — mismo cambio de tag que ya
documenta `Catalog.tsx`: pasó a `<div className="group">` con un `<button>` interno (imagen +
nombre + precio, abre el modal) y, debajo, dos triggers de texto separados en vez de uno solo
envolviendo todo (un `<button>` dentro de otro no es HTML válido).

- Handlers `handleAgregarAlCarrito`/`handleAgregarDesdeModal` copiados tal cual — mismo
  `redux/states/cart.ts` que los otros 3.
- **"Agregar al carrito" como link de texto discreto** (verde `c4-accent`, subrayado al hover),
  mismo peso visual que "Ver detalle" que ya existía — a propósito **sin** ningún botón
  sólido/con relleno como sí tienen `Catalog2.tsx`/`Catalog3.tsx`: la identidad "vidriera
  boutique" de este diseño es explícitamente minimalista (ver el comentario del componente,
  "nada de botones sólidos/con relleno"), meter un botón con fondo acá habría desentonado con
  el resto de la página.
- `CartLink` en la barra superior mínima, junto a "Contacto" (mismo tono `c4-ink/60`).
- `ProductDetailModal` ganó `onAddToCart={handleAgregarDesdeModal}` acá también.
- **`Catalog5`–`Catalog7` verificados sin ningún botón de carrito en esta pasada** (Playwright,
  regresión explícita contra `Catalog5`). `Catalog5` ganó el suyo propio en la pasada siguiente.
- Verificado con Playwright: clickear la card (imagen/texto) sigue abriendo el modal como antes
  (no el link nuevo), agregar desde la card, agregar desde el modal con cantidad 2, badge
  actualizado, 2 items distintos en `/carrito` — sin errores de consola.

**Quinto catálogo con carrito — `Catalog5.tsx`** (mismo criterio de "de a uno, confirmando cada
vez"). El más distinto de los cuatro anteriores: no hay un solo componente de catálogo, sino dos
(`CatalogoCarrusel.tsx` + `DetalleProducto.tsx`, con su propio sub-ruteo — ver Catalog5.tsx) y
**no** reutiliza `ProductDetailModal` (clickear un producto navega a una página propia, no abre un
modal) — así que el carrito se conectó en los dos lugares por separado, cada uno con su propio
`handleAgregarAlCarrito`:

- **`CatalogoCarrusel.tsx`**: cada card era un único `<Link>` (navega al detalle) — mismo problema
  de anidamiento que ya resolvieron `Catalog.tsx`/`Catalog4.tsx` con `<button>`, pero acá con `<a>`:
  un `<button>` dentro de un `<Link>` tampoco es HTML válido. Pasó a `<div className="group">` con
  el `<Link>` (imagen + info) como hijo y el botón "Agregar al carrito" como **hermano**, no
  anidado — sin necesidad de `preventDefault`/`stopPropagation`, al no estar uno dentro del otro no
  hay bubbling que frenar. Botón outline dorado (`c5-accent`), mismo idioma visual que los chips de
  categoría y los controles del carrusel que ya usaban ese estilo.
- **`DetalleProducto.tsx`**: no hay modal acá para reutilizar el selector de cantidad que ya tiene
  `ProductDetailModal.tsx` — se armó uno propio en esta página (mismo patrón de `−`/cantidad/`+`,
  clampeado a `product.stock`), junto al botón "Agregar al carrito", debajo del precio. El bloque
  entero (selector + botón) no se muestra si `stock === 0` (no tiene sentido ofrecer cantidad de
  algo que no hay).
- `CartLink` en el header de **los dos** componentes por separado (cada uno arma su propia barra
  superior, no comparten ese layout).
- **`Catalog6`/`Catalog7` verificados sin ningún botón de carrito en esta pasada** (Playwright,
  regresión explícita contra `Catalog6`). `Catalog6` ganó el suyo propio en la pasada siguiente.
- Verificado con Playwright: clickear una card del carrusel navega al detalle (no agrega nada),
  agregar desde el detalle con cantidad 2, volver al carrusel y agregar un segundo producto
  distinto directo desde su card, 2 items en `/carrito` — sin errores de consola.

**Sexto catálogo con carrito — `Catalog6.tsx`** (mismo criterio de "de a uno, confirmando cada
vez"). El más grande de los 6 hasta ahora — landing multi-sección, no una sola grilla/carrusel —
pero el carrito en sí no agregó complejidad nueva: **todos** los puntos de entrada al detalle de un
producto (hero, carrusel de "Explorá el catálogo") ya convergían en el mismo `ProductDetailModal`
compartido, así que conectar `onAddToCart` ahí una sola vez cubre el hero completo sin tocar
`HeroCarousel.tsx` para nada.

- `ProductCard.tsx` (reutilizable, usado por `ProductCarousel.tsx`) ganó una prop opcional
  `onAddToCart` — mismo criterio que la de `ProductDetailModal.tsx`: sin pasarla, la card se
  comporta exactamente igual que antes. Necesitó el mismo cambio de tag que ya tuvieron
  `Catalog.tsx`/`Catalog4.tsx` (la card entera era un único `<button>`, pasó a `<div>` con un
  `<button>` interno + el botón de agregar como hermano). `ProductCarousel.tsx` solo reenvía la
  prop, sin lógica propia.
- `handleAgregarAlCarrito`/`handleAgregarDesdeModal` en `Catalog6.tsx`, mismos handlers que los
  otros 5 catálogos — se pasan a `ProductCarousel` (vía `ProductCard`) y a `ProductDetailModal`
  (cubre el hero) por separado.
- `CartLink` en la **top bar** superior (la franja fina con "← Catálogos"/"Ayuda"/cuenta), no en el
  header sticky con el buscador — mismo criterio que el resto de los catálogos de poner el carrito
  junto al link de contacto/ayuda, acá ese link vive en la top bar, no en el header principal.
- **Bug real de mi propio script de QA, no de la app** (documentado acá porque casi lleva a
  reportar un falso bug): `allProducts` (alimenta el hero) y `products` (alimenta "Explorá el
  catálogo") salen las dos sin filtrar al montar la página, así que su primer producto coincide —
  agregar el primer slide del hero y la primera card del carrusel de entrada terminan en la
  **misma** fila del carrito con cantidad sumada (comportamiento correcto del merge, ver
  `redux/states/cart.ts`), no en dos filas — el test tuvo que usar el segundo slide del hero para
  verificar dos productos distintos.
- **`Catalog7` verificado sin ningún botón de carrito en esta pasada** (Playwright, regresión
  explícita). Ganó el suyo propio en la pasada siguiente — la última, cierra el recorrido por los 7.
- Verificado con Playwright: agregar desde una card del carrusel, agregar desde el modal abierto
  por el hero (segundo slide, cantidad por defecto), 2 items distintos en `/carrito` — sin errores
  de consola.

**Séptimo catálogo con carrito — `Catalog7.tsx`** (mismo criterio de "de a uno, confirmando cada
vez" — **último de los 7**, con esto todos los catálogos del proyecto tienen el carrito conectado).
El más simple de conectar de los siete: `ProductCard.tsx` ya era un `<div>` con varios `<button>`
hermanos (imagen, nombre, "Ver producto"), no un único `<button>` envolviendo todo — no hizo falta
ningún cambio de tag, solo agregar un botón más.

- Handlers `handleAgregarAlCarrito`/`handleAgregarDesdeModal` copiados tal cual — mismo
  `redux/states/cart.ts` que los otros 6.
- `ProductCard.tsx` ganó una prop opcional `onAddToCart` (mismo criterio que la de
  `ProductDetailModal.tsx`: sin pasarla, la card se comporta igual que antes) y un botón "Agregar
  al carrito" en **outline índigo** — bajo el "Ver producto" ya sólido, mismo criterio de contraste
  entre las dos acciones que ya usaron `Catalog2.tsx`/`Catalog3.tsx`/`Catalog6.tsx`.
- `CartLink` en el header, junto a "Contacto".
- `ProductDetailModal` ganó `onAddToCart={handleAgregarDesdeModal}` acá también.
- El comentario del componente que decía "sin carrito, ni siquiera como placeholder — este
  proyecto no lo tiene en ningún lado" (cierto cuando se escribió `Catalog7.tsx`, antes de todo
  este trabajo) se actualizó — ya no es verdad, y dejarlo así habría sido engañoso para quien lea
  el archivo de acá en más.
- Verificado con Playwright: agregar desde la card, agregar desde el modal con cantidad 2, badge
  actualizado, 2 items distintos en `/carrito` — sin errores de consola. Sin catálogo siguiente
  contra el que verificar regresión (es el último de los 7).

**Identidad propia para cada card de producto** (pedido explícito del usuario: "todas las card de
los catálogos son iguales, dales un estilo propio a cada una, que no se vean genéricas de IA" — con
la skill `frontend-design` como guía activa). El pedido tenía razón: cada catálogo ya tenía su
paleta/tipografía propia, pero la **card en sí** repetía la misma fórmula en los 7 — imagen
cuadrada arriba, categoría, nombre, precio, stock, botón(es), todo apilado — que es exactamente el
"kit de card de SaaS" que la skill marca como el tell más reconocible de diseño genérico (un solo
radio de borde y una sola sombra prolija en toda tarjeta, sin importar el contenido). El trabajo no
fue de color — eso ya estaba resuelto — sino de **estructura**: 6 de los 7 catálogos ganaron un
recurso visual distinto entre sí, sacado del propio lenguaje de cada diseño, no decoración
agregada. `Catalog4.tsx` **no se tocó** — ya venía evitando el molde de card a propósito (sin
borde/sombra/radio, ver su "Historia reciente"), es el que menos lo necesitaba.

- **`Catalog.tsx`** — el precio pasó de ser una línea más de texto a una **etiqueta colgante**
  superpuesta en la esquina de la imagen: una píldora `bg-brand` con un círculo blanco al lado (el
  mismo blanco de la card, así se lee como un agujero perforado, no un bullet) — la vernácula real
  de una etiqueta de precio de bazar, no un elemento inventado. La categoría pasó de pill a
  punto+texto (el pill ya lo usa `Catalog4`, y el precio ya "ocupa" el rol de elemento con más peso
  visual en la esquina).
- **`Catalog2.tsx`** — card en dos tonos: la foto sobre fondo claro de siempre, pero la ficha de
  datos (nombre/precio/stock/botones) pasó a `bg-neutral-900` con texto blanco — repite dentro de
  cada card el mismo contraste claro/oscuro que ya tiene la navbar de la página, en vez de una card
  blanca pareja como cualquier otro catálogo.
- **`Catalog3.tsx`** — el precio se convirtió en un **medallón circular** flotando sobre la esquina
  de la imagen, con el mismo degradé fucsia→naranja del banner de arriba y una leve rotación (para
  que se lea como un sticker pegado, no un botón más).
- **`Catalog5.tsx`** (`CatalogoCarrusel.tsx`) — se sacó la caja completa (borde + fondo propio de
  toda la card) y se reemplazó por dos **corchetes dorados** en esquinas opuestas de la foto (como
  la marca de una vitrina de museo o el visor de una cámara) + una línea dorada fina separando la
  foto de la ficha, en vez de un contorno parejo alrededor de todo.
- **`Catalog6.tsx`** (`ProductCard.tsx`) — nombre y precio pasaron de estar apilados a compartir un
  **mismo renglón** (nombre truncado a la izquierda, precio fijo a la derecha) — más "fila de
  listado" que "tarjeta", coherente con la identidad ya densa de este catálogo. Ganó además una
  franja navy de 1px arriba de cada card, firma exclusiva de este diseño.
- **`Catalog7.tsx`** (`ProductCard.tsx`) — la card pasó a horizontal en el nivel más alto: una
  **franja lateral índigo** a todo lo alto (como el indicador de estado de una fila de
  planilla/tabla) + el resto del contenido a la derecha. El ID pasó a `font-mono` (refuerza el
  registro "ficha técnica" que ya tenía el spec original) y precio+stock se reacomodaron en un
  **footer de dos columnas** en vez de líneas apiladas. El skeleton de carga (`ProductCardSkeleton`)
  se actualizó para calzar con la silueta nueva.
- **Ningún recurso se repite entre catálogos** — a propósito: etiqueta colgante y medallón (los dos
  "superpuestos sobre la imagen") usan formas distintas (píldora vs. círculo) y lógicas distintas
  (agujero perforado vs. sticker rotado); el resto (dos tonos, corchetes, fila+franja, franja
  lateral+footer) no se parece a nada más en la lista. Evita caer en el mismo problema que se venía
  a corregir — un patrón nuevo repetido 6 veces en vez de uno viejo.
- Verificado visualmente (capturas desktop + mobile 390px de las 6) y funcionalmente (Playwright:
  agregar al carrito sigue actualizando el badge en las 6, abrir el detalle sigue funcionando, sin
  errores de consola) — la restructuración del DOM de cada card no rompió ninguna de las dos
  acciones. `npx tsc -b --noEmit` + `npx vite build` + `npm run lint` limpios en todo el frontend.

**Identidad propia para el modal de detalle** (pedido explícito del usuario, inmediatamente después
de las cards: "lo que quiero ahora tambien es personalizar las ventanas modales... cuando se hace
click sobre un producto"). `ProductDetailModal.tsx` lo reutilizan 6 de los 7 catálogos (`Catalog5`
tiene su propia página de detalle, `DetalleProducto.tsx`, no modal) — el pedido explícitamente
descartaba reimplementarlo 6 veces (duplicaría galería + lógica de carrito), así que la solución fue
un prop `theme?: ProductModalTheme` (todo opcional, sin pasarlo el modal se ve exactamente como
antes): cada catálogo le pasa el mismo recurso visual que ya le dio identidad a su card (ver arriba),
no una paleta nueva — abrir el detalle tenía que sentirse parte del mismo diseño que la card que lo
abrió, no un popup neutro ajeno a la página.

- `ProductModalTheme` (definida junto al componente, `Frontend/src/pages/Public/Catalog/
  ProductDetailModal.tsx`) cubre: fuente de cuerpo/título, clases del panel, color de acento,
  clases completas del botón "Agregar al carrito" (mismo motivo que ya documentan Catalog2.tsx/
  Catalog3.tsx para no pisar el color de `<Button>` por `className` — el orden de generación de
  clases de Tailwind no es confiable para eso), borde de miniatura activa, `darkFooter` (placa
  oscura), `priceTagClassName`/`priceMedallionClassName` (etiqueta colgante o medallón superpuestos
  sobre la foto, mutuamente excluyentes), `showProductId` (ID en monospace) y `priceStockRow`
  (precio+stock en el mismo renglón).
- **`Catalog.tsx`** — misma etiqueta colgante `bg-brand` que la card, superpuesta a la foto; botón
  "Agregar al carrito" con el mismo azul.
- **`Catalog2.tsx`** — el bloque completo de categoría→precio→stock→carrito→descripción pasa a una
  **placa `bg-neutral-900`** (no solo texto teñido: el mismo contraste claro/oscuro que ya define la
  card, ver `darkFooter` más abajo). Esto obligó a envolver ese tramo del JSX del modal en un
  contenedor condicional — cuando `darkFooter` es `false` (el resto de los catálogos), ese
  contenedor usa `display: contents` (clase `contents` de Tailwind) para no alterar el `gap-4` del
  layout original: los hijos siguen participando directo del flex del padre, sin caja extra.
- **`Catalog3.tsx`** — mismo medallón circular rotado (degradé fucsia→naranja) que la card, sobre la
  foto; botón "Agregar al carrito" en píldora fucsia rellena, igual que "Ver producto" en la card.
- **`Catalog4.tsx`** — título en `font-catalog4-display` (la serif con carácter que este catálogo
  reserva para nombres de producto), panel **sin redondeo ni sombra** (`rounded-none border
  border-c4-line shadow-none` — coherente con "nada de cards redondeadas/con sombra" que ya
  documenta esta página) y el botón "Agregar al carrito" con **borde, no relleno** (mismo criterio
  que los dos links de texto discretos de la card: nada de botones sólidos acá tampoco).
- **`Catalog6.tsx`** — franja navy de 1px de la card reaparece como **borde superior de 4px** del
  panel entero (`border-t-4 border-c6-primary`); precio+stock en el mismo renglón (`priceStockRow`,
  mismo criterio "denso" que ya tiene la card).
- **`Catalog7.tsx`** — franja lateral índigo de la card reaparece como **borde izquierdo de 4px**
  del panel (`border-l-4 border-indigo-600`); `showProductId` agrega "ID {n}" en monospace bajo el
  título (mismo registro "ficha técnica"); botón "Agregar al carrito" con borde, no relleno (igual
  que en la card); precio+stock en el mismo renglón.
- Verificado con Playwright en las 6 (desktop + mobile 390px, capturas de cada una): el modal abre,
  la galería de miniaturas funciona, el stepper de cantidad suma, "Agregar al carrito" sigue
  disparando la confirmación de SweetAlert2 — sin errores de consola. Nota de QA: el chequeo
  automatizado inicial marcó falsos negativos en 5 de las 6 usando el selector `[role="dialog"]`
  (headlessui no lo expone de forma confiable en este setup — el modal abría perfecto, confirmado
  con capturas de pantalla); el script se corrigió para detectar el panel por su clase fija
  (`.shadow-xl`, que `Modal.tsx` siempre incluye) en vez de por rol — mismo tipo de falso positivo
  de QA ya documentado antes en esta sección, no un bug real. `npx tsc -b --noEmit` + `npx vite
  build` + `npm run lint` limpios.

**Miniaturas de la galería, en columna al costado** (feedback explícito del usuario con captura:
"las fotos miniaturas se ven horribles, es como si les faltara lugar... ¿no podrian ir al costado
de la foto principal?"). La tira horizontal original (`overflow-x-auto`, miniaturas de 64px debajo
de la foto) quedaba con muy poco alto real para lucir bien. Pasaron a una **columna vertical a la
izquierda de la foto principal**, misma altura (`h-64`) que la caja de la foto, con
`overflow-y-auto` propio — si algún producto llegara a tener más fotos de las que entran en esos
256px, aparece scroll vertical solo en esa columna, sin estirar el modal (pedido explícito: "que
aparezca un scroll bar"). Afecta a los 6 catálogos por igual, ya que todos comparten
`ProductDetailModal.tsx` — no hizo falta tocar ningún catálogo individual. La etiqueta
colgante/medallón de precio (`priceTagClassName`/`priceMedallionClassName`) sigue superpuesta solo
sobre la foto principal, no sobre la columna de miniaturas (el `relative` que las posiciona envuelve
únicamente esa caja). Ningún producto real del seed llega a más de 3 fotos (no se pudo capturar el
scroll en uso con datos reales), pero el mecanismo (`overflow-y-auto` + alto fijo) es CSS estándar,
no hizo falta forzarlo para confiar en que funciona. Verificado con Playwright en las 6 (desktop +
mobile 390px): el modal abre, clickear una miniatura cambia la foto principal, el stepper de
cantidad y "Agregar al carrito" siguen funcionando — sin errores de consola. `npx tsc -b --noEmit` +
`npx vite build` + `npm run lint` limpios.

**Marca decorativa en las láminas de Home** (pedido explícito del usuario, con captura: "los
catalogos tienen solo color de fondo en la portada, se les podra agregar algo... para que se vean
mas lindo"). Cada lámina de `pages/Public/Home/Home.tsx` era antes solo el degradé propio del
catálogo (`previewClassName`) + el nombre superpuesto — sin nada que la distinguiera de un simple
bloque de color. Se agregó `previewMark?: ReactNode` a `CatalogDefinition`
(`catalogs/catalog.types.ts`): un eco en miniatura, hecho con CSS puro (nada de capturas de
pantalla reales, mismo criterio que ya documenta `previewClassName` — no se desactualiza si el
diseño cambia), del recurso visual que ya identifica a cada card de producto real (ver "Identidad
propia para cada card de producto" más arriba) — para que la lámina misma anticipe el diseño, no
solo su paleta.

- `catalogs.config.ts` pasó a **`catalogs.config.tsx`** (antes no tenía JSX adentro, ahora sí) —
  se actualizaron todas las referencias en comentarios de otros archivos que lo mencionaban por
  nombre (`App.tsx`, `catalog.types.ts`, `Catalog2.tsx`–`Catalog5.tsx`). El registro sigue siendo
  la única fuente de verdad de presentación por catálogo — `Home.tsx` sigue sin conocer los diseños
  en particular, solo renderiza `{catalog.previewMark}` dentro de la lámina (después del scrim
  oscuro en el DOM, para que quede legible incluso si el scrim se oscureciera en esa zona a futuro).
- **Catálogo clásico** — píldora blanca con el mismo "agujero" circular + `$` que la etiqueta
  colgante real (`Catalog.tsx`).
- **Catálogo moderno** — swatch de dos tonos en miniatura (franja clara arriba, placa oscura abajo
  con un trazo rojo), eco de la card de `Catalog2.tsx`.
- **Catálogo tienda departamental** — medallón circular rotado con `$`, igual que el badge de precio
  de `Catalog3.tsx`.
- **Catálogo boutique** — a propósito **sin** silueta de card (ese diseño evita el molde de card
  deliberadamente, ver su "Historia reciente" de cards) — la marca es tipográfica nomás: un "Aa" en
  la serif con carácter que el diseño real reserva para títulos, como marca de agua discreta.
- **Catálogo galería** — los mismos corchetes dorados en esquinas opuestas que reemplazan el borde
  de card en `CatalogoCarrusel.tsx` (Catalog5).
- **Catálogo departamental** (Catalog6) — swatch con franja superior + una fila nombre/precio (no
  apilada, en el mismo renglón) — primera versión probada parecía más un ícono de menú (tres barras
  apiladas) que una fila de producto; se ajustó a nombre-izquierda/precio-derecha, mismo criterio
  "denso" que ya usa `ProductCard.tsx` de ese catálogo.
- **Catálogo técnico** (Catalog7) — franja lateral índigo + "ID 07" en monospace, eco directo de
  `ProductCard.tsx` (Catalog7).
- Bug de tooling en el camino: renombrar `catalogs.config.ts` a `.tsx` con el server de Vite ya
  corriendo dejó su grafo de módulos en un estado inconsistente (pantalla en blanco, 404 pidiendo
  el archivo viejo con la extensión vieja) — no era un error del código nuevo. Se resolvió matando
  el proceso de `vite` (puerto 5173) y volviendo a levantarlo con `npm run dev`; si vuelve a pasar
  después de renombrar un archivo con el dev server corriendo, reiniciarlo primero antes de
  buscar el bug en otro lado.
- Verificado visualmente (capturas desktop + mobile) y con `npx tsc -b --noEmit` + `npx vite build`
  + `npm run lint` limpios.

**Ajuste masivo de precio** (`Admin/Products/`, pedido explícito del usuario: con un catálogo de
miles de productos, cambiar el precio de a uno por vez no escala — ver `Backend/CLAUDE.md`, misma
sección, para el endpoint nuevo `PATCH /productos/precios/ajuste-masivo`). Componente nuevo,
`BulkPriceAdjustmentModal.tsx`, abierto desde un botón "Ajuste masivo de precio" al lado de "+ Nuevo
producto" en `ProductsListPage.tsx` (mismo patrón de modal que `UserFormModal.tsx`: `open`/`onClose`
+ reset del form al abrir vía "ajustar el estado durante el render", no un `useEffect`).

- Un solo form cubre los dos casos que pidió el usuario ("por categoría" y "general"): un `<select>`
  "Aplicar a" con "Todo el catálogo" primero y cada categoría después (mismo criterio "(inactiva)"
  que ya usa `ProductFormPage.tsx` para categorías dadas de baja — pueden seguir teniendo productos
  activos con precio para ajustar) — mismo mapeo 1:1 con `idCategoria` presente/ausente que resuelve
  el backend con un único DTO.
- **Preview de cuántos productos afecta la selección actual**, antes de aplicar nada: reutiliza `GET
  /productos/admin/listado` (que ya devuelve `total`) con el mismo filtro `categoriaId` que se va a
  mandar — no hizo falta un endpoint de preview nuevo. Se recalcula cada vez que cambia la categoría
  elegida.
- **Confirmación explícita con SweetAlert2** antes de aplicar (mismo patrón que
  `ProductsListPage.handleToggleActive`), con el valor, el signo y el número real de productos en el
  texto — a diferencia de "dar de baja" (reversible con un click), deshacer un ajuste masivo
  significa aplicar otro a mano con el valor inverso, así que vale la pena el paso extra antes de
  tocar potencialmente miles de filas.
- `valor` admite negativos (baja de precio), no solo el "aumento" que pidió el usuario — mismo campo
  y misma fórmula de los dos lados (frontend y backend), así que no costaba nada extra de código
  soportar también la baja, y es estrictamente más útil.
- `services/products.service.ts` ganó `bulkPriceAdjustmentService` (`PATCH
  /productos/precios/ajuste-masivo`) y los tipos `TipoAjustePrecio`/`BulkPriceAdjustmentData`.
- **Verificado end-to-end con Playwright** (login real contra un usuario ADMIN de prueba creado a
  propósito para esta verificación, no el admin real del proyecto): el modal muestra el conteo de
  productos, el conteo se recalcula al cambiar de categoría, la confirmación de SweetAlert2 aparece
  con el texto correcto (valor + categoría), el mensaje de éxito muestra la cantidad afectada, y el
  listado de productos refleja el precio nuevo sin recargar la página — sin errores de consola. El
  usuario ADMIN/USER de prueba se dio de baja (soft-delete) después de verificar, no se dejó activo.
  `npx tsc -b --noEmit` + `npx vite build` + `npm run lint` limpios.

**Bug: el mensaje de error del login desaparecía casi al instante** (reporte explícito del usuario:
"en menos de un segundo pasa de auditar todo y volver el formulario a 0, el cliente nunca sabe que
pasó"). Causa real: el interceptor de respuesta de `api/axios.ts` trata **cualquier** 401 como
"la sesión venció" — borra `localStorage` y hace `window.location.href = '/login'` (recarga dura).
Pero un 401 de `POST /auth/login` no es "tu sesión venció", es "la contraseña que acabás de
escribir está mal" — el `catch` de `Login.tsx` sí alcanzaba a hacer `setError(...)`, pero un
instante después la recarga dura del interceptor se llevaba puesto ese estado (y todo el resto del
DOM) antes de que el usuario llegara a leerlo. Con "Demasiados intentos" (429 del `ThrottlerGuard`)
no pasaba esto — un 429 no entra en la rama del 401, se veía bien — pero el usuario lo reportó en
la misma sesión de pruebas donde venía de fallar la contraseña varias veces.

- **Arreglo de una condición**: el interceptor ahora excluye `error.config?.url === '/auth/login'`
  de la redirección forzada — un 401 de esa request puntual cae al manejo normal (el `message` del
  backend se extrae igual y se re-lanza como `Error`, `Login.tsx` lo muestra con `setError` como
  siempre). El resto de los 401 (un token guardado que venció o es inválido, en cualquier otra
  request autenticada) sigue disparando el logout + redirect sin cambios.
- **Verificado con Playwright**: intentar loguearse con una contraseña incorrecta ahora deja el
  mensaje "Usuario o contraseña inválidos" visible en pantalla, **cero navegaciones** después del
  submit (antes recargaba la página entera) y el campo de contraseña conserva lo que se había
  escrito. Prueba de regresión aparte: una sesión vieja de verdad (token inválido inyectado en
  `localStorage`, mismo formato que `createUser`) sigue redirigiendo a `/login` y limpiando la
  sesión como siempre — el fix no afecta ese caso. `npx tsc -b --noEmit` + `npx vite build` +
  `npm run lint` limpios.

## Estado de las herramientas

- `npm run dev` — Vite dev server.
- `npm run build` — `tsc -b && vite build`. Limpio a la fecha de este archivo.
- `npm run build:mobile` — build para la app Android (Capacitor), usa `.env.mobile` — ver
  "Empaquetado como app Android con Capacitor" arriba.
- `npm run lint` — ESLint 9, flat config (`eslint.config.js`). Limpio a la
  fecha de este archivo.
- Sin tests configurados (no hay Jest/Vitest/Playwright instalado).
