import {
  PERMISSION_KEYS,
  PermissionKey,
  sanitizePermissionKeys,
} from './permissions.catalog';

export interface RoleTemplateDefinition {
  key: string;
  name: string;
  description: string;
  color: string;
  isSystem: boolean;
  canAccessPanel: boolean;
  canAccessTerminal: boolean;
  maxDiscountPercent: number;
  maxDiscountAmount: number | null;
  permissions: PermissionKey[];
}

export const DEFAULT_ROLE_TEMPLATES: RoleTemplateDefinition[] = [
  {
    key: 'branch_manager',
    name: 'Şube Müdürü',
    description: 'Şube içi tüm operasyon, kasa, menü, stok, personel, rol/yetki ve raporlama süreçlerini yönetir.',
    color: '#9333ea',
    isSystem: true,
    canAccessPanel: true,
    canAccessTerminal: true,
    maxDiscountPercent: 50,
    maxDiscountAmount: 2500,
    permissions: [...PERMISSION_KEYS],
  },
  {
    key: 'shift_supervisor',
    name: 'Vardiya Amiri / Şef',
    description: 'Saha operasyonunu, masa/ürün taşımalarını, iptalleri, kasayı ve günlük akışı denetler.',
    color: '#0284c7',
    isSystem: true,
    canAccessPanel: true,
    canAccessTerminal: true,
    maxDiscountPercent: 25,
    maxDiscountAmount: 750,
    permissions: [
      'order.view', 'order.create', 'order.add_note', 'order.print_receipt',
      'table.move', 'order.move_items', 'order.cancel_item', 'table.force_unlock', 'order.quick_sale',
      'discount.apply_percent', 'discount.apply_amount', 'discount.remove',
      'billing.close_check', 'billing.split_bill',
      'cash.view', 'cash.shift_open', 'cash.shift_close', 'cash.transaction_in', 'cash.transaction_out',
      'ledger.view', 'ledger.assign_order', 'ledger.collect_payment',
      'catalog.view', 'catalog.toggle_stock',
      'inventory.view', 'inventory.stock_movement',
      'reports.view_operational', 'reports.view_staff_performance',
      'security.view_fraud_alerts', 'staff.view',
    ],
  },
  {
    key: 'cashier',
    name: 'Kasiyer',
    description: 'Kasa vardiyası, hesap kesme, parçalı tahsilat, hızlı satış ve cari tahsilat işlemlerini yapar.',
    color: '#2563eb',
    isSystem: true,
    canAccessPanel: true,
    canAccessTerminal: true,
    maxDiscountPercent: 10,
    maxDiscountAmount: 200,
    permissions: [
      'order.view', 'order.create', 'order.add_note', 'order.print_receipt',
      'table.move', 'order.move_items', 'order.quick_sale',
      'discount.apply_percent', 'discount.apply_amount', 'discount.remove',
      'billing.close_check', 'billing.split_bill',
      'cash.view', 'cash.shift_open', 'cash.shift_close', 'cash.transaction_in', 'cash.transaction_out',
      'ledger.view', 'ledger.assign_order', 'ledger.manage_customers', 'ledger.collect_payment',
      'reports.view_operational',
    ],
  },
  {
    key: 'head_waiter',
    name: 'Şef Garson',
    description: 'Terminalden sipariş alır, masa ve kalem taşıma, ürün iptali ve sınırlı iskonto yapabilir.',
    color: '#0d9488',
    isSystem: true,
    canAccessPanel: false,
    canAccessTerminal: true,
    maxDiscountPercent: 10,
    maxDiscountAmount: 150,
    permissions: [
      'order.view', 'order.create', 'order.add_note', 'order.print_receipt',
      'table.move', 'order.move_items', 'order.cancel_item', 'table.force_unlock',
      'discount.apply_percent',
    ],
  },
  {
    key: 'waiter',
    name: 'Garson',
    description: 'Terminalden masa açar, sipariş girer, masa/kalem taşır ve ara hesap fişi yazdırır.',
    color: '#16a34a',
    isSystem: true,
    canAccessPanel: false,
    canAccessTerminal: true,
    maxDiscountPercent: 0,
    maxDiscountAmount: 0,
    permissions: [
      'order.view', 'order.create', 'order.add_note', 'order.print_receipt',
      'table.move', 'order.move_items',
    ],
  },
  {
    key: 'runner',
    name: 'Komi / Stajyer',
    description: 'Sadece masaları görüntüler ve yeni sipariş kalemi ekleyebilir; taşıma ve iptal yapamaz.',
    color: '#64748b',
    isSystem: true,
    canAccessPanel: false,
    canAccessTerminal: true,
    maxDiscountPercent: 0,
    maxDiscountAmount: 0,
    permissions: ['order.view', 'order.create', 'order.add_note'],
  },
  {
    key: 'inventory_manager',
    name: 'Depo & Stok Sorumlusu',
    description: 'Hammadde, stok giriş/çıkış/fire, tedarikçi, satın alma ve envanter sayımlarını yönetir.',
    color: '#d97706',
    isSystem: true,
    canAccessPanel: true,
    canAccessTerminal: false,
    maxDiscountPercent: 0,
    maxDiscountAmount: 0,
    permissions: [
      'catalog.view', 'catalog.toggle_stock',
      'inventory.view', 'inventory.manage_materials', 'inventory.stock_movement',
      'inventory.manage_suppliers', 'inventory.count_adjust',
    ],
  },
  {
    key: 'accountant',
    name: 'Muhasebe & Finans',
    description: 'Finansal raporları, kasa geçmişini, cari hesapları, stokları ve denetim kayıtlarını inceler.',
    color: '#4f46e5',
    isSystem: true,
    canAccessPanel: true,
    canAccessTerminal: false,
    maxDiscountPercent: 0,
    maxDiscountAmount: 0,
    permissions: [
      'cash.view', 'cash.view_history',
      'ledger.view', 'ledger.manage_customers', 'ledger.collect_payment',
      'inventory.view',
      'reports.view_operational', 'reports.view_financial',
      'reports.view_staff_performance', 'reports.view_audit_logs',
      'security.view_fraud_alerts',
    ],
  },
];

