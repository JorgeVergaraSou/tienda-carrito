import Roles from "./roles.enum";

export interface UserInfo {
   idUser: number;
    nickUsuario: string;
    name: string;
    role: Roles;
    token?: string;
}
