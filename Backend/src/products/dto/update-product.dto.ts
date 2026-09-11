import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString({ message: 'El nombre debe ser un texto válido' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  nombre?: string;

  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString({ message: 'La descripción debe ser un texto válido' })
  descripcion?: string;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El precio debe ser un número con hasta 2 decimales' },
  )
  @Min(0, { message: 'El precio no puede ser negativo' })
  precio?: number;

  @IsOptional()
  @IsInt({ message: 'El stock debe ser un número entero' })
  @Min(0, { message: 'El stock no puede ser negativo' })
  stock?: number;

  /** ver el mismo campo en CreateProductDto. Este PATCH sigue siendo
   * ADMIN-only (ver ProductsController) — para que un USER pueda tocar
   * solo este campo en un producto propio existe el endpoint dedicado
   * PATCH /:id/visibilidad-stock (ver UpdateStockVisibilityDto). */
  @IsOptional()
  @IsBoolean({ message: 'mostrarStock debe ser un valor booleano' })
  mostrarStock?: boolean;

  /** ver el mismo campo en CreateProductDto */
  @IsOptional()
  @IsInt({ message: 'La categoría debe ser un id numérico' })
  idCategoria?: number | null;
}
