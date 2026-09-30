import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  ValidationArguments,
  registerDecorator,
} from 'class-validator';
import { TipoAjustePrecio } from '@/common/enums/tipo-ajuste-precio.enum';
import { PRECIO_MAX } from './create-product.dto';

/** Tope del aumento porcentual (+1000% = precio × 11). Sin tope, un valor
 * enorme desbordaría DECIMAL(10,2) y saldría como un 500 de MySQL. */
export const PORCENTAJE_MAX = 1000;

/** El rango válido de `valor` depende de `tipo`: -100..PORCENTAJE_MAX para
 * PORCENTAJE (menos de -100 dejaría precios negativos), y ±PRECIO_MAX para
 * FIJO. Antes esto era un `@ValidateIf(tipo === PORCENTAJE)` sobre el
 * `@Min` — pero en class-validator `@ValidateIf` salta TODOS los
 * validadores de la propiedad cuando da falso, así que con tipo FIJO el
 * campo `valor` no se validaba en absoluto (ni siquiera que fuera un
 * número). Por eso ahora es un único validador que decide según el tipo. */
function ValorSegunTipo() {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'valorSegunTipo',
      target: object.constructor,
      propertyName,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (typeof value !== 'number' || !Number.isFinite(value)) {
            return false;
          }
          const { tipo } = args.object as BulkPriceAdjustmentDto;
          return tipo === TipoAjustePrecio.PORCENTAJE
            ? value >= -100 && value <= PORCENTAJE_MAX
            : Math.abs(value) <= PRECIO_MAX;
        },
        defaultMessage(args: ValidationArguments) {
          const { tipo } = args.object as BulkPriceAdjustmentDto;
          return tipo === TipoAjustePrecio.PORCENTAJE
            ? `El porcentaje debe estar entre -100 (dejaría los precios en 0) y ${PORCENTAJE_MAX}`
            : `El monto fijo debe estar entre -${PRECIO_MAX} y ${PRECIO_MAX}`;
        },
      },
    });
}

export class BulkPriceAdjustmentDto {
  @IsOptional()
  @IsInt({ message: 'La categoría debe ser un id numérico' })
  idCategoria?: number | null;

  @IsEnum(TipoAjustePrecio, {
    message: `El tipo de ajuste debe ser ${TipoAjustePrecio.PORCENTAJE} o ${TipoAjustePrecio.FIJO}`,
  })
  tipo!: TipoAjustePrecio;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El valor debe ser un número con hasta 2 decimales' },
  )
  @ValorSegunTipo()
  valor!: number;
}
