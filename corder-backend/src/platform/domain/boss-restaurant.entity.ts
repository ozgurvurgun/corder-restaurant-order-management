import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { RootAdminEntity } from './root-admin.entity';
import { RestaurantEntity } from './restaurant.entity';

@Entity('boss_restaurants')
@Index(['bossId', 'restaurantId'], { unique: true })
@Index(['restaurantId'])
export class BossRestaurantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'boss_id', type: 'uuid' })
  bossId: string;

  @ManyToOne(() => RootAdminEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'boss_id' })
  boss: RootAdminEntity;

  @Column({ name: 'restaurant_id', type: 'uuid' })
  restaurantId: string;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity;

  @Column({ name: 'title', type: 'varchar', length: 80, default: 'Owner' })
  title: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

