import type { Product } from '@/interfaces';
import { apiOrigin } from '@/utilities';

function formatPrice(precio: number): string {
  return `$${precio.toFixed(2)}`;
}

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
  /** opcional a propósito, mismo criterio que `onAddToCart` de
   * ProductDetailModal.tsx — sin esta prop la card se comporta exactamente
   * igual que antes (solo abre el detalle al click). Ver
   * Frontend/CLAUDE.md, sección "Sexto catálogo con carrito". */
  onAddToCart?: (product: Product) => void;
  className?: string;
}

/** Card de producto reutilizable — pedido explícito del spec original
 * ("componente que reciba los datos del producto"), la usa
 * `ProductCarousel.tsx` (la grilla de tiles de categoría en `Catalog6.tsx`
 * arma sus propios botones a mano, no usa esta card). Sin badge de
 * descuento ni precio tachado: `Product` no tiene precio de oferta en
 * este proyecto (a diferencia del spec, que pedía "ofertas flash" — ver
 * Frontend/CLAUDE.md, sección de este catálogo, para el resto de las
 * adaptaciones). Al click en la imagen/nombre/precio, delega en
 * `onSelect` — quien la usa decide qué hacer (acá, abrir
 * ProductDetailModal, igual que Catalog.tsx–Catalog5.tsx). */
export function ProductCard({ product, onSelect, onAddToCart, className = '' }: ProductCardProps) {
  return (
    // antes la card entera era un único <button> — pasó a <div> porque
    // ahora conviven dos acciones (ver detalle / agregar al carrito) y un
    // <button> dentro de otro <button> no es HTML válido (mismo cambio que
    // ya necesitaron Catalog.tsx/Catalog4.tsx). "group" queda acá para que
    // el zoom de la imagen en hover no cambie.
    <div
      className={`group flex flex-col overflow-hidden rounded-xl border border-c6-line bg-white transition-shadow hover:shadow-md ${className}`.trim()}
    >
      {/* franja superior — firma de este catálogo en particular, no
          decoración suelta: ningún otro catálogo tiene esta banda. */}
      <div className="h-1 bg-c6-primary" />

      <button
        type="button"
        onClick={() => onSelect(product)}
        className="flex flex-1 flex-col text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c6-primary"
      >
        <div className="aspect-square bg-c6-surface flex items-center justify-center overflow-hidden">
          {product.imageUrl ? (
            <img
              src={`${apiOrigin}${product.imageUrl}`}
              alt={product.nombre}
              className="h-full w-full object-contain p-4 transition-transform duration-200 group-hover:scale-[1.03]"
            />
          ) : (
            <span className="text-c6-ink/30 text-sm">Sin imagen</span>
          )}
        </div>

        {/* nombre + precio en una sola fila (no apilados) — más "renglón
            de listado" que "tarjeta", coherente con la identidad densa
            de este catálogo (ver Catalog6.tsx). El nombre se trunca a una
            línea en vez de dos: acá prioriza la fila compacta. */}
        <div className="flex flex-1 flex-col gap-1 p-3">
          {product.categoria && (
            <span className="text-[11px] text-c6-ink/45">{product.categoria.nombre}</span>
          )}
          <div className="mt-auto flex items-baseline justify-between gap-2">
            <h3 className="truncate text-sm font-bold text-c6-ink" title={product.nombre}>
              {product.nombre}
            </h3>
            <span className="shrink-0 text-sm font-extrabold text-c6-primary tabular-nums">
              {formatPrice(product.precio)}
            </span>
          </div>

          {product.stock === null ? (
            <span className="text-xs text-c6-ink/45">Consultar disponibilidad</span>
          ) : (
            product.stock === 0 && <span className="text-xs text-red-600">Sin stock</span>
          )}
        </div>
      </button>

      {onAddToCart && (
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={() => onAddToCart(product)}
            disabled={product.stock === 0}
            className="w-full rounded-md bg-c6-primary py-1.5 text-xs font-semibold text-white transition-colors hover:bg-c6-primary-dark disabled:cursor-not-allowed disabled:bg-c6-line disabled:text-c6-ink/40 cursor-pointer"
          >
            {product.stock === 0 ? 'Sin stock' : 'Agregar al carrito'}
          </button>
        </div>
      )}
    </div>
  );
}

export default ProductCard;
