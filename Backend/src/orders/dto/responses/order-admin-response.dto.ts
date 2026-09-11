import { OrderStatus } from '@/common/enums/order-status.enum';
import { OrderItemResponseDto } from './order-response.dto';

/** Vista de un pedido para el panel ADMIN (GET /ordenes/admin/listado y
 * /ordenes/admin/:id) — a diferencia de OrderResponseDto (la que devuelve
 * el checkout), no trae `initPoint` (no tiene sentido acá, no se está
 * armando ningún pago nuevo) y sí expone los ids de Mercado Pago
 * (`mercadoPagoPreferenceId`/`mercadoPagoPaymentId`), útiles para buscar
 * el pago en el panel de Mercado Pago si hay que investigar algo a mano. */
export class OrderAdminResponseDto {
  idOrden: number;
  nombreContacto: string;
  email: string;
  telefono: string;
  notas: string | null;
  estado: OrderStatus;
  total: number;
  items: OrderItemResponseDto[];
  mercadoPagoPreferenceId: string | null;
  mercadoPagoPaymentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class PaginatedOrdersResponseDto {
  items: OrderAdminResponseDto[];
  total: number;
  page: number;
  limit: number;
}
