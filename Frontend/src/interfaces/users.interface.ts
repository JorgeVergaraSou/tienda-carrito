export interface User {
    idUser: number;
    nickUsuario: string;
    nombre: string;
    apellido: string;
    email: string | null;
    role: string;
    fotoUrl: string | null;
  }

// fila del listado de ADMIN (GET /auth/listar-usuarios) — sin fotoUrl (no
// hace falta para la tabla), con deletedAt (para poder dar de baja/
// reactivar, igual que Product/Category).
export interface UserListItem {
  idUser: number;
  nickUsuario: string;
  nombre: string;
  apellido: string;
  email: string | null;
  role: string;
  // llega como string por JSON (no hay tipo Date en JSON) — null si el
  // usuario está activo.
  deletedAt: string | null;
}
