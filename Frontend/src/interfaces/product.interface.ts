export interface ProductCategory {
  idCategoria: number;
  nombre: string;
}

export interface ProductImage {
  idProductoImagen: number;
  imageUrl: string;
}

export interface Product {
  idProducto: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  // null solo en las vistas públicas (catálogo, detalle público) cuando el
  // dueño eligió no mostrar el stock (ver mostrarStock) — en el panel
  // ADMIN, "mis productos", o la respuesta de cualquier mutación, siempre
  // es el número real, nunca null.
  stock: number | null;
  categoria: ProductCategory | null;
  imageUrl: string | null;
  // galería de fotos adicionales, además de imageUrl (la portada) — ver
  // Backend/CLAUDE.md sección "Galería de fotos". Siempre es un array,
  // vacío si el producto no tiene fotos adicionales, nunca undefined.
  fotos: ProductImage[];
  // preferencia del dueño (no lo que ve el cliente en sí — ver `stock`
  // arriba): si es false, las vistas públicas reciben stock: null en vez
  // del número real. Siempre presente y siempre el valor real, incluso en
  // las vistas públicas.
  mostrarStock: boolean;
  // llega como string por JSON (no hay tipo Date en JSON) — null si el
  // producto está activo.
  deletedAt: string | null;
}

export interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  limit: number;
}
