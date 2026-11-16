import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { fromMinorUnits, toMinorUnits } from '../../common/money/minor-units';

export interface CheckSettlementShiftUpdate {
  netMinorUnits: number;
  cashMinorUnits: number;
  cardMinorUnits: number;
  mealCardMinorUnits: number;
  multinetMinorUnits: number;
}

export interface CheckSettlementShiftDiff {
  netDiffMinorUnits: number;
  cashDiffMinorUnits: number;
  cardDiffMinorUnits: number;
  mealCardDiffMinorUnits: number;
  multinetDiffMinorUnits: number;
}

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

  @Column({ name: 'total_cash', type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalCash: number;

  @Column({ name: 'total_card', type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalCard: number;

  @Column({ name: 'total_meal_card', type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalMealCard: number;

  @Column({ name: 'total_multinet', type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalMultinet: number;

  @Column({ name: 'transaction_count', type: 'integer', default: 0 })
  transactionCount: number;

  recordCheckSettlement(update: CheckSettlementShiftUpdate): void {
    if (update.cashMinorUnits > 0) {
      this.cashIn = fromMinorUnits(toMinorUnits(this.cashIn) + update.cashMinorUnits);
    }
    this.totalRevenue = fromMinorUnits(toMinorUnits(this.totalRevenue) + update.netMinorUnits);
    this.totalCash = fromMinorUnits(toMinorUnits(this.totalCash) + update.cashMinorUnits);
    this.totalCard = fromMinorUnits(toMinorUnits(this.totalCard) + update.cardMinorUnits);
    this.totalMealCard = fromMinorUnits(
      toMinorUnits(this.totalMealCard) + update.mealCardMinorUnits,
    );
    this.totalMultinet = fromMinorUnits(
      toMinorUnits(this.totalMultinet) + update.multinetMinorUnits,
    );
    this.transactionCount = (this.transactionCount ?? 0) + 1;
  }

  adjustSettlementDiff(diff: CheckSettlementShiftDiff): void {
    this.totalRevenue = fromMinorUnits(
      Math.max(0, toMinorUnits(this.totalRevenue) + diff.netDiffMinorUnits),
    );
    this.totalCash = fromMinorUnits(
      Math.max(0, toMinorUnits(this.totalCash) + diff.cashDiffMinorUnits),
    );
    this.totalCard = fromMinorUnits(
      Math.max(0, toMinorUnits(this.totalCard) + diff.cardDiffMinorUnits),
    );
    this.totalMealCard = fromMinorUnits(
      Math.max(0, toMinorUnits(this.totalMealCard) + diff.mealCardDiffMinorUnits),
    );
    this.totalMultinet = fromMinorUnits(
      Math.max(0, toMinorUnits(this.totalMultinet) + diff.multinetDiffMinorUnits),
    );
  }

  recordCashMovement(type: string, amountMinorUnits: number): void {
    if (type === 'cash-in' || type === 'sale') {
      this.cashIn = fromMinorUnits(toMinorUnits(this.cashIn) + amountMinorUnits);
    } else {
      this.cashOut = fromMinorUnits(toMinorUnits(this.cashOut) + amountMinorUnits);
    }
    this.transactionCount = (this.transactionCount ?? 0) + 1;
  }

  closeShift(closedBy: string, closingBalanceMinorUnits: number, notes?: string | null): void {
    this.closedAt = new Date();
    this.closedBy = closedBy;
    this.closingBalance = fromMinorUnits(closingBalanceMinorUnits);
    this.notes = notes ?? null;
    this.status = 'closed';
  }
}
