import { Navigate, NavLink, Route } from 'react-router-dom';
import { PrivateRoutes } from '@/models';
import RoutesWithNotFound from '@/utilities/RoutesWithNotFound.utility';
import ProductsListPage from './Products/ProductsListPage';
import ProductFormPage from './Products/ProductFormPage';
import CategoriesPage from './Categories/CategoriesPage';
import UsersPage from './Users/UsersPage';
import ContactSettingsPage from './Contact/ContactSettingsPage';
import OrdersPage from './Orders/OrdersPage';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
    isActive
      ? 'text-teal-700 border-teal-600'
      : 'text-slate-500 border-transparent hover:text-slate-800 hover:border-slate-300'
  }`;

/** Panel de administración (protegido por RoleGuard ADMIN en App.tsx).
 * Layout con una navegación entre tres páginas separadas por
 * responsabilidad — antes vivían todas juntas en un solo componente:
 * - /admin/productos        listado (ProductsListPage)
 * - /admin/productos/nuevo  crear (ProductFormPage, sin :id)
 * - /admin/productos/:id/editar  editar (ProductFormPage, con :id)
 * - /admin/categorias       gestión de categorías (CategoriesPage)
 * - /admin/usuarios         gestión de usuarios (UsersPage) — crear/editar
 *   en un modal (UserFormModal) en vez de una página aparte, no una ruta
 *   propia como los productos.
 * - /admin/contacto         email/WhatsApp donde llegan los mensajes del
 *   formulario público de contacto (ContactSettingsPage) — no es parte de
 *   Profile.tsx, es una config del negocio, no de una cuenta personal.
 * - /admin/pedidos          pedidos hechos desde el carrito (OrdersPage) —
 *   de solo lectura, el estado lo actualiza el webhook de Mercado Pago, no
 *   se edita a mano (Fase 5 del carrito, ver Backend/CLAUDE.md).
 */
function Admin() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mb-6">
        Panel de administración
      </h1>

      <nav className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
        <NavLink to={`/${PrivateRoutes.ADMIN}/productos`} end className={tabClass}>
          Productos
        </NavLink>
        <NavLink to={`/${PrivateRoutes.ADMIN}/productos/nuevo`} className={tabClass}>
          Nuevo producto
        </NavLink>
        <NavLink to={`/${PrivateRoutes.ADMIN}/categorias`} className={tabClass}>
          Categorías
        </NavLink>
        <NavLink to={`/${PrivateRoutes.ADMIN}/usuarios`} className={tabClass}>
          Usuarios
        </NavLink>
        <NavLink to={`/${PrivateRoutes.ADMIN}/contacto`} className={tabClass}>
          Contacto
        </NavLink>
        <NavLink to={`/${PrivateRoutes.ADMIN}/pedidos`} className={tabClass}>
          Pedidos
        </NavLink>
      </nav>

      <RoutesWithNotFound>
        <Route path="/" element={<Navigate to="productos" replace />} />
        <Route path="productos" element={<ProductsListPage />} />
        <Route path="productos/nuevo" element={<ProductFormPage />} />
        <Route path="productos/:id/editar" element={<ProductFormPage />} />
        <Route path="categorias" element={<CategoriesPage />} />
        <Route path="usuarios" element={<UsersPage />} />
        <Route path="contacto" element={<ContactSettingsPage />} />
        <Route path="pedidos" element={<OrdersPage />} />
      </RoutesWithNotFound>
    </div>
  );
}

export default Admin;
