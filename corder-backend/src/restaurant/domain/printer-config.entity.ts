import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';

export type PrinterConnection = 'usb' | 'network' | 'bluetooth';
export type PrinterStatus = 'online' | 'offline' | 'error';

@Entity('restaurant_printer_configs')
@Index(['restaurantId'])
export class PrinterConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'restaurant_id' })
  restaurantId!: string;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant!: RestaurantEntity;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 50 })
  type!: string;

  @Column({ type: 'varchar', length: 20, default: 'network' })
  connection!: PrinterConnection;

  @Column({ name: 'ip_address', type: 'varchar', length: 100, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'int', nullable: true })
  port: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  department: string | null;

  @Column({ type: 'varchar', length: 20, default: 'offline' })
  status!: PrinterStatus;

  @Column({ name: 'paper_width', type: 'int', default: 80 })
  paperWidth!: number;

  @Column({ name: 'auto_cut', type: 'boolean', default: true })
  autoCut!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
