# CLAUDE.md (raíz del repo)

Este repo (`tienda-carrito`) es una **copia de `tienda-basica`** a la que se le está agregando lo
único que esa base no tiene: carrito de compra + pagos con Mercado Pago (pedido explícito del
usuario, ver "Qué es esto" más abajo). Fuera de eso, mismo origen y misma estructura: **dos
proyectos independientes**, cada uno con su propio `CLAUDE.md` con el detalle real (arquitectura,
convenciones, historial de cambios y el *por qué* de cada decisión) — leelo entero antes de tocar
código en ese proyecto:

- **[Backend/CLAUDE.md](Backend/CLAUDE.md)** — API NestJS + MySQL + TypeORM (`tienda-carrito/v1`),
  puerto `3006` por defecto, base de datos `tienda-carrito` (propia de esta copia, no la `tienda`
  de `tienda-basica`). Auth por JWT/roles, productos, categorías, usuarios, contacto, pedidos.
- **[Frontend/CLAUDE.md](Frontend/CLAUDE.md)** — SPA React + TypeScript + Vite, puerto `5173` por
  defecto. Catálogo público, panel de administración, perfil.

No son un monorepo con workspaces compartidos: no hay `package.json` en la raíz, cada carpeta
tiene su propio `npm install`/`npm run dev` y corre por separado (`Backend/` necesita estar
levantado para que `Frontend/` funcione de verdad, ver `VITE_API_BASE_URL` en el `.env` del
frontend).

## Qué es esto

Una tienda online real (bazar/juguetería — "vende de todo"), no una demo. Arrancó como dos
plantillas separadas ("base-auth-backend"/"base-auth-react", con auth/roles/sesión ya resueltos) y
se le construyó encima el dominio de negocio real: catálogo público, panel de administración de
productos/categorías/usuarios, galería de fotos por producto, formulario de contacto (mail +
WhatsApp), CRUD de usuarios para ADMIN. El detalle de cada feature — qué se pidió, qué se decidió
y por qué — está en la sección "Historia reciente" de cada `CLAUDE.md`, no acá: este archivo es
solo el punto de entrada para saber a cuál de los dos ir.

**Nuevo modelo de negocio de esta copia — carrito de compra + Mercado Pago** (pedido explícito del
usuario, en desarrollo por fases): hasta ahora la tienda solo mostraba el catálogo, sin forma de
comprar. Se está agregando un carrito (client-side en el frontend) + checkout como invitado (sin
cuenta obligatoria) + pago con Mercado Pago (Checkout Pro, cuenta Argentina/ARS) — sin delivery
(retiro en local, coordinado por WhatsApp/mail, igual que el contacto) y sin multi-vendedor (un
solo Access Token de Mercado Pago para todo el negocio, aunque los productos sigan teniendo
`creadoPor` como trazabilidad interna). El detalle completo de las decisiones y el plan de fases
está en `Backend/CLAUDE.md`, sección "Carrito de compra + Mercado Pago" — a la fecha de esta nota
están hechas las 6 fases del plan original: modelo de datos de pedidos + `POST /ordenes` (Fase 1),
carrito client-side en el frontend (Fase 2, ver `Frontend/CLAUDE.md` sección "Carrito de compra
(Fase 2)" — arrancó acotado a un solo catálogo de los 7 que tiene el proyecto, se fue sumando de a
uno confirmando cada vez hasta cubrir los 7: `Catalog` a `Catalog7` — ver las secciones "Segundo" a
"Séptimo catálogo con carrito"), creación real de
la Preferencia de Checkout Pro (Fase 3, verificada contra la API real de Mercado Pago), el webhook
que confirma el pago y descuenta stock (Fase 4), el panel de pedidos ADMIN-only (Fase 5, ver
`Frontend/CLAUDE.md` sección "Panel de pedidos (Fase 5)") y esta misma documentación (Fase 6).
Queda pendiente, fuera de esas 6 fases, confirmar a mano un pago aprobado de punta a punta en
sandbox — quedó trabado en el botón "Pagar" de Mercado Pago sin habilitarse, causa todavía sin
identificar.

## Convenciones que aplican a los dos proyectos

- Comentarios y documentación en español, explicando el *por qué* además del *qué* — mantené ese
  estilo en código nuevo.
- Cambio mínimo necesario: analizar antes de tocar, no reescribir de más ni cambiar de
  librería/arquitectura sin que se pida explícitamente.
- Correr build/lint/test (según el proyecto — ver el comando exacto en cada `CLAUDE.md`) después
  de cada cambio, antes de darlo por terminado.
- `uploads/` en el backend es una carpeta compartida entre datos de prueba y datos reales — nunca
  borrar ahí por patrón/glob, siempre por nombre de archivo específico (ver Backend/CLAUDE.md).
