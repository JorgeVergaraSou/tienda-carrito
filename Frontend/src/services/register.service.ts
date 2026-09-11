//src/services/register.service.ts
import { api } from "@/api/axios";

export const registerService = async (
  name: string,
  email: string,
  password: string,
  secretWord: string,
) => {

  const res = await api.post('/auth/register', { name, email, password, secretWord });

  return res.data;
};
