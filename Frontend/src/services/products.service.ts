//src/services/products.service.ts
import { api } from "@/api/axios";
import { PaginatedProducts, Product } from "@/interfaces";

export interface ProductsQuery {
  search?: string;
  categoriaId?: number;
  page?: number;
  limit?: number;
}

export interface ProductFormData {
  nombre: string;
  descripcion?: string;
  precio: number;
  stock?: number;
  // si se omite, el backend aplica su default (true, stock visible) — ver
  // Product.mostrarStock.
  mostrarStock?: boolean;
  // id de una categoría existente, o null para "sin categoría" (ver
  // CategoriesService en el backend)
  idCategoria?: number | null;
}

/** Catálogo público — GET /productos no requiere auth, solo devuelve
 * productos activos (ver ProductsController.findAll en el backend). */
export const getProductsService = async (
  query: ProductsQuery = {},
): Promise<PaginatedProducts> => {

  const res = await api.get('/productos', { params: query });

  return res.data;
};

/** Detalle público de un producto activo — GET /productos/:id no
 * requiere auth. Nunca devuelve un producto dado de baja (ver
 * ProductsController.findOne / ProductsService.findOneActivo). */
export const getProductService = async (idProducto: number): Promise<Product> => {

  const res = await api.get(`/productos/${idProducto}`);

  return res.data;
};

/** Productos que el usuario logueado cargó él mismo (ADMIN o USER),
 * incluidos los dados de baja — requiere estar logueado, lo agrega el
 * interceptor de axios. */
export const getMisProductosService = async (
  query: ProductsQuery = {},
): Promise<PaginatedProducts> => {

  const res = await api.get('/productos/mis-productos', { params: query });

  return res.data;
};

/** Listado del panel ADMIN — incluye productos dados de baja. Requiere
 * token ADMIN (lo agrega el interceptor de axios). */
export const getAdminProductsService = async (
  query: ProductsQuery = {},
): Promise<PaginatedProducts> => {

  const res = await api.get('/productos/admin/listado', { params: query });

  return res.data;
};

/** Detalle para el panel ADMIN — a diferencia de la ruta pública, incluye
 * productos dados de baja. Lo usa la página de editar producto, que
 * puede cargarse directo por URL. */
export const getAdminProductService = async (idProducto: number): Promise<Product> => {

  const res = await api.get(`/productos/admin/${idProducto}`);

  return res.data;
};

export const createProductService = async (
  data: ProductFormData,
): Promise<Product> => {

  const res = await api.post('/productos', data);

  return res.data;
};

export const updateProductService = async (
  idProducto: number,
  data: Partial<ProductFormData>,
): Promise<Product> => {

  const res = await api.patch(`/productos/${idProducto}`, data);

  return res.data;
};

export const deactivateProductService = async (idProducto: number): Promise<void> => {
  await api.delete(`/productos/${idProducto}`);
};

export const activateProductService = async (idProducto: number): Promise<void> => {
  await api.patch(`/productos/${idProducto}/activar`);
};

/** endpoint dedicado (no el PATCH general de updateProductService, que
 * requiere ADMIN) — así USER también puede tocar esto en un producto
 * propio. Ver ProductsController.actualizarVisibilidadStock en el
 * backend. */
export const updateStockVisibilityService = async (
  idProducto: number,
  mostrarStock: boolean,
): Promise<Product> => {

  const res = await api.patch(`/productos/${idProducto}/visibilidad-stock`, { mostrarStock });

  return res.data;
};

export const uploadProductImageService = async (
  idProducto: number,
  file: File,
): Promise<Product> => {

  const formData = new FormData();
  formData.append('file', file);

  const res = await api.post(`/productos/${idProducto}/imagen`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return res.data;
};

/** agrega una foto a la galería del producto (se suma a las que ya tiene,
 * no reemplaza la portada ni las demás fotos) — ver
 * ProductsController.agregarFoto en el backend. Para subir varias, llamar
 * una vez por archivo (mismo criterio que el backend: un archivo por
 * request, ver product-image-upload.config.ts). */
export const addProductPhotoService = async (
  idProducto: number,
  file: File,
): Promise<Product> => {

  const formData = new FormData();
  formData.append('file', file);

  const res = await api.post(`/productos/${idProducto}/fotos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return res.data;
};

/** elimina una foto puntual de la galería (por su ID, no borra todas) —
 * ver ProductsController.eliminarFoto en el backend. */
export const deleteProductPhotoService = async (
  idProducto: number,
  idFoto: number,
): Promise<Product> => {

  const res = await api.delete(`/productos/${idProducto}/fotos/${idFoto}`);

  return res.data;
};
