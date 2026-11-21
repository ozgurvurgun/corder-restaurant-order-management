import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { numericColumnTransformer } from '../../common/database/numeric-column.transformer';
import { fromMinorUnits, toMinorUnits } from '../../common/money/minor-units';
import { CarriedOverTableSnapshotItem } from './services/shift-auto-close.policy';

export type { CarriedOverTableSnapshotItem };

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
@Index(['restaurantId', 'status'])
@Index('IDX_cash_shifts_restaurant_opened_at', ['restaurantId', 'openedAt'])
@Index('IDX_cash_shifts_one_open_per_restaurant', ['restaurantId'], {
  unique: true,
  where: `"status" = 'open'`,
})
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

  @Column({
    name: 'opening_balance',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericColumnTransformer,
  })
  openingBalance: number;

  @Column({
    name: 'closing_balance',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: numericColumnTransformer,
  })
  closingBalance: number | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({
    name: 'cash_in',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericColumnTransformer,
  })
  cashIn: number;

  @Column({
    name: 'cash_out',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericColumnTransformer,
  })
  cashOut: number;

  @Column({
    name: 'total_revenue',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericColumnTransformer,
  })
  totalRevenue: number;

  @Column({
    name: 'total_cash',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericColumnTransformer,
  })
  totalCash: number;

  @Column({
    name: 'total_card',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericColumnTransformer,
  })
  totalCard: number;

  @Column({
    name: 'total_meal_card',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericColumnTransformer,
  })
  totalMealCard: number;

  @Column({
    name: 'total_multinet',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericColumnTransformer,
  })
  totalMultinet: number;

  @Column({ name: 'transaction_count', type: 'integer', default: 0 })
  transactionCount: number;

  @Column({ name: 'is_auto_closed', type: 'boolean', default: false })
  isAutoClosed: boolean;

  @Column({ name: 'carried_over_tables_count', type: 'integer', default: 0 })
  carriedOverTablesCount: number;

  @Column({
    name: 'carried_over_tables_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericColumnTransformer,
  })
  carriedOverTablesAmount: number;

  @Column({
    name: 'carried_over_tables_snapshot',
    type: 'jsonb',
    nullable: true,
  })
  carriedOverTablesSnapshot: CarriedOverTableSnapshotItem[] | null;

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
    this.cashIn = fromMinorUnits(
      Math.max(0, toMinorUnits(this.cashIn) + diff.cashDiffMinorUnits),
    );
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

  /**
   * Records a non-cash debt/open-account collection on the active shift.
   * Note: `totalRevenue` is recognized at check-settlement time (`recordCheckSettlement`),
   * whereas debt collections update the tender-specific collection totals and transaction count.
   */
  recordNonCashCollection(
    paymentMethod: 'credit-card' | 'meal-card' | 'multinet',
    amountMinorUnits: number,
  ): void {
    if (amountMinorUnits <= 0) return;
    if (paymentMethod === 'credit-card') {
      this.totalCard = fromMinorUnits(toMinorUnits(this.totalCard) + amountMinorUnits);
    } else if (paymentMethod === 'meal-card') {
      this.totalMealCard = fromMinorUnits(
        toMinorUnits(this.totalMealCard) + amountMinorUnits,
      );
    } else if (paymentMethod === 'multinet') {
      this.totalMultinet = fromMinorUnits(
        toMinorUnits(this.totalMultinet) + amountMinorUnits,
      );
    }
    this.transactionCount = (this.transactionCount ?? 0) + 1;
  }

  recordCashMovement(
    type: string,
    amountMinorUnits: number,
    incrementCount = true,
    reference?: string | null,
  ): void {
    const normalizedRef = (reference ?? '').trim().toLowerCase();
    const isCardExpense = type === 'expense' && normalizedRef === 'credit-card';
    if (type === 'cash-in' || type === 'sale') {
      this.cashIn = fromMinorUnits(toMinorUnits(this.cashIn) + amountMinorUnits);
    } else if (!isCardExpense) {
      this.cashOut = fromMinorUnits(toMinorUnits(this.cashOut) + amountMinorUnits);
    }
    if (incrementCount) {
      this.transactionCount = (this.transactionCount ?? 0) + 1;
    }
  }

  closeShift(
    closedBy: string,
    closingBalanceMinorUnits: number,
    notes?: string | null,
    options?: {
      isAutoClosed?: boolean;
      closedAt?: Date;
      carriedOverTablesCount?: number;
      carriedOverTablesAmountMinorUnits?: number;
      carriedOverTablesSnapshot?: CarriedOverTableSnapshotItem[] | null;
    },
  ): void {
    this.closedAt = options?.closedAt ?? new Date();
    this.closedBy = closedBy;
    this.closingBalance = fromMinorUnits(closingBalanceMinorUnits);
    this.notes = notes ?? null;
    this.isAutoClosed = Boolean(options?.isAutoClosed);
    this.carriedOverTablesCount = Math.max(
      0,
      Math.floor(options?.carriedOverTablesCount ?? 0),
    );
    this.carriedOverTablesAmount = fromMinorUnits(
      Math.max(0, options?.carriedOverTablesAmountMinorUnits ?? 0),
    );
    this.carriedOverTablesSnapshot =
      options?.carriedOverTablesSnapshot &&
      options.carriedOverTablesSnapshot.length > 0
        ? options.carriedOverTablesSnapshot
        : null;
    this.status = 'closed';
  }
}
