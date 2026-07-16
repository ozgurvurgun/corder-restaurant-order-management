import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('restaurants')
@Index(['terminalEmail'])
@Index(['printAgentToken'], { unique: true })
export class RestaurantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ default: 'active' })
  status: string;

  @Column({ name: 'tax_id', type: 'varchar', nullable: true })
  taxId: string | null;

  @Column({ name: 'whatsapp', type: 'varchar', nullable: true })
  whatsapp: string | null;

  @Column({ name: 'instagram', type: 'varchar', nullable: true })
  instagram: string | null;

  @Column({ name: 'facebook', type: 'varchar', nullable: true })
  facebook: string | null;

  @Column({ name: 'website', type: 'varchar', nullable: true })
  website: string | null;

  @Column({ name: 'working_hours', type: 'varchar', nullable: true })
  workingHours: string | null;

  @Column({ name: 'root_admin_id', type: 'uuid', nullable: true })
  rootAdminId: string | null;

  /** Terminal login (independent of root admin; one per restaurant). */
  @Column({ name: 'terminal_email', type: 'varchar', nullable: true })
  terminalEmail: string | null;

  @Column({ name: 'terminal_password_hash', type: 'varchar', nullable: true })
  terminalPasswordHash: string | null;

  /** Restaurant-scoped static token for print-agent (Socket.IO auth). */
  @Column({ name: 'print_agent_token', type: 'varchar', length: 128, nullable: true })
  printAgentToken: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
