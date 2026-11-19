import { createHash } from 'crypto';
import { BossTier, RootAdminEntity } from '../../../platform/domain/root-admin.entity';
import { RestaurantEntity } from '../../../platform/domain/restaurant.entity';
import { RestaurantStaffEntity } from '../restaurant-staff.entity';
import {
  EffectivePolicyLimits,
  PERMISSION_KEYS,
  PermissionKey,
} from '../permissions.catalog';

export function computeSecretFingerprint(hash?: string | null): string {
  if (!hash) return '';
  return createHash('sha256').update(hash).digest('hex').slice(0, 16);
}

export interface RestaurantLoginDto {
  email: string;
  password: string;
  restaurantId?: string;
}

export type RestaurantJwtRole =
  | 'root'
  | 'staff'
  | 'terminal'
  | 'print_agent'
  | 'print_agent_refresh';

export interface RestaurantTokenPayload {
  sub: string;
  restaurantId: string;
  slug: string;
  email: string;
  name: string;
  type: 'restaurant';
  role: RestaurantJwtRole;
  staffRole?: string;
  pwdFp?: string;
}

export interface BranchSummaryDto {
  id: string;
  name: string;
  slug: string;
  address?: string | null;
  phone?: string | null;
  status: string;
  brandName?: string | null;
  branchType?: string;
  monthlyFee?: number;
  billingStatus?: string;
  isAccessSuspended?: boolean;
}

export interface AuthenticatedRestaurantUserDto {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  role: RestaurantJwtRole;
  staffRole: string;
  roleLabel: string;
  isBoss: boolean;
  bossTier?: BossTier;
  brandName?: string | null;
  permissions: PermissionKey[];
  limits: EffectivePolicyLimits;
}

export interface LoginSessionResultDto {
  accessToken: string;
  restaurant: BranchSummaryDto;
  restaurants: BranchSummaryDto[];
  user: AuthenticatedRestaurantUserDto;
}

export function isRestaurantPaymentSuspended(
  r?: {
    isAccessSuspended?: boolean | null;
    billingStatus?: string | null;
  } | null,
): boolean {
  if (!r) return false;
  return Boolean(r.isAccessSuspended) || r.billingStatus === 'suspended';
}

export function buildPaymentSuspendedErrorMessage(
  restaurantName?: string | null,
  _billingConfig?: unknown,
): string {
  const branchText = restaurantName ? `${restaurantName} işletmesi` : 'İşletmeniz';
  return `${branchText} için abonelik ödemesi tamamlanmadığından sistem erişimi geçici olarak durdurulmuştur. Lütfen Corder yönetimi ile iletişime geçin.`;
}

export function getBossRoleLabel(tier?: BossTier): string {
  if (tier === 'brand_owner') return 'Brand & Master Franchise Owner (HQ)';
  if (tier === 'regional_manager') return 'Regional Manager (Boss)';
  return 'Branch / Franchise Owner (Boss)';
}

export function toBranchSummaryDto(r: RestaurantEntity): BranchSummaryDto {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    address: r.address ?? null,
    phone: r.phone ?? null,
    status: r.status,
    brandName: r.brandName ?? null,
    branchType: r.branchType || 'independent',
    monthlyFee: Number(r.monthlyFee || 0),
    billingStatus: r.billingStatus || 'paid',
    isAccessSuspended: Boolean(r.isAccessSuspended),
  };
}

export function buildBossUserDto(admin: RootAdminEntity): AuthenticatedRestaurantUserDto {
  const tier: BossTier = admin.bossTier || 'franchise_owner';
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    phone: admin.phone,
    role: 'root',
    staffRole: 'boss',
    roleLabel: getBossRoleLabel(tier),
    isBoss: true,
    bossTier: tier,
    brandName: admin.brandName ?? null,
    permissions: [...PERMISSION_KEYS],
    limits: { maxDiscountPercent: 100, maxDiscountAmount: null },
  };
}

export function buildStaffUserDto(
  staff: RestaurantStaffEntity,
  resolved: {
    roleKey: string;
    roleLabel: string;
    permissions: PermissionKey[];
    limits: EffectivePolicyLimits;
  },
): AuthenticatedRestaurantUserDto {
  return {
    id: staff.id,
    email: staff.email ?? '',
    name: staff.name,
    phone: staff.phone,
    role: 'staff',
    staffRole: resolved.roleKey,
    roleLabel: resolved.roleLabel,
    isBoss: false,
    permissions: resolved.permissions,
    limits: resolved.limits,
  };
}

export function buildTerminalUserDto(rest: RestaurantEntity): AuthenticatedRestaurantUserDto {
  return {
    id: rest.id,
    email: rest.terminalEmail ?? '',
    name: 'Terminal',
    role: 'terminal',
    staffRole: 'terminal',
    roleLabel: 'POS Terminal',
    isBoss: false,
    permissions: [],
    limits: { maxDiscountPercent: 0, maxDiscountAmount: 0 },
  };
}
