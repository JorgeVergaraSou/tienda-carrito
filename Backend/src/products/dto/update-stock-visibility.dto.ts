import { IsBoolean } from 'class-validator';

/** body de PATCH /productos/:id/visibilidad-stock — endpoint dedicado
 * (mismo patrón que actualizarImagen/activar) para que un USER pueda
 * tocar únicamente este campo en un producto propio, sin abrir el PATCH
 * general (ADMIN-only) a otros roles. */
export class UpdateStockVisibilityDto {
  @IsBoolean({ message: 'mostrarStock debe ser un valor booleano' })
  mostrarStock: boolean;
}
