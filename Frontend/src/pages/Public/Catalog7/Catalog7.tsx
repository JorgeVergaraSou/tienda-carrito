import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { getCategoriesService, getProductsService } from '@/services';
import { Category, Product } from '@/interfaces';
import { getErrorMessage, showSuccess } from '@/utilities';
import { Button, EmptyState } from '@/components/ui';
import { CartLink } from '@/components/Cart/CartLink';
import { addToCart } from '@/redux/states/cart';
import { InputBuscarProductos } from '@/components/ProductSearch/InputBuscarProductos';
import { ProductDetailModal } from '@/pages/Public/Catalog/ProductDetailModal';
import { ProductCard, ProductCardSkeleton } from './ProductCard';

const PAGE_SIZE = 20;
const SKELETON_COUNT = 10;

// pill de categoría — sexta variante del mismo patrón de filtro que ya
// usan los otros 6 catálogos (pill-marquesina en Catalog.tsx, sidebar en
// Catalog2.tsx, pestañas en Catalog3.tsx, texto itálica en Catalog4.tsx,
// chips en Catalog5.tsx, <select> en Catalog6.tsx) — acá una pill de
// contorno cuadrado (rounded-md, no rounded-full), más en línea con la
// estética "grilla técnica" del resto de la página.
function categoriaClass(active: boolean): string {
  return `shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
    active
      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
      : 'border-neutral-200 text-neutral-600 hover:border-indigo-300 hover:text-indigo-700'
  }`;
}

/** Séptimo diseño de catálogo — mismos datos y mismo backend que los
 * otros 6 (GET /productos, GET /categorias, sin auth). Identidad "grilla
 * técnica densa" (pedido explícito del usuario, inspirado en un patrón de
 * card de e-commerce de tecnología): cards compactas, acento índigo (el
 * único de los 7 que lo usa), tipografía del sistema sin sumar una fuente
 * nueva (pedido explícito del spec original), grilla de hasta 5 columnas.
 *
 * Sin marca, SKU con formato propio, precio de descuento, ni precio por
 * medio de pago — ninguno de esos campos existe en `Product` en este
 * proyecto (ver ProductCard.tsx). El detalle completo de qué se descartó
 * del spec original y por qué está en Frontend/CLAUDE.md, sección de
 * este catálogo.
 *
 * Reutiliza ProductDetailModal (igual que Catalog.tsx–Catalog4.tsx y
 * Catalog6.tsx) — no páginas de detalle propias, a diferencia de
 * Catalog5.tsx (eso fue un pedido específico de ese diseño puntual).
 *
 * **Carrito conectado** (pedido explícito del usuario, séptimo y último
 * catálogo con esto — ver Frontend/CLAUDE.md, sección "Séptimo catálogo
 * con carrito"). Mismo `redux/states/cart.ts` que los otros 6. */
function Catalog7() {
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
        // falla (mismo criterio que los otros 6 catálogos).
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
  // los otros 6 catálogos, sin nada propio de este diseño.
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
    <div className="min-h-screen bg-neutral-50">
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3 sm:gap-6">
          <Link
            to="/"
            className="order-1 shrink-0 text-sm text-neutral-500 hover:text-indigo-700 transition-colors"
          >
            ← Catálogos
          </Link>

          <span className="order-2 shrink-0 text-lg font-extrabold text-neutral-900 tracking-tight">
           Tienda en Línea con carrito de compra
          </span>

          <div className="order-3 sm:order-4 ml-auto sm:ml-0 flex shrink-0 items-center gap-4">
            <Link
              to="/contacto"
              className="text-sm text-neutral-500 hover:text-indigo-700 transition-colors"
            >
              Contacto
            </Link>

            <CartLink className="text-neutral-500 hover:text-indigo-700" />
          </div>

          <form
            onSubmit={handleSearchSubmit}
            className="order-4 sm:order-3 basis-full sm:basis-0 sm:flex-1 flex gap-2 min-w-0"
          >
            <InputBuscarProductos
              keyword={searchInput}
              setKeyword={setSearchInput}
              onSelectProducto={handleSelectProducto}
              placeholder="Buscar productos..."
              className="flex-1 min-w-0 [&_input]:focus:border-indigo-600 [&_input]:focus:ring-indigo-600/20"
            />
            <button
              type="submit"
              className="shrink-0 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-600"
            >
              Buscar
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            type="button"
            onClick={() => handleCategoriaChange('')}
            className={categoriaClass(categoriaId === '')}
          >
            Todas
          </button>
          {categories.map((category) => (
            <button
              key={category.idCategoria}
              type="button"
              onClick={() => handleCategoriaChange(String(category.idCategoria))}
              className={categoriaClass(categoriaId === String(category.idCategoria))}
            >
              {category.nombre}
            </button>
          ))}
        </div>

        <div className="flex items-baseline justify-between mb-4">
          <h1 className="text-lg font-bold text-neutral-900">Todos los productos</h1>
          {!loading && <span className="text-sm text-neutral-500">{total} resultados</span>}
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        )}

        {!loading && !error && products.length === 0 && (
          <EmptyState message="No encontramos productos con ese filtro. Probá con otra categoría o búsqueda." />
        )}

        {!loading && !error && products.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {products.map((product) => (
              <ProductCard
                key={product.idProducto}
                product={product}
                onSelect={setProductoSeleccionado}
                onAddToCart={handleAgregarAlCarrito}
              />
            ))}
          </div>
        )}

        <ProductDetailModal
          product={productoSeleccionado}
          onClose={() => setProductoSeleccionado(null)}
          onAddToCart={handleAgregarDesdeModal}
          theme={{
            // misma franja lateral índigo que ya tiene ProductCard.tsx
            // (w-1 bg-indigo-600 a todo lo alto), acá como borde del
            // panel entero.
            panelClassName: 'rounded-lg border-l-4 border-indigo-600',
            accentTextClassName: 'text-indigo-700',
            thumbnailActiveClassName: 'border-indigo-600',
            // "ID {idProducto}" en monospace bajo el título — mismo
            // registro "ficha técnica" que ya tiene la card.
            showProductId: true,
            priceStockRow: true,
            // outline, no relleno — mismo criterio que ya usa la card
            // para "Agregar al carrito" (el CTA principal, "Ver
            // producto", ya no aplica dentro del modal).
            addToCartButtonClassName:
              'flex-1 rounded-md border border-indigo-600 py-2 text-sm font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-400 disabled:hover:bg-transparent cursor-pointer',
          }}
        />

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-10">
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
  );
}

export default Catalog7;
