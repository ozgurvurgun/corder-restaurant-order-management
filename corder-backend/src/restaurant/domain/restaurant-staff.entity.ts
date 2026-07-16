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

export type StaffRole = 'mudur' | 'kasiyer' | 'garson';

@Entity('restaurant_staff')
@Index(['restaurantId'])
@Index(['restaurantId', 'pin'])
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

  /** Numeric user code (4–8 digits) for terminal “next step” login; assigned only from Panel. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  pin: string | null;

  @Column()
  name: string;

  @Column({ type: 'varchar', length: 20 })
  role: StaffRole;

  @Column({ name: 'phone', type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
