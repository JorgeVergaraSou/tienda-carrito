//src/components/ProductSearch/InputBuscarProductos.tsx
/**
 * Buscador en vivo de productos: tipeás y a los 300ms (sin nueva tecla)
 * pega al backend y muestra un desplegable de resultados clickeable, con
 * navegación por teclado (flechas + Enter) y cierre al clickear afuera.
 *
 * No agrega ningún endpoint nuevo — reutiliza GET /productos (público) o
 * GET /productos/admin/listado (según el prop `admin`), que ya soportan
 * `search` + `limit`. Es un complemento del buscador con botón "Buscar"
 * que ya existía (Catalog.tsx, ProductsListPage.tsx): ese sigue filtrando
 * la grilla/tabla completa; este además ofrece saltar directo a un
 * producto puntual sin esperar el submit.
 */
import { useEffect, useRef, useState } from 'react';
import { getAdminProductsService, getProductsService } from '@/services';
import { Product } from '@/interfaces';
import { useClickOutside } from '@/hooks';
import { getErrorMessage } from '@/utilities';

const DEBOUNCE_MS = 300;
const MAX_RESULTS = 8;

interface InputBuscarProductosProps {
  keyword: string;
  setKeyword: (value: string) => void;
  onSelectProducto: (producto: Product) => void;
  // false (default): catálogo público, solo productos activos.
  // true: panel admin, incluye productos dados de baja.
  admin?: boolean;
  placeholder?: string;
  className?: string;
}

export function InputBuscarProductos({
  keyword,
  setKeyword,
  onSelectProducto,
  admin = false,
  placeholder = 'Buscar productos...',
  className = '',
}: InputBuscarProductosProps) {
  const [results, setResults] = useState<Product[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState('');

  // Si el usuario abre el desplegable y clickea en cualquier otra parte
  // de la pantalla (no en un resultado), se cierra solo.
  const contenedorRef = useRef<HTMLDivElement>(null);
  useClickOutside(contenedorRef, () => setShowResults(false));

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setKeyword(value);
    setShowResults(value.trim().length > 0);
    setSelectedIndex(-1);
  };

  useEffect(() => {
    let cancelado = false;

    const timer = setTimeout(async () => {
      const trimmed = keyword.trim();

      if (!trimmed) {
        if (!cancelado) setResults([]);
        return;
      }

      try {
        const data = admin
          ? await getAdminProductsService({ search: trimmed, limit: MAX_RESULTS })
          : await getProductsService({ search: trimmed, limit: MAX_RESULTS });

        if (cancelado) return;
        setResults(data.items);
        setError('');
      } catch (err) {
        if (cancelado) return;
        setResults([]);
        setError(getErrorMessage(err));
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [keyword, admin]);

  const handleSelect = (producto: Product) => {
    setKeyword(producto.nombre);
    setShowResults(false);
    onSelectProducto(producto);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
      event.preventDefault();
    } else if (event.key === 'ArrowUp') {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      event.preventDefault();
    } else if (event.key === 'Enter' && selectedIndex >= 0) {
      // si no hay ítem seleccionado con las flechas, el Enter lo maneja
      // el <form> que envuelve a este input (submit normal del buscador
      // con botón) — acá solo se intercepta cuando hay algo resaltado.
      event.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  return (
    <div ref={contenedorRef} className={`relative ${className}`.trim()}>
      <input
        type="text"
        value={keyword}
        placeholder={placeholder}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        className="border border-gray-300 rounded-md px-3 py-2 w-full"
      />

      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}

      {showResults && results.length > 0 && (
        <ul className="absolute z-10 w-full bg-white border border-gray-200 mt-1 rounded-md shadow-lg max-h-60 overflow-y-auto text-sm">
          {results.map((producto, index) => (
            <li
              key={producto.idProducto}
              onClick={() => handleSelect(producto)}
              // slate, no azul — este desplegable lo reutilizan los 3
              // catálogos (cada uno con su propio color de marca) + el
              // buscador del panel admin, ver ProductDetailModal.tsx para
              // el mismo criterio.
              className={`cursor-pointer px-4 py-2 flex items-center justify-between gap-2 hover:bg-slate-100 ${
                selectedIndex === index ? 'bg-slate-100' : ''
              }`}
            >
              <span>
                {producto.nombre}
                {producto.deletedAt && (
                  <span className="text-red-600 text-xs ml-2">(inactivo)</span>
                )}
              </span>
              <span className="text-gray-500 whitespace-nowrap">
                ${producto.precio.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default InputBuscarProductos;
