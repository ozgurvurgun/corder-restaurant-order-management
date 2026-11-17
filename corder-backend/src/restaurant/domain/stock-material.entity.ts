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

  @Column({ type: 'varchar', length: 128, default: 'Other' })
  category: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  applyDelta(delta: number): { previousStock: number; newStock: number } {
    const previousStock = Number(this.currentStock ?? 0);
    const newStock = Number((previousStock + delta).toFixed(3));
    this.currentStock = newStock;
    return { previousStock, newStock };
  }

  /**
   * Updates unit cost using Weighted Moving Average Cost when positive stock is on hand,
   * or falls back to Last Cost when previous stock or previous cost is <= 0.
   */
  applyCostUpdate(
    addedQuantity: number,
    incomingUnitCost?: number | null,
    stockBeforeAddition?: number,
  ): void {
    const unitCost = Number(incomingUnitCost);
    if (!Number.isFinite(unitCost) || unitCost <= 0 || addedQuantity <= 0) {
      return;
    }
    const prevStock = Math.max(0, Number(stockBeforeAddition ?? this.currentStock ?? 0));
    const prevCost = Number(this.costPerUnit ?? 0);
    if (prevStock > 0 && prevCost > 0) {
      const weightedAvg =
        (prevStock * prevCost + addedQuantity * unitCost) / (prevStock + addedQuantity);
      this.costPerUnit = Number(weightedAvg.toFixed(4));
    } else {
      this.costPerUnit = Number(unitCost.toFixed(4));
    }
  }
}
