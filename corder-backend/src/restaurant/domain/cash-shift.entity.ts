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

@Entity('cash_shifts')
@Index(['restaurantId'])
@Index(['restaurantId', 'status'])
export class CashShiftEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'restaurant_id' })
  restaurantId: string;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity;

  @Column({ name: 'opened_by', type: 'varchar', length: 255 })
  openedBy: string;

  @Column({ name: 'opened_at', type: 'timestamptz' })
  openedAt: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @Column({ name: 'closed_by', type: 'varchar', length: 255, nullable: true })
  closedBy: string | null;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'open' })
  status: string;

  @Column({ name: 'opening_balance', type: 'numeric', precision: 12, scale: 2, default: 0 })
  openingBalance: number;

  @Column({ name: 'closing_balance', type: 'numeric', precision: 12, scale: 2, nullable: true })
  closingBalance: number | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'cash_in', type: 'numeric', precision: 12, scale: 2, default: 0 })
  cashIn: number;

  @Column({ name: 'cash_out', type: 'numeric', precision: 12, scale: 2, default: 0 })
  cashOut: number;

  @Column({ name: 'total_revenue', type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalRevenue: number;

  @Column({ name: 'total_nakit', type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalNakit: number;

  @Column({ name: 'total_kart', type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalKart: number;

  @Column({ name: 'total_yemek_karti', type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalYemekKarti: number;

  @Column({ name: 'total_multinet', type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalMultinet: number;

  @Column({ name: 'transaction_count', type: 'integer', default: 0 })
  transactionCount: number;
}
