import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';
import * as argon2 from 'argon2';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { handleServiceError } from '@/common/utils/error-handler.util';
import { usersErrorLogger } from '@/config/module-loggers';
import { updateLogger, deleteLogger } from '@/config/db-loggers';
import { Role } from '@/common/enums/role.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async nuevoUsuario(createUserDto: CreateUserDto) {
    try {
      return await this.userRepository.save(createUserDto);
    } catch (error) {
      handleServiceError(
        error,
        usersErrorLogger,
        'UsersService.nuevoUsuario',
        'Error al crear el Usuario',
      );
    }
  }

  /** usado por AppService.seedInitialAdmin al bootear: como crear usuarios
   * requiere ser ADMIN, hace falta poder chequear si ya existe alguno antes
   * de decidir si hay que sembrar el primero. withDeleted:true para no
   * volver a sembrar si el único ADMIN existente fue dado de baja. */
  async existsAdmin(): Promise<boolean> {
    try {
      return await this.userRepository.exists({
        where: { role: Role.ADMIN },
        withDeleted: true,
      });
    } catch (error) {
      handleServiceError(
        error,
        usersErrorLogger,
        'UsersService.existsAdmin',
        'Error al verificar si existe un administrador',
      );
    }
  }

  /** reemplaza la foto de perfil del usuario (autoservicio, ver
   * AuthController POST /auth/foto). Si ya tenía una foto anterior, la
   * borra del disco para no dejar archivos huérfanos en uploads/avatars. */
  async actualizarFoto(id: number, nombreArchivo: string): Promise<void> {
    try {
      const user = await this.userRepository.findOneBy({ idUser: id });

      if (!user) {
        throw new NotFoundException('Usuario no encontrado');
      }

      if (user.imageFile) {
        const rutaAnterior = join(
          process.cwd(),
          'uploads',
          'avatars',
          user.imageFile,
        );

        if (existsSync(rutaAnterior)) {
          unlinkSync(rutaAnterior);
        }
      }

      await this.userRepository.update(id, { imageFile: nombreArchivo });
    } catch (error) {
      handleServiceError(
        error,
        usersErrorLogger,
        'UsersService.actualizarFoto',
        'Error al actualizar la foto de perfil',
        { id },
      );
    }
  }

  /* lo que hace es buscar un usuario por mail y saber si existe */
  async findOneByEmail(email: string): Promise<UserEntity | null> {
    try {
      return await this.userRepository.findOneBy({ email });
    } catch (error) {
      handleServiceError(
        error,
        usersErrorLogger,
        'UsersService.findOneByEmail',
        'Error al buscar el usuario',
        { email },
      );
    }
  }

  async findOneByNick(nickUsuario: string): Promise<UserEntity | null> {
    try {
      return await this.userRepository.findOneBy({ nickUsuario });
    } catch (error) {
      handleServiceError(
        error,
        usersErrorLogger,
        'UsersService.findOneByNick',
        'Error al buscar el usuario',
        { nickUsuario },
      );
    }
  }

  async findOneById(idUser: number): Promise<UserEntity | null> {
    try {
      return await this.userRepository.findOneBy({ idUser });
    } catch (error) {
      handleServiceError(
        error,
        usersErrorLogger,
        'UsersService.findOneById',
        'Error al buscar el usuario',
        { idUser },
      );
    }
  }

  async findOneByResetPasswordToken(
    resetPasswordToken: string,
  ): Promise<UserEntity | null> {
    try {
      return await this.userRepository.findOneBy({ resetPasswordToken });
    } catch (error) {
      handleServiceError(
        error,
        usersErrorLogger,
        'UsersService.findOneByResetPasswordToken',
        'Error al buscar el usuario',
      );
    }
  }

  /** usado por el login: nickUsuario reemplazó a email como identificador
   * de acceso. Debido al select:false de la entidad, hace falta pedir el
   * password explícitamente acá. */
  async findByNickWithPassword(
    nickUsuario: string,
  ): Promise<UserEntity | null> {
    try {
      return await this.userRepository.findOne({
        where: { nickUsuario },
        select: [
          'idUser',
          'nickUsuario',
          'nombre',
          'email',
          'role',
          'password',
        ],
      });
    } catch (error) {
      handleServiceError(
        error,
        usersErrorLogger,
        'UsersService.findByNickWithPassword',
        'Error al buscar el usuario',
        { nickUsuario },
      );
    }
  }

  async findByIdWithPassword(id: number): Promise<UserEntity | null> {
    try {
      return await this.userRepository.findOne({
        where: { idUser: id },
        select: [
          'idUser',
          'nickUsuario',
          'nombre',
          'email',
          'role',
          'password',
        ],
      });
    } catch (error) {
      handleServiceError(
        error,
        usersErrorLogger,
        'UsersService.findByIdWithPassword',
        'Error al buscar el usuario',
        { id },
      );
    }
  }

  async findAllUsers(): Promise<UserEntity[]> {
    try {
      return await this.userRepository.find({
        withDeleted: true,
        order: { nombre: 'ASC' },
      });
    } catch (error) {
      handleServiceError(
        error,
        usersErrorLogger,
        'UsersService.findAllUsers',
        'Ocurrió un error al buscar los Usuarios',
      );
    }
  }

  async updateUser(id: number, updateUserDto: UpdateUserDto): Promise<void> {
    try {
      const fieldsUpdated: string[] = [];

      const userData = await this.findByIdWithPassword(id);

      if (!userData) {
        throw new NotFoundException('Usuario no encontrado');
      }

      if (updateUserDto.currentPassword === undefined) {
        throw new BadRequestException('Debes ingresar tu password actual');
      }

      // Verificar la contraseña actual con argon2
      const isPasswordValid = await argon2.verify(
        userData.password,
        updateUserDto.currentPassword,
      );

      if (!isPasswordValid) {
        throw new BadRequestException('Password incorrecto');
      }

      const { currentPassword, ...updateData } = updateUserDto;

      if (
        updateUserDto.nickUsuario &&
        updateUserDto.nickUsuario !== userData.nickUsuario
      ) {
        const existeNick = await this.findOneByNick(updateUserDto.nickUsuario);

        if (existeNick) {
          throw new BadRequestException('El nombre de usuario ya está en uso');
        }

        fieldsUpdated.push('nickUsuario');
      }

      // Verificar siempre que se intenta actualizar el email
      if (updateUserDto.email && updateUserDto.email !== userData.email) {
        const existeEmail = await this.findOneByEmail(updateUserDto.email);

        if (existeEmail) {
          throw new BadRequestException('Ya se encuentra en uso este E-mail');
        }

        fieldsUpdated.push('email');
      }

      if (updateUserDto.nombre && updateUserDto.nombre !== userData.nombre) {
        fieldsUpdated.push('nombre');
      }

      if (updateUserDto.password) {
        const samePassword = await argon2.verify(
          userData.password,
          updateUserDto.password,
        );

        if (samePassword) {
          throw new BadRequestException(
            'Tu nueva clave no puede ser igual a la anterior',
          );
        }

        updateData.password = await argon2.hash(updateUserDto.password);
        fieldsUpdated.push('password');
      }

      if (fieldsUpdated.length === 0) {
        return;
      }

      await this.userRepository.update(id, updateData);

      // 👉 solo se loguean los nombres de los campos tocados, nunca sus
      // valores (podría incluir password) — alcanza para auditar "qué"
      // cambió sin dejar datos sensibles en texto plano en logs/updates-*.txt.
      updateLogger.info(
        `Usuario actualizado (ID ${id}): campos ${JSON.stringify(fieldsUpdated)}`,
      );
    } catch (error) {
      handleServiceError(
        error,
        usersErrorLogger,
        'UsersService.updateUser',
        'Ocurrió un error al actualizar el usuario',
        { id },
      );
    }
  }

  /** ADMIN edita a CUALQUIER usuario — a diferencia de updateUser
   * (autoservicio, solo tu propia cuenta, exige `currentPassword`), acá no
   * hace falta la contraseña actual del usuario editado (el ADMIN no la
   * conoce). Permite además cambiar `role` y setear una `password` nueva
   * directamente (recuperación de cuenta). Bloquea sacarle el rol ADMIN al
   * único administrador activo que queda — ver esUnicoAdminActivo. */
  async actualizarUsuarioAdmin(
    id: number,
    dto: AdminUpdateUserDto,
  ): Promise<void> {
    try {
      const fieldsUpdated: string[] = [];
      const userData = await this.getUserWithDeleted(id); // lanza NotFoundException si no existe

      const updateData: Partial<UserEntity> = {};

      if (dto.nickUsuario && dto.nickUsuario !== userData.nickUsuario) {
        const existeNick = await this.findOneByNick(dto.nickUsuario);

        if (existeNick) {
          throw new BadRequestException('El nombre de usuario ya está en uso');
        }

        updateData.nickUsuario = dto.nickUsuario;
        fieldsUpdated.push('nickUsuario');
      }

      if (dto.email && dto.email !== userData.email) {
        const existeEmail = await this.findOneByEmail(dto.email);

        if (existeEmail) {
          throw new BadRequestException('Ya se encuentra en uso este E-mail');
        }

        updateData.email = dto.email;
        fieldsUpdated.push('email');
      }

      if (dto.nombre && dto.nombre !== userData.nombre) {
        updateData.nombre = dto.nombre;
        fieldsUpdated.push('nombre');
      }

      if (dto.apellido && dto.apellido !== userData.apellido) {
        updateData.apellido = dto.apellido;
        fieldsUpdated.push('apellido');
      }

      if (dto.role && dto.role !== userData.role) {
        if (userData.role === Role.ADMIN && (await this.esUnicoAdminActivo())) {
          throw new BadRequestException(
            'No podés quitarle el rol de administrador al único administrador activo',
          );
        }

        updateData.role = dto.role;
        fieldsUpdated.push('role');
      }

      if (dto.password) {
        updateData.password = await argon2.hash(dto.password);
        fieldsUpdated.push('password');
      }

      if (fieldsUpdated.length === 0) {
        return;
      }

      await this.userRepository.update(id, updateData);

      // igual que en updateUser: solo se loguean los nombres de los campos
      // tocados, nunca sus valores.
      updateLogger.info(
        `Usuario actualizado por ADMIN (ID ${id}): campos ${JSON.stringify(fieldsUpdated)}`,
      );
    } catch (error) {
      handleServiceError(
        error,
        usersErrorLogger,
        'UsersService.actualizarUsuarioAdmin',
        'Ocurrió un error al actualizar el usuario',
        { id },
      );
    }
  }

  /** asocia un email al usuario. Se usa la primera vez que pide recuperar
   * su clave y todavía no tiene email guardado (ver
   * AuthService.requestResetPassword). */
  async setEmail(id: number, email: string): Promise<{ success: boolean }> {
    try {
      const result = await this.userRepository.update(id, { email });
      const success = !!(result.affected && result.affected > 0);

      if (success) {
        updateLogger.info(`Email asociado (ID ${id}): ${email}`);
      }

      return { success };
    } catch (error) {
      handleServiceError(
        error,
        usersErrorLogger,
        'UsersService.setEmail',
        'Error al asociar el email',
        { id },
      );
    }
  }

  async updateTokenResetPassword(
    id: number,
    token: string,
    expiresAt: Date,
  ): Promise<{ success: boolean }> {
    try {
      const result = await this.userRepository.update(id, {
        resetPasswordToken: token,
        resetPasswordTokenExpiresAt: expiresAt,
      });
      const success = !!(result.affected && result.affected > 0);

      // el token en sí nunca se loguea (es equivalente a una password
      // temporal) — solo que se generó uno y cuándo expira.
      if (success) {
        updateLogger.info(
          `Token de reset generado (ID ${id}), expira ${expiresAt.toISOString()}`,
        );
      }

      return { success };
    } catch (error) {
      handleServiceError(
        error,
        usersErrorLogger,
        'UsersService.updateTokenResetPassword',
        'No se pudo generar el token de recuperación',
        { id },
      );
    }
  }

  async updatePasswordByResetToken(
    id: number,
    hashedPassword: string,
  ): Promise<{ success: boolean }> {
    try {
      const result = await this.userRepository.update(id, {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordTokenExpiresAt: null,
      });
      const success = !!(result.affected && result.affected > 0);

      if (success) {
        updateLogger.info(`Password actualizada vía reset (ID ${id})`);
      }

      return { success };
    } catch (error) {
      handleServiceError(
        error,
        usersErrorLogger,
        'UsersService.updatePasswordByResetToken',
        'No se pudo actualizar la contraseña',
        { id },
      );
    }
  }

  async darDeBajaUsuario(id: number): Promise<void> {
    try {
      const user = await this.getUserWithDeleted(id); // Lanza NotFoundException si no existe

      if (user.deletedAt) {
        throw new BadRequestException('El usuario ya está inactivo');
      }

      if (user.role === Role.ADMIN && (await this.esUnicoAdminActivo())) {
        throw new BadRequestException(
          'No podés dar de baja al único administrador activo',
        );
      }

      await this.userRepository.softDelete(id);
      deleteLogger.info(`Usuario dado de baja (ID ${id}, soft-delete)`);
    } catch (error) {
      handleServiceError(
        error,
        usersErrorLogger,
        'UsersService.darDeBajaUsuario',
        'Ocurrió un error al desactivar el usuario',
        { id },
      );
    }
  }

  async activarUsuario(id: number): Promise<void> {
    try {
      const user = await this.getUserWithDeleted(id); // Lanza NotFoundException si no existe

      if (!user.deletedAt) {
        throw new BadRequestException('El usuario ya está activo');
      }

      await this.userRepository.restore(id);
      // restore() revierte un soft-delete — se audita con updateLogger
      // (no deleteLogger) porque semánticamente es la operación inversa,
      // no un borrado.
      updateLogger.info(`Usuario reactivado (ID ${id}, restore)`);
    } catch (error) {
      handleServiceError(
        error,
        usersErrorLogger,
        'UsersService.activarUsuario',
        'Ocurrió un error al activar el usuario',
        { id },
      );
    }
  }

  /** true si hay como mucho un ADMIN activo en toda la tabla — usado antes
   * de dar de baja o sacarle el rol ADMIN a alguien, para no terminar sin
   * nadie que pueda administrar la app. `.count()` sin `withDeleted:true`
   * ya excluye por default los usuarios dados de baja (soft-delete), así
   * que esto cuenta ADMINs realmente activos. Se llama solo cuando el
   * usuario en cuestión YA es ADMIN activo — si el conteo da <= 1 en ese
   * momento, ese usuario tiene que ser el único. */
  private async esUnicoAdminActivo(): Promise<boolean> {
    const totalAdminsActivos = await this.userRepository.count({
      where: { role: Role.ADMIN },
    });

    return totalAdminsActivos <= 1;
  }

  // Helper para obtener el usuario, incluyendo los borrados
  private async getUserWithDeleted(id: number): Promise<UserEntity> {
    const user = await this.userRepository.findOne({
      where: { idUser: id },
      withDeleted: true,
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }
}
