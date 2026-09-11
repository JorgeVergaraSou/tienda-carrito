export interface Category {
  idCategoria: number;
  nombre: string;
  // llega como string por JSON — null si la categoría está activa.
  deletedAt: string | null;
}
