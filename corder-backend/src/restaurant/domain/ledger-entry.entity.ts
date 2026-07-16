import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { LedgerCustomerEntity } from './ledger-customer.entity';

@Entity('ledger_entries')
@Index(['restaurantId'])
@Index(['customerId'])
export class LedgerEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'restaurant_id' })
  restaurantId: string;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity;

  @Column({ name: 'customer_id' })
  customerId: string;

  @ManyToOne(() => LedgerCustomerEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: LedgerCustomerEntity;

  /** borc = table to ledger; tahsilat = payment; credit = debt reversal (unassign from check) */
  @Column({ name: 'entry_type', type: 'varchar', length: 20 })
  entryType: 'debt' | 'payment' | 'credit';

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'table_id', type: 'uuid', nullable: true })
  tableId: string | null;

  @Column({ name: 'table_name', type: 'varchar', length: 255, nullable: true })
  tableName: string | null;

  @Column({ name: 'completed_order_id', type: 'uuid', nullable: true })
  completedOrderId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  snapshot: unknown | null;

  @Column({ name: 'received_by', type: 'varchar', length: 255, nullable: true })
  receivedBy: string | null;

  @Column({ name: 'received_by_user_id', type: 'varchar', length: 36, nullable: true })
  receivedByUserId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
