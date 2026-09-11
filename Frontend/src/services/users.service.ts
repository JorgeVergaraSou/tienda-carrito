//src/services/users.service.ts
/**
 * Gestión de usuarios del panel ADMIN — todas estas rutas viven bajo
 * /auth/* en el backend (no hay un UsersController separado, ver
 * Backend/CLAUDE.md), pero se separan acá de auth.service.ts (login) y
 * profile.service.ts (autoservicio del propio perfil) porque son otra
 * responsabilidad: un ADMIN administrando CUALQUIER cuenta, no la propia.
 */
import { api } from '@/api/axios';
import { UserListItem } from '@/interfaces';

export interface CreateUserData {
  nickUsuario: string;
  nombre: string;
  apellido: string;
  email?: string;
  role: string;
  password: string;
}

// todos opcionales: PATCH /auth/editar-usuario/:id solo toca los campos
// que vienen — ver UsersService.actualizarUsuarioAdmin en el backend.
export interface AdminUpdateUserData {
  nickUsuario?: string;
  nombre?: string;
  apellido?: string;
  email?: string;
  role?: string;
  // dejarlo afuera del objeto = no tocar la contraseña actual. Setear una
  // acá no pide la contraseña vieja (a diferencia del autoservicio de
  // Profile.tsx) — es una acción administrativa, pensada para recuperar
  // el acceso de un usuario que la perdió.
  password?: string;
}

export const getUsersService = async (): Promise<UserListItem[]> => {
  const res = await api.get('/auth/listar-usuarios');
  return res.data;
};

/** POST /auth/nuevo-usuario no devuelve body (ver AuthController.register). */
export const createUserService = async (data: CreateUserData): Promise<void> => {
  await api.post('/auth/nuevo-usuario', data);
};

/** PATCH /auth/editar-usuario/:id no devuelve body. Distinto de
 * updateUserService (profile.service.ts): ese es autoservicio (solo tu
 * propia cuenta, exige tu contraseña actual), este es para que ADMIN
 * edite cualquier cuenta. */
export const updateUserAdminService = async (
  idUser: number,
  data: AdminUpdateUserData,
): Promise<void> => {
  await api.patch(`/auth/editar-usuario/${idUser}`, data);
};

export const deactivateUserService = async (idUser: number): Promise<void> => {
  await api.delete(`/auth/dar-de-baja-usuario/${idUser}`);
};

export const activateUserService = async (idUser: number): Promise<void> => {
  await api.patch(`/auth/activar-usuario/${idUser}`);
};
