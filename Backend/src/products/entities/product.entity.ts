import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CategoryEntity } from '@/categories/entities/category.entity';
import { UserEntity } from '@/users/entities/user.entity';
import { ProductImageEntity } from './product-image.entity';

@Entity('products')
export class ProductEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true, name: 'id_producto' })
  idProducto!: number;

  @Column({ length: 120, nullable: false, name: 'nombre' })
  nombre!: string;

  @Column({ type: 'text', nullable: true, name: 'descripcion' })
  descripcion!: string | null;

  /** guardado como DECIMAL(10,2) en la base (evita el error de redondeo de
   * los floats con dinero); el transformer lo convierte a number de vuelta
   * al leerlo, porque el driver de MySQL devuelve las columnas DECIMAL
   * como string por defecto. */
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: false,
    name: 'precio',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  precio!: number;

  @Column({
    type: 'int',
    unsigned: true,
    nullable: false,
    default: 0,
    name: 'stock',
  })
  stock!: number;

  /** si es false, las lecturas públicas (GET /productos, GET /productos/:id
   * — ver ProductsService.toPublicResponseDto) devuelven `stock: null` en
   * vez del número real. Es solo una preferencia de cara al cliente: ADMIN
   * y el USER dueño del producto siempre ven el stock real en sus propias
   * vistas (admin/listado, admin/:id, mis-productos, y la respuesta de
   * cualquier mutación), la columna no cambia nada de la lógica de
   * stock/pedidos en sí. Default true: preserva el comportamiento de
   * siempre (stock visible) tanto para productos ya cargados como para
   * los nuevos que no manden el campo — mismo patrón que `stock` arriba. */
  @Column({
    type: 'boolean',
    nullable: false,
    default: true,
    name: 'mostrar_stock',
  })
  mostrarStock!: boolean;

  /** relación a categories — el ADMIN crea/renombra/da de baja categorías
   * libremente desde su propio CRUD (ver CategoriesModule), sin tocar
   * código ni rebuildear cada vez que hace falta una nueva. onDelete:
   * 'SET NULL' es solo defensa extra: en la práctica una categoría nunca
   * se borra físicamente, se da de baja con soft-delete (ver
   * CategoriesService.darDeBajaCategoria), así que la fila sigue
   * existiendo y esta relación no se ve afectada. */
  @ManyToOne(() => CategoryEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_categoria' })
  categoria!: CategoryEntity | null;

  /** mismo patrón que UserEntity.imageFile: se guarda solo el nombre de
   * archivo (la extensión sale del mimetype validado en el upload, nunca
   * del nombre que manda el cliente), servido como estático desde
   * /uploads/products/<archivo> (ver main.ts). */
  @Column({ type: 'varchar', nullable: true, name: 'image_file' })
  imageFile!: string | null;

  /** fotos adicionales del producto (galería), además de la portada de
   * arriba — ver ProductImageEntity para el porqué de mantenerlas
   * separadas de imageFile en vez de reemplazarlo. Se agregan/eliminan de
   * a una (ProductsService.agregarFoto/eliminarFoto), nunca se
   * reemplazan todas juntas. */
  @OneToMany(() => ProductImageEntity, (foto) => foto.producto)
  fotos!: ProductImageEntity[];

  /** trazabilidad: quién cargó el producto. Se setea solo al crear (ver
   * ProductsService.crearProducto), nunca se reasigna después. Es lo que
   * le permite a un USER (no ADMIN) subir/cambiar la imagen únicamente de
   * los productos que él mismo cargó — ver
   * ProductsService.actualizarImagen. onDelete: 'SET NULL' porque si se
   * borra la cuenta del usuario (hoy solo hay soft-delete, pero por las
   * dudas) el producto no debe desaparecer ni romperse, solo perder el
   * dato de quién lo cargó. */
  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'creado_por_id' })
  creadoPor!: UserEntity | null;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
