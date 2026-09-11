import { Navigate, Route, Routes } from 'react-router-dom';
import CatalogoCarrusel from './CatalogoCarrusel';
import DetalleProducto from './DetalleProducto';

/** Shell de rutas del quinto catálogo — a diferencia de Catalog/Catalog2/
 * Catalog3/Catalog4 (una sola página, una sola ruta), este necesita
 * sub-ruteo propio porque el detalle de producto es una PÁGINA aparte, no
 * un modal (pedido explícito del usuario) y tiene que poder volver
 * puntualmente a `/catalog5`. Mismo patrón que ya usan
 * `pages/Private/Admin/Admin.tsx`/`User/User.tsx` (RoutesWithNotFound +
 * <Routes> anidado) — por eso está registrado como `'catalog5/*'` en
 * catalogs.config.ts, no como un path exacto.
 *
 * - `/catalog5` → CatalogoCarrusel (la galería)
 * - `/catalog5/detalleproducto/:id` → DetalleProducto
 */
function Catalog5() {
  return (
    <Routes>
      <Route path="/" element={<CatalogoCarrusel />} />
      <Route path="detalleproducto/:id" element={<DetalleProducto />} />
      <Route path="*" element={<Navigate to="/catalog5" replace />} />
    </Routes>
  );
}

export default Catalog5;
