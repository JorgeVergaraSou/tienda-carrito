import { useEffect, useState } from 'react';
import { getAdminOrdersService } from '@/services';
import { AdminOrder, OrderStatus } from '@/interfaces';
import { getErrorMessage } from '@/utilities';
import { Button, EmptyState, EyeIcon, PageHeader, inputClass } from '@/components/ui';
import { OrderDetailModal } from './OrderDetailModal';
import { estadoBadge, formatPrice } from './orderStatus.utils';

// mismo criterio de paginado por cantidad que ya usan
// ProductsListPage.tsx/CategoriesPage.tsx/UsersPage.tsx — el backend
// acepta hasta 50 por página (ver FindOrdersQueryDto).
const PAGE_SIZE = 30;

const opcionesEstado: { value: OrderStatus | ''; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'PAID', label: 'Pagado' },
  { value: 'FAILED', label: 'Rechazado' },
  { value: 'CANCELLED', label: 'Cancelado' },
];

/** Panel de pedidos — ADMIN exclusivo (Fase 5, pedido explícito del
 * usuario: "para esta v1 dejalo solo accesible para ADMIN", ver
 * Backend/CLAUDE.md sección "Carrito de compra + Mercado Pago"). De solo
 * lectura a propósito: lista + detalle, sin ninguna acción de edición
 * manual — el estado de un pedido lo cambia únicamente el webhook de
 * Mercado Pago (Fase 4), nunca un ADMIN a mano en esta v1. */
function OrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState<OrderStatus | ''>('');

  const [ordenSeleccionada, setOrdenSeleccionada] = useState<AdminOrder | null>(null);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      setLoading(true);
      setListError('');

      try {
        const data = await getAdminOrdersService({
          search: search || undefined,
          estado: estado || undefined,
          page,
          limit: PAGE_SIZE,
        });

        if (cancelado) return;
        setOrders(data.items);
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
  }, [search, estado, page]);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleEstadoChange = (value: string) => {
    setPage(1);
    setEstado(value as OrderStatus | '');
  };

  // el listado ya trae los items completos (GET /ordenes/admin/listado),
  // así que abrir el detalle no repite ningún fetch — mismo criterio que
  // ProductDetailModal.tsx del catálogo, que reutiliza el Product que ya
  // tiene en memoria en vez de volver a pedirlo.
  const handleVerDetalle = (order: AdminOrder) => {
    setOrdenSeleccionada(order);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Pedidos"
        description="Pedidos hechos desde el carrito — el estado lo actualiza Mercado Pago, no se edita a mano."
      />

      <form onSubmit={handleSearchSubmit} className="mb-4 flex flex-wrap gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar por nombre de contacto..."
          className={`${inputClass} flex-1 min-w-[200px]`}
        />
        <select
          value={estado}
          onChange={(e) => handleEstadoChange(e.target.value)}
          className={`${inputClass} w-auto`}
        >
          {opcionesEstado.map((opcion) => (
            <option key={opcion.value} value={opcion.value}>
              {opcion.label}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      {loading && <p className="text-sm text-slate-500">Cargando...</p>}
      {listError && <p className="text-sm text-red-600">{listError}</p>}

      {/* scroll interno + header sticky, mismo criterio que
          ProductsListPage/CategoriesPage/UsersPage. */}
      <div className="overflow-auto max-h-[60vh] rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr>
              <th className="py-2.5 px-4 sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">
                #
              </th>
              <th className="py-2.5 px-4 sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">
                Contacto
              </th>
              <th className="py-2.5 px-4 sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">
                Total
              </th>
              <th className="py-2.5 px-4 sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">
                Estado
              </th>
              <th className="py-2.5 px-4 sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">
                Fecha
              </th>
              <th className="py-2.5 px-4 sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={order.idOrden}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
              >
                <td className="py-2 px-4 tabular-nums text-slate-500">#{order.idOrden}</td>
                <td className="py-2 px-4 text-slate-800">{order.nombreContacto}</td>
                <td className="py-2 px-4 font-medium tabular-nums text-slate-800">
                  {formatPrice(order.total)}
                </td>
                <td className="py-2 px-4">{estadoBadge(order.estado)}</td>
                <td className="py-2 px-4 text-slate-500">
                  {new Date(order.createdAt).toLocaleDateString('es-AR')}
                </td>
                <td className="py-2 px-4">
                  <button
                    type="button"
                    onClick={() => handleVerDetalle(order)}
                    title="Ver detalle"
                    aria-label={`Ver detalle del pedido ${order.idOrden}`}
                    className="p-1.5 rounded-full text-slate-500 hover:bg-teal-50 hover:text-teal-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                  >
                    <EyeIcon />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && orders.length === 0 && (
          <EmptyState message="No hay pedidos para mostrar." />
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
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

      <OrderDetailModal order={ordenSeleccionada} onClose={() => setOrdenSeleccionada(null)} />
    </div>
  );
}

export default OrdersPage;
