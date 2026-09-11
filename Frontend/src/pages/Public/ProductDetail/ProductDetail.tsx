import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getProductService } from '@/services';
import { Product } from '@/interfaces';
import { getErrorMessage, apiOrigin } from '@/utilities';

function formatPrice(precio: number): string {
  return `$${precio.toFixed(2)}`;
}

/** Detalle público de un producto — sin login (ver GET /productos/:id en
 * el backend, sin @Auth). Se llega acá haciendo click en una tarjeta del
 * catálogo (Catalog.tsx). Si el producto no existe o está dado de baja,
 * el backend responde 404 y se muestra como cualquier otro error. */
function ProductDetail() {
  const { id } = useParams<{ id: string }>();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelado = false;

    (async () => {
      setLoading(true);
      setError('');

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

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      {/* apuntaba a '/', que ahora es la Landing — ver el mismo comentario
          en ContactPage.tsx. */}
      <Link to="/catalog" className="text-sm font-medium text-teal-700 hover:underline">
        ← Volver al catálogo
      </Link>

      {loading && <p className="mt-4 text-sm text-slate-500">Cargando...</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {product && (
        <div className="mt-4 grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {product.imageUrl ? (
              <img
                src={`${apiOrigin}${product.imageUrl}`}
                alt={product.nombre}
                className="h-full w-full object-contain p-6"
              />
            ) : (
              <span className="text-slate-400">Sin imagen</span>
            )}
          </div>

          <div>
            {product.categoria && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {product.categoria.nombre}
              </span>
            )}

            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              {product.nombre}
            </h1>

            <p className="mt-4 text-3xl font-bold text-slate-900 tabular-nums">
              {formatPrice(product.precio)}
            </p>

            {product.stock === 0 ? (
              <p className="mt-2 text-sm font-medium text-red-600">Sin stock</p>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Stock disponible: {product.stock}</p>
            )}

            {product.descripcion && (
              <p className="mt-4 whitespace-pre-line text-slate-700">{product.descripcion}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductDetail;
