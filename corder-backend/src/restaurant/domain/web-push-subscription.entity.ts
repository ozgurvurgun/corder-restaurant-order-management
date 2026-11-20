import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { RootAdminEntity } from '../../platform/domain/root-admin.entity';

export type WebPushAppType = 'terminal' | 'merchant' | 'boss';

@Entity('web_push_subscriptions')
@Index('IDX_web_push_subscriptions_rest_app', ['restaurantId', 'appType'])
@Index('IDX_web_push_subscriptions_root_admin', ['rootAdminId'])
export class WebPushSubscriptionEntity {
  @PrimaryColumn({ type: 'text' })
  endpoint!: string;

  @Column({ name: 'restaurant_id', type: 'uuid' })
  restaurantId!: string;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant?: RestaurantEntity;

  @Column({ name: 'root_admin_id', type: 'uuid', nullable: true })
  rootAdminId!: string | null;

  @ManyToOne(() => RootAdminEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'root_admin_id' })
  rootAdmin?: RootAdminEntity | null;

  @Column({ name: 'app_type', type: 'varchar', length: 32 })
  appType!: WebPushAppType;

  @Column({ type: 'text' })
  p256dh!: string;

  @Column({ type: 'text' })
  auth!: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

