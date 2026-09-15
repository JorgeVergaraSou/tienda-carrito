import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { getProductService } from '@/services';
import { Product } from '@/interfaces';
import { getErrorMessage, apiOrigin, showSuccess } from '@/utilities';
import { CartLink } from '@/components/Cart/CartLink';
import { addToCart } from '@/redux/states/cart';

function formatPrice(precio: number): string {
  return `$${precio.toFixed(2)}`;
}

/** Página de detalle del catálogo 5 — a diferencia de los otros 4
 * catálogos (que abren ProductDetailModal, un modal), acá clickear un
 * producto NAVEGA de verdad a esta página (pedido explícito del usuario),
 * montada en `/catalog5/detalleproducto/:id` (ver Catalog5.tsx). Reutiliza
 * `getProductService` — el mismo service público que ya usaba la vieja
 * `pages/Public/ProductDetail/ProductDetail.tsx` — sin endpoint nuevo.
 *
 * La galería de fotos (imagen grande + miniaturas) es una versión propia
 * de la misma idea que ya resuelve `ProductDetailModal.tsx` (portada +
 * `fotos[]`, click en una miniatura cambia la principal) — no se reutilizó
 * ese componente porque está pensado para vivir DENTRO de un modal
 * (`Modal.tsx`/`@headlessui`), no como layout de página completa; la
 * lógica que se duplica es mínima (armar el array de fotos + un índice
 * seleccionado), no vale la pena forzar un componente compartido para
 * eso.
 *
 * **Carrito conectado** (pedido explícito del usuario — ver
 * Frontend/CLAUDE.md, sección "Quinto catálogo con carrito"): mismo
 * `redux/states/cart.ts` que el resto, con su propio selector de cantidad
 * en esta página (no hay modal acá para reutilizar el que ya tiene
 * ProductDetailModal.tsx en los otros 4 catálogos). */
function DetalleProducto() {
  const { id } = useParams<{ id: string }>();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cantidad, setCantidad] = useState(1);

  const dispatch = useDispatch();

  useEffect(() => {
    let cancelado = false;

    (async () => {
      setLoading(true);
      setError('');
      setSelectedIndex(0);
      setCantidad(1);

      try {
        const data = await getProductService(Number(id));
        if (!cancelado) setProduct(data);
      } catch (err) {
        if (!cancelado) setError(getErrorMessage(err));
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [id]);

  const fotos = product
    ? [...(product.imageUrl ? [product.imageUrl] : []), ...product.fotos.map((f) => f.imageUrl)]
    : [];

  const handleAgregarAlCarrito = () => {
    if (!product) return;

    dispatch(
      addToCart({
        item: {
          idProducto: product.idProducto,
          nombre: product.nombre,
          precio: product.precio,
          imageUrl: product.imageUrl,
          stockDisponible: product.stock,
        },
        cantidad,
      }),
    );
    showSuccess('Agregado al carrito', product.nombre);
  };

  return (
    <div className="min-h-screen bg-c5-bg text-c5-ink font-catalog5">
      <div className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-8">
          <span className="shrink-0 text-lg font-semibold tracking-tight">Tienda en Línea con carrito de compra</span>
          <div className="ml-auto flex shrink-0 items-center gap-4">
            <Link
              to="/contacto"
              className="text-sm text-c5-ink/60 hover:text-c5-ink transition-colors"
            >
              Contacto
            </Link>

            <CartLink className="text-c5-ink/60 hover:text-c5-ink" />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* vuelve puntualmente a este catálogo (no a la Landing) — pedido
            explícito del usuario. */}
        <Link
          to="/catalog5"
          className="text-sm text-c5-ink/50 hover:text-c5-accent transition-colors"
        >
          ← Volver al catálogo
        </Link>

        {loading && <p className="mt-6 text-sm text-c5-ink/50">Cargando…</p>}
        {error && <p className="mt-6 text-sm text-red-400">{error}</p>}

        {product && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div>
              <div className="aspect-square rounded-lg border border-white/10 bg-c5-surface flex items-center justify-center overflow-hidden">
                {fotos.length > 0 ? (
                  <img
                    src={`${apiOrigin}${fotos[selectedIndex]}`}
                    alt={product.nombre}
                    className="h-full w-full object-contain p-8"
                  />
                ) : (
                  <span className="text-c5-ink/25 text-sm">Sin imagen</span>
                )}
              </div>

              {fotos.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto">
                  {fotos.map((foto, index) => (
                    <button
                      key={foto}
                      type="button"
                      onClick={() => setSelectedIndex(index)}
                      aria-label={`Ver foto ${index + 1}`}
                      className={`h-16 w-16 shrink-0 rounded-md border-2 bg-c5-surface overflow-hidden cursor-pointer transition-colors ${
                        index === selectedIndex ? 'border-c5-accent' : 'border-transparent hover:border-white/25'
                      }`}
                    >
                      <img src={`${apiOrigin}${foto}`} alt="" className="h-full w-full object-contain" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              {product.categoria && (
                <span className="inline-flex items-center rounded-full border border-white/15 px-3 py-1 text-xs text-c5-ink/60">
                  {product.categoria.nombre}
                </span>
              )}

              <h1 className="mt-4 text-3xl font-semibold tracking-tight">{product.nombre}</h1>

              <p className="mt-4 text-3xl font-semibold text-c5-accent tabular-nums">
                {formatPrice(product.precio)}
              </p>

              {product.stock === null ? (
                <p className="mt-2 text-sm text-c5-ink/50">Consultar disponibilidad</p>
              ) : product.stock === 0 ? (
                <p className="mt-2 text-sm font-medium text-red-400">Sin stock</p>
              ) : (
                <p className="mt-2 text-sm text-c5-ink/50">Stock disponible: {product.stock}</p>
              )}

              {product.stock !== 0 && (
                <div className="mt-6 flex items-center gap-3">
                  <div className="flex items-center rounded-full border border-white/15">
                    <button
                      type="button"
                      onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                      className="px-3 py-1.5 text-c5-ink/70 hover:text-c5-accent cursor-pointer"
                      aria-label="Restar cantidad"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm tabular-nums">{cantidad}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setCantidad((c) => (product.stock !== null ? Math.min(c + 1, product.stock) : c + 1))
                      }
                      className="px-3 py-1.5 text-c5-ink/70 hover:text-c5-accent cursor-pointer"
                      aria-label="Sumar cantidad"
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleAgregarAlCarrito}
                    className="flex-1 rounded-full border border-c5-accent/60 py-2 text-sm font-medium text-c5-accent transition-colors hover:bg-c5-accent/10 cursor-pointer"
                  >
                    Agregar al carrito
                  </button>
                </div>
              )}

              {product.descripcion && (
                <p className="mt-6 text-c5-ink/70 leading-relaxed whitespace-pre-line">
                  {product.descripcion}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DetalleProducto;
