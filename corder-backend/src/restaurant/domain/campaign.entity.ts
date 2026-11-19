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
import { numericColumnTransformer } from '../../common/database/numeric-column.transformer';

@Entity('campaigns')
@Index('IDX_campaigns_restaurant_active_order', ['restaurantId', 'isActive', 'order'])
export class CampaignEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'restaurant_id' })
  restaurantId: string;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'image_url' })
  imageUrl: string;

  @Column({ name: 'discount_percent', type: 'int', nullable: true })
  discountPercent: number;

  @Column({
    name: 'original_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: numericColumnTransformer,
  })
  originalPrice: number;

  @Column({
    name: 'discounted_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: numericColumnTransformer,
  })
  discountedPrice: number;

  @Column({ name: 'valid_until', type: 'timestamptz', nullable: true })
  validUntil: Date;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ default: 0 })
  order: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
