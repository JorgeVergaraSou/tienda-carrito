import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { getCategoriesService, getProductsService } from '@/services';
import { Category, Product } from '@/interfaces';
import { getErrorMessage, apiOrigin, showSuccess } from '@/utilities';
import { Button } from '@/components/ui';
import { CartLink } from '@/components/Cart/CartLink';
import { addToCart } from '@/redux/states/cart';
import { InputBuscarProductos } from '@/components/ProductSearch/InputBuscarProductos';

// más grande que los otros catálogos a propósito: acá el "scroll" del
// catálogo lo hace el carrusel horizontal, no la paginación — con más
// productos por página hay menos necesidad de tocar "Siguiente".
const PAGE_SIZE = 20;
// ancho de card (w-64 = 256px) + gap-5 (20px) — cuánto se desplaza el
// carrusel por click de flecha (2 cards por click).
const SCROLL_STEP = (256 + 20) * 2;

function formatPrice(precio: number): string {
  return `$${precio.toFixed(2)}`;
}

// chip de categoría — quinta variante del mismo patrón ("un filtro
// seleccionado a la vez") que ya usan los otros 4 catálogos: pill llena
// (C1), sidebar (C2), pestaña subrayada (C3), texto en itálica (C4). Acá,
// borde fino que se enciende en dorado — encaja con el resto del sistema
// oscuro sin repetir ninguna de las cuatro anteriores.
function chipClass(active: boolean): string {
  return `shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors cursor-pointer ${
    active
      ? 'border-c5-accent text-c5-accent bg-c5-accent/10'
      : 'border-white/15 text-c5-ink/60 hover:border-white/30 hover:text-c5-ink'
  }`;
}

/** Quinto diseño de catálogo — mismos datos y mismo backend que los otros
 * 4 (GET /productos, GET /categorias, sin auth). Dos diferencias reales,
 * ambas pedidas explícitamente por el usuario:
 * 1. La galería de productos es un carrusel horizontal (scroll-snap
 *    nativo — sin librería nueva), no una grilla estática. El filtro de
 *    categoría de arriba decide qué entra al carrusel (se evaluó también
 *    un carrusel por categoría estilo Netflix, pero con el catálogo chico
 *    que hay hoy — pocas categorías, ~1 producto c/u — cada fila quedaría
 *    casi vacía; un solo carrusel + filtro aprovecha mejor los datos
 *    reales).
 * 2. Clickear un producto NAVEGA a `/catalog5/detalleproducto/:id`
 *    (DetalleProducto.tsx, página aparte) en vez de abrir
 *    ProductDetailModal como los otros 4 — por eso este catálogo tiene su
 *    propio sub-ruteo (ver Catalog5.tsx).
 *
 * Identidad "vidriera de noche": fondo oscuro (el único de los 5) +
 * acento dorado — pedido explícito del usuario ("no quiero el blanco
 * plano de IA"). Sin badges de descuento/cuotas inventados, mismo criterio
 * que los otros 4.
 *
 * **Carrito conectado** (pedido explícito del usuario, quinto catálogo con
 * esto — ver Frontend/CLAUDE.md, sección "Quinto catálogo con carrito").
 * Mismo `redux/states/cart.ts` que los otros 4, pero acá la card entera es
 * un `<Link>` (navega al detalle, no abre un modal) — el botón de agregar
 * queda como hermano del `<Link>`, no adentro (un `<button>` dentro de un
 * `<a>` tampoco es válido, mismo problema que un `<button>` dentro de
 * otro). `DetalleProducto.tsx` tiene su propio botón de agregar, ver ese
 * archivo. */
