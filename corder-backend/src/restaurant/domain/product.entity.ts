import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { CategoryEntity } from './category.entity';

@Entity('products')
@Index(['categoryId'])
export class ProductEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'category_id' })
  categoryId: string;

  @ManyToOne(() => CategoryEntity, (c) => c.products, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: CategoryEntity;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ name: 'image_url', type: 'varchar', length: 512, nullable: true })
  imageUrl: string | null;

  @Column({ name: 'in_stock', default: true })
  inStock: boolean;

  @Column({ default: 0 })
  order: number;

  /** Per-product material usage (stock deduction); { materialId, quantity }[] */
  @Column({ type: 'jsonb', nullable: true })
  ingredients: { materialId: string; quantity: number }[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
