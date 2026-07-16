import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { StockMaterialEntity } from './stock-material.entity';
import { SupplierEntity } from './supplier.entity';

@Entity('stock_movements')
@Index(['restaurantId', 'materialId', 'createdAt'])
export class StockMovementEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'restaurant_id' })
  restaurantId: string;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity;

  @Column({ name: 'material_id' })
  materialId: string;

  @ManyToOne(() => StockMaterialEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'material_id' })
  material: StockMaterialEntity;

  @Column({ name: 'material_name' })
  materialName: string;

  @Column({ type: 'varchar', length: 32 })
  type: 'in' | 'out' | 'waste' | 'count-adjustment';

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  quantity: number;

  @Column({ name: 'previous_stock', type: 'decimal', precision: 12, scale: 3 })
  previousStock: number;

  @Column({ name: 'new_stock', type: 'decimal', precision: 12, scale: 3 })
  newStock: number;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 12, scale: 4, nullable: true })
  unitCost: number | null;

  @Column({ name: 'total_cost', type: 'decimal', precision: 12, scale: 4, nullable: true })
  totalCost: number | null;

  @Column({ name: 'supplier_id', type: 'uuid', nullable: true })
  supplierId: string | null;

  @ManyToOne(() => SupplierEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: SupplierEntity | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'created_by' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

