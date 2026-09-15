/** Tipo de ajuste masivo de precio (ver ProductsService.ajustarPreciosMasivo)
 * — el mismo valor numérico (positivo o negativo) se interpreta distinto
 * según este campo: PORCENTAJE lo aplica como % sobre el precio actual de
 * cada producto, FIJO lo suma tal cual (en pesos) sin importar el precio
 * de partida. */
export enum TipoAjustePrecio {
  PORCENTAJE = 'PORCENTAJE',
  FIJO = 'FIJO',
}
