import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { OpenAccountEntity } from './open-account.entity';

@Entity('open_account_items')
@Index(['openAccountId'])
export class OpenAccountItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'open_account_id' })
  openAccountId: string;

  @ManyToOne(() => OpenAccountEntity, (a) => a.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'open_account_id' })
  openAccount: OpenAccountEntity;

  @Column({ name: 'product_id', type: 'varchar', length: 36, nullable: true })
  productId: string | null;

  @Column({ name: 'product_name', type: 'varchar', length: 500 })
  productName: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
