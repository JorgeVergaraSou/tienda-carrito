import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { RecortarTexto } from '@/common/decorators/recortar-texto.decorator';
import { SinHtml } from '@/common/decorators/sin-html.decorator';

export class UpdateCategoryDto {
  @IsOptional()
  @RecortarTexto()
  @IsString({ message: 'El nombre debe ser un texto válido' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  // coincide con CategoryEntity.nombre (varchar(60))
  @MaxLength(60, { message: 'El nombre no puede superar los 60 caracteres' })
  @SinHtml()
  nombre?: string;
}
