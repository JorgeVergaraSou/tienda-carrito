import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('categories')
export class CategoryEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true, name: 'id_categoria' })
  idCategoria!: number;

  @Column({
    type: 'varchar',
    length: 60,
    unique: true,
    nullable: false,
    name: 'nombre',
  })
  nombre!: string;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
