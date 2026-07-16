import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';

@Entity('stock_materials')
@Index(['restaurantId', 'name'])
export class StockMaterialEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'restaurant_id' })
  restaurantId: string;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity;

  @Column()
  name: string;

  @Column({ type: 'varchar', length: 16 })
  unit: string;

  @Column({ name: 'current_stock', type: 'decimal', precision: 12, scale: 3, default: 0 })
  currentStock: number;

  @Column({ name: 'min_stock', type: 'decimal', precision: 12, scale: 3, default: 0 })
  minStock: number;

  @Column({ name: 'cost_per_unit', type: 'decimal', precision: 12, scale: 4, default: 0 })
  costPerUnit: number;

  @Column({ name: 'supplier_id', type: 'uuid', nullable: true })
  supplierId: string | null;

  @Column({ type: 'varchar', length: 128, default: 'Diger' })
  category: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

