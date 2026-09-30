import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  ILike,
  Repository,
} from 'typeorm';
import { OrderEntity } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { FindOrdersQueryDto } from './dto/find-orders-query.dto';
import {
  OrderItemResponseDto,
  OrderResponseDto,
} from './dto/responses/order-response.dto';
import {
  OrderAdminResponseDto,
  PaginatedOrdersResponseDto,
} from './dto/responses/order-admin-response.dto';
import { OrderStatus } from '@/common/enums/order-status.enum';
import { PRECIO_MAX } from '@/products/dto/create-product.dto';
import { ProductEntity } from '@/products/entities/product.entity';
import { ProductsService } from '@/products/products.service';
import { MercadoPagoService } from '@/mercadopago/mercadopago.service';
import { handleServiceError } from '@/common/utils/error-handler.util';
import { escapeLikeWildcards } from '@/common/utils/escape-like.util';
import { ordersErrorLogger } from '@/config/module-loggers';
import { insertLogger, updateLogger } from '@/config/db-loggers';

/** Un pago aprobado o rechazado cierra el pedido; cualquier otro estado
 * (`pending`, `in_process`, `authorized`, etc.) lo deja en PENDING — el
 * webhook puede volver a llegar más adelante cuando el pago termine de
 * resolverse (ej. un pago en efectivo que tarda unos días). `null` =
 * "no hay nada que actualizar todavía". */
function mapearEstadoPago(status: string | undefined): OrderStatus | null {
  if (status === 'approved') return OrderStatus.PAID;
  if (status === 'rejected' || status === 'cancelled')
    return OrderStatus.FAILED;
  return null;
}

/** El id del pago dentro de la notificación de Mercado Pago — soporta los
 * dos formatos que todavía se ven en la práctica: el actual (`{ type:
 * 'payment', data: { id } }` o `action: 'payment.<algo>'`) y el IPN viejo
 * (`?topic=payment&id=...` por query string, sin body). Cualquier otro
 * tipo de notificación (`merchant_order`, pings de prueba del panel, etc.)
 * devuelve `null` — no hay nada que este método sepa procesar. */
function extraerPaymentId(
  body: Record<string, unknown>,
  query: Record<string, string>,
): string | null {
  const type = body?.type ?? body?.action;
  const esNotificacionDePago =
    type === 'payment' ||
    (typeof type === 'string' && type.startsWith('payment.'));

  const data = body?.data as Record<string, unknown> | undefined;
  if (esNotificacionDePago && data?.id) {
    return idDePagoValido(data.id);
  }

  if (query?.topic === 'payment' && query?.id) {
    return idDePagoValido(query.id);
  }

  return null;
}

/** El id de pago de Mercado Pago es un número entero. Se exige eso antes de
 * usarlo: este endpoint es público, y `paymentClient.get({ id })` arma con
 * ese valor la URL de la API de Mercado Pago (`/v1/payments/<id>`) usando
 * NUESTRO Access Token — un id como `1/../../customers/search` haría que
 * el servidor consulte otro recurso de la cuenta a pedido de cualquiera.
 * Un objeto, un texto con letras o un número enorme devuelven null. */
