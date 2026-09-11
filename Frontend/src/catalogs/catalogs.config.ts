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
 * presentación, no de datos.
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
  },
  {
    id: 'catalog-2',
    name: 'Catálogo moderno',
    description:
      'Diseño más técnico y denso, con filtro de categorías lateral — pensado para catálogos grandes.',
    path: 'catalog2',
    component: lazy(() => import('@/pages/Public/Catalog2')),
    previewClassName: 'bg-linear-to-br from-neutral-900 to-red-700',
  },
  {
    id: 'catalog-3',
    name: 'Catálogo tienda departamental',
    description:
      'Diseño colorido y redondeado, con pestañas de categoría y banner destacado — estilo grandes tiendas.',
    path: 'catalog3',
    component: lazy(() => import('@/pages/Public/Catalog3')),
    previewClassName: 'bg-linear-to-br from-fuchsia-600 to-pink-500',
  },
  {
    id: 'catalog-4',
    name: 'Catálogo boutique',
    description:
      'Diseño editorial y espacioso, sin bordes redondeados ni sombras — pensado como una vidriera, no una grilla.',
    path: 'catalog4',
    component: lazy(() => import('@/pages/Public/Catalog4')),
    previewClassName: 'bg-linear-to-br from-stone-800 to-emerald-900',
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
  },
  {
    id: 'catalog-6',
    name: 'Catálogo departamental',
    description:
      'Landing densa estilo gran tienda: hero con carrusel, drawer de categorías y varias secciones — todo con datos reales.',
    path: 'catalog6',
    component: lazy(() => import('@/pages/Public/Catalog6')),
    previewClassName: 'bg-linear-to-br from-[#14204b] to-[#0c1631]',
  },
  {
    id: 'catalog-7',
    name: 'Catálogo técnico',
    description:
      'Grilla densa de cards compactas con acento índigo, indicador de stock y skeletons de carga.',
    path: 'catalog7',
    component: lazy(() => import('@/pages/Public/Catalog7')),
    previewClassName: 'bg-linear-to-br from-indigo-600 to-indigo-950',
  },
];
