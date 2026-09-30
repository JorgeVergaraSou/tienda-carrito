import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, IsNull, Not, Repository } from 'typeorm';
import { copyFileSync, existsSync, unlinkSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { ProductEntity } from './entities/product.entity';
import { ProductImageEntity } from './entities/product-image.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FindProductsQueryDto } from './dto/find-products-query.dto';
import { BulkPriceAdjustmentDto } from './dto/bulk-price-adjustment.dto';
import { PRECIO_MAX } from './dto/create-product.dto';
import {
  PaginatedProductsResponseDto,
  ProductResponseDto,
} from './dto/responses/product-response.dto';
import { BulkPriceAdjustmentResponseDto } from './dto/responses/bulk-price-adjustment-response.dto';
import { CategoriesService } from '@/categories/categories.service';
import { CategoryEntity } from '@/categories/entities/category.entity';
import { Role } from '@/common/enums/role.enum';
import { TipoAjustePrecio } from '@/common/enums/tipo-ajuste-precio.enum';
import { UserActiveInterface } from '@/common/interfaces/user-active.interface';
import { UserEntity } from '@/users/entities/user.entity';
import { handleServiceError } from '@/common/utils/error-handler.util';
import { escapeLikeWildcards } from '@/common/utils/escape-like.util';
import { productsErrorLogger } from '@/config/module-loggers';
import { deleteLogger, insertLogger, updateLogger } from '@/config/db-loggers';

/** relaciones + orden que necesita cualquier lectura que vaya a mostrarse
 * al cliente (listados y detalle) — 'fotos' ordenadas por id ascendente
 * (= orden de creación, la más vieja primero) porque no hay un campo de
 * orden explícito, y no hace falta: alcanza con que sea estable. */
const RELACIONES_LECTURA = ['categoria', 'creadoPor', 'fotos'] as const;
const ORDEN_FOTOS = { fotos: { idProductoImagen: 'ASC' as const } };

@Injectable()
export class ProductsService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    @InjectRepository(ProductImageEntity)
    private readonly productImageRepository: Repository<ProductImageEntity>,
    private readonly categoriesService: CategoriesService,
  ) {}

  async onApplicationBootstrap() {
    await this.migrarImagenesLegacy();
  }

  /** productos cargados antes de que existiera la galería (product_images)
   * solo tienen imageFile (portada). Para que esos productos no arranquen
   * con la galería vacía, cada uno que tenga imageFile y todavía no tenga
   * ninguna fila en product_images se migra una sola vez: se duplica el
   * archivo (nunca se referencia el mismo nombre que imageFile) bajo un
   * nombre nuevo y se crea una fila de galería apuntando a esa copia.
   *
   * Duplicar en vez de reutilizar el mismo archivo es deliberado: si en
   * el futuro alguien reemplaza la portada, actualizarImagen() borra del
   * disco el imageFile viejo (comportamiento actual, sin tocar) — si la
   * foto migrada compartiera ese mismo nombre de archivo, quedaría
   * apuntando a un archivo borrado. Con la copia, portada y galería
   * quedan totalmente desacopladas desde el momento de la migración.
   *
   * Corre en cada arranque (no una sola vez con un flag), pero es
   * idempotente: un producto que ya tiene alguna fila en product_images
   * (migrada antes, o cargada a mano con agregarFoto) se salta siempre.
   * No debe tirar abajo el arranque de la app si algo falla acá — se
   * loguea y sigue. */
  private async migrarImagenesLegacy() {
    try {
      const productos = await this.productRepository.find({
        where: { imageFile: Not(IsNull()) },
        withDeleted: true,
      });

      for (const producto of productos) {
        const yaTieneFotos = await this.productImageRepository.count({
          where: { producto: { idProducto: producto.idProducto } },
        });

        if (yaTieneFotos > 0) {
          continue;
        }

        const nombreOriginal = producto.imageFile as string;
        const rutaOriginal = join(
          process.cwd(),
          'uploads',
          'products',
          nombreOriginal,
        );

        // si el archivo ya no está en disco no hay nada para copiar — no
        // rompemos el arranque por esto. productsErrorLogger está creado
        // con level:'error' (ver module-loggers.ts), así que se loguea con
        // .error (un .warn acá quedaría filtrado y no escribiría nada).
        if (!existsSync(rutaOriginal)) {
          productsErrorLogger.error(
            `Migración de imagen legacy: el archivo de imageFile no existe en disco (producto ID ${producto.idProducto}, archivo ${nombreOriginal})`,
          );
          continue;
        }

        const nuevoNombre = `${randomUUID()}${extname(nombreOriginal)}`;
        const rutaNueva = join(
          process.cwd(),
          'uploads',
          'products',
          nuevoNombre,
        );

        copyFileSync(rutaOriginal, rutaNueva);

        await this.productImageRepository.save({
          producto: { idProducto: producto.idProducto } as ProductEntity,
          imageFile: nuevoNombre,
        });

        insertLogger.info(
          `Foto migrada desde imageFile legacy (producto ID ${producto.idProducto}): ${nuevoNombre} (copia de ${nombreOriginal})`,
        );
      }
    } catch (error) {
      productsErrorLogger.error(
        `Error migrando imágenes legacy a product_images: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async crearProducto(
    dto: CreateProductDto,
    activeUser: UserActiveInterface,
  ): Promise<ProductResponseDto> {
    try {
      const { idCategoria, ...resto } = dto;
      const categoria = await this.resolverCategoria(idCategoria);

      const created = await this.productRepository.save({
        ...resto,
        categoria,
        // se guarda quién lo cargó (ver ProductEntity.creadoPor) — no hace
        // falta el objeto UserEntity completo, alcanza con el id para que
        // TypeORM arme la FK.
        creadoPor: { idUser: activeUser.idUser } as UserEntity,
      });

      insertLogger.info(
        `Producto creado: ${JSON.stringify({
          idProducto: created.idProducto,
          nombre: created.nombre,
        })}`,
      );

      return this.toResponseDto(
        await this.getProductoWithDeleted(created.idProducto),
      );
    } catch (error) {
      handleServiceError(
        error,
        productsErrorLogger,
        'ProductsService.crearProducto',
        'Error al crear el producto',
      );
    }
  }

  /** catálogo público: solo productos activos (no da de baja) */
  async findAllActivos(
    query: FindProductsQueryDto,
  ): Promise<PaginatedProductsResponseDto> {
    return this.buscarProductos(query, false);
  }

  /** listado para el panel ADMIN: incluye los dados de baja */
  async findAllAdmin(
    query: FindProductsQueryDto,
  ): Promise<PaginatedProductsResponseDto> {
    return this.buscarProductos(query, true);
  }

  /** "mis productos" (ADMIN o USER): los que el usuario activo cargó él
   * mismo, incluidos los dados de baja — mismo criterio que
   * findOneAdmin, porque el dueño de un producto tiene que poder verlo y
   * reactivarlo si lo dio de baja por error. */
  async findMisProductos(
    query: FindProductsQueryDto,
    activeUser: UserActiveInterface,
  ): Promise<PaginatedProductsResponseDto> {
    return this.buscarProductos(query, true, activeUser.idUser);
  }

  private async buscarProductos(
    query: FindProductsQueryDto,
    incluirInactivos: boolean,
    creadoPorId?: number,
  ): Promise<PaginatedProductsResponseDto> {
    try {
      const page = query.page ?? 1;
      const limit = query.limit ?? 12;

      const where: FindOptionsWhere<ProductEntity> = {};

      if (query.search) {
        // escapeLikeWildcards: sin esto, buscar literalmente "10%" o
        // "a_b" se interpreta como comodines de LIKE en vez de texto —
        // ver el comentario del util para el detalle.
        where.nombre = ILike(`%${escapeLikeWildcards(query.search)}%`);
      }

      if (query.categoriaId) {
        where.categoria = { idCategoria: query.categoriaId };
      }

      if (creadoPorId) {
        where.creadoPor = { idUser: creadoPorId };
      }

      // Siempre se pide withDeleted:true acá — no para mostrar productos
      // dados de baja (eso lo controla el IsNull() explícito de abajo),
      // sino porque sin esto TypeORM excluye del JOIN cualquier categoría
      // que esté soft-deleted, y un producto activo con una categoría dada
      // de baja terminaría mostrando categoria:null en vez de la categoría
      // real (dar de baja una categoría no debería "romper" los productos
      // que ya la tenían asignada).
      if (!incluirInactivos) {
        where.deletedAt = IsNull();
      }

      const [items, total] = await this.productRepository.findAndCount({
        where,
        relations: [...RELACIONES_LECTURA],
        withDeleted: true,
        order: { nombre: 'ASC', ...ORDEN_FOTOS },
        skip: (page - 1) * limit,
        take: limit,
      });

      return {
        // el catálogo público (incluirInactivos: false) no revela el stock
        // real si el dueño eligió ocultarlo — ver toPublicResponseDto. Las
        // vistas privilegiadas (admin/listado, mis-productos) siempre son
        // incluirInactivos: true, y siempre ven el stock real.
        items: items.map((item) =>
          incluirInactivos
            ? this.toResponseDto(item)
            : this.toPublicResponseDto(item),
        ),
        total,
        page,
        limit,
      };
    } catch (error) {
      handleServiceError(
        error,
        productsErrorLogger,
        'ProductsService.buscarProductos',
        'Error al buscar productos',
        { incluirInactivos, creadoPorId },
      );
    }
  }

  /** detalle para el panel ADMIN: a diferencia de findOneActivo, sí
   * devuelve productos dados de baja — hace falta para la página de
   * editar un producto (que se puede cargar directo por URL/refresh, no
   * solo navegando desde el listado que ya tiene los datos en memoria). */
  async findOneAdmin(id: number): Promise<ProductResponseDto> {
    try {
      const product = await this.getProductoWithDeleted(id); // lanza NotFoundException si no existe
      return this.toResponseDto(product);
    } catch (error) {
      handleServiceError(
        error,
        productsErrorLogger,
        'ProductsService.findOneAdmin',
        'Error al buscar el producto',
        { id },
      );
    }
  }

  /** detalle público: nunca devuelve un producto dado de baja. withDeleted
   * + deletedAt: IsNull() explícito (en vez de dejar el filtro implícito
   * de TypeORM) por el mismo motivo que en buscarProductos: que la
   * categoría esté dada de baja no debe ocultarla en un producto activo. */
  async findOneActivo(id: number): Promise<ProductResponseDto> {
    try {
      const product = await this.productRepository.findOne({
        where: { idProducto: id, deletedAt: IsNull() },
        relations: [...RELACIONES_LECTURA],
        withDeleted: true,
        order: ORDEN_FOTOS,
      });

      if (!product) {
        throw new NotFoundException('Producto no encontrado');
      }

      return this.toPublicResponseDto(product);
    } catch (error) {
      handleServiceError(
        error,
        productsErrorLogger,
        'ProductsService.findOneActivo',
        'Error al buscar el producto',
        { id },
      );
    }
  }

  /** usado por OrdersModule para validar cada item del carrito contra un
   * producto real al crear un pedido (ver OrdersService.crearOrden) —
   * nunca confiar en el nombre/precio que mande el cliente. Devuelve la
   * entidad completa (no el DTO de respuesta) porque a diferencia de
   * findOneActivo, quien llama necesita el `precio`/`stock` reales para
   * calcular el total y validar disponibilidad, no una versión ya
   * adaptada para mostrarse al cliente (sin el enmascarado de
   * toPublicResponseDto). Mismo patrón que
   * CategoriesService.findActivaByIdOrThrow, que ProductsService ya usa
   * de la misma forma. */
  async findActivoByIdOrThrow(id: number): Promise<ProductEntity> {
    try {
      const product = await this.productRepository.findOne({
        where: { idProducto: id, deletedAt: IsNull() },
      });

      if (!product) {
        throw new BadRequestException(
          'Uno de los productos del pedido no existe o ya no está disponible',
        );
      }

      return product;
    } catch (error) {
      handleServiceError(
        error,
        productsErrorLogger,
        'ProductsService.findActivoByIdOrThrow',
        'Error al validar el producto',
        { id },
      );
    }
  }

  async actualizarProducto(
    id: number,
    dto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    try {
      await this.getProductoWithDeleted(id); // lanza NotFoundException si no existe

      if (Object.keys(dto).length > 0) {
        const { idCategoria, ...resto } = dto;
        const updateData: Partial<ProductEntity> = { ...resto };

        // idCategoria solo se toca si vino explícitamente en el body —
        // 'idCategoria' in dto distingue "no mandaron el campo" (undefined,
        // no tocar) de "lo mandaron en null" (sacarle la categoría).
        if ('idCategoria' in dto) {
          updateData.categoria = await this.resolverCategoria(idCategoria);
        }

        await this.productRepository.save({ idProducto: id, ...updateData });

        updateLogger.info(
          `Producto actualizado (ID ${id}): campos ${JSON.stringify(Object.keys(dto))}`,
        );
      }

      const updated = await this.getProductoWithDeleted(id);
      return this.toResponseDto(updated);
    } catch (error) {
      handleServiceError(
        error,
        productsErrorLogger,
        'ProductsService.actualizarProducto',
        'Ocurrió un error al actualizar el producto',
        { id },
      );
    }
  }

  /** ajuste masivo de precio — ver BulkPriceAdjustmentDto para el
   * contrato completo (por categoría vs. general, porcentaje vs. fijo).
   * ADMIN-only (ver ProductsController): a diferencia de crear/editar un
   * producto individual, este endpoint puede tocar miles de filas de una
   * sola vez, así que no es algo que un USER deba poder disparar sobre el
   * catálogo entero aunque sea dueño de algunos de esos productos.
   *
   * Implementado como un único UPDATE con una expresión SQL (no un
   * find() + loop de N save()) a propósito: con miles de productos, leer
   * todo a memoria y guardarlos de a uno sería lento y innecesario —
   * MySQL puede resolver "precio = precio * 1.1" para todas las filas que
   * matcheen en una sola pasada. GREATEST(...,0) es el piso de seguridad:
   * ningún ajuste (ni un % muy negativo, ni un descuento fijo mayor al
   * precio actual) puede dejar un precio negativo, sin necesidad de leer
   * cada precio de antemano para validarlo en JS. */
  async ajustarPreciosMasivo(
    dto: BulkPriceAdjustmentDto,
  ): Promise<BulkPriceAdjustmentResponseDto> {
    try {
      if (dto.idCategoria !== undefined && dto.idCategoria !== null) {
        // valida que la categoría exista antes de tocar nada — mismo
        // criterio que resolverCategoria: sin este chequeo, un id
        // inexistente no rompería nada (el WHERE de abajo simplemente no
        // matchearía ninguna fila), pero el admin recibiría "0 productos
        // afectados" sin saber si eso es porque la categoría está vacía o
        // porque el id está mal.
        await this.categoriesService.findActivaByIdOrThrow(dto.idCategoria);
      }

      // GREATEST(...,0) es el piso (nunca negativo) y LEAST(...,PRECIO_MAX)
      // el techo: un aumento sobre un precio ya alto no puede desbordar
      // DECIMAL(10,2) (MySQL en modo estricto tiraría un error 500 y no
      // se aplicaría NINGÚN cambio).
      const formula =
        dto.tipo === TipoAjustePrecio.PORCENTAJE
          ? `LEAST(GREATEST(ROUND(precio * (1 + :valor / 100), 2), 0), ${PRECIO_MAX})`
          : `LEAST(GREATEST(ROUND(precio + :valor, 2), 0), ${PRECIO_MAX})`;

      const queryBuilder = this.productRepository
        .createQueryBuilder()
        .update(ProductEntity)
        .set({ precio: () => formula })
        .setParameter('valor', dto.valor);

      // sin idCategoria: afecta TODO el catálogo, productos dados de baja
      // incluidos — un UPDATE de TypeORM no filtra soft-delete
      // automáticamente (a diferencia de find/findOne), y acá es
      // deliberado: un producto pausado conserva el precio ajustado para
      // cuando se reactive, en vez de quedar con un precio desactualizado.
      if (dto.idCategoria !== undefined && dto.idCategoria !== null) {
        queryBuilder.where('id_categoria = :idCategoria', {
          idCategoria: dto.idCategoria,
        });
      }

      const result = await queryBuilder.execute();
      const productosAfectados = result.affected ?? 0;

      updateLogger.info(
        `Ajuste masivo de precio: tipo=${dto.tipo} valor=${dto.valor} categoria=${
          dto.idCategoria ?? 'todas'
        } productosAfectados=${productosAfectados}`,
      );

      return { productosAfectados };
    } catch (error) {
      handleServiceError(
        error,
        productsErrorLogger,
        'ProductsService.ajustarPreciosMasivo',
        'Error al aplicar el ajuste masivo de precio',
        { idCategoria: dto.idCategoria, tipo: dto.tipo, valor: dto.valor },
      );
    }
  }

  /** reemplaza la imagen del producto (mismo patrón que
   * UsersService.actualizarFoto: si ya tenía una imagen anterior, la borra
   * del disco para no dejar archivos huérfanos en uploads/products).
   * ADMIN puede tocar la imagen de cualquier producto; USER solo la del
   * que él mismo cargó (ver ProductEntity.creadoPor) — RolesGuard ya deja
   * pasar a ambos roles por el @Auth del controller, así que la
   * diferencia de permisos se resuelve acá adentro.
   *
   * Esto sigue siendo solo la portada (imageFile) — para agregar/quitar
   * fotos de la galería ver agregarFoto/eliminarFoto. */
  async actualizarImagen(
    id: number,
    file: Express.Multer.File,
    activeUser: UserActiveInterface,
  ): Promise<ProductResponseDto> {
    try {
      if (!file) {
        throw new BadRequestException('Debe adjuntar una imagen');
      }

      const product = await this.getProductoWithDeleted(id);

      if (
        activeUser.role !== Role.ADMIN &&
        product.creadoPor?.idUser !== activeUser.idUser
      ) {
        throw new ForbiddenException(
          'No podés modificar la imagen de un producto que no cargaste vos',
        );
      }

      if (product.imageFile) {
        const rutaAnterior = join(
          process.cwd(),
          'uploads',
          'products',
          product.imageFile,
        );

        if (existsSync(rutaAnterior)) {
          unlinkSync(rutaAnterior);
        }
      }

      await this.productRepository.update(id, { imageFile: file.filename });
      updateLogger.info(`Imagen de producto actualizada (ID ${id})`);

      const updated = await this.getProductoWithDeleted(id);
      return this.toResponseDto(updated);
    } catch (error) {
      handleServiceError(
        error,
        productsErrorLogger,
        'ProductsService.actualizarImagen',
        'Error al actualizar la imagen del producto',
        { id },
      );
    }
  }

  /** agrega una foto nueva a la galería del producto — a diferencia de
   * actualizarImagen (que reemplaza la portada), esto se suma a las fotos
   * que ya tiene, sin tocarlas. Mismo chequeo de ownership que
   * actualizarImagen/activarProducto: ADMIN sin restricción, USER solo en
   * productos que él mismo cargó. */
  async agregarFoto(
    id: number,
    file: Express.Multer.File,
    activeUser: UserActiveInterface,
  ): Promise<ProductResponseDto> {
    try {
      if (!file) {
        throw new BadRequestException('Debe adjuntar una imagen');
      }

      const product = await this.getProductoWithDeleted(id);

      if (
        activeUser.role !== Role.ADMIN &&
        product.creadoPor?.idUser !== activeUser.idUser
      ) {
        throw new ForbiddenException(
          'No podés agregar fotos a un producto que no cargaste vos',
        );
      }

      await this.productImageRepository.save({
        producto: { idProducto: id } as ProductEntity,
        imageFile: file.filename,
      });

      insertLogger.info(
        `Foto agregada a producto (ID ${id}): ${file.filename}`,
      );

      const updated = await this.getProductoWithDeleted(id);
      return this.toResponseDto(updated);
    } catch (error) {
      handleServiceError(
        error,
        productsErrorLogger,
        'ProductsService.agregarFoto',
        'Error al agregar la foto al producto',
        { id },
      );
    }
  }

  /** elimina una foto puntual de la galería del producto (por su ID, no
   * todas) — mismo chequeo de ownership que agregarFoto. Además valida
   * que la foto realmente pertenezca al producto :id (no solo que exista
   * en la base): sin este chequeo, un USER dueño de su propio producto
   * podría adivinar el ID de una foto de un producto ajeno y borrarla
   * igual, porque el ownership de arriba solo mira el producto de la URL,
   * no de quién es cada fila de product_images. */
  async eliminarFoto(
    id: number,
    idFoto: number,
    activeUser: UserActiveInterface,
  ): Promise<ProductResponseDto> {
    try {
      const product = await this.getProductoWithDeleted(id);

      if (
        activeUser.role !== Role.ADMIN &&
        product.creadoPor?.idUser !== activeUser.idUser
      ) {
        throw new ForbiddenException(
          'No podés eliminar fotos de un producto que no cargaste vos',
        );
      }

      const foto = await this.productImageRepository.findOne({
        where: {
          idProductoImagen: idFoto,
          producto: { idProducto: id },
        },
      });

      if (!foto) {
        throw new NotFoundException('Foto no encontrada');
      }

      const ruta = join(process.cwd(), 'uploads', 'products', foto.imageFile);

      if (existsSync(ruta)) {
        unlinkSync(ruta);
      }

      await this.productImageRepository.delete(foto.idProductoImagen);
      deleteLogger.info(
        `Foto eliminada de producto (ID ${id}, foto ID ${idFoto})`,
      );

      const updated = await this.getProductoWithDeleted(id);
      return this.toResponseDto(updated);
    } catch (error) {
      handleServiceError(
        error,
        productsErrorLogger,
        'ProductsService.eliminarFoto',
        'Error al eliminar la foto del producto',
        { id, idFoto },
      );
    }
  }

  async darDeBajaProducto(id: number): Promise<void> {
    try {
      const product = await this.getProductoWithDeleted(id);

      if (product.deletedAt) {
        throw new BadRequestException('El producto ya está inactivo');
      }

      await this.productRepository.softDelete(id);
      deleteLogger.info(`Producto dado de baja (ID ${id}, soft-delete)`);
    } catch (error) {
      handleServiceError(
        error,
        productsErrorLogger,
        'ProductsService.darDeBajaProducto',
        'Ocurrió un error al desactivar el producto',
        { id },
      );
    }
  }

  /** ADMIN puede reactivar cualquier producto; USER solo el que él mismo
   * cargó (mismo criterio y mismo chequeo que actualizarImagen). */
  async activarProducto(
    id: number,
    activeUser: UserActiveInterface,
  ): Promise<void> {
    try {
      const product = await this.getProductoWithDeleted(id);

      if (
        activeUser.role !== Role.ADMIN &&
        product.creadoPor?.idUser !== activeUser.idUser
      ) {
        throw new ForbiddenException(
          'No podés reactivar un producto que no cargaste vos',
        );
      }

      if (!product.deletedAt) {
        throw new BadRequestException('El producto ya está activo');
      }

      await this.productRepository.restore(id);
      // restore() revierte un soft-delete — se audita con updateLogger (no
      // deleteLogger) porque semánticamente es la operación inversa, no un
      // borrado (mismo criterio que UsersService.activarUsuario).
      updateLogger.info(`Producto reactivado (ID ${id}, restore)`);
    } catch (error) {
      handleServiceError(
        error,
        productsErrorLogger,
        'ProductsService.activarProducto',
        'Ocurrió un error al activar el producto',
        { id },
      );
    }
  }

  /** endpoint dedicado (mismo patrón que actualizarImagen/activarProducto)
   * para que un USER pueda tocar la visibilidad pública del stock en un
   * producto propio, sin abrir el PATCH general (ADMIN-only) a otros
   * roles — ver UpdateStockVisibilityDto. ADMIN también puede usarlo (o,
   * como cualquier otro campo, setearlo directo en actualizarProducto). */
  async actualizarVisibilidadStock(
    id: number,
    mostrarStock: boolean,
    activeUser: UserActiveInterface,
  ): Promise<ProductResponseDto> {
    try {
      const product = await this.getProductoWithDeleted(id);

      if (
        activeUser.role !== Role.ADMIN &&
        product.creadoPor?.idUser !== activeUser.idUser
      ) {
        throw new ForbiddenException(
          'No podés modificar la visibilidad del stock de un producto que no cargaste vos',
        );
      }

      await this.productRepository.update(id, { mostrarStock });
      updateLogger.info(
        `Visibilidad de stock actualizada (ID ${id}): mostrarStock=${mostrarStock}`,
      );

      const updated = await this.getProductoWithDeleted(id);
      return this.toResponseDto(updated);
    } catch (error) {
      handleServiceError(
        error,
        productsErrorLogger,
        'ProductsService.actualizarVisibilidadStock',
        'Error al actualizar la visibilidad del stock',
        { id },
      );
    }
  }

  /** valida el idCategoria que manda el cliente contra una categoría real
   * (ver CategoriesService.findActivaByIdOrThrow) — undefined/null significa
   * "sin categoría". */
  private async resolverCategoria(
    idCategoria: number | null | undefined,
  ): Promise<CategoryEntity | null> {
    if (idCategoria === null || idCategoria === undefined) {
      return null;
    }

    return this.categoriesService.findActivaByIdOrThrow(idCategoria);
  }

  private async getProductoWithDeleted(id: number): Promise<ProductEntity> {
    const product = await this.productRepository.findOne({
      where: { idProducto: id },
      relations: [...RELACIONES_LECTURA],
      withDeleted: true,
      order: ORDEN_FOTOS,
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    return product;
  }

  private toResponseDto(product: ProductEntity): ProductResponseDto {
    return {
      idProducto: product.idProducto,
      nombre: product.nombre,
      descripcion: product.descripcion,
      precio: product.precio,
      stock: product.stock,
      categoria: product.categoria
        ? {
            idCategoria: product.categoria.idCategoria,
            nombre: product.categoria.nombre,
          }
        : null,
      imageUrl: product.imageFile
        ? `/uploads/products/${product.imageFile}`
        : null,
      // (product.fotos ?? []) por las dudas: si algún llamador interno
      // llegara a construir el DTO a partir de un product sin la relación
      // 'fotos' cargada, mejor un array vacío que un undefined que rompa
      // al cliente.
      fotos: (product.fotos ?? []).map((foto) => ({
        idProductoImagen: foto.idProductoImagen,
        imageUrl: `/uploads/products/${foto.imageFile}`,
      })),
      mostrarStock: product.mostrarStock,
      deletedAt: product.deletedAt,
    };
  }

  /** versión del DTO para lecturas públicas (catálogo, detalle público):
   * no revela el stock real si el dueño eligió ocultarlo — ver
   * ProductEntity.mostrarStock. `mostrarStock` en sí siempre viaja con su
   * valor real (no es información sensible, y el frontend la necesita
   * para distinguir "sin stock" de "el dueño no quiere mostrar el
   * stock"). */
  private toPublicResponseDto(product: ProductEntity): ProductResponseDto {
    const dto = this.toResponseDto(product);
    return product.mostrarStock ? dto : { ...dto, stock: null };
  }
}
