import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type SubscriptionPaymentMethod =
  | 'bank_transfer'
  | 'cash'
  | 'credit_card'
  | 'other';

@Entity('restaurant_subscription_payments')
@Index('IDX_sub_payments_restaurant_paid_at', ['restaurantId', 'paidAt'])
@Index('IDX_sub_payments_paid_at', ['paidAt'])
export class RestaurantSubscriptionPaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'restaurant_id', type: 'uuid' })
  restaurantId: string;

  /** Actual date/time the payment was received/collected. */
  @Column({ name: 'paid_at', type: 'timestamptz' })
  paidAt: Date;

  /** Total amount collected in this transaction (may cover 1 or multiple months). */
  @Column({
    name: 'amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
  })
  amount: string;

  /** Sorted list of canonical YYYY-MM periods covered by this payment. */
  @Column({ name: 'periods', type: 'text', array: true })
  periods: string[];

  @Column({ name: 'period_start', type: 'varchar', length: 7 })
  periodStart: string;

  @Column({ name: 'period_end', type: 'varchar', length: 7 })
  periodEnd: string;

  @Column({ name: 'months_count', type: 'integer', default: 1 })
  monthsCount: number;

  @Column({
    name: 'payment_method',
    type: 'varchar',
    length: 32,
    default: 'bank_transfer',
  })
  paymentMethod: SubscriptionPaymentMethod;

  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'recorded_by', type: 'varchar', length: 120, nullable: true })
  recordedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

