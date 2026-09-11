import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/** body de POST /contacto (público, sin login) — lo que manda un cliente
 * desde la página de contacto. */
export class SendContactMessageDto {
  @Transform(({ value }) => value?.trim())
  @IsString({ message: 'El nombre debe ser un texto válido' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede superar los 100 caracteres' })
  nombre: string;

  // a diferencia de User.email (opcional, es solo para recuperación de
  // clave), acá es obligatorio: es el email al que el ADMIN le contesta
  // (se manda como replyTo del mail de notificación, ver
  // ContactService.enviarMensaje).
  @IsEmail({}, { message: 'Debe proporcionar un email válido' })
  email: string;

  @Transform(({ value }) => value?.trim())
  @IsString({ message: 'El mensaje debe ser un texto válido' })
  @MinLength(10, { message: 'El mensaje debe tener al menos 10 caracteres' })
  @MaxLength(2000, {
    message: 'El mensaje no puede superar los 2000 caracteres',
  })
  mensaje: string;
}
