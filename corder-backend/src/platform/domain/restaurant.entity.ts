import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { RootAdminEntity } from './root-admin.entity';
import {
  RestaurantBillingStatus,
  RestaurantPaymentRecord,
} from './subscription-billing.policy';

export type RestaurantBranchType = 'independent' | 'company_owned' | 'franchise';
export type RestaurantMenuTemplate =
  | 'classic'
  | 'bistro-grid'
  | 'luxury-noir'
  | 'editorial'
  | 'vibrant-pop';
export const RESTAURANT_MENU_TEMPLATES: readonly RestaurantMenuTemplate[] = [
  'classic',
  'bistro-grid',
  'luxury-noir',
  'editorial',
  'vibrant-pop',
] as const;
export type { RestaurantBillingStatus, RestaurantPaymentRecord };

@Entity('restaurants')
@Index('UQ_restaurants_terminal_email', ['terminalEmail'], {
  unique: true,
  where: '"terminal_email" IS NOT NULL',
})
@Index(['printAgentUsername'], { unique: true })
@Index(['brandName'])
@Index(['billingStatus'])
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

  /** Brand / Franchise network name (e.g., "Burger House Group"). */
  @Column({ name: 'brand_name', type: 'varchar', length: 120, nullable: true })
  brandName: string | null;

  /** Branch ownership model: independent, company_owned (HQ branch), or franchise. */
  @Column({ name: 'branch_type', type: 'varchar', length: 32, default: 'independent' })
  branchType: RestaurantBranchType;

  /** Legal / commercial name of the franchisee operating this branch. */
  @Column({ name: 'franchisee_company_name', type: 'varchar', length: 160, nullable: true })
  franchiseeCompanyName: string | null;

  /** Royalty rate percentage for franchise analytics (0 - 100). */
  @Column({
    name: 'royalty_rate',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
  })
  royaltyRate: string;

  /** Monthly subscription fee for this restaurant (configured per branch in Admin Panel). */
  @Column({
    name: 'monthly_fee',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
  })
  monthlyFee: string;

  /** Current billing status: 'paid' | 'pending' | 'overdue' | 'suspended'. */
  @Column({ name: 'billing_status', type: 'varchar', length: 32, default: 'paid' })
  billingStatus: RestaurantBillingStatus;

  /** Whether all system access is halted (e.g. non-payment after 25-30 collection window). */
  @Column({ name: 'is_access_suspended', type: 'boolean', default: false })
  isAccessSuspended: boolean;

  @Column({ name: 'suspension_reason', type: 'varchar', length: 160, nullable: true })
  suspensionReason: string | null;

  @Column({ name: 'suspended_at', type: 'timestamptz', nullable: true })
  suspendedAt: Date | null;

  @Column({ name: 'last_payment_date', type: 'timestamptz', nullable: true })
  lastPaymentDate: Date | null;

  @Column({ name: 'last_paid_period', type: 'varchar', length: 16, nullable: true })
  lastPaidPeriod: string | null;

  @Column({ name: 'billing_start_period', type: 'varchar', length: 7, nullable: true })
  billingStartPeriod: string | null;

  @Column({ name: 'billing_notes', type: 'text', nullable: true })
  billingNotes: string | null;

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

  /** Public customer-facing contact fields configured by the merchant in Merchant Panel -> Settings (shown on QR Menu & receipts). */
  @Column({ name: 'menu_phone', type: 'varchar', nullable: true })
  menuPhone: string | null;

  @Column({ name: 'menu_address', type: 'varchar', nullable: true })
  menuAddress: string | null;

  @Column({ name: 'logo_url', type: 'varchar', length: 500, nullable: true })
  logoUrl?: string | null;

  @Column({ name: 'menu_template', type: 'varchar', length: 40, default: 'classic' })
  menuTemplate: RestaurantMenuTemplate;

  @Column({
    name: 'terminal_location_restriction_enabled',
    type: 'boolean',
    default: false,
  })
  terminalLocationRestrictionEnabled: boolean;

  @Column({ name: 'location_latitude', type: 'double precision', nullable: true })
  locationLatitude: number | null;

  @Column({ name: 'location_longitude', type: 'double precision', nullable: true })
  locationLongitude: number | null;

  @Column({ name: 'location_radius_meters', type: 'integer', default: 150 })
  locationRadiusMeters: number;

  @Column({ name: 'notifications_cleared_at', type: 'timestamptz', nullable: true })
  notificationsClearedAt?: Date | null;

  @Column({
    name: 'dismissed_notification_ids',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  dismissedNotificationIds: string[];

  @Column({ name: 'root_admin_id', type: 'uuid', nullable: true })
  rootAdminId: string | null;

  @ManyToOne(() => RootAdminEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'root_admin_id' })
  rootAdmin?: RootAdminEntity | null;

  /** Terminal login (independent of root admin; one per restaurant). */
  @Column({ name: 'terminal_email', type: 'varchar', nullable: true })
  terminalEmail: string | null;

  @Column({ name: 'terminal_password_hash', type: 'varchar', nullable: true })
  terminalPasswordHash: string | null;

  /** Print Agent desktop login (independent credentials per restaurant). */
  @Column({ name: 'print_agent_username', type: 'varchar', nullable: true })
  printAgentUsername: string | null;

  @Column({ name: 'print_agent_password_hash', type: 'varchar', nullable: true })
  printAgentPasswordHash: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