function idDePagoValido(valor: unknown): string | null {
  if (typeof valor !== 'string' && typeof valor !== 'number') {
    return null;
  }

  const texto = String(valor);
  return /^\d{1,20}$/.test(texto) ? texto : null;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    // para envolver "crear la orden" + "crear la Preferencia de Mercado
    // Pago" en una única transacción — ver crearOrden. No hace falta
    // ningún import/módulo extra: TypeOrmCoreModule provee el DataSource
    // global, mismo patrón que ya usa AppService.
    private readonly dataSource: DataSource,
    private readonly productsService: ProductsService,
    private readonly mercadoPagoService: MercadoPagoService,
  ) {}

  /** checkout como invitado (ver Backend/CLAUDE.md, sección "Carrito de
   * compra + Mercado Pago"): crea el pedido en PENDING y, en la misma
   * transacción, la Preferencia de Checkout Pro de Mercado Pago — sin
   * tocar stock todavía, el stock recién se descuenta cuando el webhook
   * de Mercado Pago confirma el pago aprobado (Fase 4, todavía sin
   * implementar).
   *
   * Cada item se resuelve contra la base real (ProductsService, nunca lo
   * que manda el cliente): existencia, que esté activo, y precio —
   * `CreateOrderItemDto` ni siquiera acepta un precio en el body, así que
   * no hay forma de que el cliente lo manipule. El chequeo de
   * `cantidad > stock` de acá es solo informativo — no reserva nada, no
   * bloquea el stock para otro comprador que esté armando el mismo
   * carrito en paralelo: la validación (y el descuento) real se repite en
   * el webhook, que es el único lugar que efectivamente compromete stock.
   *
   * Envuelto en `dataSource.transaction` porque crear un pedido ahora
   * tiene un efecto colateral externo — la llamada a la API de Mercado
   * Pago, que puede fallar (red, credenciales no configuradas, etc.). Si
   * `MercadoPagoService.crearPreferencia` tira, la transacción entera se
   * revierte: no queda en la base un pedido "fantasma", en PENDING pero
   * sin ninguna forma de pagarlo. */
  async crearOrden(dto: CreateOrderDto): Promise<OrderResponseDto> {
    try {
      // el mismo producto puede venir en varios renglones: se suman ANTES de
      // validar el stock. Sin esto, dos renglones de 5 unidades de un
      // producto con stock 5 pasaban los dos (cada uno se comparaba por
      // separado contra el stock) y se armaba un pedido por 10.
      const cantidadPorProducto = new Map<number, number>();
      for (const item of dto.items) {
        cantidadPorProducto.set(
          item.idProducto,
          (cantidadPorProducto.get(item.idProducto) ?? 0) + item.cantidad,
        );
      }

      const items = await Promise.all(
        [...cantidadPorProducto].map(async ([idProducto, cantidad]) => {
          const producto =
            await this.productsService.findActivoByIdOrThrow(idProducto);

          if (cantidad > producto.stock) {
            // si el dueño eligió ocultar el stock (mostrarStock=false), el
            // número real tampoco se filtra por este mensaje: un cliente
            // podría deducirlo probando cantidades.
            const disponible = producto.mostrarStock
              ? ` (disponible: ${producto.stock})`
              : '';
            throw new BadRequestException(
              `No hay stock suficiente de "${producto.nombre}"${disponible}`,
            );
          }

          return {
            producto,
            nombreProducto: producto.nombre,
            cantidad,
            precioUnitario: producto.precio,
          };
        }),
      );

      // suma en centavos enteros (evita 0.1 + 0.2 = 0.30000000000000004) y
      // se valida contra lo que entra en la columna DECIMAL(10,2): un total
      // mayor llegaba a MySQL y salía como un 500 con el error SQL.
      const totalCentavos = items.reduce(
        (acumulado, item) =>
          acumulado + Math.round(item.precioUnitario * 100) * item.cantidad,
        0,
      );
      const total = totalCentavos / 100;

      if (total > PRECIO_MAX) {
        throw new BadRequestException(
          'El total del pedido supera el máximo permitido, reducí las cantidades',
        );
      }

      return await this.dataSource.transaction(async (manager) => {
        const created = await manager.save(OrderEntity, {
          nombreContacto: dto.nombreContacto,
          email: dto.email,
          telefono: dto.telefono,
          notas: dto.notas ?? null,
          estado: OrderStatus.PENDING,
          total,
          items,
        });

        // se vuelve a leer completa (con la relación items.producto) en
        // vez de reutilizar `created`: `manager.save` con un array de
        // items nuevos (cascade) no devuelve esa relación poblada de
        // vuelta, y MercadoPagoService.crearPreferencia la necesita para
        // armar los items de la Preferencia.
        const ordenCompleta = await manager.findOne(OrderEntity, {
          where: { idOrden: created.idOrden },
          relations: ['items', 'items.producto'],
        });

        if (!ordenCompleta) {
          // no debería poder pasar (se acaba de crear en esta misma
          // transacción) — sale por el catch de abajo como error genérico
          // en vez de dejar un `!` sin chequear más adelante.
          throw new Error('No se pudo leer el pedido recién creado');
        }

        const preferencia =
          await this.mercadoPagoService.crearPreferencia(ordenCompleta);

        await manager.update(OrderEntity, created.idOrden, {
          mercadoPagoPreferenceId: preferencia.id,
        });

        insertLogger.info(
          `Orden creada: ${JSON.stringify({
            idOrden: created.idOrden,
            total: created.total,
            items: items.length,
          })}`,
        );
        updateLogger.info(
          `Orden (ID ${created.idOrden}) con Preferencia de Mercado Pago: ${preferencia.id}`,
        );

        return this.toResponseDto(ordenCompleta, preferencia.initPoint);
      });
    } catch (error) {
      handleServiceError(
        error,
        ordersErrorLogger,
        'OrdersService.crearOrden',
        'Error al crear el pedido',
      );
    }
  }

  /** Webhook de Mercado Pago (ver Backend/CLAUDE.md, sección "Carrito de
   * compra + Mercado Pago", Fase 4) — confirma un pago y recién ahí
   * descuenta stock. A diferencia del resto de los métodos de este
   * proyecto, **nunca tira una excepción hacia afuera**: el controller
   * tiene que poder responderle 200 a Mercado Pago siempre que sea
   * posible, porque un 4xx/5xx solo logra que reintente la misma
   * notificación sin que cambie nada. Cualquier problema real (pago no
   * encontrado, pedido no encontrado, error de red, lo que sea) se
   * loguea acá adentro para investigar a mano, no se propaga.
   *
   * Nunca confía en el body de la notificación más allá de "qué id de
   * pago consultar" — el estado real siempre se pide de nuevo a la API de
   * Mercado Pago (ver MercadoPagoService.consultarPago). Idempotente: si
   * la notificación de un mismo pago llega más de una vez (Mercado Pago
   * no garantiza entrega única), un pedido que ya salió de PENDING no se
   * vuelve a tocar — así nunca se descuenta stock dos veces por el mismo
   * pago. */
  async procesarWebhookMercadoPago(
    body: Record<string, unknown>,
    query: Record<string, string>,
  ): Promise<void> {
    try {
      const paymentId = extraerPaymentId(body, query);

      if (!paymentId) {
        return;
      }

      const pago = await this.mercadoPagoService.consultarPago(paymentId);

      if (!pago?.external_reference) {
        return;
      }

      const idOrden = Number(pago.external_reference);

      if (!Number.isInteger(idOrden)) {
        return;
      }

      const nuevoEstado = mapearEstadoPago(pago.status);

      if (!nuevoEstado) {
        return;
      }

      await this.dataSource.transaction(async (manager) => {
        // Se bloquea la fila del pedido (SELECT ... FOR UPDATE) antes de
        // decidir nada: si la misma notificación llega dos veces EN
        // PARALELO, la segunda espera acá a que la primera termine y ya ve
        // el pedido en PAID. Sin el bloqueo las dos leían PENDING y las dos
        // descontaban stock.
        const orden = await manager.findOne(OrderEntity, {
          where: { idOrden },
          lock: { mode: 'pessimistic_write' },
        });

        if (!orden) {
          return;
        }

        // PAID es terminal. FAILED también, salvo para un pago aprobado
        // posterior: Checkout Pro deja reintentar el pago sobre la misma
        // Preferencia, así que "rechazado" no cierra el pedido — si el
        // comprador reintenta y el segundo intento se aprueba, tiene que
        // terminar PAID (antes quedaba FAILED con el dinero cobrado y el
        // stock sin descontar). Un rechazo solo aplica a un pedido PENDING.
        const puedeCambiar =
          nuevoEstado === OrderStatus.PAID
            ? orden.estado === OrderStatus.PENDING ||
              orden.estado === OrderStatus.FAILED
            : orden.estado === OrderStatus.PENDING;

        if (!puedeCambiar) {
          return;
        }

        if (nuevoEstado === OrderStatus.PAID) {
          await this.descontarStockDePedido(manager, orden);
        }

        await manager.update(OrderEntity, orden.idOrden, {
          estado: nuevoEstado,
          mercadoPagoPaymentId: String(pago.id),
        });

        updateLogger.info(
          `Orden (ID ${orden.idOrden}) actualizada por webhook de Mercado Pago: estado=${nuevoEstado}, paymentId=${pago.id}`,
        );
      });
    } catch (error) {
      ordersErrorLogger.error(
        `[OrdersService.procesarWebhookMercadoPago] Error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** Descuenta el stock de cada item de un pedido recién confirmado como
   * pagado — se llama solo desde `procesarWebhookMercadoPago`, dentro de
   * la misma transacción que marca el pedido como PAID (o las dos cosas
   * pasan juntas, o ninguna). Clampeado a 0 en vez de dejar que la resta
   * sea negativa: `ProductEntity.stock` es una columna `unsigned`, restar
   * de más tiraría un error de SQL — y aunque no lo fuera, no tendría
   * sentido un stock negativo. Si la cantidad pedida supera el stock
   * disponible en este momento (sobreventa — alguien más compró el mismo
   * producto entre que se creó este pedido y se confirmó el pago), se
   * loguea como advertencia pero **no bloquea nada**: el pago ya está
   * aprobado, ya se cobró de verdad, no hay forma de "cancelarlo" acá. */
  private async descontarStockDePedido(
    manager: EntityManager,
    orden: OrderEntity,
  ): Promise<void> {
    const items = await manager.find(OrderItemEntity, {
      where: { orden: { idOrden: orden.idOrden } },
      relations: ['producto'],
    });

    // siempre en el mismo orden (por id de producto): dos pedidos que
    // comparten varios productos y se confirman a la vez bloquean las filas
    // de products en el mismo orden y no se traban entre sí (deadlock).
    items.sort(
      (a, b) => (a.producto?.idProducto ?? 0) - (b.producto?.idProducto ?? 0),
    );

    for (const item of items) {
      // producto borrado físicamente (no pasa en la práctica — los
      // productos se dan de baja con soft-delete, ver
      // Backend/CLAUDE.md — pero OrderItemEntity.producto es nullable por
      // las dudas) — no hay nada que descontar.
      if (!item.producto) {
        continue;
      }

      const productoActual = await manager.findOne(ProductEntity, {
        where: { idProducto: item.producto.idProducto },
        withDeleted: true,
      });

      if (!productoActual) {
        continue;
      }

      if (item.cantidad > productoActual.stock) {
        ordersErrorLogger.error(
          `Sobreventa al confirmar el pedido ${orden.idOrden}: se pidieron ${item.cantidad} de "${item.nombreProducto}" (producto ID ${productoActual.idProducto}) pero solo había ${productoActual.stock} en stock. El pago ya está aprobado, el stock queda en 0.`,
        );
      }

      // UPDATE atómico (`stock = GREATEST(stock - n, 0)`) en vez de leer el
      // stock, restar en JS y guardar el resultado: con dos pagos
      // distintos del mismo producto confirmándose a la vez, los dos
      // leían el mismo stock y el segundo pisaba el descuento del primero
      // (lost update).
      await manager
        .createQueryBuilder()
        .update(ProductEntity)
        .set({ stock: () => 'GREATEST(stock - :cantidad, 0)' })
        .where('id_producto = :idProducto', {
          idProducto: productoActual.idProducto,
        })
        .setParameter('cantidad', item.cantidad)
        .execute();

      updateLogger.info(
        `Stock descontado por pago confirmado (producto ID ${productoActual.idProducto}, pedido ID ${orden.idOrden}): -${item.cantidad}`,
      );
    }
  }

  /** listado del panel ADMIN (ver Backend/CLAUDE.md, sección "Carrito de
   * compra + Mercado Pago", Fase 5) — el más reciente primero (a
   * diferencia de `buscarProductos`, que ordena por nombre: acá lo
   * relevante es qué pasó último, no un orden alfabético). `search` busca
   * solo por `nombreContacto` (ver FindOrdersQueryDto) y `estado` filtra
   * exacto si se manda. */
  async findAllAdmin(
    query: FindOrdersQueryDto,
  ): Promise<PaginatedOrdersResponseDto> {
    try {
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;

      const where: FindOptionsWhere<OrderEntity> = {};

      if (query.search) {
        // escapeLikeWildcards: mismo criterio que
        // ProductsService.buscarProductos — sin esto, buscar "%" o "_"
        // literales se interpreta como comodines de LIKE.
        where.nombreContacto = ILike(`%${escapeLikeWildcards(query.search)}%`);
      }

      if (query.estado) {
        where.estado = query.estado;
      }

      const [items, total] = await this.orderRepository.findAndCount({
        where,
        relations: ['items', 'items.producto'],
        order: { createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

      return {
        items: items.map((orden) => this.toAdminResponseDto(orden)),
        total,
        page,
        limit,
      };
    } catch (error) {
      handleServiceError(
        error,
        ordersErrorLogger,
        'OrdersService.findAllAdmin',
        'Error al buscar los pedidos',
      );
    }
  }

  /** detalle de un pedido para el panel ADMIN. */
  async findOneAdmin(id: number): Promise<OrderAdminResponseDto> {
    try {
      const orden = await this.orderRepository.findOne({
        where: { idOrden: id },
        relations: ['items', 'items.producto'],
      });

      if (!orden) {
        throw new NotFoundException('Pedido no encontrado');
      }

      return this.toAdminResponseDto(orden);
    } catch (error) {
      handleServiceError(
        error,
        ordersErrorLogger,
        'OrdersService.findOneAdmin',
        'Error al buscar el pedido',
        { id },
      );
    }
  }

  /** compartido por toResponseDto (checkout) y toAdminResponseDto (panel
   * ADMIN) — la forma de un item es la misma en los dos, no tenía sentido
   * repetir el `.map`. */
  private mapItems(items: OrderItemEntity[]): OrderItemResponseDto[] {
    return items.map((item) => ({
      idOrdenItem: item.idOrdenItem,
      idProducto: item.producto?.idProducto ?? null,
      nombreProducto: item.nombreProducto,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
    }));
  }

  private toResponseDto(
    orden: OrderEntity,
    initPoint: string,
  ): OrderResponseDto {
    return {
      idOrden: orden.idOrden,
      nombreContacto: orden.nombreContacto,
      email: orden.email,
      telefono: orden.telefono,
      notas: orden.notas,
      estado: orden.estado,
      total: orden.total,
      items: this.mapItems(orden.items),
      createdAt: orden.createdAt,
      initPoint,
    };
  }

  private toAdminResponseDto(orden: OrderEntity): OrderAdminResponseDto {
    return {
      idOrden: orden.idOrden,
      nombreContacto: orden.nombreContacto,
      email: orden.email,
      telefono: orden.telefono,
      notas: orden.notas,
      estado: orden.estado,
      total: orden.total,
      items: this.mapItems(orden.items),
      mercadoPagoPreferenceId: orden.mercadoPagoPreferenceId,
      mercadoPagoPaymentId: orden.mercadoPagoPaymentId,
      createdAt: orden.createdAt,
      updatedAt: orden.updatedAt,
    };
  }
}
