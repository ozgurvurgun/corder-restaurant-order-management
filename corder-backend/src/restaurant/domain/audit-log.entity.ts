import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';

export type AuditCategory =
  | 'auth'
  | 'order'
  | 'payment'
  | 'product'
  | 'user'
  | 'settings'
  | 'stock'
  | 'kasa'
  | 'table';

@Entity('restaurant_audit_logs')
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  restaurantId!: string;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  restaurant!: RestaurantEntity;

  @Column({ length: 64 })
  userId!: string;

  @Column({ length: 120 })
  userName!: string;

  @Column({ length: 120 })
  action!: string;

  @Column({ type: 'enum', enum: ['auth', 'order', 'payment', 'product', 'user', 'settings', 'stock', 'kasa', 'table'] })
  category!: AuditCategory;

  @Column({ type: 'text' })
  details!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}