function CatalogoCarrusel() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);

  const dispatch = useDispatch();

  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const data = await getCategoriesService();
        if (!cancelado) setCategories(data);
      } catch {
        // el filtro de categorías es un extra — no bloquea el catálogo si
        // falla (mismo criterio que los otros 4 catálogos).
      }
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      setLoading(true);
      setError('');

      try {
        const data = await getProductsService({
          search: search || undefined,
          categoriaId: categoriaId ? Number(categoriaId) : undefined,
          page,
          limit: PAGE_SIZE,
        });

        if (cancelado) return;
        setProducts(data.items);
        setTotal(data.total);
        // vuelve al principio del carrusel cada vez que cambia el
        // conjunto de productos (nueva categoría/búsqueda/página) — si no,
        // podría quedar desplazado a una posición que ya no tiene tarjetas.
        scrollRef.current?.scrollTo({ left: 0 });
      } catch (err) {
        if (!cancelado) setError(getErrorMessage(err));
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [search, categoriaId, page]);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleCategoriaChange = (value: string) => {
    setPage(1);
    setCategoriaId(value);
  };

  const handleSelectProducto = (producto: Product) => {
    setPage(1);
    setSearch(producto.nombre);
  };

  const scroll = (dir: 1 | -1) => {
    scrollRef.current?.scrollBy({ left: dir * SCROLL_STEP, behavior: 'smooth' });
  };

  // carrito client-side (ver redux/states/cart.ts) — mismo mecanismo que
  // los otros 4 catálogos, sin nada propio de este diseño.
  const handleAgregarAlCarrito = (product: Product) => {
    dispatch(
      addToCart({
        item: {
          idProducto: product.idProducto,
          nombre: product.nombre,
          precio: product.precio,
          imageUrl: product.imageUrl,
          stockDisponible: product.stock,
        },
      }),
    );
    showSuccess('Agregado al carrito', product.nombre);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-c5-bg text-c5-ink font-catalog5">
      {/* barra superior oscura, sin bloque de color aparte (todo el fondo
          ya es oscuro acá) */}
      <div className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center gap-4 sm:gap-8">
          <Link
            to="/"
            className="order-1 shrink-0 text-sm text-c5-ink/50 hover:text-c5-ink transition-colors"
          >
            ← Catálogos
          </Link>

          <span className="order-2 shrink-0 text-lg font-semibold tracking-tight">
            Tienda Básica
          </span>

          <div className="order-3 sm:order-4 ml-auto sm:ml-0 flex shrink-0 items-center gap-4">
            <Link
              to="/contacto"
              className="text-sm text-c5-ink/60 hover:text-c5-ink transition-colors"
            >
              Contacto
            </Link>

            <CartLink className="text-c5-ink/60 hover:text-c5-ink" />
          </div>

          <form
            onSubmit={handleSearchSubmit}
            className="order-4 sm:order-3 basis-full sm:basis-0 sm:flex-1 flex gap-2 min-w-0"
          >
            <InputBuscarProductos
              keyword={searchInput}
              setKeyword={setSearchInput}
              onSelectProducto={handleSelectProducto}
              placeholder="Buscar en el catálogo"
              className="flex-1 min-w-0 [&_input]:border [&_input]:border-white/15 [&_input]:rounded-full [&_input]:bg-white/5 [&_input]:text-c5-ink [&_input]:placeholder:text-c5-ink/35 [&_input]:focus:outline-none [&_input]:focus:border-c5-accent [&_input]:focus:ring-0"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full border border-c5-accent/60 px-4 py-2 text-sm font-medium text-c5-accent hover:bg-c5-accent/10 transition-colors cursor-pointer"
            >
              Buscar
            </button>
          </form>
        </div>
      </div>

      {/* apertura — sin banner ni imagen, la tipografía + el fondo oscuro
          ya dan el gesto de marca. */}
      <div className="max-w-6xl mx-auto px-4 pt-14 pb-8 sm:pt-20">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight max-w-lg">
          Bazar y juguetería
        </h1>
        <p className="mt-3 text-c5-ink/55 max-w-md">
          De todo un poco, para recorrer con calma: juguetes, cuadernos, y lo que se te ocurra.
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-20">
        {/* chips de categoría */}
        <div className="flex flex-wrap gap-2 mb-10">
          <button
            type="button"
            onClick={() => handleCategoriaChange('')}
            className={chipClass(categoriaId === '')}
          >
            Todas
          </button>
          {categories.map((category) => (
            <button
              key={category.idCategoria}
              type="button"
              onClick={() => handleCategoriaChange(String(category.idCategoria))}
              className={chipClass(categoriaId === String(category.idCategoria))}
            >
              {category.nombre}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-c5-ink/50">
            {total} producto{total === 1 ? '' : 's'}
          </h2>

          {/* controles del carrusel — funcionales (mueven el scroll), no
              decorativos: la única razón para usar heroicons acá es que
              son flechas reales de navegación. */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => scroll(-1)}
              aria-label="Productos anteriores"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-c5-ink/70 hover:border-c5-accent hover:text-c5-accent transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c5-accent"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              aria-label="Siguientes productos"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-c5-ink/70 hover:border-c5-accent hover:text-c5-accent transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c5-accent"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loading && <p className="text-sm text-c5-ink/50">Cargando…</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {!loading && !error && products.length === 0 && (
          <p className="text-sm text-c5-ink/50">No hay productos para mostrar.</p>
        )}

        {/* carrusel — scroll-snap nativo, sin librería. La scrollbar se
            oculta (queda el swipe/drag/trackpad + las flechas de arriba
            como control visible) pero el contenedor sigue siendo
            navegable por teclado (foco en cada card, el navegador
            autoscrollea para mantenerlo visible). */}
        <div
          ref={scrollRef}
          className="flex gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {products.map((product) => (
            // antes esto era un único <Link> — el botón de agregar queda
            // como hermano, no adentro (ver el comentario del componente
            // más arriba: un <button> dentro de un <a> tampoco es HTML
            // válido). "group" sigue en el contenedor para que el zoom de
            // la imagen en hover no cambie.
            // "vitrina de museo": sin caja completa (ni borde ni fondo
            // propio en la card entera) — dos corchetes dorados en
            // esquinas opuestas de la foto, como la marca de una vitrina
            // o el visor de una cámara, en vez de encerrar todo en un
            // rectángulo. Una línea dorada fina separa la foto de la
            // ficha, en vez de un contorno completo.
            <div key={product.idProducto} className="group snap-start shrink-0 w-56 sm:w-64 flex flex-col">
              <Link
                to={`/catalog5/detalleproducto/${product.idProducto}`}
                className="flex flex-1 flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c5-accent"
              >
                <div className="relative aspect-square bg-black/20 flex items-center justify-center overflow-hidden">
                  {product.imageUrl ? (
                    <img
                      src={`${apiOrigin}${product.imageUrl}`}
                      alt={product.nombre}
                      className="h-full w-full object-contain p-5 transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <span className="text-c5-ink/25 text-sm">Sin imagen</span>
                  )}

                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-2 top-2 h-5 w-5 border-l-2 border-t-2 border-c5-accent/50 transition-colors group-hover:border-c5-accent"
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute bottom-2 right-2 h-5 w-5 border-b-2 border-r-2 border-c5-accent/50 transition-colors group-hover:border-c5-accent"
                  />
                </div>

                <div className="flex flex-1 flex-col gap-1.5 border-t border-c5-accent/20 bg-c5-surface p-4">
                  {product.categoria && (
                    <span className="text-xs text-c5-ink/45">{product.categoria.nombre}</span>
                  )}
                  <h3 className="text-sm font-medium leading-snug line-clamp-2 min-h-[2.5em]">
                    {product.nombre}
                  </h3>
                  <p className="mt-auto text-base font-semibold text-c5-accent tabular-nums">
                    {formatPrice(product.precio)}
                  </p>

                  {product.stock === null ? (
                    <span className="text-xs text-c5-ink/40">Consultar disponibilidad</span>
                  ) : (
                    product.stock === 0 && (
                      <span className="text-xs text-red-400">Sin stock</span>
                    )
                  )}
                </div>
              </Link>

              {/* mismo bg-c5-surface que la ficha de arriba — sin esto
                  quedaría flotando sobre el fondo oscuro de la página, con
                  un salto de color entre la ficha y el botón. */}
              <div className="bg-c5-surface px-4 pb-4">
                <button
                  type="button"
                  onClick={() => handleAgregarAlCarrito(product)}
                  disabled={product.stock === 0}
                  className="w-full rounded-full border border-c5-accent/60 py-1.5 text-sm font-medium text-c5-accent transition-colors hover:bg-c5-accent/10 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-c5-ink/30 cursor-pointer"
                >
                  {product.stock === 0 ? 'Sin stock' : 'Agregar al carrito'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-12">
            <Button
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <span className="text-sm text-c5-ink/50 tabular-nums">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CatalogoCarrusel;
