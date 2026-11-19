import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export type PlatformNotificationLevel = 'info' | 'warning' | 'urgent' | 'success';
export type PlatformNotificationTargetApp = 'merchant' | 'boss';
export type PlatformNotificationStatus = 'scheduled' | 'sent' | 'cancelled';

@Entity('platform_notifications')
export class PlatformNotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 24, default: 'info' })
  level: PlatformNotificationLevel;

  @Column({
    name: 'target_apps',
    type: 'jsonb',
    default: () => '\'["merchant","boss"]\'::jsonb',
  })
  targetApps: PlatformNotificationTargetApp[];

  @Column({
    name: 'target_restaurant_ids',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  targetRestaurantIds: string[];

  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt: Date | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'varchar', length: 24, default: 'sent' })
  status: PlatformNotificationStatus;

  @Column({
    name: 'created_by',
    type: 'varchar',
    length: 120,
    default: 'Platform Admin',
  })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
