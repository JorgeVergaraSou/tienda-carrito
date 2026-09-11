/** Ciclo de vida de un pedido (ver OrderEntity) — arranca en PENDING al
 * crear la orden (POST /ordenes), pasa a PAID cuando el webhook de Mercado
 * Pago confirma el pago aprobado (Fase 4, todavía sin implementar acá), o
 * a FAILED si Mercado Pago lo rechaza. CANCELLED queda reservado para una
 * cancelación manual (ej. desde el panel ADMIN, Fase 5) — todavía sin un
 * endpoint que lo dispare. */
export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}
