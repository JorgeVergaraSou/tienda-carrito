import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { RecortarTexto } from '@/common/decorators/recortar-texto.decorator';
import { SinHtml } from '@/common/decorators/sin-html.decorator';
import {
  DESCRIPCION_PRODUCTO_MAX,
  NOMBRE_PRODUCTO_MAX,
  PRECIO_MAX,
  STOCK_MAX,
} from './create-product.dto';

export class UpdateProductDto {
  @IsOptional()
  @RecortarTexto()
  @IsString({ message: 'El nombre debe ser un texto válido' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(NOMBRE_PRODUCTO_MAX, {
    message: `El nombre no puede superar los ${NOMBRE_PRODUCTO_MAX} caracteres`,
  })
  @SinHtml()
  nombre?: string;

  @IsOptional()
  @RecortarTexto()
  @IsString({ message: 'La descripción debe ser un texto válido' })
  @MaxLength(DESCRIPCION_PRODUCTO_MAX, {
    message: `La descripción no puede superar los ${DESCRIPCION_PRODUCTO_MAX} caracteres`,
  })
  descripcion?: string;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El precio debe ser un número con hasta 2 decimales' },
  )
  @Min(0, { message: 'El precio no puede ser negativo' })
  @Max(PRECIO_MAX, { message: 'El precio es demasiado alto' })
  precio?: number;

  @IsOptional()
  @IsInt({ message: 'El stock debe ser un número entero' })
  @Min(0, { message: 'El stock no puede ser negativo' })
  @Max(STOCK_MAX, { message: `El stock no puede superar ${STOCK_MAX}` })
  stock?: number;

  @IsOptional()
  @IsBoolean({ message: 'mostrarStock debe ser un valor booleano' })
  mostrarStock?: boolean;

  @IsOptional()
  @IsInt({ message: 'La categoría debe ser un id numérico' })
  idCategoria?: number | null;
}
