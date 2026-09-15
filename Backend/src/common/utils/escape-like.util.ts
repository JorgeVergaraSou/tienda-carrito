/**
 * Escapa los comodines de SQL `LIKE` (`%` y `_`) y el propio carácter de
 * escape (`\`) en un texto que viene de un buscador — sin esto, alguien
 * que busca literalmente "10%" o "a_b" no está buscando ese texto, está
 * mandando comodines: `%` matchea cualquier secuencia de caracteres y `_`
 * matchea un carácter cualquiera, así que una búsqueda de "10%" en
 * realidad devolvería cualquier fila que contenga "10" seguido de
 * cualquier cosa (incluida la nada), no solo las que tengan el signo "%"
 * de verdad. Nunca permite ejecutar SQL arbitrario (eso ya lo evita el
 * parámetro bindeado de TypeORM) — esto es sobre que la búsqueda
 * signifique lo que el usuario escribió, ni más ni menos.
 *
 * Se usa antes de armar el patrón `%texto%` en cualquier `ILike` — ver
 * ProductsService.buscarProductos / OrdersService (búsqueda de pedidos).
 * MySQL usa `\` como carácter de escape por default en LIKE (sin
 * necesidad de una cláusula ESCAPE explícita), por eso alcanza con
 * escapar acá; el backslash se escapa primero para no terminar
 * "escapando" el carácter siguiente si el texto del usuario ya traía uno.
 */
export function escapeLikeWildcards(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
