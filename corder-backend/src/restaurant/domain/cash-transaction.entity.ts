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
import { CashShiftEntity } from './cash-shift.entity';

@Entity('cash_transactions')
@Index(['restaurantId'])
@Index(['restaurantId', 'shiftId'])
export class CashTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'restaurant_id' })
  restaurantId: string;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity;

  @Column({ name: 'shift_id' })
  shiftId: string;

  @ManyToOne(() => CashShiftEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shift_id' })
  shift: CashShiftEntity;

  @Column({ name: 'type', type: 'varchar', length: 20 })
  type: string;

  @Column({ name: 'amount', type: 'numeric', precision: 12, scale: 2 })
  amount: number;

  @Column({ name: 'description', type: 'text' })
  description: string;

  @Column({ name: 'reference', type: 'varchar', length: 255, nullable: true })
  reference: string | null;

  @Column({ name: 'created_by', type: 'varchar', length: 255 })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

