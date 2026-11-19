import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { TableEntity } from './table.entity';

export type WaiterCallRequestType = 'waiter' | 'bill';

@Entity('waiter_calls')
@Index(['restaurantId', 'createdAt'])
@Index('IDX_waiter_calls_restaurant_table_created', [
  'restaurantId',
  'tableId',
  'createdAt',
])
@Index('IDX_waiter_calls_restaurant_ack_created', [
  'restaurantId',
  'acknowledged',
  'createdAt',
])
export class WaiterCallEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'restaurant_id', type: 'uuid' })
  restaurantId!: string;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant!: RestaurantEntity;

  @Column({ name: 'table_id', type: 'uuid' })
  tableId!: string;

  @ManyToOne(() => TableEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'table_id' })
  table?: TableEntity;

  @Column({ name: 'table_name', type: 'varchar', length: 120 })
  tableName!: string;

  @Column({ name: 'section_name', type: 'varchar', length: 120, nullable: true })
  sectionName!: string | null;

  @Column({ name: 'request_type', type: 'varchar', length: 32, default: 'waiter' })
  requestType!: WaiterCallRequestType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note!: string | null;

  @Column({ type: 'boolean', default: false })
  acknowledged!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
