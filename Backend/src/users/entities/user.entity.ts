import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '@/common/enums/role.enum';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true, name: 'id_user' })
  idUser!: number;

  /** identificador de login, único y obligatorio. Reemplaza a "email" en ese rol. */
  @Column({ length: 60, unique: true, nullable: false, name: 'nick_usuario' })
  nickUsuario!: string;

  @Column({ length: 60, nullable: false, name: 'nombre' })
  nombre!: string;

  @Column({ length: 60, nullable: false, name: 'apellido' })
  apellido!: string;

  /** email de contacto/recuperación. Opcional al crear el usuario: queda
   * asociado la primera vez que pide recuperar su clave (ver
   * AuthService.requestResetPassword). Único cuando no es nulo. */
  @Column({ type: 'varchar', unique: true, nullable: true, name: 'email' })
  email!: string | null;

  @Column({ nullable: false, select: false, name: 'password' })
  password!: string;

  /** select:false, igual que `password`: es equivalente a una contraseña
   * temporal, y sin esto cualquier relación que cargue al usuario completo
   * (ej. `product.creadoPor`) la arrastra a la respuesta de OTRO usuario.
   * Donde de verdad hace falta (validar el reseteo) se pide explícita. */
  @Column({
    type: 'uuid',
    unique: true,
    nullable: true,
    select: false,
    name: 'reset_password_token',
  })
  resetPasswordToken!: string | null;

  @Column({
    type: 'datetime',
    nullable: true,
    select: false,
    name: 'reset_password_token_expires_at',
  })
  resetPasswordTokenExpiresAt!: Date | null;

  /** cuándo se cambió la contraseña por última vez (con milisegundos: un
   * `datetime` sin decimales redondea y el chequeo del guard quedaría
   * impreciso). El JWT lleva este valor en el claim `pv` al emitirse
   * (ver AuthService.login) y AuthGuard exige que siga siendo el mismo:
   * cambiar la clave (autoservicio, reseteo por mail o por un ADMIN)
   * invalida todos los tokens emitidos antes. */
  @Column({
    type: 'datetime',
    precision: 3,
    nullable: true,
    name: 'password_changed_at',
  })
  passwordChangedAt!: Date | null;

  @Column({ type: 'varchar', nullable: true, name: 'image_file' })
  imageFile!: string | null;

  @Column({ type: 'enum', enum: Role, name: 'role' })
  role!: Role;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
