import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { RecortarTexto } from '@/common/decorators/recortar-texto.decorator';
import { SinHtml } from '@/common/decorators/sin-html.decorator';
import { CreateOrderItemDto } from './create-order-item.dto';

/** Máximo de renglones distintos por pedido — sin tope, un POST público
 * con miles de items dispara miles de consultas a la base (una por item). */
export const MAX_ITEMS_POR_PEDIDO = 50;

/** body de POST /ordenes (público, checkout como invitado — sin login, ver
 * Backend/CLAUDE.md). Los datos de contacto reemplazan a una cuenta de
 * usuario: no hay relación a UserEntity, el pedido se identifica solo por
 * esto. Los @MaxLength coinciden con el largo de cada columna de
 * OrderEntity: sin ellos el modo estricto de MySQL da un 500 al pasarse. */
export class CreateOrderDto {
  @RecortarTexto()
  @IsString({ message: 'El nombre debe ser un texto válido' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(120, { message: 'El nombre no puede superar los 120 caracteres' })
  @SinHtml()
  nombreContacto: string;

  @RecortarTexto()
  @IsEmail({}, { message: 'Debe proporcionar un email válido' })
  @MaxLength(150, { message: 'El email no puede superar los 150 caracteres' })
  email: string;

  @RecortarTexto()
  @IsString({ message: 'El teléfono debe ser un texto válido' })
  @MinLength(6, { message: 'El teléfono no es válido' })
  @MaxLength(40, { message: 'El teléfono no puede superar los 40 caracteres' })
  @SinHtml()
  telefono: string;

  /** libre — ej. horario de retiro. No hay dirección de envío formal, ver
   * OrderEntity. Texto libre: acá NO se rechaza `<`/`>` (son texto
   * legítimo), se escapa al mostrarlo. */
  @IsOptional()
  @RecortarTexto()
  @IsString({ message: 'Las notas deben ser un texto válido' })
  @MaxLength(500, { message: 'Las notas no pueden superar los 500 caracteres' })
  notas?: string;

  @IsArray({ message: 'items debe ser un array' })
  @ArrayMinSize(1, { message: 'El pedido debe tener al menos un producto' })
  @ArrayMaxSize(MAX_ITEMS_POR_PEDIDO, {
    message: `El pedido no puede tener más de ${MAX_ITEMS_POR_PEDIDO} productos distintos`,
  })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
