import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryEntity } from './entities/category.entity';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CategoryEntity])],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  // se exporta para que ProductsModule pueda validar el idCategoria que
  // manda el cliente contra una categoría real (ver ProductsService).
  exports: [CategoriesService],
})
export class CategoriesModule {}
