import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '@/users/users.service';
import { LoginDto } from './dto/login.dto';
import { UserActiveInterface } from '@/common/interfaces/user-active.interface';
import { RequestResetPasswordDto } from './dto/requestResetPassword.dto';
import { v4 as uuidv4 } from 'uuid';
import { UpdateUserDto } from '@/users/dto/update-user.dto';
import { AdminUpdateUserDto } from '@/users/dto/admin-update-user.dto';
import { ResetPasswordDto } from './dto/resetPassword.dto';
import { getTransporter } from '@/config/mailer';
import * as argon2 from 'argon2';
import { handleServiceError } from '@/common/utils/error-handler.util';
import { padToMinDuration } from '@/common/utils/timing-safe.util';
import { authErrorLogger } from '@/config/module-loggers';
import { insertLogger, selectLogger } from '@/config/db-loggers';
import { ProfileResponseDto } from './dto/responses/profile-response.dto';
import { UserListItemResponseDto } from './dto/responses/user-list-item-response.dto';

/** Tiempo de validez del token de recuperación de contraseña */
const RESET_PASSWORD_TOKEN_TTL_MINUTES = 10;

/** Piso de tiempo para login(), calibrado para cubrir un hash+verify de
 * argon2 con los parámetros default (~40-120ms) — así la rama
 * "nickUsuario no existe" no responde perceptiblemente más rápido que la
 * rama "contraseña incorrecta" o un login exitoso. No cierra el oráculo
 * contra un atacante que promedie muchísimas mediciones, pero saca la
 * señal obvia (respuesta instantánea vs. respuesta después de hashear). */
const LOGIN_MIN_DURATION_MS = 300;

/** Piso de tiempo para requestResetPassword(). La rama real hace una
 * escritura a la base y un envío real por SMTP, cuya latencia es variable
 * y no se puede empatar del todo con un delay fijo — esto reduce la señal
 * más obvia (respuesta instantánea si el nickUsuario no existe) pero no
 * elimina el oráculo por completo bajo mediciones estadísticas finas. */
