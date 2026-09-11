import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  activateProductService,
  deactivateProductService,
  getAdminProductsService,
} from '@/services';
import { Product } from '@/interfaces';
import { PrivateRoutes } from '@/models';
import { getErrorMessage, apiOrigin } from '@/utilities';
import { showError } from '@/utilities/alerts/alert.utils';
import { Button, BanIcon, CheckCircleIcon, PencilIcon, EmptyState, PageHeader } from '@/components/ui';
import { InputBuscarProductos } from '@/components/ProductSearch/InputBuscarProductos';

// mismo criterio que Catalog.tsx: el backend ya soporta paginado por
// cantidad (GET /productos/admin/listado acepta page/limit, límite máximo
// 50 — ver FindProductsQueryDto), esto es solo conectarlo acá. Se eligió
// paginado por cantidad y no por letra inicial: agrupar por letra no
// acota nada (una letra con cientos de productos seguiría siendo una
// lista larga, habría que paginarla igual) y ya existe el buscador en
// vivo para encontrar un producto puntual por nombre.
const PAGE_SIZE = 30;

/** Listado de productos del panel admin — separado de "nuevo producto"
 * (Products/ProductFormPage.tsx en modo creación) y de "categorías"
 * (Categories/CategoriesPage.tsx). "Editar" navega a su propia página en
 * vez de abrir un form inline acá mismo. */
function ProductsListPage() {
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelado = false;

    (async () => {
      setLoading(true);
      setListError('');

      try {
        const data = await getAdminProductsService({
          search: search || undefined,
          page,
          limit: PAGE_SIZE,
        });

        if (cancelado) return;
        setProducts(data.items);
        setTotal(data.total);
      } catch (error) {
        if (!cancelado) setListError(getErrorMessage(error));
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [search, page, reloadToken]);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // seleccionar un resultado del buscador en vivo salta directo a
  // editarlo, sin pasar por el submit del botón "Buscar".
  const handleSelectProducto = (producto: Product) => {
    navigate(`/${PrivateRoutes.ADMIN}/productos/${producto.idProducto}/editar`);
  };

  const handleToggleActive = async (product: Product) => {
    const estaActivo = !product.deletedAt;

    const { isConfirmed } = await Swal.fire({
      icon: 'question',
      title: estaActivo ? 'Dar de baja producto' : 'Reactivar producto',
      text: `¿Confirmás ${estaActivo ? 'dar de baja a' : 'reactivar'} "${product.nombre}"?`,
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar',
      cancelButtonText: 'Cancelar',
    });

    if (!isConfirmed) {
      return;
    }

    try {
      if (estaActivo) {
        await deactivateProductService(product.idProducto);
      } else {
        await activateProductService(product.idProducto);
      }
      setReloadToken((token) => token + 1);
    } catch (error) {
      showError(getErrorMessage(error));
    }
  };

  return (
    <div>
      <PageHeader
        title="Productos"
        description="Catálogo completo, incluidos los dados de baja."
        action={
          <Button onClick={() => navigate(`/${PrivateRoutes.ADMIN}/productos/nuevo`)}>
            + Nuevo producto
          </Button>
        }
      />

      <form onSubmit={handleSearchSubmit} className="mb-4 flex gap-2">
        <InputBuscarProductos
          keyword={searchInput}
          setKeyword={setSearchInput}
          onSelectProducto={handleSelectProducto}
          admin
          className="flex-1"
        />
        <Button type="submit" variant="secondary">Buscar</Button>
      </form>

      {loading && <p className="text-sm text-slate-500">Cargando...</p>}
      {listError && <p className="text-sm text-red-600">{listError}</p>}

      {/* max-h + overflow-auto: mismo criterio que CategoriesPage.tsx (ver
          ese archivo) — no crece sin límite con muchos productos, header
          sticky para no perderlo de vista al scrollear. */}
      <div className="overflow-auto max-h-[60vh] rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr>
              <th className="py-2.5 px-4 sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">Imagen</th>
              <th className="py-2.5 px-4 sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">Nombre</th>
              <th className="py-2.5 px-4 sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">Categoría</th>
              <th className="py-2.5 px-4 sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">Precio</th>
              <th className="py-2.5 px-4 sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">Stock</th>
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
                  {product.deletedAt ? (
                    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Inactivo</span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Activo</span>
                  )}
                </td>
                <td className="py-2 px-4">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/${PrivateRoutes.ADMIN}/productos/${product.idProducto}/editar`)
                      }
                      title="Editar"
                      aria-label={`Editar ${product.nombre}`}
                      className="p-1.5 rounded-full text-slate-500 hover:bg-teal-50 hover:text-teal-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(product)}
                      title={product.deletedAt ? 'Reactivar' : 'Dar de baja'}
                      aria-label={`${product.deletedAt ? 'Reactivar' : 'Dar de baja'} ${product.nombre}`}
                      className={`p-1.5 rounded-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                        product.deletedAt
                          ? 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'
                          : 'text-red-400 hover:bg-red-50 hover:text-red-600'
                      }`}
                    >
                      {product.deletedAt ? <CheckCircleIcon /> : <BanIcon />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && products.length === 0 && (
          <EmptyState message="No hay productos para mostrar." />
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm text-slate-500 tabular-nums">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}

export default ProductsListPage;
