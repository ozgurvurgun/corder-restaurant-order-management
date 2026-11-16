import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('platform_billing_configs')
export class PlatformBillingConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'receiver_name',
    type: 'varchar',
    length: 160,
    default: 'Corder Software and Technology Inc.',
  })
  receiverName: string;

  @Column({
    name: 'iban',
    type: 'varchar',
    length: 64,
    default: 'TR33 0006 1005 1978 6457 8413 26',
  })
  iban: string;

  @Column({
    name: 'bank_name',
    type: 'varchar',
    length: 120,
    default: 'Garanti BBVA',
  })
  bankName: string;

  @Column({ name: 'collection_start_day', type: 'integer', default: 25 })
  collectionStartDay: number;

  @Column({ name: 'collection_end_day', type: 'integer', default: 30 })
  collectionEndDay: number;

  @Column({ name: 'support_phone', type: 'varchar', length: 64, nullable: true })
  supportPhone: string | null;

  @Column({ name: 'support_email', type: 'varchar', length: 120, nullable: true })
  supportEmail: string | null;

  @Column({ name: 'payment_instructions', type: 'text', nullable: true })
  paymentInstructions: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

