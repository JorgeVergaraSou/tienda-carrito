import { OrderStatus } from '@/common/enums/order-status.enum';

export class OrderItemResponseDto {
  idOrdenItem: number;
  /** null solo si el producto original llegó a borrarse físicamente (no
   * pasa en la práctica, ver OrderItemEntity.producto) — nombre/precio
   * siguen disponibles igual, son el snapshot congelado. */
  idProducto: number | null;
  nombreProducto: string;
  cantidad: number;
  precioUnitario: number;
}

export class OrderResponseDto {
  idOrden: number;
  nombreContacto: string;
  email: string;
  telefono: string;
  notas: string | null;
  estado: OrderStatus;
  total: number;
  items: OrderItemResponseDto[];
  createdAt: Date;
  /** URL de Checkout Pro a la que el frontend tiene que redirigir al
   * comprador — ver MercadoPagoService.crearPreferencia. Siempre presente:
   * OrdersService.crearOrden crea el pedido y la Preferencia en la misma
   * transacción, si la Preferencia falla no se persiste el pedido (ver el
   * comentario ahí), así que un OrderResponseDto nunca existe sin esto. */
  initPoint: string;
}
