/** Un renglón del carrito (ver redux/states/cart.ts) — carrito 100%
 * client-side, sin ningún endpoint de "carrito en progreso" del lado del
 * backend (ver Backend/CLAUDE.md, sección "Carrito de compra + Mercado
 * Pago"). Se arma a partir de un `Product` real al agregarlo, no es un
 * `Product` completo: solo lo que hace falta para mostrar el carrito y
 * armar el pedido más adelante (Fase 3). */
export interface CartItem {
  idProducto: number;
  nombre: string;
  precio: number;
  imageUrl: string | null;
  cantidad: number;
  /** snapshot de `Product.stock` visto al agregar el producto — solo para
   * limitar cuánto se puede subir la cantidad en el carrito (ayuda de UX,
   * nada más). `null` si el dueño no muestra el stock público (ver
   * `Product.stock`): en ese caso no se limita la cantidad acá. El backend
   * vuelve a validar el stock real al crear el pedido (ver
   * ProductsService.findActivoByIdOrThrow en Backend/CLAUDE.md) — esto
   * nunca reemplaza esa validación. */
  stockDisponible: number | null;
}
