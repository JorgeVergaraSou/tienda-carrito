import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppStore } from '@/redux/store';
import { clearCart } from '@/redux/states/cart';
import { crearOrdenService } from '@/services';
import { getErrorMessage } from '@/utilities';
import { Button, FormField, inputClass } from '@/components/ui';

function formatPrice(precio: number): string {
  return `$${precio.toFixed(2)}`;
}

/** Valida que la URL a la que se va a redirigir sea de verdad una página de
 * pago de Mercado Pago (https + dominio de Mercado Pago) y la devuelve. La
 * URL viene de la respuesta del backend y se asigna a `window.location.href`:
 * un valor inesperado (`javascript:...`, otro dominio) ejecutaría código o
 * mandaría al comprador a un sitio ajeno con el pedido recién armado. No
 * es una defensa contra un backend comprometido — es no redirigir a ciegas
 * ante un dato raro (respuesta manipulada por un proxy, bug del backend). */
function urlDeMercadoPagoValida(initPoint: string): string {
  let url: URL;

  try {
    url = new URL(initPoint);
  } catch {
    throw new Error('No se pudo iniciar el pago, intentá de nuevo en unos minutos');
  }

  const esMercadoPago =
    url.hostname === 'mercadopago.com' ||
    url.hostname.endsWith('.mercadopago.com') ||
    url.hostname === 'mercadopago.com.ar' ||
    url.hostname.endsWith('.mercadopago.com.ar');

  if (url.protocol !== 'https:' || !esMercadoPago) {
    throw new Error('No se pudo iniciar el pago, intentá de nuevo en unos minutos');
  }

  return url.toString();
}

interface CheckoutFormState {
  nombreContacto: string;
  email: string;
  telefono: string;
  notas: string;
}

const emptyForm: CheckoutFormState = { nombreContacto: '', email: '', telefono: '', notas: '' };

/** Checkout como invitado (ver Backend/CLAUDE.md, sección "Carrito de
 * compra + Mercado Pago") — sin cuenta obligatoria, solo datos de
 * contacto. Al confirmar, crea el pedido contra `POST /ordenes` (que ya
 * crea también la Preferencia de Mercado Pago en la misma request, ver
 * OrdersService.crearOrden en el backend) y redirige de inmediato a
 * Checkout Pro con `window.location.href` — no es una navegación de la
 * SPA, es una URL de mercadopago.com.
 *
 * El carrito se vacía recién cuando el pedido se creó con éxito (justo
 * antes de redirigir), no antes: si `crearOrdenService` falla, el carrito
 * tiene que seguir intacto para que el comprador pueda reintentar sin
 * tener que volver a armar todo.
 *
 * `window.location.href = initPoint` no navega en el mismo instante —
 * el browser tarda un momento en efectivamente salir de la SPA. En ese
 * momento el carrito ya está vacío (`clearCart` se disparó antes, ver
 * arriba), así que sin `redirigiendoAMercadoPago` esta página volvía a
 * renderizar el estado de "carrito vacío" de más abajo durante esa
 * ventana — pedido explícito del usuario, con captura: confundía al
 * cliente, que veía "no hay nada que pagar" justo después de haber
 * apretado "Pagar" y pensaba que tenía que volver a hacer algo. */
function CheckoutPage() {
  const items = useSelector((state: AppStore) => state.cart.items);
  const dispatch = useDispatch();

  const [form, setForm] = useState<CheckoutFormState>(emptyForm);
  const [enviando, setEnviando] = useState(false);
  const [formError, setFormError] = useState('');
  const [redirigiendoAMercadoPago, setRedirigiendoAMercadoPago] = useState(false);

  const total = items.reduce((acumulado, item) => acumulado + item.precio * item.cantidad, 0);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.nombreContacto.trim() || !form.email.trim() || !form.telefono.trim()) {
      setFormError('Nombre, email y teléfono son obligatorios');
      return;
    }

    setEnviando(true);
    setFormError('');

    try {
      const orden = await crearOrdenService({
        nombreContacto: form.nombreContacto.trim(),
        email: form.email.trim(),
        telefono: form.telefono.trim(),
        notas: form.notas.trim() || undefined,
        items: items.map((item) => ({ idProducto: item.idProducto, cantidad: item.cantidad })),
      });

      // se valida ANTES de vaciar el carrito: si la URL es rara, el error
      // sale por el catch de abajo y el carrito queda intacto.
      const destino = urlDeMercadoPagoValida(orden.initPoint);

      // antes de vaciar el carrito (que dispara el re-render que de otro
      // modo mostraría el estado de "carrito vacío" más abajo, ver el
      // comentario del componente).
      setRedirigiendoAMercadoPago(true);
      dispatch(clearCart());
      // navegación dura a propósito (no react-router): initPoint es una
      // URL de Mercado Pago, no una ruta de este sitio.
      window.location.href = destino;
    } catch (error) {
      setFormError(getErrorMessage(error));
      setEnviando(false);
    }
  };

  // va antes del check de "carrito vacío" a propósito — ver el comentario
  // del componente. Sin botones ni links: no hay nada que el cliente
  // tenga que hacer acá, la redirección es automática.
  if (redirigiendoAMercadoPago) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <div
          className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-teal-600"
          aria-hidden="true"
        />
        <h1 className="mb-2 text-2xl font-semibold tracking-tight text-slate-900">
          Procesando tu pedido...
        </h1>
        <p className="text-slate-600">Ya casi — te estamos redirigiendo a Mercado Pago para completar el pago.</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight text-slate-900">Checkout</h1>
        <p className="mb-6 text-slate-600">Tu carrito está vacío — no hay nada que pagar todavía.</p>
        <Link to="/catalog">
          <Button>Ir al catálogo</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <Link to="/carrito" className="text-sm font-medium text-teal-700 hover:underline">
        ← Volver al carrito
      </Link>

      <h1 className="mt-4 mb-2 text-2xl font-semibold tracking-tight text-slate-900">Checkout</h1>
      <p className="mb-6 text-slate-600">
        No hace falta una cuenta — completá tus datos de contacto y te llevamos a Mercado Pago para
        pagar.
      </p>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.idProducto} className="flex justify-between text-sm">
              <span className="text-slate-700">
                {item.cantidad} × {item.nombre}
              </span>
              <span className="font-medium tabular-nums text-slate-900">
                {formatPrice(item.precio * item.cantidad)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-slate-200 pt-3">
          <span className="font-semibold text-slate-900">Total</span>
          <span className="font-bold tabular-nums text-slate-900">{formatPrice(total)}</span>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <FormField label="Nombre" htmlFor="nombreContacto" required>
          <input
            id="nombreContacto"
            type="text"
            value={form.nombreContacto}
            onChange={(e) => setForm({ ...form, nombreContacto: e.target.value })}
            className={inputClass}
          />
        </FormField>

        <FormField label="Email" htmlFor="email" required>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={inputClass}
          />
        </FormField>

        <FormField label="Teléfono" htmlFor="telefono" required>
          <input
            id="telefono"
            type="tel"
            value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            className={inputClass}
          />
        </FormField>

        <FormField
          label="Notas"
          htmlFor="notas"
          hint="Opcional — por ejemplo, un horario para retirar el pedido. No hay envío a domicilio, se coordina el retiro en el local."
        >
          <textarea
            id="notas"
            value={form.notas}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
            rows={3}
            className={inputClass}
          />
        </FormField>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <Button type="submit" disabled={enviando}>
          {enviando ? 'Redirigiendo a Mercado Pago...' : 'Pagar con Mercado Pago'}
        </Button>
      </form>
    </div>
  );
}

export default CheckoutPage;
