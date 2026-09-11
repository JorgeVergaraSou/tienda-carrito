/** Espejo de OrderResponseDto/OrderItemResponseDto del backend (ver
 * Backend/CLAUDE.md, sección "Carrito de compra + Mercado Pago"). */
export interface OrderItem {
  idOrdenItem: number;
  idProducto: number | null;
  nombreProducto: string;
  cantidad: number;
  precioUnitario: number;
}

export type OrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';

export interface Order {
  idOrden: number;
  nombreContacto: string;
  email: string;
  telefono: string;
  notas: string | null;
  estado: OrderStatus;
  total: number;
  items: OrderItem[];
  createdAt: string;
  /** URL de Checkout Pro de Mercado Pago — CheckoutPage.tsx redirige acá
   * (`window.location.href`, no es una ruta de la SPA) apenas se crea el
   * pedido. */
  initPoint: string;
}

/** espejo de OrderAdminResponseDto (GET /ordenes/admin/listado y
 * /ordenes/admin/:id, ADMIN-only, ver Backend/CLAUDE.md Fase 5) — sin
 * `initPoint` (no se está armando ningún pago nuevo acá), con los ids de
 * Mercado Pago visibles para poder buscar el pago a mano si hace falta. */
export interface AdminOrder extends Omit<Order, 'initPoint'> {
  mercadoPagoPreferenceId: string | null;
  mercadoPagoPaymentId: string | null;
  updatedAt: string;
}

export interface PaginatedOrders {
  items: AdminOrder[];
  total: number;
  page: number;
  limit: number;
}
