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

export type PrintJobType = 'receipt' | 'kitchen_cancel';

@Entity('print_jobs')
@Index(['restaurantId', 'printedAt', 'createdAt'])
export class PrintJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'restaurant_id' })
  restaurantId: string;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity;

  @Column({ name: 'print_type', type: 'varchar', length: 32 })
  printType: PrintJobType;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ name: 'printed_at', type: 'timestamptz', nullable: true })
  printedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

