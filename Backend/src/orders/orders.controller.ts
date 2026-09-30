import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Auth } from '@/auth/decorators/auth.decorator';
import { Role } from '@/common/enums/role.enum';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { FindOrdersQueryDto } from './dto/find-orders-query.dto';

@Controller('ordenes')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /** checkout como invitado — público, sin @Auth (ver Backend/CLAUDE.md,
   * sección "Carrito de compra + Mercado Pago"): cualquier visitante
   * puede crear un pedido sin loguearse. */
  // cada pedido crea una Preferencia en la API de Mercado Pago y escribe en
  // la base, y el endpoint es público: sin límite, un script puede
  // inundar la tabla de pedidos y gastar cuota de la cuenta de Mercado
  // Pago. 10 pedidos cada 10 minutos por IP sobra para un cliente real.
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 600000 } })
  @Post()
  async create(@Body() dto: CreateOrderDto) {
    return this.ordersService.crearOrden(dto);
  }

  /** panel de pedidos — ADMIN exclusivo (Fase 5, pedido explícito del
   * usuario: "para esta v1 dejalo solo accesible para ADMIN"). Declarado
   * ANTES de GET /admin/:id — misma forma de ruta ("admin/<segmento>"),
   * mismo motivo que ya documentan products/categories: si se invierte el
   * orden, Nest intentaría matchear "listado" como si fuera el :id. */
  @Auth(Role.ADMIN)
  @Get('admin/listado')
  async findAllAdmin(@Query() query: FindOrdersQueryDto) {
    return this.ordersService.findAllAdmin(query);
  }

  /** detalle de un pedido — ADMIN exclusivo, mismo criterio que arriba. */
  @Auth(Role.ADMIN)
  @Get('admin/:id')
  async findOneAdmin(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.findOneAdmin(id);
  }

  /** webhook de Mercado Pago — público, sin @Auth (ver Backend/CLAUDE.md,
   * sección "Carrito de compra + Mercado Pago", Fase 4). `body`/`query`
   * quedan sin tipar con un DTO a propósito (`Record<string, unknown>` /
   * `Record<string, string>`, no una clase): el `ValidationPipe` global
   * (`whitelist: true, forbidNonWhitelisted: true`, ver main.ts) solo
   * valida parámetros cuyo tipo resuelve a una clase real — con un tipo
   * "objeto" común, Nest lo salta entero. Hace falta ese salto acá: el
   * body lo arma Mercado Pago, no nuestro propio frontend, y su forma
   * varía según el tipo de notificación (no tiene sentido mantener un DTO
   * estricto para eso). Siempre responde 200 (`@HttpCode(200)`, aunque
   * ya sea el status default de un POST que no tira) — ver el comentario
   * largo en `OrdersService.procesarWebhookMercadoPago` sobre por qué
   * nunca hay que devolverle un error a Mercado Pago acá. */
  // límite por IP: cada notificación dispara una consulta a la API de
  // Mercado Pago con NUESTRO Access Token, y el endpoint es público — sin
  // tope, cualquiera puede usarlo para quemar la cuota de la cuenta. 100
  // por minuto es holgado para las notificaciones de una tienda chica.
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Body() body: Record<string, unknown>,
    @Query() query: Record<string, string>,
  ): Promise<void> {
    return this.ordersService.procesarWebhookMercadoPago(body, query);
  }

  /** mismo webhook, pero por GET — el IPN clásico de Mercado Pago
   * (`?topic=payment&id=...`, el formato viejo que ya contempla
   * `extraerPaymentId` en OrdersService) históricamente se entrega por
   * GET, no POST. Sin este handler, esas notificaciones llegarían a un
   * 404 y nunca se procesarían — encontrado recién ahora probando el
   * endpoint a mano, no había ningún caso de test que lo cubriera. Mismo
   * body vacío siempre (un GET no trae body), toda la información viaja
   * por query. */
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  @Get('webhook')
  @HttpCode(200)
  async webhookPorGet(@Query() query: Record<string, string>): Promise<void> {
    return this.ordersService.procesarWebhookMercadoPago({}, query);
  }
}
