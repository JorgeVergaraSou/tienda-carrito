import { IsString, MinLength, IsEmail, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { IsPassword } from '@/common/decorators/is-password.decorator';
import { IsNickUsuario } from '@/common/decorators/is-nick-usuario.decorator';

export class UpdateUserDto {
  @IsOptional()
  @IsNickUsuario()
  nickUsuario?: string;

  @IsOptional()
  @Transform(({ value }) => value.trim())
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres.' })
  nombre?: string;

  @IsOptional()
  @Transform(({ value }) => value.trim())
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres.' })
  apellido?: string;

  @IsOptional()
  @IsEmail(
    {},
    {
      message: 'El email debe ser una dirección de correo electrónico válida.',
    },
  )
  email?: string;

  @IsOptional()
  @IsPassword()
  password?: string;

  @IsOptional()
  @IsString({ message: 'La contraseña actual debe ser una cadena de texto.' })
  currentPassword?: string;
}
