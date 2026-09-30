import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import type { PaymentResponse } from 'mercadopago/dist/clients/payment/commonTypes';
import { OrderEntity } from '@/orders/entities/order.entity';
import { handleServiceError } from '@/common/utils/error-handler.util';
import { mercadopagoErrorLogger } from '@/config/module-loggers';

export interface PreferenciaCreada {
  id: string;
  /** URL a la que hay que redirigir al comprador — ya resuelta según
   * MERCADOPAGO_SANDBOX (ver crearPreferencia), el consumidor de este
   * servicio no tiene que saber la diferencia entre init_point y
   * sandbox_init_point. */
  initPoint: string;
}

/**
 * Integración con Mercado Pago Checkout Pro (ver Backend/CLAUDE.md, sección
 * "Carrito de compra + Mercado Pago"): el backend crea una Preferencia y
 * redirige al comprador a la página de pago hospedada por Mercado Pago —
 * nada de tarjetas ni datos de pago pasan por este servidor. La
 * confirmación real del pago (webhook + descuento de stock) es una fase
 * siguiente, todavía sin implementar; este servicio solo arma la
 * Preferencia y devuelve a dónde redirigir.
 *
 * A propósito no es parte de OrdersModule ni recibe nada del cliente
 * directamente — OrdersService le pasa un OrderEntity ya guardado en la
 * base (con sus items ya validados/congelados), nunca el carrito crudo del
 * frontend.
 */
@Injectable()
export class MercadoPagoService {
  /** Crea la Preferencia de Checkout Pro para un pedido ya persistido.
   * `order.items` tiene que venir con la relación `producto` cargada (para
   * el id del item) — ver OrdersService.crearOrden, que siempre la carga
   * antes de llamar acá. */
  async crearPreferencia(order: OrderEntity): Promise<PreferenciaCreada> {
    // Se lee directo de process.env (mismo criterio que mailer.ts/
    // ContactService — ver Backend/CLAUDE.md) en vez de inyectar
    // ConfigService: este proyecto no usa ConfigService dentro de
    // servicios, solo en la fábrica de TypeORM de app.module.ts.
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (!accessToken) {
      throw new InternalServerErrorException(
        'El pago con Mercado Pago todavía no está configurado en el servidor (falta MERCADOPAGO_ACCESS_TOKEN)',
      );
    }

    // MERCADOPAGO_SANDBOX tiene default true en el schema de Joi
    // (app.module.ts) — con una cuenta/token de prueba, Mercado Pago exige
    // redirigir a sandbox_init_point, no a init_point (ese exige un token
    // de producción real). Leído como string porque las env vars siempre
    // llegan como string aunque Joi las valide como boolean.
    const sandbox = process.env.MERCADOPAGO_SANDBOX !== 'false';

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    // `auto_return` exige que `back_urls.success` sea una URL https — con
    // MERCADOPAGO_SANDBOX y FRONTEND_URL apuntando a un localhost http
    // (dev), mandar auto_return igual no lo ignora "cosméticamente" como
    // se pensaba al principio: Mercado Pago rechaza la creación de TODA
    // la Preferencia con "auto_return invalid. back_url.success must be
    // defined" (verificado a mano). Así que solo se manda si success es
    // https — en producción (FRONTEND_URL real, con https) esto se activa
    // solo, sin tocar nada acá.
    const successEsHttps = frontendUrl.startsWith('https://');

    try {
      const client = new MercadoPagoConfig({ accessToken });
      const preferenceClient = new Preference(client);

      const resultado = await preferenceClient.create({
        body: {
          items: order.items.map((item) => ({
            // id: el del producto si todavía existe la relación (ver
            // OrderItemEntity.producto, onDelete: SET NULL) — si no,
            // el propio id del item alcanza, Mercado Pago no lo valida
            // contra nada nuestro, es solo para que el comprador vea un
            // identificador en el resumen de pago.
            id: String(item.producto?.idProducto ?? item.idOrdenItem),
            title: item.nombreProducto,
            quantity: item.cantidad,
            currency_id: 'ARS',
            unit_price: item.precioUnitario,
          })),
          payer: { name: order.nombreContacto, email: order.email },
          // así el webhook de la fase siguiente va a poder encontrar el
          // pedido en la base a partir del pago que le llegue de Mercado
          // Pago, sin tener que guardar nada más en la Preferencia.
          external_reference: String(order.idOrden),
          // las tres apuntan a la misma página del frontend — no hace
          // falta una ruta por resultado, Mercado Pago agrega sus propios
          // parámetros de query (status, collection_status, etc.) al
          // volver, y esa página los lee para mostrar un mensaje
          // inmediato (ver CheckoutResultPage.tsx en el frontend). Ese
          // mensaje es solo orientativo, no la confirmación real del
          // pedido — eso lo resuelve el webhook de la fase siguiente.
          back_urls: {
            success: `${frontendUrl}/checkout/resultado`,
            pending: `${frontendUrl}/checkout/resultado`,
            failure: `${frontendUrl}/checkout/resultado`,
          },
          // vuelve solo al sitio (en vez de mostrar el botón "Volver al
          // sitio" de Mercado Pago) cuando el pago se aprueba al toque —
          // ver el comentario de `successEsHttps` arriba: en dev
          // (localhost http) directamente no se manda, se vuelve siempre
          // con el botón manual.
          ...(successEsHttps ? { auto_return: 'approved' as const } : {}),
          // adónde Mercado Pago nos avisa que un pago cambió de estado
          // (ver OrdersController.webhook / OrdersService.procesarWebhookMercadoPago).
          // Opcional: MERCADOPAGO_WEBHOOK_URL tiene que ser una URL pública
          // que llegue hasta este backend (un túnel tipo ngrok en dev —
          // localhost no sirve, Mercado Pago no puede pegarle). Sin
          // configurar, el pedido igual se crea y se puede pagar
          // normalmente, solo que nunca vamos a enterarnos de la
          // confirmación por este canal.
          ...(process.env.MERCADOPAGO_WEBHOOK_URL
            ? {
                // el prefijo tiene que coincidir con
                // app.setGlobalPrefix('tienda-carrito/v1') de main.ts —
                // no hay una constante compartida para esto en el
                // proyecto, se repite el literal a propósito (mismo
                // criterio que ya usa el resto del código con este prefijo).
                notification_url: `${process.env.MERCADOPAGO_WEBHOOK_URL}/tienda-carrito/v1/ordenes/webhook`,
              }
            : {}),
          statement_descriptor: 'TIENDA CARRITO',
        },
      });

      const initPoint = sandbox
        ? resultado.sandbox_init_point
        : resultado.init_point;

      if (!resultado.id || !initPoint) {
        throw new InternalServerErrorException(
          'Mercado Pago no devolvió una preferencia de pago válida',
        );
      }

      return { id: resultado.id, initPoint };
    } catch (error) {
      handleServiceError(
        error,
        mercadopagoErrorLogger,
        'MercadoPagoService.crearPreferencia',
        'No se pudo iniciar el pago con Mercado Pago, intentá de nuevo en unos minutos',
        { idOrden: order.idOrden },
      );
    }
  }

