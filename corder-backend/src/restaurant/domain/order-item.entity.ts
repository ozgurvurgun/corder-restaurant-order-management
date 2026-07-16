import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { OrderEntity } from './order.entity';

@Entity('order_items')
@Index(['orderId'])
export class OrderItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id' })
  orderId: string;

  @ManyToOne(() => OrderEntity, (o) => o.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;

  @Column({ name: 'product_id' })
  productId: string;

  @Column({ name: 'product_name' })
  productName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ default: 'pending' })
  status: string;

  @Column({ name: 'cancel_reason', type: 'varchar', length: 500, nullable: true })
  cancelReason: string | null;

  @Column({ name: 'cancelled_by', type: 'varchar', length: 255, nullable: true })
  cancelledBy: string | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
