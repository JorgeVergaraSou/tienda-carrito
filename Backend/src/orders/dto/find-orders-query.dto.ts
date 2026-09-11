import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { OrderStatus } from '@/common/enums/order-status.enum';

/** Query params de GET /ordenes/admin/listado — mismo patrón que
 * FindProductsQueryDto (whitelist+forbidNonWhitelisted+transform global,
 * page/limit llegan como string desde la URL). `search` solo busca por
 * `nombreContacto` (no también por email) — mismo criterio de simpleza que
 * el resto de este panel v1, ver Backend/CLAUDE.md. */
export class FindOrdersQueryDto {
  @IsOptional()
  @IsString({ message: 'La búsqueda debe ser un texto válido' })
  search?: string;

  @IsOptional()
  @IsEnum(OrderStatus, { message: 'El estado no es válido' })
  estado?: OrderStatus;

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
  limit?: number = 20;
}
