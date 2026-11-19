import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { RestaurantEntity } from './restaurant.entity';

export type BossTier = 'brand_owner' | 'franchise_owner' | 'regional_manager';

@Entity('root_admins')
@Index(['restaurantId'])
@Index(['bossTier'])
export class RootAdminEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'restaurant_id', type: 'uuid', nullable: true })
  restaurantId: string | null;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity | null;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column()
  name: string;

  @Column({ name: 'phone', type: 'varchar', nullable: true })
  phone: string | null;

  /**
   * Hierarchy tier:
   * - 'brand_owner': Brand / Master Franchise Owner (HQ - sees revenue and analytics across all branches)
   * - 'franchise_owner': Branch / Franchise Owner (manages revenue and team for assigned branches)
   * - 'regional_manager': Regional / Group Manager (manages an assigned cluster of branches)
   */
  @Column({ name: 'boss_tier', type: 'varchar', length: 32, default: 'franchise_owner' })
  bossTier: BossTier;

  /** Brand name this Boss owns or belongs to (auto-grants visibility to all brand branches for 'brand_owner'). */
  @Column({ name: 'brand_name', type: 'varchar', length: 120, nullable: true })
  brandName: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
