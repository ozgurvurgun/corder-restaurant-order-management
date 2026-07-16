import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';

export type BackupType = 'auto' | 'manual';
export type BackupStatus = 'success' | 'failed';

@Entity('restaurant_backups')
export class BackupRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  restaurantId!: string;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  restaurant!: RestaurantEntity;

  @Column({ type: 'enum', enum: ['auto', 'manual'], default: 'manual' })
  type!: BackupType;

  // Human readable, e.g. "12.6 MB"
  @Column({ length: 32 })
  size!: string;

  @Column({ type: 'enum', enum: ['success', 'failed'], default: 'success' })
  status!: BackupStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  filePath: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}

