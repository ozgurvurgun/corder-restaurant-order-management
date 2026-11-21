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
import { numericColumnTransformer } from '../../common/database/numeric-column.transformer';

@Entity('products')
@Index(['categoryId'])
@Index('IDX_products_category_order', ['categoryId', 'order'])
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

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: numericColumnTransformer,
  })
  price: number;

  @Column({
    name: 'cost_price',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    default: null,
    transformer: numericColumnTransformer,
  })
  costPrice: number | null;

  @Column({ name: 'image_url', type: 'varchar', length: 512, nullable: true })
  imageUrl: string | null;

  @Column({ name: 'in_stock', default: true })
  inStock: boolean;

  @Column({ name: 'show_in_menu', default: true })
  showInMenu: boolean;

  @Column({ default: 0 })
  order: number;

  /** Per-product material usage (stock deduction); { materialId, quantity, unit? }[] */
  @Column({ type: 'jsonb', nullable: true })
  ingredients: { materialId: string; quantity: number; unit?: string }[] | null;

  /** Optional nutritional energy value in kcal; null when not specified. */
  @Column({ type: 'int', nullable: true, default: null })
  calories: number | null;

  /** Optional normalized allergen list in lowercase; null when not specified. */
  @Column({ type: 'jsonb', nullable: true, default: null })
  allergens: string[] | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
