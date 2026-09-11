export class ProductCategoryDto {
  idCategoria: number;
  nombre: string;
}

export class ProductImageResponseDto {
  idProductoImagen: number;
  imageUrl: string;
}

export class ProductResponseDto {
  idProducto: number;
  nombre: string;
  descripcion: string | null;
  /** null solo en las lecturas públicas (GET /productos, GET /productos/:id)
   * cuando el dueño eligió no mostrar el stock (mostrarStock: false) — ver
   * ProductsService.toPublicResponseDto. En cualquier otra respuesta
   * (admin/listado, admin/:id, mis-productos, o la devuelta por cualquier
   * mutación) siempre es el número real, nunca null. */
  precio: number;
  stock: number | null;
  categoria: ProductCategoryDto | null;
  imageUrl: string | null;
  /** fotos adicionales del producto (galería), además de imageUrl (la
   * portada) — ver ProductEntity.fotos / ProductImageEntity. Siempre es
   * un array (vacío si no tiene fotos adicionales), nunca undefined. */
  fotos: ProductImageResponseDto[];
  /** preferencia del dueño, no lo que ve el cliente en sí — ver `stock`
   * arriba y ProductEntity.mostrarStock. Siempre presente y siempre el
   * valor real, incluso en las lecturas públicas (para que, por ejemplo,
   * el frontend pueda mostrar "Consultar disponibilidad" cuando stock es
   * null por esto en vez de por estar realmente en 0). */
  mostrarStock: boolean;
  deletedAt: Date | null;
}

export class PaginatedProductsResponseDto {
  items: ProductResponseDto[];
  total: number;
  page: number;
  limit: number;
}
