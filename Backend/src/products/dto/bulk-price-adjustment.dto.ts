import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  ValidateIf,
} from 'class-validator';
import { TipoAjustePrecio } from '@/common/enums/tipo-ajuste-precio.enum';

/** Body de PATCH /productos/precios/ajuste-masivo — ajusta el precio de
 * venta de muchos productos a la vez, en vez de uno por uno (pedido
 * explícito del usuario: editar de a uno no escala con miles de
 * productos). Cubre los dos casos que pidió con el mismo DTO/endpoint en
 * vez de duplicar la misma lógica dos veces:
 *   - "por categoría": mandar `idCategoria`.
 *   - "general, todo el catálogo": no mandar `idCategoria` (o mandarlo en
 *     null).
 * Ver ProductsService.ajustarPreciosMasivo para la fórmula real. */
export class BulkPriceAdjustmentDto {
  /** sin este campo (o en null) el ajuste aplica a TODOS los productos,
   * activos e inactivos — ver el comentario del service sobre por qué
   * incluye los dados de baja. */
  @IsOptional()
  @IsInt({ message: 'La categoría debe ser un id numérico' })
  idCategoria?: number | null;

  @IsEnum(TipoAjustePrecio, {
    message: `El tipo de ajuste debe ser ${TipoAjustePrecio.PORCENTAJE} o ${TipoAjustePrecio.FIJO}`,
  })
  tipo!: TipoAjustePrecio;

  /** positivo = aumento, negativo = descuento — misma fórmula para los dos
   * casos, así que no hace falta un campo aparte ("aumentar"/"bajar") ni
   * duplicar el endpoint. Para PORCENTAJE es el % a aplicar sobre el
   * precio actual de cada producto (10 = +10%, -10 = -10%); para FIJO son
   * pesos que se suman tal cual, sin importar el precio de partida (500 =
   * +$500, -500 = -$500). */
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El valor debe ser un número con hasta 2 decimales' },
  )
  // el tope de -100 solo tiene sentido para un porcentaje (bajar más de
  // 100% ya no significa nada — el precio no puede ser negativo); un
  // ajuste FIJO no tiene ese límite natural, así que no se valida acá
  // (el service igual nunca deja un precio final negativo, ver
  // GREATEST(...,0) en la query).
  @ValidateIf(
    (dto: BulkPriceAdjustmentDto) => dto.tipo === TipoAjustePrecio.PORCENTAJE,
  )
  @Min(-100, {
    message:
      'El porcentaje no puede ser menor a -100 (dejaría los precios en 0)',
  })
  valor!: number;
}
