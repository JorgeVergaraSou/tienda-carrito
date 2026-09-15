import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { getCategoriesService, getProductsService } from '@/services';
import { Category, Product } from '@/interfaces';
import { getErrorMessage, apiOrigin, showSuccess } from '@/utilities';
import { Button } from '@/components/ui';
import { CartLink } from '@/components/Cart/CartLink';
import { addToCart } from '@/redux/states/cart';
import { InputBuscarProductos } from '@/components/ProductSearch/InputBuscarProductos';
import { ProductDetailModal } from '@/pages/Public/Catalog/ProductDetailModal';

const PAGE_SIZE = 15;

function formatPrice(precio: number): string {
  return `$${precio.toFixed(2)}`;
}

// botón de categoría de la sidebar — activo (fondo rojo) vs. en reposo
// (borde izquierdo transparente que se marca al pasar el mouse). Mismo
// criterio de "un solo estado seleccionado" que la pill de Catalog.tsx,
// pero con la estética de lista de filtros de una tienda de electrónica
// en vez de pills sueltas.
function categoriaItemClass(active: boolean): string {
  return `w-full text-left px-3 py-2 text-sm font-medium border-l-2 transition-colors cursor-pointer ${
    active
      ? 'border-red-600 bg-red-50 text-red-700'
      : 'border-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
  }`;
}

/** Segundo diseño de catálogo — mismos datos y mismo backend que
 * Catalog.tsx (GET /productos, GET /categorias, sin auth), presentación
 * distinta: inspirada en cómo pcfactory.cl arma su catálogo (navbar
 * oscura, acento rojo, filtro de categorías en sidebar en vez de pills en
 * marquesina, grilla más densa/técnica). Registrado en
 * src/catalogs/catalogs.config.tsx, montado en '/catalog2' (ver App.tsx).
 *
 * A propósito NO tiene nada que el modelo de datos de este proyecto no
 * respalde (specs técnicas, comparador, cuotas) — mismo criterio que ya
 * documenta Catalog.tsx: mostrar eso acá sería inventarle funciones a la
 * tienda que no existen. El botón de cada card es "Ver detalle", reutiliza
 * ProductDetailModal (mismo componente que usa Catalog.tsx) en vez de
 * reimplementar el modal.
 *
 * **Carrito conectado** (pedido explícito del usuario, después de
 * Catalog.tsx — ver Frontend/CLAUDE.md, sección "Segundo catálogo con
 * carrito"): mismo `redux/states/cart.ts` que ya usa Catalog.tsx, sin
 * lógica propia acá — "Agregar al carrito" en cada card + la prop
 * `onAddToCart` de ProductDetailModal (opcional, ya existía sin usarse acá
 * desde que se armó en Catalog.tsx). */
