import { useEffect, useRef, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import type { Product } from '@/interfaces';
import { apiOrigin } from '@/utilities';

const AUTOPLAY_MS = 5000;
const SWIPE_THRESHOLD_PX = 40;

function formatPrice(precio: number): string {
  return `$${precio.toFixed(2)}`;
}

interface HeroCarouselProps {
  /** los primeros N se muestran como slides — no hay ningún campo de
   * "destacado" en el modelo de datos, así que no se pretende que sea una
   * selección curada, son productos reales del catálogo sin más. */
  products: Product[];
  onSelectProduct: (product: Product) => void;
}

/** Hero banner a todo el ancho — layout split (texto+CTA a la izquierda,
 * imagen del producto a la derecha), autoplay cada 5s con pausa al pasar
 * el mouse, flechas, dots clickeables, y swipe táctil. Transición vía
 * `transform: translateX` + `transition-transform` (CSS), no JS de
 * animación cuadro a cuadro.
 *
 * El copy de cada slide es 100% real (nombre/precio/categoría del
 * producto) — sin textos promocionales inventados. */
export function HeroCarousel({ products, onSelectProduct }: HeroCarouselProps) {
  const slides = products.slice(0, 5);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  // si `slides` se achica (ej. cambia el catálogo) y el índice quedó
  // apuntando afuera de rango, lo vuelve a 0 en vez de dejar un slide en
  // blanco — ajustado durante el render (no con un efecto) para no pisar
  // react-hooks/set-state-in-effect, mismo patrón que ya usan
  // ProductDetailModal.tsx/UserFormModal.tsx en este proyecto.
  const [slidesLengthSnapshot, setSlidesLengthSnapshot] = useState(slides.length);
  if (slides.length !== slidesLengthSnapshot) {
    setSlidesLengthSnapshot(slides.length);
    if (index >= slides.length) {
      setIndex(0);
    }
  }

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    // respeta "reducir movimiento" del sistema — no autoplayea si el
    // usuario lo pidió, sigue navegable a mano con flechas/dots.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, AUTOPLAY_MS);

    return () => clearInterval(timer);
  }, [paused, slides.length]);

  if (slides.length === 0) {
    return null;
  }

  const goTo = (i: number) => setIndex(((i % slides.length) + slides.length) % slides.length);
  const next = () => goTo(index + 1);
  const prev = () => goTo(index - 1);

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0].clientX;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = event.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > SWIPE_THRESHOLD_PX) {
      if (delta > 0) {
        prev();
      } else {
        next();
      }
    }
    touchStartX.current = null;
  };

  return (
    <div
      className="relative overflow-hidden bg-c6-primary h-[250px] sm:h-[400px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex h-full transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((product, i) => (
          <div
            key={product.idProducto}
            className="flex h-full w-full shrink-0 items-center"
            // los 5 slides están todos en el DOM a la vez (solo se
            // desplazan con translateX, no se desmontan) — sin esto, los
            // que no se ven seguirían siendo alcanzables con Tab y un
            // lector de pantalla los anunciaría igual que al activo.
            // Mismo criterio que la marquesina de Catalog.tsx.
            aria-hidden={i !== index}
            inert={i !== index ? true : undefined}
          >
            {/* px-14 en mobile (no px-6): deja lugar a las flechas
                absolutas (left-3 + h-10/w-10 ≈ 52px) — con menos padding
                el precio quedaba tapado por el botón, encontrado al
                revisar el responsive real. */}
            <div className="max-w-6xl mx-auto w-full px-14 sm:px-10 grid grid-cols-1 sm:grid-cols-2 items-center gap-4 sm:gap-6">
              <div className="text-white">
                {product.categoria && (
                  <p className="text-sm font-medium text-white/65 mb-1.5">
                    {product.categoria.nombre}
                  </p>
                )}
                <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight line-clamp-2">
                  {product.nombre}
                </h2>
                <p className="mt-3 text-xl sm:text-2xl font-bold tabular-nums">
                  {formatPrice(product.precio)}
                </p>
                <button
                  type="button"
                  onClick={() => onSelectProduct(product)}
                  tabIndex={i === index ? 0 : -1}
                  className="mt-4 sm:mt-5 inline-flex items-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-c6-primary hover:bg-c6-surface transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-c6-primary focus-visible:ring-white"
                >
                  Ver producto
                </button>
              </div>

              <div className="hidden sm:flex justify-center">
                {product.imageUrl && (
                  <img
                    src={`${apiOrigin}${product.imageUrl}`}
                    alt={product.nombre}
                    className="max-h-64 object-contain drop-shadow-2xl"
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Slide anterior"
            className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Slide siguiente"
            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {slides.map((slide, i) => (
              <button
                key={slide.idProducto}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Ir al slide ${i + 1}`}
                aria-current={i === index}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  i === index ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default HeroCarousel;
