import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Patch,
  Param,
  ParseIntPipe,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthService } from './auth.service';
import { Role } from '@/common/enums/role.enum';
import { Auth } from './decorators/auth.decorator';
import { ActiveUser } from '@/common/decorators/active-user.decorator';
import { UserActiveInterface } from '@/common/interfaces/user-active.interface';
import { RequestResetPasswordDto } from './dto/requestResetPassword.dto';
import { ResetPasswordDto } from './dto/resetPassword.dto';
import { UpdateUserDto } from '@/users/dto/update-user.dto';
import { AdminUpdateUserDto } from '@/users/dto/admin-update-user.dto';
import {
  avatarStorage,
  avatarFileFilter,
} from '@/common/upload/avatar-upload.config';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Alta de usuarios: solo un ADMIN puede crear cuentas nuevas (y elegir
   * su rol). No hay auto-registro público — si en algún proyecto hijo de
   * esta base hace falta signup abierto, hay que agregar un endpoint
   * público aparte que fuerce role=USER, nunca reabrir este. */
  @Auth(Role.ADMIN)
  @Post('nuevo-usuario')
  async register(@Body() registerDto: RegisterDto): Promise<void> {
    return this.authService.registro(registerDto);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // máx. 5 intentos por minuto por IP
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return await this.authService.login(loginDto);
  }

  @Auth(Role.USER, Role.GUEST)
  @Patch('/updateUser/:id')
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @ActiveUser() user: UserActiveInterface,
  ): Promise<void> {
    // autoservicio: solo se puede editar el propio perfil, nunca el de
    // otro usuario (el :id de la URL debe coincidir con el del token).
    if (id !== user.idUser) {
      throw new ForbiddenException('No podés editar el perfil de otro usuario');
    }

    return this.authService.updateUser(id, updateUserDto);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 600000 } }) // máx. 3 pedidos cada 10 min por IP
  @Post('requestResetPassword')
  async requestResetPasswordByEmail(
    @Body() dto: RequestResetPasswordDto,
  ): Promise<void> {
    return this.authService.requestResetPassword(dto);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 600000 } }) // máx. 5 intentos cada 10 min por IP
  @Post('resetPassword')
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    return await this.authService.resetPassword(dto);
  }

  @Get('profile')
  @Auth(Role.USER, Role.GUEST)
  async profile(@ActiveUser() user: UserActiveInterface) {
    return await this.authService.profile(user);
  }

  @Auth(Role.USER, Role.GUEST)
  @Post('foto')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: avatarStorage,
      fileFilter: avatarFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async actualizarFoto(
    @UploadedFile() file: Express.Multer.File,
    @ActiveUser() user: UserActiveInterface,
  ): Promise<void> {
    return this.authService.actualizarFoto(user.idUser, file);
  }

  @Get('listar-usuarios')
  @Auth(Role.ADMIN)
  async findAllUsers() {
    return await this.authService.findAll();
  }

  /** ADMIN edita a cualquier usuario (nickUsuario/nombre/apellido/email/
   * role/password) — distinto de PATCH /updateUser/:id, que es
   * autoservicio (solo tu propia cuenta, exige tu contraseña actual). Acá
   * no se pide contraseña: el ADMIN ya está autenticado por su propio JWT,
   * y no tiene por qué conocer la del usuario que edita. */
  @Patch('editar-usuario/:id')
  @Auth(Role.ADMIN)
  async editarUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateUserDto,
  ): Promise<void> {
    return this.authService.editarUsuarioAdmin(id, dto);
  }

  @Delete('dar-de-baja-usuario/:id')
  @Auth(Role.ADMIN)
  async deleteUser(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return await this.authService.deleteUser(id);
  }

  @Patch('activar-usuario/:id')
  @Auth(Role.ADMIN)
  async activarUsuario(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return await this.authService.activarUsuario(id);
  }
}
