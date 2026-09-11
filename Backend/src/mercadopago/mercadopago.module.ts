import { Module } from '@nestjs/common';
import { MercadoPagoService } from './mercadopago.service';

/** sin controller propio a propósito — por ahora el único consumidor es
 * OrdersModule (ver OrdersService.crearOrden). El webhook de confirmación
 * de pago (fase siguiente, todavía sin implementar) va a vivir en
 * OrdersController, no acá, porque necesita actualizar un OrderEntity —
 * este módulo se queda solo con la integración con la API de Mercado Pago
 * en sí. */
@Module({
  providers: [MercadoPagoService],
  exports: [MercadoPagoService],
})
export class MercadoPagoModule {}
