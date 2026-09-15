/** Respuesta de PATCH /productos/precios/ajuste-masivo — no devuelve la
 * lista de productos actualizados (podrían ser miles, ver
 * BulkPriceAdjustmentDto), solo cuántos se vieron afectados, para que el
 * panel ADMIN pueda confirmarle al usuario "se actualizaron N productos"
 * sin tener que traer todo el listado de nuevo. */
export class BulkPriceAdjustmentResponseDto {
  productosAfectados: number;
}
