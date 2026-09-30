import {
  IsString,
  MinLength,
  MaxLength,
  IsEmail,
  IsOptional,
} from 'class-validator';
import { RecortarTexto } from '@/common/decorators/recortar-texto.decorator';
import { SinHtml } from '@/common/decorators/sin-html.decorator';
import { IsPassword } from '@/common/decorators/is-password.decorator';
import { IsNickUsuario } from '@/common/decorators/is-nick-usuario.decorator';

export class UpdateUserDto {
  @IsOptional()
  @IsNickUsuario()
  nickUsuario?: string;

  @IsOptional()
  @RecortarTexto()
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres.' })
  @MaxLength(60, { message: 'El nombre no puede superar los 60 caracteres.' })
  @SinHtml()
  nombre?: string;

  @IsOptional()
  @RecortarTexto()
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres.' })
  @MaxLength(60, { message: 'El apellido no puede superar los 60 caracteres.' })
  @SinHtml()
  apellido?: string;

  @IsOptional()
  @IsEmail(
    {},
    {
      message: 'El email debe ser una dirección de correo electrónico válida.',
    },
  )
  @MaxLength(255, { message: 'El email no puede superar los 255 caracteres.' })
  email?: string;

  @IsOptional()
  @IsPassword()
  password?: string;

  @IsOptional()
  @IsString({ message: 'La contraseña actual debe ser una cadena de texto.' })
  @MaxLength(128, { message: 'La contraseña actual no es válida.' })
  currentPassword?: string;
}
