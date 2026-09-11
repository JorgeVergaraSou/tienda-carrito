import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui';

type Tono = 'success' | 'pending' | 'error' | 'neutral';

const estilosPorTono: Record<Tono, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
};

/**
 * Adonde vuelve el comprador después de Checkout Pro — las tres
 * `back_urls` (success/pending/failure) de la Preferencia apuntan acá
 * mismo (ver MercadoPagoService.crearPreferencia en el backend), Mercado
 * Pago agrega sus propios parámetros de query al volver (`status` entre
 * otros) y esta página los lee para mostrar un mensaje inmediato.
 *
 * Importante: esto es **solo una referencia orientativa para el
 * comprador**, no la confirmación real del pedido — un parámetro de URL
 * lo puede mandar cualquiera (compartir el link, ida y vuelta manual,
 * etc.), nunca hay que confiar en él para nada que importe (marcar un
 * pedido como pagado, descontar stock). La confirmación real es el
 * webhook de Mercado Pago (fase siguiente, todavía sin implementar) — el
 * día que exista, esta página va a consultarle el estado real del pedido
 * al backend en vez de (o además de) leer esto.
 */
function CheckoutResultPage() {
  const [searchParams] = useSearchParams();
  // Mercado Pago manda `status` en la mayoría de los flujos y
  // `collection_status` en algunos otros (históricamente el nombre del
  // parámetro varió entre integraciones) — se prueban los dos.
  const status = searchParams.get('status') ?? searchParams.get('collection_status');
  const idOrden = searchParams.get('external_reference');

  let tono: Tono = 'neutral';
  let titulo = 'Volviste de Mercado Pago';
  let mensaje =
    'No pudimos leer el estado del pago desde la URL. Si ya pagaste, tu pedido se va a procesar igual.';

  if (status === 'approved') {
    tono = 'success';
    titulo = '¡Pago aprobado!';
    mensaje = 'Gracias por tu compra. Te vamos a contactar para coordinar el retiro del pedido.';
  } else if (status === 'pending' || status === 'in_process') {
    tono = 'pending';
    titulo = 'Pago pendiente';
    mensaje =
      'Tu pago todavía se está procesando (por ejemplo, si elegiste pagar en efectivo). Te avisamos apenas se confirme.';
  } else if (status === 'rejected') {
    tono = 'error';
    titulo = 'El pago no se pudo procesar';
    mensaje = 'Mercado Pago rechazó el pago. Podés volver al carrito e intentar de nuevo.';
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12 text-center">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight text-slate-900">{titulo}</h1>

      <p className={`rounded-xl border px-4 py-3 ${estilosPorTono[tono]}`}>{mensaje}</p>

      {idOrden && <p className="mt-3 text-xs text-slate-400">Pedido #{idOrden}</p>}

      <div className="mt-6">
        <Link to="/catalog">
          <Button variant="secondary">Volver al catálogo</Button>
        </Link>
      </div>
    </div>
  );
}

export default CheckoutResultPage;
