import { useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import type { Product } from '@/interfaces';
import { ProductCard } from './ProductCard';

// ancho de card (w-48=192px, w-56=224px en sm+) + gap-4 (16px), aprox —
// cuánto se desplaza el carrusel por click de flecha (2 cards por click).
const SCROLL_STEP = (224 + 16) * 2;

interface ProductCarouselProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  /** opcional, se reenvía tal cual a cada ProductCard — ver el comentario
   * de esa prop ahí (Frontend/CLAUDE.md, "Sexto catálogo con carrito"). */
  onAddToCart?: (product: Product) => void;
}

/** Carrusel horizontal de productos, reutilizable (scroll-snap nativo, sin
 * librería — mismo mecanismo que ya usa Catalog5.tsx, acá como componente
 * aparte porque Catalog6 lo necesita en más de un lugar potencialmente y
 * el spec original lo pedía explícito con flecha para avanzar/retroceder).
 * El scroll con el mouse/trackpad/dedo funciona solo (overflow-x-auto);
 * las flechas son un atajo, no el único modo de navegarlo. */
export function ProductCarousel({ products, onSelectProduct, onAddToCart }: ProductCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 1 | -1) => {
    scrollRef.current?.scrollBy({ left: dir * SCROLL_STEP, behavior: 'smooth' });
  };

  if (products.length === 0) {
    return <p className="text-sm text-c6-ink/50">No hay productos para mostrar.</p>;
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {products.map((product) => (
          <ProductCard
            key={product.idProducto}
            product={product}
            onSelect={onSelectProduct}
            onAddToCart={onAddToCart}
            className="snap-start shrink-0 w-48 sm:w-56"
          />
        ))}
      </div>

      {products.length > 3 && (
        <>
          <button
            type="button"
            onClick={() => scroll(-1)}
            aria-label="Ver productos anteriores"
            className="hidden sm:flex absolute -left-4 top-[38%] -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-white shadow-md border border-c6-line text-c6-primary hover:bg-c6-surface transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c6-primary"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            aria-label="Ver más productos"
            className="hidden sm:flex absolute -right-4 top-[38%] -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-white shadow-md border border-c6-line text-c6-primary hover:bg-c6-surface transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c6-primary"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}

export default ProductCarousel;
