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

@Entity('inventory_counts')
@Index(['restaurantId', 'createdAt'])
export class InventoryCountEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'restaurant_id' })
  restaurantId: string;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity;

  @Column({ type: 'timestamptz' })
  date: Date;

  @Column({ name: 'counted_by' })
  countedBy: string;

  @Column({ type: 'jsonb' })
  items: {
    materialId: string;
    materialName: string;
    expectedStock: number;
    actualStock: number;
    difference: number;
  }[];

  @Column({ type: 'varchar', length: 32 })
  status: 'in-progress' | 'completed';

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

