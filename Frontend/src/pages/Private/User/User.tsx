import { NavLink, Route } from 'react-router-dom';
import { PrivateRoutes } from '@/models';
import RoutesWithNotFound from '@/utilities/RoutesWithNotFound.utility';
import CargarProductoPage from './CargarProducto/CargarProductoPage';
import MisProductosPage from './MisProductos/MisProductosPage';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
    isActive
      ? 'text-teal-700 border-teal-600'
      : 'text-slate-500 border-transparent hover:text-slate-800 hover:border-slate-300'
  }`;

/** Panel del rol USER (protegido por RoleGuard en App.tsx). Layout con
 * una navegación entre dos páginas separadas por responsabilidad, mismo
 * patrón que ya usa pages/Private/Admin/Admin.tsx:
 * - /user               cargar un producto nuevo (CargarProductoPage)
 * - /user/mis-productos los que ya cargó, solo lectura + reactivar
 *   (MisProductosPage) — ver esa página para el detalle de qué acciones
 *   tiene disponibles USER según el backend real.
 */
function UserPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mb-6">Mis productos</h1>

      <nav className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
        <NavLink to={`/${PrivateRoutes.USER}`} end className={tabClass}>
          Cargar producto
        </NavLink>
        <NavLink to={`/${PrivateRoutes.USER}/mis-productos`} className={tabClass}>
          Mis productos
        </NavLink>
      </nav>

      <RoutesWithNotFound>
        <Route path="/" element={<CargarProductoPage />} />
        <Route path="mis-productos" element={<MisProductosPage />} />
      </RoutesWithNotFound>
    </div>
  );
}

export default UserPage;
