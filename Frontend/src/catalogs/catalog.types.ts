import type { ComponentType, LazyExoticComponent } from 'react';

/**
 * Un diseño de catálogo registrado — ver catalogs.config.ts. La Landing
 * (pages/Public/Home) arma sus cards a partir de este tipo, sin conocer
 * los diseños en particular; agregar un catálogo nuevo es una entrada más
 * acá, no tocar Home.tsx.
 */
export interface CatalogDefinition {
  id: string;
  name: string;
  description: string;
  /** sin slash inicial (ej. "catalog", no "/catalog") — se arma la ruta
   * completa donde haga falta con `/${path}`. Siempre el path "limpio",
   * sin el `/*` de React Router — eso lo agrega App.tsx solo si
   * `hasSubRoutes` es true (ver ese campo), para que el link de Home.tsx
   * (`/${path}`) nunca termine con un `*` literal. */
  path: string;
  /** true si el diseño tiene sub-rutas propias (ej. una página de detalle
   * de producto aparte, no un modal — ver Catalog5.tsx) y por lo tanto
   * necesita un `<Routes>` anidado adentro de `component`. App.tsx
   * registra la <Route> como `${path}/*` en vez de `path` a secas cuando
   * esto es true. Default: false (un diseño de una sola página, como
   * Catalog/Catalog2/Catalog3/Catalog4). */
  hasSubRoutes?: boolean;
  /** lazy: la Landing no debe traer el JS de todos los diseños de catálogo
   * con ella, solo el del que el usuario termina eligiendo. */
  component: LazyExoticComponent<ComponentType>;
  /** clases Tailwind para el degradé de preview de la card en Home —
   * puramente decorativo (da una idea de la paleta de cada diseño sin
   * necesitar una captura de pantalla real, que se desactualizaría cada
   * vez que cambie el diseño). */
  previewClassName: string;
}