const RESET_PASSWORD_REQUEST_MIN_DURATION_MS = 400;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  // auth.service.ts

  async registro({
    password,
    nickUsuario,
    email,
    nombre,
    apellido,
    role,
  }: RegisterDto): Promise<void> {
    // Verificar si el usuario ya existe (nickUsuario es el identificador de
    // login, obligatorio; email es opcional, solo se chequea si viene)
    const existeNick = await this.usersService.findOneByNick(nickUsuario);
    if (existeNick) {
      throw new HttpException(
        'El nombre de usuario ya existe',
        HttpStatus.CONFLICT,
      );
    }

    if (email) {
      const existeEmail = await this.usersService.findOneByEmail(email);
      if (existeEmail) {
        throw new HttpException('El email ya existe', HttpStatus.CONFLICT);
      }
    }

    try {
      const hashedPassword = await argon2.hash(password);

      const newUser = await this.usersService.nuevoUsuario({
        nickUsuario,
        nombre,
        apellido,
        role,
        email,
        password: hashedPassword,
      });

      if (!newUser) {
        throw new HttpException(
          'No se pudo crear el usuario',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // 👉 Registrar en archivo insert.log
      insertLogger.info(
        `Usuario creado: ${JSON.stringify({
          id: newUser.idUser,
          nickUsuario: newUser.nickUsuario,
          nombre: newUser.nombre,
          apellido: newUser.apellido,
          email: newUser.email,
          role: newUser.role,
        })}`,
      );
    } catch (error) {
      handleServiceError(
        error,
        authErrorLogger,
        'AuthService.registro',
        'Ocurrio un error al crear el usuario',
        { nickUsuario },
      );
    }
  }
  // --------------- REGISTER FIN ---------------

  /** ----------------- INICIO LOGIN ------------------- */
  async login({ nickUsuario, password }: LoginDto): Promise<{ token: string }> {
    const startedAt = Date.now();
    try {
      // Buscar usuario incluyendo el campo password
      const user = await this.usersService.findByNickWithPassword(nickUsuario);

      // mismo mensaje genérico tanto si el nickUsuario no existe como si la
      // contraseña es incorrecta — así la respuesta no revela qué nombres
      // de usuario están registrados en el sistema. El padToMinDuration del
      // finally empareja además el tiempo de respuesta entre las tres ramas
      // (ver LOGIN_MIN_DURATION_MS) — puesto en el finally (no en cada
      // return/throw) para que ninguna salida nueva pueda saltearlo por
      // error.
      if (!user) {
        selectLogger.warn(
          `Login fallido: nickUsuario no encontrado -> ${nickUsuario}`,
        );
        throw new UnauthorizedException('Usuario o contraseña inválidos');
      }

      // Verificar la contraseña
      const isPasswordValid = await argon2.verify(user.password, password);
      if (!isPasswordValid) {
        selectLogger.warn(
          `Login fallido: contraseña incorrecta para -> ${nickUsuario}`,
        );
        throw new UnauthorizedException('Usuario o contraseña inválidos');
      }
      selectLogger.info(
        `Login exitoso: ${JSON.stringify({ nickUsuario: user.nickUsuario })}`,
      );

      // Crear payload para el JWT (puedes incluir la información necesaria)
      const payload = {
        idUser: user.idUser,
        nickUsuario: user.nickUsuario,
        role: user.role,
        name: user.nombre,
      };

      // Generar el token
      const token = await this.jwtService.signAsync(payload);

      return { token };
    } catch (error) {
      handleServiceError(
        error,
        authErrorLogger,
        'AuthService.login',
        'Ocurrió un error al realizar el login',
        { nickUsuario },
      );
    } finally {
      await padToMinDuration(startedAt, LOGIN_MIN_DURATION_MS);
    }
  }
  /** ===================== FIN LOGIN ===================== */

  /** INICIO RECUPERAR CLAVE */

  /**
   * Pide nickUsuario + email juntos (no solo email) para evitar que
   * cualquiera que reciba un token válido a su propio email pueda
   * aplicarlo sobre el nick de otra persona. Si el usuario todavía no
   * tiene email asociado, éste queda guardado en su perfil (debe ser
   * único). Si ya tiene uno, se ignora el que llega acá y el token
   * siempre se manda al email ya guardado.
   */
  async requestResetPassword(dto: RequestResetPasswordDto): Promise<void> {
    const { nickUsuario, email } = dto;
    const startedAt = Date.now();

    try {
      const user = await this.usersService.findOneByNick(nickUsuario);

      // si el usuario no existe, se responde igual que un pedido exitoso
      // (sin mandar nada) — no distinguir este caso evita que la respuesta
      // revele qué nombres de usuario existen en el sistema. El
      // padToMinDuration del finally empareja además el tiempo de
      // respuesta de esta rama con el de un pedido real (ver
      // RESET_PASSWORD_REQUEST_MIN_DURATION_MS) — puesto en el finally (no
      // en cada return/throw individual) para que también cubra los
      // errores de negocio que se lanzan más abajo una vez que el usuario
      // ya existe (email en uso, fallo al asociar email, fallo al generar
      // el token) y no queden respondiendo casi al instante. No elimina
      // del todo el oráculo (la rama real manda un mail real por SMTP, de
      // latencia variable) pero saca la señal más obvia.
      if (!user) {
        return;
      }

      let destinationEmail = user.email;

      if (!destinationEmail) {
        const emailEnUso = await this.usersService.findOneByEmail(email);

        if (emailEnUso) {
          throw new BadRequestException(
            'Ese email ya está asociado a otro usuario',
          );
        }

        const { success: emailAsociado } = await this.usersService.setEmail(
          user.idUser,
          email,
        );

        if (!emailAsociado) {
          throw new BadRequestException('Hubo un error al asociar el email');
        }

        destinationEmail = email;
      }

      const resetPasswordToken = uuidv4();
      const expiresAt = new Date(
        Date.now() + RESET_PASSWORD_TOKEN_TTL_MINUTES * 60 * 1000,
      );

      const { success } = await this.usersService.updateTokenResetPassword(
        user.idUser,
        resetPasswordToken,
        expiresAt,
      );
      if (!success) {
        throw new BadRequestException(
          'No se pudo generar el token de recuperación.',
        );
      }

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      // nombre del remitente configurable por proyecto — cada app hija de
      // esta base puede setear MAIL_FROM_NAME en su propio .env en vez de
      // tener que tocar código para cambiar el nombre que ve el usuario.
      const fromName = process.env.MAIL_FROM_NAME || 'Soporte';

      await getTransporter().sendMail({
        from: `"${fromName}" <${process.env.MAIL_USER}>`,
        to: destinationEmail,
        subject: 'Recuperación de contraseña',
        html: `
          <b>¿Te olvidaste la clave? Hacé clic en el siguiente enlace:</b><br />
          <a href="${frontendUrl}/reset-password?token=${resetPasswordToken}">Recuperar contraseña</a>
        `,
      });
    } catch (error) {
      handleServiceError(
        error,
        authErrorLogger,
        'AuthService.requestResetPassword',
        'Ocurrió un error al procesar la solicitud de reseteo de clave',
        { nickUsuario },
      );
    } finally {
      await padToMinDuration(startedAt, RESET_PASSWORD_REQUEST_MIN_DURATION_MS);
    }
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const { resetPasswordToken, password } = dto;

    try {
      const user =
        await this.usersService.findOneByResetPasswordToken(resetPasswordToken);

      if (
        !user ||
        !user.resetPasswordTokenExpiresAt ||
        user.resetPasswordTokenExpiresAt < new Date()
      ) {
        throw new BadRequestException('Token inválido o expirado');
      }

      const hashedPassword = await argon2.hash(password);

      const { success } = await this.usersService.updatePasswordByResetToken(
        user.idUser,
        hashedPassword,
      );

      if (!success) {
        throw new BadRequestException('No se pudo actualizar la contraseña');
      }
    } catch (error) {
      handleServiceError(
        error,
        authErrorLogger,
        'AuthService.resetPassword',
        'Error al actualizar la contraseña',
        { resetPasswordToken },
      );
    }
  }

  /** FIN  RECUPERAR CLAVE*/

  /** INICIO UPDATE USER */
  async updateUser(id: number, updateUserDto: UpdateUserDto): Promise<void> {
    try {
      await this.usersService.updateUser(id, updateUserDto);
    } catch (error) {
      handleServiceError(
        error,
        authErrorLogger,
        'AuthService.updateUser',
        'Error al actualizar el usuario',
        { id },
      );
    }
  }

  /** actualiza la foto de perfil del usuario autenticado (autoservicio) */
  async actualizarFoto(
    idUser: number,
    file: Express.Multer.File,
  ): Promise<void> {
    try {
      if (!file) {
        throw new BadRequestException('Debe adjuntar una imagen');
      }

      await this.usersService.actualizarFoto(idUser, file.filename);
    } catch (error) {
      handleServiceError(
        error,
        authErrorLogger,
        'AuthService.actualizarFoto',
        'Error al actualizar la foto de perfil',
        { idUser },
      );
    }
  }

  async findAll(): Promise<UserListItemResponseDto[]> {
    try {
      const usersArray = await this.usersService.findAllUsers();

      return usersArray.map((user) => ({
        idUser: user.idUser,
        nickUsuario: user.nickUsuario,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        role: user.role,
        deletedAt: user.deletedAt,
      }));
    } catch (error) {
      handleServiceError(
        error,
        authErrorLogger,
        'AuthService.findAll',
        'Ocurrió un error al buscar los Usuarios',
      );
    }
  }

  async profile(user: UserActiveInterface): Promise<ProfileResponseDto> {
    try {
      // Buscamos el perfil según el nickUsuario del usuario activo (viene
      // del JWT) — nunca por un :id de la URL, así nadie puede pedir el
      // perfil de otro cambiando un parámetro.
      const profile = await this.usersService.findOneByNick(user.nickUsuario);
      if (!profile) {
        throw new NotFoundException('No existe perfil');
      }

      return {
        idUser: profile.idUser,
        nickUsuario: profile.nickUsuario,
        nombre: profile.nombre,
        apellido: profile.apellido,
        email: profile.email,
        role: profile.role,
        fotoUrl: profile.imageFile
          ? `/uploads/avatars/${profile.imageFile}`
          : null,
      };
    } catch (error) {
      handleServiceError(
        error,
        authErrorLogger,
        'AuthService.profile',
        'Ocurrió un error al obtener el perfil',
        { nickUsuario: user.nickUsuario },
      );
    }
  }

  async deleteUser(id: number): Promise<void> {
    try {
      await this.usersService.darDeBajaUsuario(id);
    } catch (error) {
      handleServiceError(
        error,
        authErrorLogger,
        'AuthService.deleteUser',
        'Ocurrió un error al desactivar el usuario',
        { id },
      );
    }
  }

  async activarUsuario(id: number): Promise<void> {
    try {
      await this.usersService.activarUsuario(id);
    } catch (error) {
      handleServiceError(
        error,
        authErrorLogger,
        'AuthService.activarUsuario',
        'Ocurrió un error al activar el usuario',
        { id },
      );
    }
  }

  /** ADMIN edita a cualquier usuario — ver
   * UsersService.actualizarUsuarioAdmin, distinto de updateUser
   * (autoservicio, más arriba). */
  async editarUsuarioAdmin(id: number, dto: AdminUpdateUserDto): Promise<void> {
    try {
      await this.usersService.actualizarUsuarioAdmin(id, dto);
    } catch (error) {
      handleServiceError(
        error,
        authErrorLogger,
        'AuthService.editarUsuarioAdmin',
        'Ocurrió un error al actualizar el usuario',
        { id },
      );
    }
  }
}
