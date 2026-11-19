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
import { numericColumnTransformer } from '../../common/database/numeric-column.transformer';

@Entity('open_account_payments')
@Index(['openAccountId'])
export class OpenAccountPaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'open_account_id' })
  openAccountId: string;

  @ManyToOne(() => OpenAccountEntity, (a) => a.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'open_account_id' })
  openAccount: OpenAccountEntity;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: numericColumnTransformer,
  })
  amount: number;

  @Column({ name: 'received_by', type: 'varchar', length: 255 })
  receivedBy: string;

  @Column({ name: 'received_by_user_id', type: 'varchar', length: 36, nullable: true })
  receivedByUserId: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
