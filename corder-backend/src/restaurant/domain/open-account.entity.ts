import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { OpenAccountItemEntity } from './open-account-item.entity';
import { OpenAccountPaymentEntity } from './open-account-payment.entity';

@Entity('open_accounts')
@Index(['restaurantId'])
export class OpenAccountEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'restaurant_id' })
  restaurantId: string;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity;

  @Column({ name: 'customer_name', type: 'varchar', length: 255 })
  customerName: string;

  @Column({ name: 'customer_phone', type: 'varchar', length: 50, nullable: true })
  customerPhone: string | null;

  @Column({ name: 'amount', type: 'numeric', precision: 12, scale: 2 })
  amount: number;

  @Column({ name: 'paid_amount', type: 'numeric', precision: 12, scale: 2, default: 0 })
  paidAmount: number;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'open' })
  status: string;

  @Column({ name: 'description', type: 'text' })
  description: string;

  @Column({ name: 'created_by', type: 'varchar', length: 255 })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @OneToMany(() => OpenAccountItemEntity, (i) => i.openAccount)
  items: OpenAccountItemEntity[];

  @OneToMany(() => OpenAccountPaymentEntity, (p) => p.openAccount)
  payments: OpenAccountPaymentEntity[];
}

