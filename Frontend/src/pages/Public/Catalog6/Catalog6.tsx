import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { getCategoriesService, getProductsService } from '@/services';
import { Category, Product } from '@/interfaces';
import { getErrorMessage, apiOrigin, showSuccess } from '@/utilities';
import { PrivateRoutes, PublicRoutes } from '@/models';
import { AppStore } from '@/redux/store';
import { CartLink } from '@/components/Cart/CartLink';
import { addToCart } from '@/redux/states/cart';
import { InputBuscarProductos } from '@/components/ProductSearch/InputBuscarProductos';
import { ProductDetailModal } from '@/pages/Public/Catalog/ProductDetailModal';
import { HeroCarousel } from './HeroCarousel';
import { CategoryDrawer } from './CategoryDrawer';
import { ProductCarousel } from './ProductCarousel';

// el máximo que acepta el backend (FindProductsQueryDto) — una sola
// carga alcanza y sobra para el catálogo real de hoy. `allProducts` (sin
// filtrar) alimenta el hero y las miniaturas de categoría; `products`
// (react a búsqueda/categoría) alimenta el carrusel de "Explorá el
// catálogo".
const BASELINE_LIMIT = 50;
const LISTADO_LIMIT = 24;
const HEADER_SHRINK_AT_PX = 40;

/** Sexto diseño de catálogo — landing densa multi-sección estilo "tienda
 * por departamentos" (pedido explícito del usuario, sobre un análisis de
 * paris.cl como referencia de estructura/layout/funcionalidad). Mismos
 * datos y mismo backend que los otros 5 (getProductsService/
 * getCategoriesService, sin auth) — la diferencia real con el spec
 * original es que ACÁ todo tiene que ser real: sin carrito, sin ofertas
 * con descuento inventado, sin "marcas hermanas", sin delivery. El detalle
 * completo de qué se adaptó y por qué está en Frontend/CLAUDE.md, sección
 * de este catálogo — no se repite acá.
 *
 * A diferencia de Catalog.tsx–Catalog4.tsx (una sola sección de grilla/
 * carrusel), esta es la única landing con múltiples secciones — esa
 * densidad estructural es la identidad real de este diseño, más que la
 * paleta (azul marino + blanco, Manrope).
 *
 * **Carrito conectado** (pedido explícito del usuario, sexto catálogo con
 * esto — ver Frontend/CLAUDE.md, sección "Sexto catálogo con carrito").
 * Mismo `redux/states/cart.ts` que los otros 5. Como acá hay varios
 * puntos de entrada al detalle de un producto (el hero, el carrusel de
 * "Explorá el catálogo"), todos terminan en el mismo
 * `ProductDetailModal` — conectar `onAddToCart` ahí cubre el hero gratis,
 * sin tocar `HeroCarousel.tsx`. `ProductCard.tsx` (usado por
 * `ProductCarousel.tsx`) ganó su propio botón además, para agregar sin
 * pasar por el modal. */
