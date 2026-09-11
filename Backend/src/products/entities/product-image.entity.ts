import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProductEntity } from './product.entity';

/** una foto adicional de la "galería" de un producto — a diferencia de
 * ProductEntity.imageFile (que sigue siendo la portada/imagen principal,
 * con su propio endpoint que la reemplaza), acá cada fila es una foto más
 * que se agrega o se borra puntualmente sin tocar las demás. Mismo patrón
 * de subida que imageFile (nombre de archivo generado, extensión sacada
 * del mimetype — ver product-image-upload.config.ts), servida como
 * estático desde /uploads/products/<archivo>, igual que la portada.
 *
 * Sin soft-delete acá a propósito: a diferencia de un producto o un
 * usuario (que se pueden "reactivar"), no existe un caso de uso de
 * "restaurar una foto borrada" — eliminarFoto() borra la fila y el
 * archivo del disco a la vez (mismo criterio que ya usa
 * ProductsService.actualizarImagen al reemplazar la portada). */
@Entity('product_images')
export class ProductImageEntity {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
    name: 'id_producto_imagen',
  })
  idProductoImagen!: number;

  @ManyToOne(() => ProductEntity, (producto) => producto.fotos, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'producto_id' })
  producto!: ProductEntity;

  @Column({ type: 'varchar', nullable: false, name: 'image_file' })
  imageFile!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