  /** Consulta un pago REAL contra la API de Mercado Pago a partir de su id
   * — usado por el webhook (ver OrdersService.procesarWebhookMercadoPago)
   * para nunca confiar en el `status` que venga en el body de la
   * notificación: cualquiera puede mandarnos un POST fingiendo ser
   * Mercado Pago, pero solo un pago que exista de verdad en su API (y
   * cuyo `external_reference` coincida con un pedido nuestro) puede
   * terminar marcando algo como pagado.
   *
   * A propósito no usa `handleServiceError` (que loguea y **tira** una
   * excepción HTTP) — un webhook tiene que responder 200 siempre que
   * pueda, aunque el id que mandó Mercado Pago no exista (webhook de
   * prueba desde su panel, notificación vieja/reenviada, etc.), así que
   * acá un pago no encontrado es un resultado válido (`null`), no un
   * error que haya que propagar. */
  async consultarPago(paymentId: string): Promise<PaymentResponse | null> {
    // defensa en profundidad (OrdersService ya lo valida): el id se usa
    // para armar la URL de la API con nuestro Access Token, así que tiene
    // que ser sí o sí un entero.
    if (!/^\d{1,20}$/.test(paymentId)) {
      return null;
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (!accessToken) {
      mercadopagoErrorLogger.error(
        `No se pudo consultar el pago ${paymentId}: falta MERCADOPAGO_ACCESS_TOKEN`,
      );
      return null;
    }

    try {
      const client = new MercadoPagoConfig({ accessToken });
      const paymentClient = new Payment(client);

      return await paymentClient.get({ id: paymentId });
    } catch (error) {
      mercadopagoErrorLogger.error(
        `No se pudo consultar el pago ${paymentId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }
}
