import { useState } from 'react';
import { DialogTitle } from '@headlessui/react';
import { Button, Modal } from '@/components/ui';
import { Product } from '@/interfaces';
import { apiOrigin } from '@/utilities';

function formatPrice(precio: number): string {
  return `$${precio.toFixed(2)}`;
}

/** Piezas de identidad visual que cada catálogo le pasa a este modal
 * compartido — mismo criterio que ya se usó para las cards (ver
 * Frontend/CLAUDE.md, sección "Identidad propia para cada card de
 * producto"): en vez de una card/modal genérica recoloreada, cada
 * catálogo aporta el mismo recurso que ya tiene su card, para que abrir
 * el detalle se sienta como parte del mismo diseño, no un popup neutro
 * ajeno a la página. Todos los campos son opcionales — sin pasar `theme`,
 * el modal se ve exactamente como antes de este cambio. */
export interface ProductModalTheme {
  /** fuente del cuerpo del modal — el `Dialog` de headlessui porta fuera
   * del árbol de la página (a un nodo aparte, no un hijo de la card que
   * lo abrió), así que no hereda la tipografía de la página por cascada;
   * hay que pasarla explícita acá. */
  fontClassName?: string;
  /** fuente/estilo solo del título (nombre del producto) — separado de
   * `fontClassName` porque algunos catálogos (Catalog4) usan una serif
   * distinta SOLO para títulos, nunca para el cuerpo. */
  titleFontClassName?: string;
  /** clases extra para el panel del modal (radio de esquina, franja de
   * acento vía border-t/border-l, etc.) — se agregan después de las
   * clases base de Modal.tsx. */
  panelClassName?: string;
  /** color del precio y otros acentos de texto (cuando no hay
   * priceTagClassName/priceMedallionClassName — ver abajo). */
  accentTextClassName?: string;
  /** clases completas del botón "Agregar al carrito" — si se pasa,
   * reemplaza el <Button> teal por default. Mismo motivo que ya usan
   * Catalog2.tsx/Catalog3.tsx para no depender del orden de generación de
   * clases de Tailwind al pisar el color de <Button> (ver
   * Frontend/CLAUDE.md). */
  addToCartButtonClassName?: string;
  /** borde de la miniatura activa en la galería de fotos. */
  thumbnailActiveClassName?: string;
  /** si es true, el bloque de precio/stock/cantidad/botón se muestra
   * sobre una placa oscura (mismo recurso que la card de Catalog2.tsx) en
   * vez del fondo blanco de siempre. */
  darkFooter?: boolean;
  /** si se pasa, el precio se muestra como una etiqueta colgante
   * superpuesta en la esquina de la foto — mismo recurso que la card de
   * Catalog.tsx — en vez de una línea de texto aparte. Son las clases del
   * fondo/color de la etiqueta (el "agujero" siempre es un círculo
   * blanco, el modal siempre tiene fondo blanco a diferencia de las
   * cards). Mutuamente excluyente con priceMedallionClassName. */
  priceTagClassName?: string;
  /** igual que priceTagClassName pero como medallón circular rotado —
   * mismo recurso que la card de Catalog3.tsx. */
  priceMedallionClassName?: string;
  /** muestra "ID {idProducto}" en monospace bajo el título — mismo
   * recurso que la card de Catalog7.tsx. */
  showProductId?: boolean;
  /** precio y stock en un mismo renglón en vez de líneas apiladas —
   * mismo criterio "denso" que ya usan las cards de Catalog6.tsx/
   * Catalog7.tsx. */
  priceStockRow?: boolean;
}

interface ProductDetailModalProps {
  /** null = cerrado. Se le pasa el Product que Catalog.tsx ya tiene en
   * memoria (la lista de GET /productos ya trae descripcion/imageUrl/fotos
   * completos) — a diferencia de la vieja página de detalle
   * (pages/Public/ProductDetail/ProductDetail.tsx, que sigue existiendo
   * para acceso directo por URL, ver Frontend/CLAUDE.md), este modal no
   * repite el fetch. */
  product: Product | null;
  onClose: () => void;
  /** opcional a propósito — este modal lo reutilizan 6 de los 7 catálogos
   * (ver Frontend/CLAUDE.md), pero el carrito solo está conectado en
   * Catalog.tsx por ahora (Fase 2, alcance acotado, pedido explícito del
   * usuario). Sin esta prop, el modal se comporta exactamente igual que
   * antes — el resto de los catálogos no pasa nada y no ven ningún botón
   * nuevo. */
  onAddToCart?: (product: Product, cantidad: number) => void;
  /** opcional — ver ProductModalTheme. Sin pasarla, el modal queda con el
   * look neutro original (App Shell: slate/teal). */
  theme?: ProductModalTheme;
}

/** Detalle de un producto del catálogo, en modal — reemplaza la
 * navegación a /productos/:id al clickear una tarjeta (ver Catalog.tsx).
 * Galería simple: miniaturas + foto grande seleccionada (no carrusel), la
 * portada (imageUrl) va primero seguida de las fotos adicionales
 * (product.fotos) — un solo array armado acá, sin tocar el backend. */
