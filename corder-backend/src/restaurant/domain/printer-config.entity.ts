import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';

export type PrinterConnection = 'usb' | 'network' | 'bluetooth';
export type PrinterStatus = 'online' | 'offline' | 'error';

@Entity('restaurant_printer_configs')
export class PrinterConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  restaurantId!: string;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  restaurant!: RestaurantEntity;

  @Column({ length: 100 })
  name!: string;

  // e.g. "thermal", "kitchen", "bar"
  @Column({ length: 50 })
  type!: string;

  @Column({ type: 'enum', enum: ['usb', 'network', 'bluetooth'], default: 'network' })
  connection!: PrinterConnection;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'int', nullable: true })
  port: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  department: string | null;

  @Column({ type: 'enum', enum: ['online', 'offline', 'error'], default: 'offline' })
  status!: PrinterStatus;

  @Column({ type: 'int', default: 80 })
  paperWidth!: number;

  @Column({ type: 'boolean', default: true })
  autoCut!: boolean;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}

