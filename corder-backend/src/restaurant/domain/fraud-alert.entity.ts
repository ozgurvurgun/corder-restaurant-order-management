import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';

export type FraudRuleCode =
  | 'POST_PRINT_VOID_OR_DISCOUNT'
  | 'CLOSED_CHECK_DOWNGRADE'
  | 'EXCESSIVE_VOID_PATTERN'
  | 'TRANSFER_THEN_VOID'
  | 'CASH_DRAWER_DISCREPANCY'
  | 'UNUSUAL_CASH_OUT'
  | 'BOUNDARY_DISCOUNT_ABUSE'
  | 'OFF_HOURS_SENSITIVE_ACTION';

export type FraudAlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export type FraudAlertStatus =
  | 'open'
  | 'investigating'
  | 'resolved'
  | 'false_positive';

@Entity('fraud_alerts')
@Index(['restaurantId'])
@Index(['restaurantId', 'status'])
@Index(['restaurantId', 'createdAt'])
export class FraudAlertEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'restaurant_id', type: 'uuid' })
  restaurantId!: string;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant!: RestaurantEntity;

  @Column({ name: 'rule_code', type: 'varchar', length: 64 })
  ruleCode!: FraudRuleCode;

  @Column({ type: 'varchar', length: 16 })
  severity!: FraudAlertSeverity;

  @Column({ name: 'risk_score', type: 'int', default: 50 })
  riskScore!: number;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'actor_name', type: 'varchar', length: 160, nullable: true })
  actorName!: string | null;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId!: string | null;

  @Column({ name: 'table_name', type: 'varchar', length: 120, nullable: true })
  tableName!: string | null;

  @Column({
    name: 'amount_impact',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  amountImpact!: number;

  @Column({ type: 'varchar', length: 24, default: 'open' })
  status!: FraudAlertStatus;

  @Column({ name: 'resolution_note', type: 'text', nullable: true })
  resolutionNote!: string | null;

  @Column({ name: 'resolved_by', type: 'varchar', length: 160, nullable: true })
  resolvedBy!: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  evidence!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
