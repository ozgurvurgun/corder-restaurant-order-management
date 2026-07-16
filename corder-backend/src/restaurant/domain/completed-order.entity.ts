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

@Entity('completed_orders')
@Index(['restaurantId', 'closedAt'])
@Index(['restaurantId', 'waiter'])
export class CompletedOrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'restaurant_id' })
  restaurantId: string;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity;

  @Column({ name: 'table_name', type: 'varchar', length: 255 })
  tableName: string;

  @Column({ name: 'section', type: 'varchar', length: 255 })
  section: string;

  @Column({ name: 'waiter', type: 'varchar', length: 255 })
  waiter: string;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2 })
  totalAmount: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ name: 'net_amount', type: 'decimal', precision: 12, scale: 2 })
  netAmount: number;

  @Column({ name: 'closed_by', type: 'varchar', length: 255 })
  closedBy: string;

  @Column({ name: 'opened_at', type: 'timestamptz' })
  openedAt: Date;

  @Column({ name: 'closed_at', type: 'timestamptz' })
  closedAt: Date;

  @Column({ name: 'payment_method', type: 'varchar', length: 50 })
  paymentMethod: string;

  @Column({ name: 'payment_split', type: 'jsonb', nullable: true })
  paymentSplit: unknown | null;

  @Column({ name: 'payment_discount', type: 'jsonb', nullable: true })
  paymentDiscount: unknown | null;

  @Column({ name: 'payment_tip', type: 'decimal', precision: 12, scale: 2, default: 0 })
  paymentTip: number;

  @Column({ name: 'orders_snapshot', type: 'jsonb' })
  ordersSnapshot: unknown;

  @Column({ name: 'payment_snapshot', type: 'jsonb' })
  paymentSnapshot: unknown;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