function Catalog2() {
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
        // falla (mismo criterio que Catalog.tsx).
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
  // Catalog.tsx, sin nada propio de este diseño.
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

  // misma lista de categorías para la sidebar (desktop) y la tira
  // horizontal (mobile) — un solo array, dos formas de mostrarlo.
  const renderCategoriaItems = () => (
    <>
      <button
        type="button"
        onClick={() => handleCategoriaChange('')}
        className={categoriaItemClass(categoriaId === '')}
      >
        Todas las categorías
      </button>
      {categories.map((category) => (
        <button
          key={category.idCategoria}
          type="button"
          onClick={() => handleCategoriaChange(String(category.idCategoria))}
          className={categoriaItemClass(categoriaId === String(category.idCategoria))}
        >
          {category.nombre}
        </button>
      ))}
    </>
  );

  return (
    <div className="min-h-screen bg-neutral-50 font-catalog2">
      {/* navbar oscura — identidad visual opuesta a la franja azul de
          Catalog.tsx a propósito, para que los dos diseños se sientan
          claramente distintos aunque muestren lo mismo. */}
      <div className="bg-neutral-900">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3 sm:gap-6">
          <Link
            to="/"
            className="order-1 shrink-0 text-sm font-medium text-neutral-400 hover:text-white"
          >
            ← Catálogos
          </Link>

          <span className="order-2 shrink-0 text-lg font-extrabold text-white tracking-tight">
            Tienda en Línea con carrito de compra
          </span>

          <div className="order-3 sm:order-4 ml-auto sm:ml-0 flex shrink-0 items-center gap-4">
            <Link
              to="/contacto"
              className="text-sm font-medium text-neutral-300 hover:text-white"
            >
              Contacto
            </Link>

            <CartLink className="text-neutral-300 hover:text-white" />
          </div>

          <form
            onSubmit={handleSearchSubmit}
            className="order-4 sm:order-3 basis-full sm:basis-0 sm:flex-1 flex gap-2 min-w-0"
          >
            <InputBuscarProductos
              keyword={searchInput}
              setKeyword={setSearchInput}
              onSelectProducto={handleSelectProducto}
              className="flex-1 min-w-0"
            />
            {/* botón propio, no <Button> — Button.tsx ya trae su color
                "primary" (teal, el acento del App Shell) y pisarlo con
                className queda a merced del orden en que Tailwind genera
                las clases; acá el rojo es parte de la identidad del
                diseño, así que se define completo a mano, mismo criterio
                que ya usa el botón "Ver detalle" de esta página. */}
            <button
              type="submit"
              className="shrink-0 rounded-md bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-600"
            >
              Buscar
            </button>
          </form>
        </div>
      </div>

      {/* franja de acento — mismo rol que el hero de Catalog.tsx (el único
          lugar de la página que se anima a afirmar algo de la tienda), acá
          resuelto como una tira angosta en vez de un banner grande, para
          dejarle más lugar arriba a la sidebar + grilla. */}
      <div className="bg-red-600">
        <div className="max-w-7xl mx-auto px-4 py-2.5">
          <p className="text-sm font-semibold text-white">
            Bazar y juguetería: todo en un solo lugar.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">
        {/* sidebar de categorías (desktop) — filtro fijo a la izquierda,
            estética de lista en vez de la marquesina de pills de
            Catalog.tsx. */}
        <aside className="hidden lg:block w-56 shrink-0">
          <h2 className="text-sm font-semibold text-neutral-500 mb-2 px-3">
            Categorías
          </h2>
          <nav className="flex flex-col gap-0.5 bg-white border border-neutral-200 rounded-lg overflow-hidden py-1">
            {renderCategoriaItems()}
          </nav>
        </aside>

        {/* misma lista, en tira horizontal con scroll manual — no hay
            sidebar en mobile. */}
        <nav className="lg:hidden flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {renderCategoriaItems()}
        </nav>

        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-neutral-900 mb-3">Todos los productos</h2>

          {loading && <p className="text-neutral-500">Cargando...</p>}
          {error && <p className="text-red-600">{error}</p>}

          {!loading && !error && products.length === 0 && (
            <p className="text-neutral-500">No hay productos para mostrar.</p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((product) => (
              // dos tonos — foto sobre fondo claro, ficha de datos sobre
              // fondo oscuro (bg-neutral-900, el mismo que la navbar de
              // arriba) — repite dentro de cada card el contraste
              // claro/oscuro que ya tiene la página, en vez de una card
              // blanca uniforme como las de cualquier otro catálogo.
              <div
                key={product.idProducto}
                className="flex flex-col overflow-hidden rounded-lg border border-neutral-800 transition-colors hover:border-red-500"
              >
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

                <div className="flex flex-1 flex-col gap-1 bg-neutral-900 p-3">
                  {product.categoria && (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-red-500">
                      <span className="h-1.5 w-1.5 bg-red-500" />
                      {product.categoria.nombre}
                    </span>
                  )}

                  <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2 min-h-[2.5em]">
                    {product.nombre}
                  </h3>

                  <p className="text-lg font-extrabold text-red-500 tabular-nums">
                    {formatPrice(product.precio)}
                  </p>

                  {product.stock === null ? (
                    <span className="text-xs text-neutral-400">Consultar disponibilidad</span>
                  ) : product.stock === 0 ? (
                    <span className="text-xs text-red-400">Sin stock</span>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setProductoSeleccionado(product)}
                    className="mt-2 w-full border border-red-500 text-red-400 hover:bg-red-500 hover:text-white text-sm font-medium py-1.5 rounded-md transition-colors cursor-pointer"
                  >
                    Ver detalle
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAgregarAlCarrito(product)}
                    disabled={product.stock === 0}
                    className="mt-1.5 w-full rounded-md bg-red-600 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-500 cursor-pointer"
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
              fontClassName: 'font-catalog2',
              panelClassName: 'rounded-lg',
              accentTextClassName: 'text-red-600',
              thumbnailActiveClassName: 'border-red-600',
              // ficha oscura debajo de la foto — mismo contraste
              // claro/oscuro que ya arma la card (ver el comentario en el
              // <div> de la grilla, bg-neutral-900).
              darkFooter: true,
              addToCartButtonClassName:
                'flex-1 rounded-md bg-red-600 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-500 cursor-pointer',
            }}
          />

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-8">
              <Button
                variant="secondary"
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
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Catalog2;
