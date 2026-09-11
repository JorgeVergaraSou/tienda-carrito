import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CreateOrderItemDto } from './create-order-item.dto';

/** body de POST /ordenes (público, checkout como invitado — sin login, ver
 * Backend/CLAUDE.md). Los datos de contacto reemplazan a una cuenta de
 * usuario: no hay relación a UserEntity, el pedido se identifica solo por
 * esto. */
export class CreateOrderDto {
  @Transform(({ value }) => value?.trim())
  @IsString({ message: 'El nombre debe ser un texto válido' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(120, { message: 'El nombre no puede superar los 120 caracteres' })
  nombreContacto: string;

  @Transform(({ value }) => value?.trim())
  @IsEmail({}, { message: 'Debe proporcionar un email válido' })
  email: string;

  @Transform(({ value }) => value?.trim())
  @IsString({ message: 'El teléfono debe ser un texto válido' })
  @MinLength(6, { message: 'El teléfono no es válido' })
  @MaxLength(40, { message: 'El teléfono no puede superar los 40 caracteres' })
  telefono: string;

  /** libre — ej. horario de retiro. No hay dirección de envío formal, ver
   * OrderEntity. */
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString({ message: 'Las notas deben ser un texto válido' })
  @MaxLength(500, { message: 'Las notas no pueden superar los 500 caracteres' })
  notas?: string;

  @IsArray({ message: 'items debe ser un array' })
  @ArrayMinSize(1, { message: 'El pedido debe tener al menos un producto' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
