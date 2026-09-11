import { IsInt, Min } from 'class-validator';

/** un renglón del carrito, tal como lo manda el frontend en POST /ordenes.
 * Solo id + cantidad — el precio y el nombre nunca se toman de acá, se
 * resuelven contra la base real en OrdersService.crearOrden (ver
 * ProductsService.findActivoByIdOrThrow), para que un cliente no pueda
 * mandar un precio manipulado. */
export class CreateOrderItemDto {
  @IsInt({ message: 'idProducto debe ser un id numérico' })
  idProducto: number;

  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad debe ser al menos 1' })
  cantidad: number;
}
