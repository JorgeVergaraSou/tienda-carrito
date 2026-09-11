import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrderStatus } from '@/common/enums/order-status.enum';
import { OrderItemEntity } from './order-item.entity';

/**
 * Un pedido del carrito de compra — ver Backend/CLAUDE.md, sección
 * "Carrito de compra + Mercado Pago", para el modelo de negocio completo
 * (fases implementadas y pendientes).
 *
 * Checkout como invitado (pedido explícito del usuario): a propósito no
 * hay relación a UserEntity — cualquier visitante puede comprar sin
 * cuenta, identificado solo por los datos de contacto de abajo. El rol
 * GUEST (ver role.enum.ts) queda reservado para una futura función de
 * "reclamar" un pedido logueándose después, todavía sin implementar.
 *
 * Negocio único, sin multi-vendedor: aunque ProductEntity.creadoPor
 * permite que un USER cargue sus propios productos, acá no hay ninguna
 * relación a quién vendió cada item ni split de pagos — todo el dinero
 * entra a la única cuenta de Mercado Pago del negocio.
 *
 * Sin soft-delete a propósito: un pedido nunca se "borra", su ciclo de
 * vida se representa con `estado` (ver OrderStatus).
 */
@Entity('orders')
export class OrderEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true, name: 'id_orden' })
  idOrden!: number;

  @Column({
    type: 'varchar',
    length: 120,
    nullable: false,
    name: 'nombre_contacto',
  })
  nombreContacto!: string;

  @Column({ type: 'varchar', length: 150, nullable: false, name: 'email' })
  email!: string;

  @Column({ type: 'varchar', length: 40, nullable: false, name: 'telefono' })
  telefono!: string;

  /** notas libres del comprador (ej. horario de retiro) — no hay campo de
   * dirección de envío formal: el negocio no tiene delivery por ahora, se
   * coordina el retiro en local por WhatsApp/mail, mismo criterio que ya
   * usa ContactModule para el contacto general. */
  @Column({ type: 'text', nullable: true, name: 'notas' })
  notas!: string | null;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
    name: 'estado',
  })
  estado!: OrderStatus;

  /** mismo patrón que ProductEntity.precio: DECIMAL(10,2) con transformer.
   * Es la suma de `cantidad * precioUnitario` de cada item, calculada y
   * guardada al crear la orden (OrdersService.crearOrden) — no se
   * recalcula después. */
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: false,
    name: 'total',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  total!: number;

  /** se completan recién en fases siguientes, todavía sin implementar acá:
   * Fase 3 crea la Preferencia de Mercado Pago (mercadoPagoPreferenceId) y
   * Fase 4, el webhook que confirma el pago, guarda el id del pago real
   * (mercadoPagoPaymentId) y recién ahí descuenta stock. Null hasta
   * entonces — hoy toda orden queda en PENDING con los dos en null. */
  @Column({
    type: 'varchar',
    nullable: true,
    name: 'mercado_pago_preference_id',
  })
  mercadoPagoPreferenceId!: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'mercado_pago_payment_id' })
  mercadoPagoPaymentId!: string | null;

  @OneToMany(() => OrderItemEntity, (item) => item.orden, { cascade: true })
  items!: OrderItemEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
