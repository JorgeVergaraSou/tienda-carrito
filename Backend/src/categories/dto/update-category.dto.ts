import { Transform } from 'class-transformer';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString({ message: 'El nombre debe ser un texto válido' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  nombre?: string;
}
