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

/** Topes que salen de las columnas de ProductEntity: `precio` es
 * DECIMAL(10,2) (máximo 99.999.999,99) y `stock` INT UNSIGNED. Sin estos
 * límites, un valor fuera de rango llega a MySQL en modo estricto y sale
 * como un 500 con el texto del error SQL. Compartidos con UpdateProductDto. */
export const PRECIO_MAX = 99999999.99;
export const STOCK_MAX = 9999999;
export const NOMBRE_PRODUCTO_MAX = 120;
export const DESCRIPCION_PRODUCTO_MAX = 5000;

export class CreateProductDto {
  @RecortarTexto()
  @IsString({ message: 'El nombre debe ser un texto válido' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(NOMBRE_PRODUCTO_MAX, {
    message: `El nombre no puede superar los ${NOMBRE_PRODUCTO_MAX} caracteres`,
  })
  @SinHtml()
  nombre: string;

  @IsOptional()
  @RecortarTexto()
  @IsString({ message: 'La descripción debe ser un texto válido' })
  @MaxLength(DESCRIPCION_PRODUCTO_MAX, {
    message: `La descripción no puede superar los ${DESCRIPCION_PRODUCTO_MAX} caracteres`,
  })
  descripcion?: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El precio debe ser un número con hasta 2 decimales' },
  )
  @Min(0, { message: 'El precio no puede ser negativo' })
  @Max(PRECIO_MAX, { message: 'El precio es demasiado alto' })
  precio: number;

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
