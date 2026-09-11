//src/services/auth.service.ts
import { jwtDecode } from "jwt-decode";
import { api } from "@/api/axios";
import { DecodedToken } from "@/interfaces/decode.token.interface";

export const loginService = async (nickUsuario: string, password: string) => {

  const res = await api.post('/auth/login', { nickUsuario, password });

  const token = res.data.token;
  const decoded = jwtDecode<DecodedToken>(token);

  return { token, ...decoded };
};

/** foto de perfil del usuario logueado (no de un producto — mismo
 * mecanismo de subida que uploadProductImageService, ver
 * avatar-upload.config.ts en el backend). POST /auth/foto no devuelve
 * body (ver AuthService.actualizarFoto) — quien llame tiene que volver a
 * pedir el perfil (profileService) para obtener el fotoUrl nuevo. */
export const actualizarFotoService = async (file: File): Promise<void> => {

  const formData = new FormData();
  formData.append('file', file);

  await api.post('/auth/foto', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
