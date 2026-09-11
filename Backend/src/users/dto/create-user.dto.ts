import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '@/common/enums/role.enum';
import { IsPassword } from '@/common/decorators/is-password.decorator';
import { IsNickUsuario } from '@/common/decorators/is-nick-usuario.decorator';

export class CreateUserDto {
  @IsNickUsuario()
  nickUsuario: string;

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

  @IsEnum(Role, { message: 'Rol inválido' })
  role: Role;

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
}
