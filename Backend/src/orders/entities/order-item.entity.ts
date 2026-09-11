import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProductEntity } from '@/products/entities/product.entity';
import { OrderEntity } from './order.entity';

/**
 * Una línea de un pedido — ver OrderEntity para el modelo completo.
 *
 * `nombreProducto`/`precioUnitario` son un snapshot del producto al
 * momento de crear la orden (OrdersService.crearOrden) y nunca se vuelven
 * a leer de ProductEntity después: si el producto cambia de nombre o
 * precio más adelante, o incluso se da de baja, el historial de este
 * pedido no se ve afectado.
 */
@Entity('order_items')
export class OrderItemEntity {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
    name: 'id_orden_item',
  })
  idOrdenItem!: number;

  @ManyToOne(() => OrderEntity, (orden) => orden.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orden_id' })
  orden!: OrderEntity;

  /** referencia al producto real, solo para trazabilidad/administración
   * (ej. poder ver desde un pedido viejo qué producto era) — nunca se usa
   * para releer precio o nombre, eso ya quedó congelado abajo. onDelete:
   * 'SET NULL' porque en este proyecto los productos se dan de baja con
   * soft-delete, nunca se borran físicamente (ver Backend/CLAUDE.md), pero
   * por las dudas el pedido no debe romperse si alguna vez pasara. */
  @ManyToOne(() => ProductEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'producto_id' })
  producto!: ProductEntity | null;

  @Column({
    type: 'varchar',
    length: 120,
    nullable: false,
    name: 'nombre_producto',
  })
  nombreProducto!: string;

  @Column({ type: 'int', unsigned: true, nullable: false, name: 'cantidad' })
  cantidad!: number;

  /** mismo patrón que ProductEntity.precio: DECIMAL(10,2) con transformer
   * (el driver de MySQL devuelve DECIMAL como string). Es el precio
   * unitario del producto en el momento de la compra, no el actual. */
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: false,
    name: 'precio_unitario',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  precioUnitario!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