function Catalog6() {
  const user = useSelector((state: AppStore) => state.user);
  const dispatch = useDispatch();

  const [categories, setCategories] = useState<Category[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState<Product | null>(null);
  const [headerShrunk, setHeaderShrunk] = useState(false);

  const exploreRef = useRef<HTMLDivElement>(null);

  // categorías + el "pool" base de productos (sin filtrar) — una sola vez.
  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const [categoriesData, productsData] = await Promise.all([
          getCategoriesService(),
          getProductsService({ limit: BASELINE_LIMIT }),
        ]);
        if (cancelado) return;
        setCategories(categoriesData);
        setAllProducts(productsData.items);
      } catch {
        // el hero/las miniaturas de categoría son un extra — si esto
        // falla, la sección de abajo (con su propio loading/error) sigue
        // intentando cargar el listado real.
      }
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  // listado filtrado (búsqueda/categoría) — sección "Explorá el catálogo".
  useEffect(() => {
    let cancelado = false;

    (async () => {
      setLoading(true);
      setError('');

      try {
        const data = await getProductsService({
          search: search || undefined,
          categoriaId: categoriaId ? Number(categoriaId) : undefined,
          limit: LISTADO_LIMIT,
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
  }, [search, categoriaId]);

  // header "sticky" con shrink al scrollear — solo lectura de scroll, no
  // cambia el layout salvo la altura/padding del propio header.
  useEffect(() => {
    const onScroll = () => setHeaderShrunk(window.scrollY > HEADER_SHRINK_AT_PX);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // un producto real representativo por categoría (el primero que
  // aparece en el pool base) — para las miniaturas de categoría más abajo.
  // Sin imagen inventada: si una categoría no tiene ningún producto en el
  // pool, su tile queda sin foto (bloque de color con el nombre nomás).
  const categoryThumbnails = useMemo(() => {
    const map = new Map<number, Product>();
    for (const product of allProducts) {
      if (product.categoria && !map.has(product.categoria.idCategoria)) {
        map.set(product.categoria.idCategoria, product);
      }
    }
    return map;
  }, [allProducts]);

  const bannerProduct = allProducts[0];

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(searchInput.trim());
    scrollToExplore();
  };

  const handleSelectProducto = (producto: Product) => {
    setSearchInput(producto.nombre);
    setSearch(producto.nombre);
    scrollToExplore();
  };

  const applyCategoria = (id: string) => {
    setCategoriaId(id);
    scrollToExplore();
  };

  const scrollToExplore = () => {
    exploreRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // carrito client-side (ver redux/states/cart.ts) — mismos handlers que
  // los otros 5 catálogos, sin nada propio de este diseño.
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

  const accountLink = user?.token
    ? { to: `/${PrivateRoutes.PERFIL}`, label: 'Mi cuenta' }
    : { to: `/${PublicRoutes.LOGIN}`, label: 'Iniciar sesión' };

  return (
    <div className="min-h-screen bg-c6-bg text-c6-ink font-catalog6">
      {/* 1. top bar — sin "marcas hermanas" inventadas: links reales del
          sitio a la izquierda, cuenta (según sesión real) a la derecha. */}
      <div className="bg-c6-primary-dark text-white">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-white/70 hover:text-white transition-colors">
              ← Catálogos
            </Link>
            <Link to="/contacto" className="text-white/70 hover:text-white transition-colors">
              Ayuda
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link to={accountLink.to} className="text-white/70 hover:text-white transition-colors">
              {accountLink.label}
            </Link>

            <CartLink className="text-white/70 hover:text-white" />
          </div>
        </div>
      </div>

      {/* 2. header principal — sticky, se achica al scrollear
          (headerShrunk controla el padding vertical). */}
      <div className={`sticky top-0 z-30 bg-c6-primary transition-[padding] duration-200 ${headerShrunk ? 'py-2' : 'py-4'}`}>
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-4 sm:gap-8">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="shrink-0 flex items-center gap-2 text-white text-sm font-semibold cursor-pointer hover:text-white/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
          >
            <Bars3Icon className="h-5 w-5" />
            <span className="hidden sm:inline">Categorías</span>
          </button>

          <span className="shrink-0 text-white font-extrabold tracking-tight text-lg">
            Tienda Básica
          </span>

          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-0 flex gap-2">
            <InputBuscarProductos
              keyword={searchInput}
              setKeyword={setSearchInput}
              onSelectProducto={handleSelectProducto}
              placeholder="Buscar productos..."
              className="flex-1 min-w-0 [&_input]:rounded-full [&_input]:border-0 [&_input]:py-2.5"
            />
          </form>
        </div>
      </div>

      <CategoryDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        categories={categories}
        onSelectCategory={applyCategoria}
      />

      {/* 3. franja de beneficios — mensajes reales, no logística
          inventada (este proyecto no tiene sistema de envío). */}
      <div className="bg-sky-50 text-center text-xs sm:text-sm text-c6-primary py-2 px-4">
        Explorá todas las categorías del catálogo{' '}
        <span className="mx-2 text-c6-primary/40">|</span> ¿Dudas? Escribinos desde Contacto
      </div>

      {/* 4. hero carousel */}
      <HeroCarousel products={allProducts} onSelectProduct={setProductoSeleccionado} />

      {/* 5. "Explorá el catálogo" — reemplaza la sección de "ofertas
          flash" del spec original (sin countdown ni descuento inventado,
          ver Frontend/CLAUDE.md). */}
      <div ref={exploreRef} className="max-w-7xl mx-auto px-4 py-12 scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-c6-ink">
              Explorá el catálogo
            </h2>
            <p className="text-sm text-c6-ink/50 mt-1">
              {total} producto{total === 1 ? '' : 's'}
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-c6-ink/70">
            Categoría
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="rounded-md border border-c6-line px-3 py-1.5 text-sm text-c6-ink focus:outline-none focus:border-c6-primary focus:ring-2 focus:ring-c6-primary/20"
            >
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category.idCategoria} value={category.idCategoria}>
                  {category.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading && <p className="text-sm text-c6-ink/50 mb-4">Cargando…</p>}
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        {!loading && !error && (
          <ProductCarousel
            products={products}
            onSelectProduct={setProductoSeleccionado}
            onAddToCart={handleAgregarAlCarrito}
          />
        )}
      </div>

      {/* 6. carrusel de tiles de categoría — cada tile usa la foto de un
          producto real de esa categoría (o un bloque de color con el
          nombre si no hay ninguna en el pool cargado). */}
      {categories.length > 0 && (
        <div className="bg-c6-surface py-12">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-c6-ink mb-6">
              Categorías
            </h2>
            <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {categories.map((category) => {
                const thumb = categoryThumbnails.get(category.idCategoria);
                return (
                  <button
                    key={category.idCategoria}
                    type="button"
                    onClick={() => applyCategoria(String(category.idCategoria))}
                    className="group relative snap-start shrink-0 w-56 h-40 rounded-xl overflow-hidden cursor-pointer bg-c6-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c6-primary"
                  >
                    {thumb?.imageUrl && (
                      <img
                        src={`${apiOrigin}${thumb.imageUrl}`}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    <span className="absolute bottom-3 left-4 right-4 text-left text-base font-bold text-white">
                      {category.nombre}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 7. banner promocional ancho — sin "marcas participantes"
          inventadas: CTA real a Contacto, imagen de fondo de un producto
          real (no stock photo). */}
      <div
        className="relative py-16 sm:py-24 px-4"
        style={{
          backgroundImage: bannerProduct?.imageUrl
            ? `linear-gradient(to right, rgba(12,22,49,0.94), rgba(12,22,49,0.7)), url(${apiOrigin}${bannerProduct.imageUrl})`
            : undefined,
          backgroundColor: 'var(--color-c6-primary-dark)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight max-w-lg">
            ¿Buscás algo puntual?
          </h2>
          <p className="mt-3 text-white/75 max-w-md">
            Escribinos desde la página de contacto y te ayudamos a encontrarlo.
          </p>
          <Link
            to="/contacto"
            className="mt-6 inline-flex items-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-c6-primary hover:bg-c6-surface transition-colors"
          >
            Ir a Contacto
          </Link>
        </div>
      </div>

      {/* 8. grid de 2 banners de campaña — 2 categorías reales, "Ver
          categoría" en vez de "Ver colección" inventada. */}
      {categories.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {categories.slice(0, 2).map((category) => {
            const thumb = categoryThumbnails.get(category.idCategoria);
            return (
              <div
                key={category.idCategoria}
                className="relative h-64 rounded-xl overflow-hidden bg-c6-surface"
              >
                {thumb?.imageUrl && (
                  <img
                    src={`${apiOrigin}${thumb.imageUrl}`}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5">
                  <h3 className="text-xl font-bold text-white">{category.nombre}</h3>
                  <button
                    type="button"
                    onClick={() => applyCategoria(String(category.idCategoria))}
                    className="mt-3 inline-flex items-center rounded-full bg-white px-4 py-2 text-xs font-semibold text-c6-primary hover:bg-c6-surface transition-colors cursor-pointer"
                  >
                    Ver categoría
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 9. banner de descarga de app — se sacó: la app Android de este
          proyecto no está publicada en ningún lado accesible, un QR acá
          prometería algo que no existe (ver Frontend/CLAUDE.md). */}

      {/* 10. accesos rápidos — categorías reales como chips, no
          "tendencias de búsqueda" con analítica inventada. */}
      {categories.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 py-12">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-c6-ink mb-5">
            Categorías populares
          </h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category.idCategoria}
                type="button"
                onClick={() => applyCategoria(String(category.idCategoria))}
                className="rounded-full border border-c6-line px-4 py-2 text-sm text-c6-ink/70 hover:border-c6-primary hover:text-c6-primary transition-colors cursor-pointer"
              >
                {category.nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 11. footer — no se construye uno propio, el <Footer /> global
          que ya monta App.tsx en todas las rutas hace ese trabajo (mismo
          criterio que Catalog.tsx–Catalog5.tsx, ninguno tiene el suyo). */}

      <ProductDetailModal
        product={productoSeleccionado}
        onClose={() => setProductoSeleccionado(null)}
        onAddToCart={handleAgregarDesdeModal}
        theme={{
          fontClassName: 'font-catalog6',
          // mismo tipo de franja superior que ya tiene ProductCard.tsx
          // (h-1 bg-c6-primary), acá como borde del panel entero.
          panelClassName: 'rounded-xl border-t-4 border-c6-primary',
          accentTextClassName: 'text-c6-primary',
          thumbnailActiveClassName: 'border-c6-primary',
          // precio y stock en el mismo renglón — mismo criterio "denso"
          // que ya usa la card (ver ProductCard.tsx).
          priceStockRow: true,
          addToCartButtonClassName:
            'flex-1 rounded-md bg-c6-primary py-2 text-sm font-semibold text-white transition-colors hover:bg-c6-primary-dark disabled:cursor-not-allowed disabled:bg-c6-line disabled:text-c6-ink/40 cursor-pointer',
        }}
      />
    </div>
  );
}

export default Catalog6;
