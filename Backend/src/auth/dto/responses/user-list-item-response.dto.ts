import { Role } from '@/common/enums/role.enum';

export class UserListItemResponseDto {
  idUser: number;
  nickUsuario: string;
  nombre: string;
  apellido: string;
  email: string | null;
  role: Role;
  deletedAt: Date | null;
}
