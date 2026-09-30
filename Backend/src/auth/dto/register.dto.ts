import { RecortarTexto } from '@/common/decorators/recortar-texto.decorator';
import { SinHtml } from '@/common/decorators/sin-html.decorator';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Role } from '@/common/enums/role.enum';
import { IsPassword } from '@/common/decorators/is-password.decorator';
import { IsNickUsuario } from '@/common/decorators/is-nick-usuario.decorator';

export class RegisterDto {
  /** CLASS VALIDATOR INDICA COMO DEBE COMPORTARSE LA VARIABLE Y LO QUE DEBE RECIBIR */
  /** EL TRANSFORM RECIVE UNA FUNCION DE CALLBACK RECIVE EL VALOR Y LO REGRESA SIN ESPACIOS */

  @IsNickUsuario()
  nickUsuario: string;

  @RecortarTexto()
  @IsString({ message: 'El NOMBRE debe ser un texto válido' })
  // coincide con UserEntity.nombre (varchar(60))
  @MaxLength(60, { message: 'El NOMBRE no puede superar los 60 caracteres' })
  @SinHtml()
  //@MinLength(5, { message: 'El nombre debe tener al menos 5 caracteres' })
  nombre: string;

  @RecortarTexto()
  @IsString({ message: 'El APELLIDO debe ser un texto válido' })
  // coincide con UserEntity.apellido (varchar(60))
  @MaxLength(60, { message: 'El APELLIDO no puede superar los 60 caracteres' })
  @SinHtml()
  //@MinLength(5, { message: 'El nombre debe tener al menos 5 caracteres' })
  apellido: string;

  // Opcional: el email ya no es el identificador de login (lo es
  // nickUsuario) — sirve solo como destino del mail de recuperación de
  // clave, y puede asociarse más adelante si no se carga acá (ver
  // AuthService.requestResetPassword).
  @IsOptional()
  @IsEmail({}, { message: 'Debe proporcionar un correo electrónico válido' })
  @MaxLength(255, { message: 'El email no puede superar los 255 caracteres' })
  email?: string;

  @IsEnum(Role, { message: 'Rol inválido' })
  role: Role;

  @IsPassword()
  password: string;
}
/* ESTE DTO SIRVE PARA ESTANDARIZAR LA INFO Y PODER REGISTRAR UN NUEVO USUARIO */
