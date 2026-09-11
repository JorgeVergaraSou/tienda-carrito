//src/services/categories.service.ts
import { api } from "@/api/axios";
import { Category } from "@/interfaces";

export interface CategoryFormData {
  nombre: string;
}

/** público — alimenta el <select> del catálogo y del form de productos */
export const getCategoriesService = async (): Promise<Category[]> => {
  const res = await api.get('/categorias');
  return res.data;
};

/** listado del panel ADMIN — incluye categorías dadas de baja */
export const getAdminCategoriesService = async (): Promise<Category[]> => {
  const res = await api.get('/categorias/admin/listado');
  return res.data;
};

export const createCategoryService = async (
  data: CategoryFormData,
): Promise<Category> => {
  const res = await api.post('/categorias', data);
  return res.data;
};

export const updateCategoryService = async (
  idCategoria: number,
  data: CategoryFormData,
): Promise<Category> => {
  const res = await api.patch(`/categorias/${idCategoria}`, data);
  return res.data;
};

export const deactivateCategoryService = async (idCategoria: number): Promise<void> => {
  await api.delete(`/categorias/${idCategoria}`);
};

export const activateCategoryService = async (idCategoria: number): Promise<void> => {
  await api.patch(`/categorias/${idCategoria}/activar`);
};
