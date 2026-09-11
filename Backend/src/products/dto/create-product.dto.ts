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

export class CreateProductDto {
  @Transform(({ value }) => value?.trim())
  @IsString({ message: 'El nombre debe ser un texto válido' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  nombre: string;

  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString({ message: 'La descripción debe ser un texto válido' })
  descripcion?: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El precio debe ser un número con hasta 2 decimales' },
  )
  @Min(0, { message: 'El precio no puede ser negativo' })
  precio: number;

  @IsOptional()
  @IsInt({ message: 'El stock debe ser un número entero' })
  @Min(0, { message: 'El stock no puede ser negativo' })
  stock?: number;

  /** si se omite, la columna aplica su default (true — ver
   * ProductEntity.mostrarStock): controla si el número de stock se
   * muestra a los clientes en el catálogo público. */
  @IsOptional()
  @IsBoolean({ message: 'mostrarStock debe ser un valor booleano' })
  mostrarStock?: boolean;

  /** id de una categoría existente (ver CategoriesModule) — null/omitido
   * significa "sin categoría". @IsOptional() de class-validator ya trata
   * null igual que undefined (salta las demás validaciones), así que
   * alcanza con esto para aceptar ambos casos. Se valida además que el id
   * exista de verdad contra la tabla en ProductsService — no alcanza con
   * que sea un número cualquiera. */
  @IsOptional()
  @IsInt({ message: 'La categoría debe ser un id numérico' })
  idCategoria?: number | null;
}
