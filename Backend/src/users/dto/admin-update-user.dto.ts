import { RecortarTexto } from '@/common/decorators/recortar-texto.decorator';
import { SinHtml } from '@/common/decorators/sin-html.decorator';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '@/common/enums/role.enum';
import { IsPassword } from '@/common/decorators/is-password.decorator';
import { IsNickUsuario } from '@/common/decorators/is-nick-usuario.decorator';

/** body de PATCH /auth/editar-usuario/:id — a diferencia de UpdateUserDto
 * (autoservicio, solo tu propia cuenta, exige `currentPassword`), este es
 * para que un ADMIN edite CUALQUIER usuario: no pide contraseña actual
 * (el ADMIN no la conoce, ni tiene por qué) y además permite cambiar
 * `role` y setear una `password` nueva directamente — pensado para
 * recuperar el acceso de un usuario que perdió su contraseña. Ver
 * UsersService.actualizarUsuarioAdmin. */
export class AdminUpdateUserDto {
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
  @IsString({ message: 'El apellido debe ser una cadena de texto.' })
  @MinLength(3, { message: 'El apellido debe tener al menos 3 caracteres.' })
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
  @IsEnum(Role, { message: 'Rol inválido' })
  role?: Role;

  @IsOptional()
  @IsPassword()
  password?: string;
}
