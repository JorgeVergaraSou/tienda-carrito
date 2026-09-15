import { lazy } from 'react';
import type { CatalogDefinition } from './catalog.types';

/**
 * Registro central de diseños de catálogo. Agregar uno nuevo (Catalog6,
 * etc.):
 *   1. Crear la página en pages/Public/Catalog6/ (+ index.ts barrel, mismo
 *      patrón que los anteriores). Si el diseño necesita sub-rutas propias
 *      (ej. una página de detalle aparte en vez de un modal — ver
 *      Catalog5.tsx/Catalog5.tsx como ejemplo), el barrel exporta un
 *      componente con su propio `<Routes>` adentro.
 *   2. Sumar una entrada acá — `hasSubRoutes: true` si aplica lo de arriba.
 * Nada más — App.tsx genera la <Route> de cada uno con `catalogs.map(...)`
 * (no hay que tocarlo, ya contempla `hasSubRoutes`), y la Landing
 * (pages/Public/Home) arma su card también a partir de este array.
 *
 * Todos los diseños consumen el mismo backend (getProductsService /
 * getCategoriesService, ver services/) — este registro es solo de
 * presentación, no de datos. Es `.tsx` (no `.ts`) porque `previewMark`
 * es JSX — ver el comentario de ese campo en catalog.types.ts.
 */
export const catalogs: CatalogDefinition[] = [
  {
    id: 'catalog-1',
    name: 'Catálogo clásico',
    description:
      'Nuestro diseño original: buscador y categorías arriba, grilla de productos estilo marketplace.',
    path: 'catalog',
    component: lazy(() => import('@/pages/Public/Catalog')),
    previewClassName: 'bg-linear-to-br from-brand to-brand-dark',
    // eco de la etiqueta colgante de precio de la card real (ver
    // Catalog.tsx) — píldora blanca + "agujero" de color, en vez del
    // degradé liso de antes.
    previewMark: (
      <div className="absolute right-5 top-5 flex items-center gap-1.5 rounded-full bg-white/95 py-1 pl-1.5 pr-2.5 shadow-sm">
        <span className="h-2 w-2 rounded-full bg-brand" />
        <span className="text-xs font-extrabold text-brand">$</span>
      </div>
    ),
  },
  {
    id: 'catalog-2',
    name: 'Catálogo moderno',
    description:
      'Diseño más técnico y denso, con filtro de categorías lateral — pensado para catálogos grandes.',
    path: 'catalog2',
    component: lazy(() => import('@/pages/Public/Catalog2')),
    previewClassName: 'bg-linear-to-br from-neutral-900 to-red-700',
    // eco de la card en dos tonos (foto clara / ficha oscura) de
    // Catalog2.tsx, con el acento rojo de la página.
    previewMark: (
      <div className="absolute right-5 top-5 w-14 overflow-hidden rounded-md shadow-sm">
        <div className="h-6 bg-white/90" />
        <div className="flex h-5 items-center bg-neutral-950 px-1.5">
          <span className="h-1 w-6 rounded-full bg-red-500" />
        </div>
      </div>
    ),
  },
  {
    id: 'catalog-3',
    name: 'Catálogo tienda departamental',
    description:
      'Diseño colorido y redondeado, con pestañas de categoría y banner destacado — estilo grandes tiendas.',
    path: 'catalog3',
    component: lazy(() => import('@/pages/Public/Catalog3')),
    previewClassName: 'bg-linear-to-br from-fuchsia-600 to-pink-500',
    // eco del medallón de precio rotado de Catalog3.tsx.
    previewMark: (
      <div className="absolute right-6 top-6 flex h-11 w-11 rotate-6 items-center justify-center rounded-full bg-white/95 shadow-md">
        <span className="text-xs font-extrabold text-fuchsia-700">$</span>
      </div>
    ),
  },
  {
    id: 'catalog-4',
    name: 'Catálogo boutique',
    description:
      'Diseño editorial y espacioso, sin bordes redondeados ni sombras — pensado como una vidriera, no una grilla.',
    path: 'catalog4',
    component: lazy(() => import('@/pages/Public/Catalog4')),
    previewClassName: 'bg-linear-to-br from-stone-800 to-emerald-900',
    // acá NO va una miniatura de card — este diseño evita ese molde a
    // propósito (ver Catalog4.tsx, "no se tocó" en la identidad de
    // cards). La marca es tipográfica: la serif con carácter que el
    // diseño real reserva para títulos/nombres de producto, como
    // marca de agua discreta.
    previewMark: (
      <span
        className="absolute right-6 top-3 font-catalog4-display text-4xl italic text-white/25 select-none"
        aria-hidden="true"
      >
        Aa
      </span>
    ),
  },
  {
    id: 'catalog-5',
    name: 'Catálogo galería',
    description:
      'Fondo oscuro con acento dorado, productos en carrusel — cada uno abre su propia página de detalle.',
    path: 'catalog5',
    hasSubRoutes: true,
    component: lazy(() => import('@/pages/Public/Catalog5')),
    previewClassName: 'bg-linear-to-br from-neutral-950 to-amber-900',
    // eco de los corchetes dorados en esquinas opuestas de la foto, el
    // recurso que reemplaza el borde de card en CatalogoCarrusel.tsx.
    previewMark: (
      <div className="absolute right-5 top-5 h-12 w-12" aria-hidden="true">
        <span className="absolute left-0 top-0 h-4 w-4 border-l-2 border-t-2 border-amber-400" />
        <span className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-amber-400" />
      </div>
    ),
  },
  {
    id: 'catalog-6',
    name: 'Catálogo departamental',
    description:
      'Landing densa estilo gran tienda: hero con carrusel, drawer de categorías y varias secciones — todo con datos reales.',
    path: 'catalog6',
    component: lazy(() => import('@/pages/Public/Catalog6')),
    previewClassName: 'bg-linear-to-br from-[#14204b] to-[#0c1631]',
    // eco de la franja superior + fila densa nombre/precio (mismo
    // renglón, no apilados) de ProductCard.tsx (Catalog6) — nombre a la
    // izquierda, precio fijo a la derecha, no una lista de líneas
    // genérica.
    previewMark: (
      <div className="absolute right-5 top-5 w-16 overflow-hidden rounded-md bg-white/10">
        <div className="h-1 bg-white/80" />
        <div className="flex items-center justify-between gap-1 p-1.5">
          <span className="h-1 w-6 rounded-full bg-white/50" />
          <span className="h-1.5 w-3 rounded-full bg-white/90" />
        </div>
      </div>
    ),
  },
  {
    id: 'catalog-7',
    name: 'Catálogo técnico',
    description:
      'Grilla densa de cards compactas con acento índigo, indicador de stock y skeletons de carga.',
    path: 'catalog7',
    component: lazy(() => import('@/pages/Public/Catalog7')),
    previewClassName: 'bg-linear-to-br from-indigo-600 to-indigo-950',
    // eco de la franja lateral índigo + ID en monospace de
    // ProductCard.tsx (Catalog7) — registro "ficha técnica".
    previewMark: (
      <div className="absolute right-5 top-5 flex h-12 w-16 overflow-hidden rounded-md bg-white/10">
        <span className="w-1 shrink-0 bg-indigo-400" />
        <div className="flex flex-1 flex-col justify-center gap-1 px-1.5">
          <span className="font-mono text-[8px] text-white/70">ID 07</span>
          <span className="h-1 w-8 rounded-full bg-white/50" />
        </div>
      </div>
    ),
  },
];
