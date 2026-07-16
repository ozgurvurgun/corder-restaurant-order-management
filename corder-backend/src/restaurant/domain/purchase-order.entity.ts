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
import { SupplierEntity } from './supplier.entity';

@Entity('purchase_orders')
@Index(['restaurantId', 'status', 'createdAt'])
export class PurchaseOrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'restaurant_id' })
  restaurantId: string;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity;

  @Column({ name: 'supplier_id' })
  supplierId: string;

  @ManyToOne(() => SupplierEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: SupplierEntity;

  @Column({ name: 'supplier_name' })
  supplierName: string;

  @Column({ type: 'jsonb' })
  items: {
    materialId: string;
    materialName: string;
    quantity: number;
    unitCost: number;
  }[];

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 4 })
  totalAmount: number;

  @Column({ type: 'varchar', length: 32 })
  status: 'draft' | 'ordered' | 'received' | 'cancelled';

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'created_by' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'received_at', type: 'timestamptz', nullable: true })
  receivedAt: Date | null;
}

