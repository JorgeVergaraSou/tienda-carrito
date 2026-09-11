import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Auth } from '@/auth/decorators/auth.decorator';
import { ActiveUser } from '@/common/decorators/active-user.decorator';
import { Role } from '@/common/enums/role.enum';
import { UserActiveInterface } from '@/common/interfaces/user-active.interface';
import {
  productImageFileFilter,
  productImageStorage,
} from '@/common/upload/product-image-upload.config';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FindProductsQueryDto } from './dto/find-products-query.dto';
import { UpdateStockVisibilityDto } from './dto/update-stock-visibility.dto';

@Controller('productos')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /** catálogo público — sin @Auth, no requiere login */
  @Get()
  async findAll(@Query() query: FindProductsQueryDto) {
    return this.productsService.findAllActivos(query);
  }

  /** listado del panel ADMIN (incluye productos dados de baja). Declarado
   * ANTES de GET /admin/:id — mismo forma de ruta ("admin/<segmento>"),
   * así que si se invierte el orden Nest intentaría matchear "listado"
   * como si fuera el :id de abajo. */
  @Auth(Role.ADMIN)
  @Get('admin/listado')
  async findAllAdmin(@Query() query: FindProductsQueryDto) {
    return this.productsService.findAllAdmin(query);
  }

  /** detalle para el panel ADMIN (incluye productos dados de baja) — lo
   * usa la página de editar producto, que puede cargarse directo por URL. */
  @Auth(Role.ADMIN)
  @Get('admin/:id')
  async findOneAdmin(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOneAdmin(id);
  }

  /** productos que el usuario activo cargó él mismo (ADMIN o USER),
   * incluidos los dados de baja — para que el dueño de un producto lo
   * pueda encontrar y reactivar si lo dio de baja por error. Declarado
   * ANTES de GET /:id — mismo forma de ruta ("productos/<segmento>"),
   * mismo motivo que admin/listado vs admin/:id: si se invierte el
   * orden, Nest intentaría matchear "mis-productos" como si fuera el :id. */
  @Auth(Role.ADMIN, Role.USER)
  @Get('mis-productos')
  async misProductos(
    @Query() query: FindProductsQueryDto,
    @ActiveUser() user: UserActiveInterface,
  ) {
    return this.productsService.findMisProductos(query, user);
  }

  /** detalle público de un producto activo */
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOneActivo(id);
  }

  /** USER también puede cargar productos nuevos (no editar/dar de
   * baja/reactivar los existentes, ni tocar la imagen de un producto ya
   * creado — eso sigue siendo solo ADMIN, ver el resto de los endpoints). */
  @Auth(Role.ADMIN, Role.USER)
  @Post()
  async create(
    @Body() dto: CreateProductDto,
    @ActiveUser() user: UserActiveInterface,
  ) {
    return this.productsService.crearProducto(dto, user);
  }

  @Auth(Role.ADMIN)
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.actualizarProducto(id, dto);
  }

  /** USER también puede subir/cambiar la imagen, pero solo la del producto
   * que él mismo cargó — el chequeo de "es tuyo o no" vive en el service
   * (ProductsService.actualizarImagen), no acá: el guard de rol no puede
   * saber de quién es el producto :id, solo qué rol tiene el usuario. */
  @Auth(Role.ADMIN, Role.USER)
  @Post(':id/imagen')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: productImageStorage,
      fileFilter: productImageFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async actualizarImagen(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @ActiveUser() user: UserActiveInterface,
  ) {
    return this.productsService.actualizarImagen(id, file, user);
  }

  /** agrega una foto a la galería del producto (se suma a las que ya
   * tiene, no reemplaza nada — a diferencia de POST /:id/imagen que sí
   * reemplaza la portada). Mismo criterio de permisos que actualizarImagen:
   * USER solo en productos que él mismo cargó, chequeado en el service. */
  @Auth(Role.ADMIN, Role.USER)
  @Post(':id/fotos')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: productImageStorage,
      fileFilter: productImageFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async agregarFoto(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @ActiveUser() user: UserActiveInterface,
  ) {
    return this.productsService.agregarFoto(id, file, user);
  }

  /** elimina una foto puntual de la galería (por su ID, no borra todas) —
   * mismo criterio de permisos que agregarFoto/actualizarImagen. */
  @Auth(Role.ADMIN, Role.USER)
  @Delete(':id/fotos/:idFoto')
  async eliminarFoto(
    @Param('id', ParseIntPipe) id: number,
    @Param('idFoto', ParseIntPipe) idFoto: number,
    @ActiveUser() user: UserActiveInterface,
  ) {
    return this.productsService.eliminarFoto(id, idFoto, user);
  }

  @Auth(Role.ADMIN)
  @Delete(':id')
  async darDeBaja(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.productsService.darDeBajaProducto(id);
  }

  /** USER también puede reactivar, pero solo el producto que él mismo
   * cargó — mismo criterio que actualizarImagen (chequeo de ownership
   * dentro del service, el guard de rol no sabe de quién es el :id). */
  @Auth(Role.ADMIN, Role.USER)
  @Patch(':id/activar')
  async activar(
    @Param('id', ParseIntPipe) id: number,
    @ActiveUser() user: UserActiveInterface,
  ): Promise<void> {
    return this.productsService.activarProducto(id, user);
  }

  /** endpoint dedicado (no el PATCH general, que sigue ADMIN-only) para
   * que USER pueda tocar solo este campo en un producto propio — mismo
   * criterio de ownership que actualizarImagen/activar/agregarFoto. */
  @Auth(Role.ADMIN, Role.USER)
  @Patch(':id/visibilidad-stock')
  async actualizarVisibilidadStock(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStockVisibilityDto,
    @ActiveUser() user: UserActiveInterface,
  ) {
    return this.productsService.actualizarVisibilidadStock(
      id,
      dto.mostrarStock,
      user,
    );
  }
}
