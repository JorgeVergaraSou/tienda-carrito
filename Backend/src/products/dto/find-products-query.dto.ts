import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** Query params de GET /productos (catálogo público) y GET
 * /productos/admin/listado. El ValidationPipe global tiene
 * whitelist+forbidNonWhitelisted+transform, así que cualquier query param
 * no declarado acá se rechaza (no se descarta en silencio), y page/limit
 * llegan como string desde la URL — @Type(() => Number) los convierte. */
export class FindProductsQueryDto {
  @IsOptional()
  @IsString({ message: 'La búsqueda debe ser un texto válido' })
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La categoría debe ser un id numérico' })
  categoriaId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página mínima es 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite mínimo es 1' })
  @Max(50, { message: 'El límite máximo es 50' })
  limit?: number = 12;
}