export function ProductDetailModal({ product, onClose, onAddToCart, theme = {} }: ProductDetailModalProps) {
  const {
    fontClassName = '',
    titleFontClassName = '',
    panelClassName = '',
    accentTextClassName = '',
    addToCartButtonClassName,
    thumbnailActiveClassName = 'border-slate-800',
    darkFooter = false,
    priceTagClassName,
    priceMedallionClassName,
    showProductId = false,
    priceStockRow = false,
  } = theme;

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cantidad, setCantidad] = useState(1);

  // el índice seleccionado y la cantidad se resetean cada vez que cambia
  // el producto — si no, al pasar de un producto con 5 fotos a uno con 1
  // sola podría quedar apuntando a un índice que ya no existe, y una
  // cantidad elegida para un producto podría quedar pisando el stock de
  // otro. Ajustar el estado durante el render (en vez de un useEffect) es
  // el patrón que recomienda React para "resetear un estado cuando cambia
  // una prop" sin disparar un render en cascada (ver
  // react-hooks/set-state-in-effect).
  const [productoAnteriorId, setProductoAnteriorId] = useState(product?.idProducto);
  if (product?.idProducto !== productoAnteriorId) {
    setProductoAnteriorId(product?.idProducto);
    setSelectedIndex(0);
    setCantidad(1);
  }

  const fotos = product
    ? [
        ...(product.imageUrl ? [product.imageUrl] : []),
        ...product.fotos.map((foto) => foto.imageUrl),
      ]
    : [];

  // clases resueltas del bloque de precio/stock/cantidad/botón — un solo
  // lugar para la variante clara/oscura (darkFooter), en vez de repetir
  // el condicional en cada línea de abajo.
  const footerTextClass = darkFooter ? 'text-white' : 'text-gray-900';
  const footerMutedClass = darkFooter ? 'text-neutral-400' : 'text-gray-500';
  const footerBorderClass = darkFooter ? 'border-neutral-700' : 'border-gray-100';
  const priceColorClass = priceTagClassName || priceMedallionClassName
    ? 'text-white' // el precio vive adentro de la etiqueta/medallón, siempre con fondo de color
    : accentTextClassName || footerTextClass;

  const priceNode = <span className="text-2xl font-bold tabular-nums">{formatPrice(product?.precio ?? 0)}</span>;

  const stockNode = product && (
    product.stock === null ? (
      <p className={footerMutedClass}>Consultar disponibilidad</p>
    ) : product.stock === 0 ? (
      <p className="text-red-600">Sin stock</p>
    ) : (
      <p className={footerMutedClass}>Stock disponible: {product.stock}</p>
    )
  );

  return (
    <Modal
      open={product !== null}
      onClose={onClose}
      className={`max-w-2xl max-h-[90vh] flex flex-col ${panelClassName} ${fontClassName}`.trim()}
    >
      {product && (
        <div className="p-6 overflow-y-auto flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle as="h2" className={`text-xl font-semibold ${titleFontClassName}`.trim()}>
                {product.nombre}
              </DialogTitle>
              {/* mismo recurso que la card de Catalog7.tsx: el ID real
                  del producto en monospace, como referencia técnica. */}
              {showProductId && (
                <p className="mt-0.5 font-mono text-xs text-gray-400">ID {product.idProducto}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none cursor-pointer"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>

          {/* miniaturas en columna al costado de la foto principal, no en
              una tira debajo — apiladas en fila quedaban muy apretadas
              (poco alto real para 64px de miniatura + texto abajo,
              feedback explícito del usuario). Con scroll vertical propio
              (mismo alto que la foto, h-64) cuando hay más fotos de las
              que entran — así el modal no crece de alto por tener 6 fotos
              en vez de 2. */}
          <div className="flex gap-3">
            {fotos.length > 1 && (
              <div className="flex h-64 shrink-0 flex-col gap-2 overflow-y-auto pr-1">
                {fotos.map((foto, index) => (
                  <button
                    key={foto}
                    type="button"
                    onClick={() => setSelectedIndex(index)}
                    className={`h-16 w-16 shrink-0 rounded-md overflow-hidden border-2 bg-gray-100 cursor-pointer ${
                      index === selectedIndex ? thumbnailActiveClassName : 'border-transparent'
                    }`}
                  >
                    <img src={`${apiOrigin}${foto}`} alt="" className="h-full w-full object-contain" />
                  </button>
                ))}
              </div>
            )}

            {/* "relative" sin overflow-hidden acá (eso queda en la caja de
                la imagen) para que la etiqueta/medallón de precio pueda
                superponerse a la foto sin que se recorte — mismo recurso
                que ya usan las cards de Catalog.tsx/Catalog3.tsx.
                "min-w-0" para que esta columna se achique correctamente
                dentro del flex (si no, la imagen podía forzar el ancho del
                modal en vez de recortarse a su caja). */}
            <div className="relative min-w-0 flex-1">
              <div className="h-64 bg-gray-100 rounded-md overflow-hidden flex items-center justify-center">
                {fotos.length > 0 ? (
                  // object-contain (no object-cover): se ve la imagen completa
                  // sin recortarla ni deformarla para llenar la caja a la
                  // fuerza — mismo tamaño de caja de siempre, mejor si la
                  // imagen no tiene el mismo aspect-ratio.
                  <img
                    src={`${apiOrigin}${fotos[selectedIndex]}`}
                    alt={product.nombre}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-gray-400">Sin imagen</span>
                )}
              </div>

              {priceTagClassName && (
                <div
                  className={`absolute -bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-full py-1 pl-1.5 pr-3 shadow-md ${priceTagClassName}`}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-white" />
                  {priceNode}
                </div>
              )}

              {priceMedallionClassName && (
                <div
                  className={`absolute -right-2 -top-2 z-10 rotate-3 rounded-full px-3 py-1.5 shadow-lg ${priceMedallionClassName}`}
                >
                  {priceNode}
                </div>
              )}
            </div>
          </div>

          {/* categoría → descripción: bloque único porque darkFooter lo
              envuelve entero en una placa oscura (mismo recurso que la
              card de Catalog2.tsx: foto clara arriba, ficha oscura abajo)
              en vez de solo teñir el texto — así el modal repite la misma
              estructura de la card, no nada más su paleta. */}
          <div className={darkFooter ? 'flex flex-col gap-4 rounded-lg bg-neutral-900 p-4' : 'contents'}>
            {product.categoria && (
              <p className={`text-sm ${footerMutedClass}`}>{product.categoria.nombre}</p>
            )}

            {/* sin etiqueta/medallón sobre la foto, el precio sigue como
                línea de texto de siempre (con el color de acento propio de
                cada catálogo) — y opcionalmente comparte renglón con el
                stock (Catalog6.tsx/Catalog7.tsx). */}
            {!priceTagClassName && !priceMedallionClassName && (
              priceStockRow ? (
                <div className="flex items-end justify-between gap-3">
                  <div className={priceColorClass}>{priceNode}</div>
                  {stockNode}
                </div>
              ) : (
                <>
                  <div className={priceColorClass}>{priceNode}</div>
                  {/* stock === null: el dueño eligió no mostrarlo (ver
                      Product.mostrarStock) — no es lo mismo que stock === 0
                      (sin stock real). */}
                  {stockNode}
                </>
              )
            )}

            {/* con etiqueta/medallón, el precio ya está sobre la foto — acá
                solo falta el stock (si no se combinó arriba). */}
            {(priceTagClassName || priceMedallionClassName) && stockNode}

            {/* solo si el catálogo conectó el carrito (ver el comentario de
                onAddToCart más arriba) — sin stock real (0, no null) el
                botón queda deshabilitado en vez de ocultarse, mismo criterio
                que el resto del proyecto (ej. "Reactivar" solo aparece si
                corresponde, pero un botón deshabilitado es más claro acá
                porque el producto sigue siendo el que el cliente quería
                ver). */}
            {onAddToCart && (
              <div className={`flex items-center gap-3 border-t pt-4 ${footerBorderClass}`}>
                <div className={`flex items-center rounded-md border ${darkFooter ? 'border-neutral-600' : 'border-gray-300'}`}>
                  <button
                    type="button"
                    onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                    disabled={product.stock === 0}
                    className={`px-3 py-1.5 cursor-pointer disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed ${
                      darkFooter ? 'text-neutral-300 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                    aria-label="Restar cantidad"
                  >
                    −
                  </button>
                  <span className={`w-8 text-center text-sm tabular-nums ${footerTextClass}`}>{cantidad}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setCantidad((c) => (product.stock !== null ? Math.min(c + 1, product.stock) : c + 1))
                    }
                    disabled={product.stock === 0 || (product.stock !== null && cantidad >= product.stock)}
                    className={`px-3 py-1.5 cursor-pointer disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed ${
                      darkFooter ? 'text-neutral-300 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                    aria-label="Sumar cantidad"
                  >
                    +
                  </button>
                </div>

                {addToCartButtonClassName ? (
                  <button
                    type="button"
                    onClick={() => onAddToCart(product, cantidad)}
                    disabled={product.stock === 0}
                    className={addToCartButtonClassName}
                  >
                    {product.stock === 0 ? 'Sin stock' : 'Agregar al carrito'}
                  </button>
                ) : (
                  <Button
                    onClick={() => onAddToCart(product, cantidad)}
                    disabled={product.stock === 0}
                    className="flex-1"
                  >
                    {product.stock === 0 ? 'Sin stock' : 'Agregar al carrito'}
                  </Button>
                )}
              </div>
            )}

            {product.descripcion && (
              // bloque con scroll interno propio (max-h + overflow-y-auto):
              // no estira el modal indefinidamente con descripciones largas,
              // y el texto sigue siendo legible completo haciendo scroll acá
              // adentro en vez de cortarse.
              <p className={`whitespace-pre-line max-h-40 overflow-y-auto pr-1 ${darkFooter ? 'text-neutral-300' : 'text-gray-700'}`}>
                {product.descripcion}
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default ProductDetailModal;
