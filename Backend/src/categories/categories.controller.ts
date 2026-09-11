import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Auth } from '@/auth/decorators/auth.decorator';
import { Role } from '@/common/enums/role.enum';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('categorias')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /** público — alimenta el <select> del catálogo y del form de productos */
  @Get()
  async findAll() {
    return this.categoriesService.findAllActivas();
  }

  /** listado del panel ADMIN (incluye dadas de baja). Declarado ANTES de
   * cualquier ruta con :id por las dudas, aunque acá no colisiona. */
  @Auth(Role.ADMIN)
  @Get('admin/listado')
  async findAllAdmin() {
    return this.categoriesService.findAllAdmin();
  }

  @Auth(Role.ADMIN)
  @Post()
  async create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.crearCategoria(dto);
  }

  @Auth(Role.ADMIN)
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.actualizarCategoria(id, dto);
  }

  @Auth(Role.ADMIN)
  @Delete(':id')
  async darDeBaja(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.categoriesService.darDeBajaCategoria(id);
  }

  @Auth(Role.ADMIN)
  @Patch(':id/activar')
  async activar(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.categoriesService.activarCategoria(id);
  }
}
