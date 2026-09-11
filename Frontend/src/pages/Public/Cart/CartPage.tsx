import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppStore } from '@/redux/store';
import { clearCart, removeFromCart, setCantidad } from '@/redux/states/cart';
import { Button, EmptyState } from '@/components/ui';
import { apiOrigin } from '@/utilities';

function formatPrice(precio: number): string {
  return `$${precio.toFixed(2)}`;
}

/** Carrito (client-side, ver redux/states/cart.ts) — pública, sin login:
 * el checkout va a ser como invitado (ver Backend/CLAUDE.md, sección
 * "Carrito de compra + Mercado Pago"). Estilo "App Shell" (slate/teal,
 * mismo que ContactPage/Profile), no la paleta propia de ningún catálogo —
 * es infraestructura compartida, no parte del diseño de un catálogo en
 * particular. Por ahora solo se llega acá desde Catalog.tsx (Fase 2,
 * alcance acotado a un solo catálogo, pedido explícito del usuario), pero
 * la ruta (/carrito) es genérica: cualquier catálogo que sume el carrito
 * más adelante puede linkear directo acá sin tocar esta página.
 *
 * "Finalizar compra" navega a /checkout (CheckoutPage.tsx) — ahí se piden
 * los datos de contacto y se crea el pedido contra POST /ordenes, que ya
 * devuelve la URL de Checkout Pro de Mercado Pago (ver Backend/CLAUDE.md,
 * sección "Carrito de compra + Mercado Pago", Fase 3). El carrito en sí
 * no se toca acá — se vacía recién cuando el pedido se crea con éxito. */
function CartPage() {
  const items = useSelector((state: AppStore) => state.cart.items);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const total = items.reduce((acumulado, item) => acumulado + item.precio * item.cantidad, 0);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      {/* mismo destino que ContactPage.tsx: el catálogo clásico (único que
          por ahora enlaza acá) vive en /catalog, no en '/' (la Landing). */}
      <Link to="/catalog" className="text-sm font-medium text-teal-700 hover:underline">
        ← Volver al catálogo
      </Link>

      <h1 className="mt-4 mb-6 text-2xl font-semibold tracking-tight text-slate-900">Tu carrito</h1>

      {items.length === 0 ? (
        <EmptyState
          message="Tu carrito está vacío."
          action={
            <Link to="/catalog">
              <Button>Ir al catálogo</Button>
            </Link>
          }
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li
                key={item.idProducto}
                className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-50">
                  {item.imageUrl ? (
                    <img
                      src={`${apiOrigin}${item.imageUrl}`}
                      alt={item.nombre}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-slate-300">Sin imagen</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{item.nombre}</p>
                  <p className="text-sm text-slate-500">{formatPrice(item.precio)} c/u</p>

                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex items-center rounded-md border border-slate-300">
                      <button
                        type="button"
                        onClick={() =>
                          dispatch(
                            setCantidad({ idProducto: item.idProducto, cantidad: item.cantidad - 1 }),
                          )
                        }
                        disabled={item.cantidad <= 1}
                        className="cursor-pointer px-2.5 py-1 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                        aria-label={`Restar cantidad de ${item.nombre}`}
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm tabular-nums">{item.cantidad}</span>
                      <button
                        type="button"
                        onClick={() =>
                          dispatch(
                            setCantidad({ idProducto: item.idProducto, cantidad: item.cantidad + 1 }),
                          )
                        }
                        disabled={item.stockDisponible !== null && item.cantidad >= item.stockDisponible}
                        className="cursor-pointer px-2.5 py-1 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                        aria-label={`Sumar cantidad de ${item.nombre}`}
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => dispatch(removeFromCart(item.idProducto))}
                      className="cursor-pointer text-xs font-medium text-red-600 hover:underline"
                    >
                      Quitar
                    </button>
                  </div>
                </div>

                <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                  {formatPrice(item.precio * item.cantidad)}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => dispatch(clearCart())}
              className="cursor-pointer text-sm font-medium text-slate-500 hover:text-red-600"
            >
              Vaciar carrito
            </button>
            <p className="text-lg font-bold tabular-nums text-slate-900">Total: {formatPrice(total)}</p>
          </div>

          <div className="mt-4">
            <Button onClick={() => navigate('/checkout')} className="w-full">
              Finalizar compra
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default CartPage;
