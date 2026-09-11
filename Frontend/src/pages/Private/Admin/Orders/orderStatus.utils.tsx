import type { OrderStatus } from '@/interfaces';

export function formatPrice(precio: number): string {
  return `$${precio.toFixed(2)}`;
}

const estilosPorEstado: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  PAID: 'bg-emerald-50 text-emerald-700',
  FAILED: 'bg-red-50 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-600',
};

const etiquetaPorEstado: Record<OrderStatus, string> = {
  PENDING: 'Pendiente',
  PAID: 'Pagado',
  FAILED: 'Rechazado',
  CANCELLED: 'Cancelado',
};

/** Pill de estado — mismo tratamiento visual que el badge Activo/Inactivo
 * de ProductsListPage.tsx (compartido acá entre OrdersPage.tsx y
 * OrderDetailModal.tsx, no tenía sentido repetirlo en los dos). */
export function estadoBadge(estado: OrderStatus) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${estilosPorEstado[estado]}`}
    >
      {etiquetaPorEstado[estado]}
    </span>
  );
}