export function normalizeRoleKey(roleKey: string): string {
  const trimmed = (roleKey || '').trim().toLowerCase();
  if (trimmed === 'manager') return 'branch_manager';
  if (trimmed === 'root') return 'boss';
  return trimmed || 'waiter';
}

export function getDefaultRoleTemplate(roleKey: string): RoleTemplateDefinition {
  const normalized = normalizeRoleKey(roleKey);
  if (normalized === 'boss') {
    return {
      key: 'boss',
      name: 'İşletme Sahibi (Boss)',
      description: 'Tüm şubeler ve aksiyonlar üzerinde tam yetkili işletme sahibi.',
      color: '#e63462',
      isSystem: true,
      canAccessPanel: true,
      canAccessTerminal: true,
      maxDiscountPercent: 100,
      maxDiscountAmount: null,
      permissions: [...PERMISSION_KEYS],
    };
  }
  return (
    DEFAULT_ROLE_TEMPLATES.find((t) => t.key === normalized) ??
    DEFAULT_ROLE_TEMPLATES.find((t) => t.key === 'waiter')!
  );
}

export function resolveEffectivePermissions(params: {
  isBoss?: boolean;
  rolePermissions: string[];
  grantedPermissions?: string[] | null;
  revokedPermissions?: string[] | null;
}): PermissionKey[] {
  if (params.isBoss) return [...PERMISSION_KEYS];
  const set = new Set<PermissionKey>(sanitizePermissionKeys(params.rolePermissions));
  for (const g of sanitizePermissionKeys(params.grantedPermissions)) set.add(g);
  for (const r of sanitizePermissionKeys(params.revokedPermissions)) set.delete(r);
  return Array.from(set);
}

export interface EffectivePolicyLimits {
  maxDiscountPercent: number;
  maxDiscountAmount: number | null;
}

export function resolveEffectiveLimits(params: {
  isBoss?: boolean;
  roleMaxDiscountPercent: number;
  roleMaxDiscountAmount: number | null;
  userMaxDiscountPercentOverride?: number | null;
  userMaxDiscountAmountOverride?: number | null;
}): EffectivePolicyLimits {
  if (params.isBoss) return { maxDiscountPercent: 100, maxDiscountAmount: null };
  const pct =
    params.userMaxDiscountPercentOverride != null
      ? Math.max(0, Math.min(100, Number(params.userMaxDiscountPercentOverride)))
      : Math.max(0, Math.min(100, Number(params.roleMaxDiscountPercent ?? 0)));
  const amtRaw =
    params.userMaxDiscountAmountOverride !== undefined &&
    params.userMaxDiscountAmountOverride !== null
      ? Number(params.userMaxDiscountAmountOverride)
      : params.roleMaxDiscountAmount !== undefined &&
          params.roleMaxDiscountAmount !== null
        ? Number(params.roleMaxDiscountAmount)
        : null;
  return {
    maxDiscountPercent: Number.isFinite(pct) ? pct : 0,
    maxDiscountAmount: amtRaw != null && Number.isFinite(amtRaw) && amtRaw >= 0 ? amtRaw : null,
  };
}
