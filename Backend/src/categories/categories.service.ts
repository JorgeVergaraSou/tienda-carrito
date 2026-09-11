import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoryEntity } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryResponseDto } from './dto/responses/category-response.dto';
import { handleServiceError } from '@/common/utils/error-handler.util';
import { categoriesErrorLogger } from '@/config/module-loggers';
import { deleteLogger, insertLogger, updateLogger } from '@/config/db-loggers';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly categoryRepository: Repository<CategoryEntity>,
  ) {}

  async crearCategoria(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    try {
      const created = await this.categoryRepository.save(dto);

      insertLogger.info(
        `Categoría creada: ${JSON.stringify({
          idCategoria: created.idCategoria,
          nombre: created.nombre,
        })}`,
      );

      return this.toResponseDto(created);
    } catch (error) {
      handleServiceError(
        error,
        categoriesErrorLogger,
        'CategoriesService.crearCategoria',
        'Error al crear la categoría',
      );
    }
  }

  /** para el <select> del catálogo público y del form de productos: solo
   * categorías activas */
  async findAllActivas(): Promise<CategoryResponseDto[]> {
    try {
      const categorias = await this.categoryRepository.find({
        order: { nombre: 'ASC' },
      });

      return categorias.map((categoria) => this.toResponseDto(categoria));
    } catch (error) {
      handleServiceError(
        error,
        categoriesErrorLogger,
        'CategoriesService.findAllActivas',
        'Error al buscar categorías',
      );
    }
  }

  /** para el panel ADMIN: incluye las dadas de baja */
  async findAllAdmin(): Promise<CategoryResponseDto[]> {
    try {
      const categorias = await this.categoryRepository.find({
        withDeleted: true,
        order: { nombre: 'ASC' },
      });

      return categorias.map((categoria) => this.toResponseDto(categoria));
    } catch (error) {
      handleServiceError(
        error,
        categoriesErrorLogger,
        'CategoriesService.findAllAdmin',
        'Error al buscar categorías',
      );
    }
  }

  /** usado por ProductsService al crear/editar un producto: solo se puede
   * asignar una categoría activa (no tiene sentido asignar una recién
   * dada de baja a un producto nuevo), y valida que el id exista de
   * verdad en vez de confiar ciegamente en lo que manda el cliente. */
  async findActivaByIdOrThrow(id: number): Promise<CategoryEntity> {
    try {
      const categoria = await this.categoryRepository.findOneBy({
        idCategoria: id,
      });

      if (!categoria) {
        throw new BadRequestException('La categoría seleccionada no existe');
      }

      return categoria;
    } catch (error) {
      handleServiceError(
        error,
        categoriesErrorLogger,
        'CategoriesService.findActivaByIdOrThrow',
        'Error al validar la categoría',
        { id },
      );
    }
  }

  async actualizarCategoria(
    id: number,
    dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    try {
      await this.getCategoriaWithDeleted(id); // lanza NotFoundException si no existe

      if (Object.keys(dto).length > 0) {
        await this.categoryRepository.update(id, dto);

        updateLogger.info(
          `Categoría actualizada (ID ${id}): campos ${JSON.stringify(Object.keys(dto))}`,
        );
      }

      const updated = await this.getCategoriaWithDeleted(id);
      return this.toResponseDto(updated);
    } catch (error) {
      handleServiceError(
        error,
        categoriesErrorLogger,
        'CategoriesService.actualizarCategoria',
        'Ocurrió un error al actualizar la categoría',
        { id },
      );
    }
  }

  async darDeBajaCategoria(id: number): Promise<void> {
    try {
      const categoria = await this.getCategoriaWithDeleted(id);

      if (categoria.deletedAt) {
        throw new BadRequestException('La categoría ya está inactiva');
      }

      // soft-delete: los productos que ya tenían esta categoría asignada
      // (id_categoria como FK) no se ven afectados — la fila sigue
      // existiendo, solo deja de listarse en findAllActivas() para nuevas
      // asignaciones. Mismo criterio que ProductsService/UsersService.
      await this.categoryRepository.softDelete(id);
      deleteLogger.info(`Categoría dada de baja (ID ${id}, soft-delete)`);
    } catch (error) {
      handleServiceError(
        error,
        categoriesErrorLogger,
        'CategoriesService.darDeBajaCategoria',
        'Ocurrió un error al desactivar la categoría',
        { id },
      );
    }
  }

  async activarCategoria(id: number): Promise<void> {
    try {
      const categoria = await this.getCategoriaWithDeleted(id);

      if (!categoria.deletedAt) {
        throw new BadRequestException('La categoría ya está activa');
      }

      await this.categoryRepository.restore(id);
      updateLogger.info(`Categoría reactivada (ID ${id}, restore)`);
    } catch (error) {
      handleServiceError(
        error,
        categoriesErrorLogger,
        'CategoriesService.activarCategoria',
        'Ocurrió un error al activar la categoría',
        { id },
      );
    }
  }

  private async getCategoriaWithDeleted(id: number): Promise<CategoryEntity> {
    const categoria = await this.categoryRepository.findOne({
      where: { idCategoria: id },
      withDeleted: true,
    });

    if (!categoria) {
      throw new NotFoundException('Categoría no encontrada');
    }

    return categoria;
  }

  private toResponseDto(categoria: CategoryEntity): CategoryResponseDto {
    return {
      idCategoria: categoria.idCategoria,
      nombre: categoria.nombre,
      deletedAt: categoria.deletedAt,
    };
  }
}
