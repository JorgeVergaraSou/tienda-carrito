import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { getCategoriesService, getProductsService } from '@/services';
import { Category, Product } from '@/interfaces';
import { getErrorMessage, apiOrigin, showSuccess } from '@/utilities';
import { Button } from '@/components/ui';
import { CartLink } from '@/components/Cart/CartLink';
import { addToCart } from '@/redux/states/cart';
import { InputBuscarProductos } from '@/components/ProductSearch/InputBuscarProductos';
import { ProductDetailModal } from '@/pages/Public/Catalog/ProductDetailModal';

const PAGE_SIZE = 16;

function formatPrice(precio: number): string {
  return `$${precio.toFixed(2)}`;
}

// pestaña de categoría — subrayado grueso en rosa cuando está activa, en
// vez de la pill rellena de Catalog.tsx o el ítem de sidebar de
// Catalog2.tsx: tercera variante de "un solo filtro seleccionado a la
// vez", misma idea, look distinto (estilo tabs de tienda departamental).
function tabClass(active: boolean): string {
  return `shrink-0 px-3 py-2.5 text-sm font-semibold border-b-[3px] transition-colors cursor-pointer ${
    active
      ? 'border-fuchsia-600 text-fuchsia-700'
      : 'border-transparent text-neutral-500 hover:text-neutral-800'
  }`;
}

/** Tercer diseño de catálogo — mismos datos y mismo backend que
 * Catalog.tsx/Catalog2.tsx (GET /productos, GET /categorias, sin auth),
 * inspirado visualmente en cómo paris.cl arma su catálogo: paleta
 * rosa/fucsia, tipografía redondeada (Poppins), banner destacado grande,
 * pestañas de categoría subrayadas (en vez de pills en marquesina o
 * sidebar de filtros) y cards blancas muy redondeadas. Registrado en
 * src/catalogs/catalogs.config.tsx, montado en '/catalog3' (ver App.tsx).
 *
 * A propósito NO tiene nada que el modelo de datos de este proyecto no
 * respalde (% de descuento, "antes/ahora", cuotas sin interés, favoritos)
 * — mismo criterio que ya documentan Catalog.tsx/Catalog2.tsx: inventar
 * esos datos sería mentirle a un cliente real. El botón de cada card es
 * "Ver producto", reutiliza ProductDetailModal (mismo componente que los
 * otros dos diseños) en vez de reimplementar el modal.
 *
 * **Carrito conectado** (pedido explícito del usuario, tercer catálogo con
 * esto — ver Frontend/CLAUDE.md, sección "Tercer catálogo con carrito").
 * Mismo `redux/states/cart.ts` que ya usan Catalog.tsx/Catalog2.tsx, sin
 * lógica propia acá. */
