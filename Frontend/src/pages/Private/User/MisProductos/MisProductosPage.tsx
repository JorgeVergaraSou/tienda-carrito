import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import {
  activateProductService,
  getMisProductosService,
  updateStockVisibilityService,
} from '@/services';
import { Product } from '@/interfaces';
import { getErrorMessage, apiOrigin } from '@/utilities';
import { showError } from '@/utilities/alerts/alert.utils';
import { Button, checkboxClass, EmptyState, PageHeader } from '@/components/ui';

/** Productos que el usuario logueado cargó él mismo (ADMIN o USER),
 * incluidos los dados de baja — GET /productos/mis-productos. A
 * diferencia del panel de ADMIN (Admin/Products/ProductsListPage.tsx),
 * esta vista NO tiene "Editar" ni "Dar de baja": el backend solo le
 * permite a USER crear, subir imagen, reactivar y tocar la visibilidad
 * del stock de sus propios productos (ver ProductsController — editar y
 * dar de baja siguen siendo @Auth(Role.ADMIN) exclusivo). "Reactivar" y
 * el check de "Mostrar stock" están disponibles porque
 * ProductsService.activarProducto/actualizarVisibilidadStock aceptan
 * USER cuando el producto es suyo (mismo criterio que actualizarImagen).
 * Esta vista siempre ve el stock real (nunca null, ver
 * Product.mostrarStock) — el que puede llegar null es el que ve el
 * cliente en el catálogo/detalle público. */
function MisProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      setLoading(true);
      setListError('');

      try {
        const data = await getMisProductosService({ limit: 50 });
        if (!cancelado) setProducts(data.items);
      } catch (error) {
        if (!cancelado) setListError(getErrorMessage(error));
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [reloadToken]);

  const handleReactivar = async (product: Product) => {
    const { isConfirmed } = await Swal.fire({
      icon: 'question',
      title: 'Reactivar producto',
      text: `¿Confirmás reactivar "${product.nombre}"?`,
      showCancelButton: true,
      confirmButtonText: 'Sí, reactivar',
      cancelButtonText: 'Cancelar',
    });

    if (!isConfirmed) {
      return;
    }

    try {
      await activateProductService(product.idProducto);
      setReloadToken((token) => token + 1);
    } catch (error) {
      showError(getErrorMessage(error));
    }
  };

  const handleToggleMostrarStock = async (product: Product) => {
    try {
      await updateStockVisibilityService(product.idProducto, !product.mostrarStock);
      setReloadToken((token) => token + 1);
    } catch (error) {
      showError(getErrorMessage(error));
    }
  };

  return (
    <div>
      <PageHeader title="Mis productos" description="Los que cargaste vos, incluidos los que diste de baja." />

      {loading && <p className="text-sm text-slate-500">Cargando...</p>}
      {listError && <p className="text-sm text-red-600">{listError}</p>}

      {/* mismo criterio de scroll interno + header sticky que ya usan las
          tablas del panel ADMIN (ver ProductsListPage.tsx/CategoriesPage.tsx
          /UsersPage.tsx) — antes esta era la única de las 4 sin ese
          tratamiento. */}
      <div className="overflow-auto max-h-[60vh] rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr>
              <th className="py-2.5 px-4 sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">Imagen</th>
              <th className="py-2.5 px-4 sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">Nombre</th>
              <th className="py-2.5 px-4 sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">Categoría</th>
              <th className="py-2.5 px-4 sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">Precio</th>
              <th className="py-2.5 px-4 sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">Stock</th>
              <th className="py-2.5 px-4 sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">Mostrar stock</th>
              <th className="py-2.5 px-4 sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">Estado</th>
              <th className="py-2.5 px-4 sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.idProducto} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="py-2 px-4">
                  {product.imageUrl ? (
                    <img
                      src={`${apiOrigin}${product.imageUrl}`}
                      alt={product.nombre}
                      className="h-12 w-12 object-cover rounded-md border border-slate-100"
                    />
                  ) : (
                    <span className="text-slate-400 text-xs">Sin imagen</span>
                  )}
                </td>
                <td className="py-2 px-4 text-slate-800">{product.nombre}</td>
                <td className="py-2 px-4 text-slate-600">{product.categoria?.nombre ?? '—'}</td>
                <td className="py-2 px-4 font-medium text-slate-800 tabular-nums">${product.precio.toFixed(2)}</td>
                {/* siempre el número real acá (esta vista nunca lo oculta,
                    ver Product.mostrarStock) — ?? 0 es solo para
                    satisfacer el tipo number | null compartido con las
                    vistas públicas, nunca debería pasar en la práctica. */}
                <td className="py-2 px-4 tabular-nums text-slate-600">{product.stock ?? 0}</td>
                <td className="py-2 px-4">
                  <input
                    type="checkbox"
                    checked={product.mostrarStock}
                    onChange={() => handleToggleMostrarStock(product)}
                    aria-label={`Mostrar stock a los clientes de ${product.nombre}`}
                    className={checkboxClass}
                  />
                </td>
                <td className="py-2 px-4">
                  {product.deletedAt ? (
                    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Inactivo</span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Activo</span>
                  )}
                </td>
                <td className="py-2 px-4">
                  {product.deletedAt && (
                    <Button variant="secondary" onClick={() => handleReactivar(product)}>
                      Reactivar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && products.length === 0 && (
          <EmptyState message="Todavía no cargaste ningún producto." />
        )}
      </div>
    </div>
  );
}

export default MisProductosPage;
