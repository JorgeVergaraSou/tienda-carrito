import { DialogTitle } from '@headlessui/react';
import { AdminOrder } from '@/interfaces';
import { Modal } from '@/components/ui';
import { estadoBadge, formatPrice } from './orderStatus.utils';

interface OrderDetailModalProps {
  /** null = cerrado — mismo patrón que ProductDetailModal.tsx del
   * catálogo (Catalog/ProductDetailModal.tsx). */
  order: AdminOrder | null;
  onClose: () => void;
}

/** Detalle de un pedido para el panel ADMIN — de solo lectura (v1, pedido
 * explícito del usuario: "para esta v1 dejalo solo accesible para ADMIN",
 * sin mencionar acciones de edición manual, ver Backend/CLAUDE.md Fase 5).
 * Muestra los ids de Mercado Pago (Preferencia/Pago) para poder buscar el
 * pago a mano en el panel de Mercado Pago si hace falta investigar algo. */
export function OrderDetailModal({ order, onClose }: OrderDetailModalProps) {
  return (
    <Modal open={order !== null} onClose={onClose} className="max-w-xl max-h-[90vh] flex flex-col">
      {order && (
        <div className="flex flex-col gap-4 overflow-y-auto p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle as="h2" className="text-lg font-semibold text-slate-900">
                Pedido #{order.idOrden}
              </DialogTitle>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(order.createdAt).toLocaleString('es-AR')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {estadoBadge(order.estado)}
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer text-2xl leading-none text-gray-400 hover:text-gray-600"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-slate-500">Contacto</p>
              <p className="text-slate-800">{order.nombreContacto}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Email</p>
              <p className="text-slate-800">{order.email}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Teléfono</p>
              <p className="text-slate-800">{order.telefono}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Total</p>
              <p className="font-semibold tabular-nums text-slate-800">{formatPrice(order.total)}</p>
            </div>
            {order.notas && (
              <div className="sm:col-span-2">
                <p className="text-xs font-medium text-slate-500">Notas</p>
                <p className="whitespace-pre-line text-slate-800">{order.notas}</p>
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-slate-500">Productos</p>
            <ul className="flex flex-col gap-2">
              {order.items.map((item) => (
                <li
                  key={item.idOrdenItem}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <span className="text-slate-700">
                    {item.cantidad} × {item.nombreProducto}
                  </span>
                  <span className="font-medium tabular-nums text-slate-900">
                    {formatPrice(item.precioUnitario * item.cantidad)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* ids de Mercado Pago — para buscar el pago/la preferencia a
              mano en el panel de Mercado Pago si hace falta investigar
              algo (ej. un reclamo). No son datos que le interesen a nadie
              más que a quien administra la tienda. */}
          <div className="border-t border-slate-100 pt-3 text-xs text-slate-400">
            <p>Preferencia MP: {order.mercadoPagoPreferenceId ?? '—'}</p>
            <p>Pago MP: {order.mercadoPagoPaymentId ?? '— (todavía sin confirmar)'}</p>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default OrderDetailModal;
