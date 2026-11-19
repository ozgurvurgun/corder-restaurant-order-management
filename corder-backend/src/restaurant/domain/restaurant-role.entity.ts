import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';

@Entity('restaurant_roles')
@Index(['restaurantId', 'key'], { unique: true })
export class RestaurantRoleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'restaurant_id', type: 'uuid' })
  restaurantId: string;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity;

  @Column({ type: 'varchar', length: 64 })
  key: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 32, default: '#e63462' })
  color: string;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem: boolean;

  @Column({ name: 'can_access_panel', type: 'boolean', default: false })
  canAccessPanel: boolean;

  @Column({ name: 'can_access_terminal', type: 'boolean', default: true })
  canAccessTerminal: boolean;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  permissions: string[];

  @Column({ name: 'max_discount_percent', type: 'integer', default: 0 })
  maxDiscountPercent: number;

  @Column({
    name: 'max_discount_amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  maxDiscountAmount: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

