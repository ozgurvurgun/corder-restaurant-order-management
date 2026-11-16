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

export const STAFF_ROLES = [
  'branch_manager',
  'shift_supervisor',
  'cashier',
  'head_waiter',
  'waiter',
  'runner',
  'inventory_manager',
  'accountant',
  'manager',
] as const;
export type StaffRole = string;

@Entity('restaurant_staff')
@Index(['restaurantId'])
@Index(['restaurantId', 'isActive'])
@Index(['email'])
export class RestaurantStaffEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'restaurant_id' })
  restaurantId: string;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ name: 'password_hash', type: 'varchar', nullable: true })
  passwordHash: string | null;

  @Column({ name: 'pin_hash', type: 'varchar', length: 120, nullable: true })
  pinHash: string | null;

  @Column()
  name: string;

  @Column({ type: 'varchar', length: 64 })
  role: string;

  @Column({ name: 'phone', type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'can_access_panel', type: 'boolean', default: false })
  canAccessPanel: boolean;

  @Column({ name: 'can_access_terminal', type: 'boolean', default: true })
  canAccessTerminal: boolean;

  @Column({ name: 'permissions_override', type: 'jsonb', nullable: true })
  permissionsOverride: string[] | null;

  @Column({ name: 'granted_permissions', type: 'jsonb', default: () => "'[]'::jsonb" })
  grantedPermissions: string[];

  @Column({ name: 'revoked_permissions', type: 'jsonb', default: () => "'[]'::jsonb" })
  revokedPermissions: string[];

  @Column({ name: 'max_discount_percent_override', type: 'integer', nullable: true })
  maxDiscountPercentOverride: number | null;

  @Column({
    name: 'max_discount_amount_override',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  maxDiscountAmountOverride: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
