import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsModule } from '@/products/products.module';
import { MercadoPagoModule } from '@/mercadopago/mercadopago.module';
import { OrderEntity } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrderEntity, OrderItemEntity]),
    // para validar cada item del carrito contra un producto real (existe,
    // activo, precio/stock actuales) — ver
    // ProductsService.findActivoByIdOrThrow, mismo patrón que ya usa
    // ProductsModule importando CategoriesModule.
    ProductsModule,
    // para crear la Preferencia de Checkout Pro al crear el pedido — ver
    // OrdersService.crearOrden y MercadoPagoService.
    MercadoPagoModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