function Catalog3() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [productoSeleccionado, setProductoSeleccionado] = useState<Product | null>(null);

  const dispatch = useDispatch();

  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const data = await getCategoriesService();
        if (!cancelado) setCategories(data);
      } catch {
        // el filtro de categorías es un extra — no bloquea el catálogo si
        // falla (mismo criterio que Catalog.tsx/Catalog2.tsx).
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // carrito client-side (ver redux/states/cart.ts) — mismos handlers que
  // Catalog.tsx/Catalog2.tsx, sin nada propio de este diseño.
  const handleAgregarAlCarrito = (product: Product, cantidad = 1) => {
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

  const handleAgregarDesdeModal = (product: Product, cantidad: number) => {
    handleAgregarAlCarrito(product, cantidad);
    setProductoSeleccionado(null);
  };

  return (
    <div className="min-h-screen bg-white font-catalog3">
      {/* navbar blanca, logo en fucsia — buscador en formato píldora
          (rounded-full), estética redondeada consistente en toda la
          página, a diferencia de las esquinas rectas/suaves de los otros
          dos diseños. */}
      <div className="border-b border-neutral-100">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3 sm:gap-6">
          <Link
            to="/"
            className="order-1 shrink-0 text-sm font-medium text-neutral-400 hover:text-fuchsia-700"
          >
            ← Catálogos
          </Link>

          <span className="order-2 shrink-0 text-xl font-extrabold text-fuchsia-700 tracking-tight">
            Tienda en Línea con carrito de compra
          </span>

          <div className="order-3 sm:order-4 ml-auto sm:ml-0 flex shrink-0 items-center gap-4">
            <Link
              to="/contacto"
              className="text-sm font-medium text-neutral-500 hover:text-fuchsia-700"
            >
              Contacto
            </Link>

            <CartLink className="text-neutral-500 hover:text-fuchsia-700" />
          </div>

          <form
            onSubmit={handleSearchSubmit}
            className="order-4 sm:order-3 basis-full sm:basis-0 sm:flex-1 flex gap-2 min-w-0"
          >
            <div className="relative flex-1 min-w-0">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <InputBuscarProductos
                keyword={searchInput}
                setKeyword={setSearchInput}
                onSelectProducto={handleSelectProducto}
                placeholder="¿Qué estás buscando?"
                className="[&_input]:rounded-full [&_input]:pl-9 [&_input]:bg-neutral-50 [&_input]:border-neutral-200"
              />
            </div>
            {/* botón propio, no <Button> — mismo motivo que en
                Catalog2.tsx: pisar el color "primary" de Button.tsx por
                className depende del orden en que Tailwind genera las
                clases, no es confiable para un color de marca. */}
            <button
              type="submit"
              className="shrink-0 rounded-full bg-fuchsia-600 px-4 py-2 font-medium text-white transition-colors hover:bg-fuchsia-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-fuchsia-600"
            >
              Buscar
            </button>
          </form>
        </div>

        {/* pestañas de categoría — subrayado, con scroll horizontal manual
            en vez de la marquesina automática de Catalog.tsx. "Todas"
            queda fija primera, igual criterio que el "Todo" fijo de
            Catalog.tsx (el filtro "sin filtro" siempre a mano). */}
        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => handleCategoriaChange('')}
            className={tabClass(categoriaId === '')}
          >
            Todas
          </button>
          {categories.map((category) => (
            <button
              key={category.idCategoria}
              type="button"
              onClick={() => handleCategoriaChange(String(category.idCategoria))}
              className={tabClass(categoriaId === String(category.idCategoria))}
            >
              {category.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* banner destacado — grande, redondeado y colorido (mismo rol que
          el hero de Catalog.tsx / la tira de acento de Catalog2.tsx: el
          único lugar de la página que se anima a decir algo de la
          tienda). Sin badges de descuento/cuotas inventados. */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <div className="rounded-3xl bg-linear-to-br from-fuchsia-600 via-pink-500 to-orange-400 px-6 py-10 sm:px-10 sm:py-14">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight max-w-md">
            Bazar y juguetería
          </h1>
          <p className="mt-2 text-white/90 max-w-sm">
            Encontrá de todo un poco: juguetes, cuadernos, y lo que se te ocurra.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-neutral-900 mb-4">Todos los productos</h2>

        {loading && <p className="text-neutral-500">Cargando...</p>}
        {error && <p className="text-red-600">{error}</p>}

        {!loading && !error && products.length === 0 && (
          <p className="text-neutral-500">No hay productos para mostrar.</p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
          {products.map((product) => (
            <div
              key={product.idProducto}
              className="flex flex-col bg-white border border-neutral-100 rounded-2xl overflow-hidden shadow-sm transition-shadow hover:shadow-lg"
            >
              {/* medallón de precio flotando sobre la esquina — mismo
                  degradé del banner de arriba (fuchsia→naranja), un poco
                  rotado para que se lea como un sticker pegado, no como un
                  botón más. "relative" sin overflow-hidden acá (eso queda
                  solo en la caja de la imagen) para que el medallón pueda
                  sobresalir del cuadro. */}
              <div className="relative">
                <div className="aspect-square bg-neutral-50 flex items-center justify-center overflow-hidden">
                  {product.imageUrl ? (
                    <img
                      src={`${apiOrigin}${product.imageUrl}`}
                      alt={product.nombre}
                      className="h-full w-full object-contain p-4"
                    />
                  ) : (
                    <span className="text-neutral-300 text-sm">Sin imagen</span>
                  )}
                </div>

                <div className="absolute -right-2 -top-2 z-10 rotate-3 rounded-full bg-linear-to-br from-fuchsia-600 to-orange-400 px-3 py-1.5 shadow-[0_6px_14px_-4px_rgba(190,24,150,0.5)]">
                  <span className="text-sm font-extrabold text-white tabular-nums">
                    {formatPrice(product.precio)}
                  </span>
                </div>
              </div>

              <div className="p-3.5 flex-1 flex flex-col gap-1.5">
                {product.categoria && (
                  <span className="self-start rounded-full bg-fuchsia-50 px-2.5 py-0.5 text-[11px] font-semibold text-fuchsia-700">
                    {product.categoria.nombre}
                  </span>
                )}

                <h3 className="text-sm font-semibold text-neutral-800 leading-snug line-clamp-2 min-h-[2.5em]">
                  {product.nombre}
                </h3>

                {product.stock === null ? (
                  <span className="text-xs text-neutral-500">Consultar disponibilidad</span>
                ) : product.stock === 0 ? (
                  <span className="text-xs text-red-600">Sin stock</span>
                ) : null}

                <button
                  type="button"
                  onClick={() => setProductoSeleccionado(product)}
                  className="mt-2 w-full bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-sm font-semibold py-2 rounded-full transition-colors cursor-pointer"
                >
                  Ver producto
                </button>

                <button
                  type="button"
                  onClick={() => handleAgregarAlCarrito(product)}
                  disabled={product.stock === 0}
                  className="w-full rounded-full border border-fuchsia-600 py-2 text-sm font-semibold text-fuchsia-600 transition-colors hover:bg-fuchsia-600 hover:text-white disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-400 disabled:hover:bg-transparent cursor-pointer"
                >
                  {product.stock === 0 ? 'Sin stock' : 'Agregar al carrito'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <ProductDetailModal
          product={productoSeleccionado}
          onClose={() => setProductoSeleccionado(null)}
          onAddToCart={handleAgregarDesdeModal}
          theme={{
            fontClassName: 'font-catalog3',
            panelClassName: 'rounded-3xl',
            thumbnailActiveClassName: 'border-fuchsia-600',
            // mismo medallón rotado que ya tiene la card, con el degradé
            // del banner de la página (ver el comentario en el <div> de
            // la grilla).
            priceMedallionClassName:
              'bg-linear-to-br from-fuchsia-600 to-orange-400 shadow-[0_6px_14px_-4px_rgba(190,24,150,0.5)]',
            addToCartButtonClassName:
              'flex-1 rounded-full bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-sm font-semibold py-2.5 transition-colors disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400 cursor-pointer',
          }}
        />

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-8">
            <Button
              variant="secondary"
              className="rounded-full"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <span className="text-sm text-neutral-500 tabular-nums">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="secondary"
              className="rounded-full"
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

export default Catalog3;
