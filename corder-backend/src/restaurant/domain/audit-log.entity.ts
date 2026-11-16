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

export type AuditCategory =
  | 'auth'
  | 'order'
  | 'payment'
  | 'product'
  | 'user'
  | 'settings'
  | 'stock'
  | 'cash-register'
  | 'register'
  | 'shift'
  | 'table';

@Entity('restaurant_audit_logs')
@Index(['restaurantId', 'createdAt'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'restaurant_id' })
  restaurantId!: string;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant!: RestaurantEntity;

  @Column({ name: 'user_id', length: 64 })
  userId!: string;

  @Column({ name: 'user_name', length: 120 })
  userName!: string;

  @Column({ length: 120 })
  action!: string;

  @Column({ type: 'varchar', length: 32 })
  category!: AuditCategory;

  @Column({ type: 'text' })
  details!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
