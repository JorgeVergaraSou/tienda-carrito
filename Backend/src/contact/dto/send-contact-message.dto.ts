import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { RecortarTexto } from '@/common/decorators/recortar-texto.decorator';
import {
  SinHtml,
  SinSaltosDeLinea,
} from '@/common/decorators/sin-html.decorator';

/** body de POST /contacto (público, sin login) — lo que manda un cliente
 * desde la página de contacto. */
export class SendContactMessageDto {
  @RecortarTexto()
  @IsString({ message: 'El nombre debe ser un texto válido' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede superar los 100 caracteres' })
  // va al asunto del mail: sin saltos de línea (inyección de cabeceras)
  @SinSaltosDeLinea()
  @SinHtml()
  nombre: string;

  // a diferencia de User.email (opcional, es solo para recuperación de
  // clave), acá es obligatorio: es el email al que el ADMIN le contesta
  // (se manda como replyTo del mail de notificación, ver
  // ContactService.enviarMensaje).
  @IsEmail({}, { message: 'Debe proporcionar un email válido' })
  @MaxLength(150, { message: 'El email no puede superar los 150 caracteres' })
  email: string;

  @RecortarTexto()
  @IsString({ message: 'El mensaje debe ser un texto válido' })
  @MinLength(10, { message: 'El mensaje debe tener al menos 10 caracteres' })
  @MaxLength(2000, {
    message: 'El mensaje no puede superar los 2000 caracteres',
  })
  mensaje: string;
}
