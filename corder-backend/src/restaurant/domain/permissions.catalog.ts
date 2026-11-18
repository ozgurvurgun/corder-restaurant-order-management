export const PERMISSION_CATEGORIES = [
  'orders_tables',
  'discounts',
  'billing_cash',
  'ledger',
  'catalog',
  'inventory',
  'reports_system',
] as const;

export type PermissionCategory = (typeof PERMISSION_CATEGORIES)[number];
export type PermissionScope = 'terminal' | 'panel' | 'both';

export interface PermissionDefinition {
  key: PermissionKey;
  category: PermissionCategory;
  title: string;
  description: string;
  scope: PermissionScope;
  isCritical?: boolean;
}

export const PERMISSION_KEYS = [
  'order.view',
  'order.create',
  'order.add_note',
  'order.print_receipt',
  'table.move',
  'order.move_items',
  'order.cancel_item',
  'table.force_unlock',
  'order.quick_sale',
  'discount.apply_percent',
  'discount.apply_amount',
  'discount.complimentary',
  'discount.remove',
  'billing.close_check',
  'billing.split_bill',
  'billing.edit_completed_order',
  'cash.view',
  'cash.shift_open',
  'cash.shift_close',
  'cash.transaction_in',
  'cash.transaction_out',
  'cash.view_history',
  'ledger.view',
  'ledger.assign_order',
  'ledger.revert_item',
  'ledger.manage_customers',
  'ledger.collect_payment',
  'catalog.view',
  'catalog.manage_products',
  'catalog.change_price',
  'catalog.toggle_stock',
  'catalog.manage_categories',
  'catalog.manage_campaigns',
  'inventory.view',
  'inventory.manage_materials',
  'inventory.stock_movement',
  'inventory.manage_suppliers',
  'inventory.count_adjust',
  'reports.view_operational',
  'reports.view_financial',
  'reports.view_staff_performance',
  'reports.view_audit_logs',
  'security.view_fraud_alerts',
  'security.manage_fraud_alerts',
  'staff.view',
  'staff.manage',
  'roles.manage',
  'system.manage_tables',
  'system.manage_printers',
  'system.manage_settings',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_CATEGORY_META: Record<
  PermissionCategory,
  { title: string; description: string }
> = {
  orders_tables: {
    title: 'Table & Order Operations',
    description: 'Taking orders via terminal and panel, moving tables, transferring items, and cancellations',
  },
  discounts: {
    title: 'Discounts & Complimentary',
    description: 'Percentage discounts, amount discounts, full complimentary items, and discount limits',
  },
  billing_cash: {
    title: 'Billing, Payments & Cash Register',
    description: 'Closing checks, splitting bills, opening/closing cash shifts, and cash in/out transactions',
  },
  ledger: {
    title: 'Customer Ledger & Open Accounts',
    description: 'Assigning checks to customer ledgers, creating ledger customers, and collecting payments',
  },
  catalog: {
    title: 'Menu, Products, Pricing & Campaigns',
    description: 'Managing products, updating prices, toggling stock availability, and managing campaigns',
  },
  inventory: {
    title: 'Inventory, Recipes, Suppliers & Counts',
    description: 'Defining raw materials, stock movements/waste, supplier management, and inventory counts',
  },
  reports_system: {
    title: 'Reporting, Staff & System',
    description: 'Revenue reports, audit logs, staff/role management, and restaurant settings',
  },
};

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  { key: 'order.view', category: 'orders_tables', title: 'View Tables and Open Checks', description: 'Can view floor/table statuses and active check items.', scope: 'both' },
  { key: 'order.create', category: 'orders_tables', title: 'Create Orders / Open Checks', description: 'Can open a new check on a table and add items to existing checks.', scope: 'both' },
  { key: 'order.add_note', category: 'orders_tables', title: 'Add Order Item Notes', description: 'Can attach kitchen/preparation notes to order items.', scope: 'both' },
  { key: 'order.print_receipt', category: 'orders_tables', title: 'Print Check / Proforma Receipt', description: 'Can print table or check summary slips on thermal printers.', scope: 'both' },
  { key: 'table.move', category: 'orders_tables', title: 'Move and Merge Tables', description: 'Can move or merge all open checks from one table to another.', scope: 'both', isCritical: true },
  { key: 'order.move_items', category: 'orders_tables', title: 'Transfer Order Items', description: 'Can transfer selected items from a check to another table.', scope: 'both', isCritical: true },
  { key: 'order.cancel_item', category: 'orders_tables', title: 'Cancel Order Items (Void/Waste)', description: 'Can cancel confirmed check items with a reason (triggers kitchen cancel ticket).', scope: 'both', isCritical: true },
  { key: 'table.force_unlock', category: 'orders_tables', title: 'Force Unlock Table Session', description: 'Can override and take over a table session locked by another staff member.', scope: 'both', isCritical: true },
  { key: 'order.quick_sale', category: 'orders_tables', title: 'Quick / Counter Sale', description: 'Can perform walk-in / counter sales without opening a table.', scope: 'panel' },
  { key: 'discount.apply_percent', category: 'discounts', title: 'Apply Percentage (%) Discount', description: 'Can apply percentage discounts within their configured maximum limit.', scope: 'both', isCritical: true },
  { key: 'discount.apply_amount', category: 'discounts', title: 'Apply Amount Discount', description: 'Can apply fixed-amount discounts within their configured maximum limit.', scope: 'both', isCritical: true },
  { key: 'discount.complimentary', category: 'discounts', title: 'Apply 100% Complimentary', description: 'Can close a check or item as 100% complimentary.', scope: 'both', isCritical: true },
  { key: 'discount.remove', category: 'discounts', title: 'Remove Applied Discount', description: 'Can remove an existing discount on a check and restore full price.', scope: 'both' },
  { key: 'billing.close_check', category: 'billing_cash', title: 'Close Check and Collect Payment', description: 'Can settle checks via cash, credit card, meal card, or Multinet.', scope: 'both', isCritical: true },
  { key: 'billing.split_bill', category: 'billing_cash', title: 'Split Bill / Partial Payment', description: 'Can split bills by guest count or selected items and collect partial payments.', scope: 'panel' },
  { key: 'billing.edit_completed_order', category: 'billing_cash', title: 'Edit Completed Orders', description: 'Can retroactively modify payment methods or details of completed orders.', scope: 'panel', isCritical: true },
  { key: 'cash.view', category: 'billing_cash', title: 'View Cash Register Status', description: 'Can view the active cash shift and live register totals.', scope: 'panel' },
  { key: 'cash.shift_open', category: 'billing_cash', title: 'Open Cash Shift', description: 'Can start a new cash shift by entering an opening balance.', scope: 'panel', isCritical: true },
  { key: 'cash.shift_close', category: 'billing_cash', title: 'Close Cash Shift (End of Day)', description: 'Can close the active cash shift by recording counted closing cash.', scope: 'panel', isCritical: true },
  { key: 'cash.transaction_in', category: 'billing_cash', title: 'Manual Cash Inflow', description: 'Can record non-sale cash additions/float into the register.', scope: 'panel' },
  { key: 'cash.transaction_out', category: 'billing_cash', title: 'Cash Outflow / Expense Entry', description: 'Can record cash expenses, supplier payouts, or advances from the register.', scope: 'panel', isCritical: true },
  { key: 'cash.view_history', category: 'billing_cash', title: 'View Cash Shift History', description: 'Can inspect closed shifts, cash variances, and historical register movements.', scope: 'panel' },
  { key: 'ledger.view', category: 'ledger', title: 'View Customer Ledgers & Open Accounts', description: 'Can view customer ledger balances and open account lists.', scope: 'panel' },
  { key: 'ledger.assign_order', category: 'ledger', title: 'Assign Check or Items to Ledger', description: 'Can charge an entire check or selected items to a customer ledger account.', scope: 'panel', isCritical: true },
  { key: 'ledger.revert_item', category: 'ledger', title: 'Revert Item from Ledger to Check', description: 'Can return an item previously assigned to a ledger back to the active table check.', scope: 'panel', isCritical: true },
  { key: 'ledger.manage_customers', category: 'ledger', title: 'Manage Ledger Customers', description: 'Can create and edit customer ledger profiles and open accounts.', scope: 'panel' },
  { key: 'ledger.collect_payment', category: 'ledger', title: 'Collect Ledger / Open Account Payment', description: 'Can record debt payments received from ledger customers or open accounts.', scope: 'panel', isCritical: true },
  { key: 'catalog.view', category: 'catalog', title: 'View Products and Categories', description: 'Can view categories, products, and recipe definitions in the menu.', scope: 'panel' },
  { key: 'catalog.manage_products', category: 'catalog', title: 'Create, Edit and Delete Products', description: 'Can create products, update descriptions, images, and recipes, or delete products.', scope: 'panel' },
  { key: 'catalog.change_price', category: 'catalog', title: 'Change Product Prices', description: 'Can update selling prices of menu products.', scope: 'panel', isCritical: true },
  { key: 'catalog.toggle_stock', category: 'catalog', title: 'Toggle Product Stock Availability', description: 'Can mark products as in-stock or sold-out.', scope: 'panel' },
  { key: 'catalog.manage_categories', category: 'catalog', title: 'Manage and Reorder Categories', description: 'Can add, edit, reorder, and delete menu categories.', scope: 'panel' },
  { key: 'catalog.manage_campaigns', category: 'catalog', title: 'Manage Campaigns and Promotions', description: 'Can create and manage digital menu campaigns and promotions.', scope: 'panel' },
  { key: 'inventory.view', category: 'inventory', title: 'View Inventory and Raw Materials', description: 'Can view raw material stock levels, low-stock alerts, and stock movements.', scope: 'panel' },
  { key: 'inventory.manage_materials', category: 'inventory', title: 'Manage Raw Material Cards', description: 'Can define stock materials and update unit costs and minimum stock thresholds.', scope: 'panel' },
  { key: 'inventory.stock_movement', category: 'inventory', title: 'Record Stock In/Out and Waste', description: 'Can record manual stock inflows, outflows, and waste deductions.', scope: 'panel', isCritical: true },
  { key: 'inventory.manage_suppliers', category: 'inventory', title: 'Manage Suppliers and Purchase Orders', description: 'Can manage suppliers and create or receive purchase orders.', scope: 'panel' },
  { key: 'inventory.count_adjust', category: 'inventory', title: 'Inventory Count and Stock Adjustment', description: 'Can record physical inventory counts and reconcile stock quantities.', scope: 'panel', isCritical: true },
  { key: 'reports.view_operational', category: 'reports_system', title: 'Operational Sales and Product Reports', description: 'Can view completed order lists and product/category sales quantities.', scope: 'panel' },
  { key: 'reports.view_financial', category: 'reports_system', title: 'Financial Revenue, Profit and Payment Reports', description: 'Can view total revenue, payment method breakdown, discount totals, and financial analytics.', scope: 'panel', isCritical: true },
  { key: 'reports.view_staff_performance', category: 'reports_system', title: 'Staff Performance Reports', description: 'Can view waiter and cashier sales, cancellations, and operational performance metrics.', scope: 'panel' },
  { key: 'reports.view_audit_logs', category: 'reports_system', title: 'View Audit Logs', description: 'Can inspect cancellations, table moves, price changes, and critical system audit events.', scope: 'panel', isCritical: true },
  { key: 'security.view_fraud_alerts', category: 'reports_system', title: 'View Loss Prevention & Fraud Alerts', description: 'Can view anomaly detection, suspicious void/discount patterns, and cash register discrepancy alerts.', scope: 'panel', isCritical: true },
  { key: 'security.manage_fraud_alerts', category: 'reports_system', title: 'Manage & Resolve Fraud Alerts', description: 'Can investigate, resolve, or mark fraud and loss-prevention alerts as false positives.', scope: 'panel', isCritical: true },
  { key: 'staff.view', category: 'reports_system', title: 'View Staff Directory', description: 'Can view the list of staff members and users in the branch.', scope: 'panel' },
  { key: 'staff.manage', category: 'reports_system', title: 'Create and Edit Staff / Users', description: 'Can add staff members, reset PINs/passwords, and toggle active status.', scope: 'panel', isCritical: true },
  { key: 'roles.manage', category: 'reports_system', title: 'Manage Roles and Permission Policies', description: 'Can configure role templates, permission matrices, and discount limits.', scope: 'panel', isCritical: true },
  { key: 'system.manage_tables', category: 'reports_system', title: 'Manage Tables and Floor Sections', description: 'Can add, edit, and delete tables and dining sections.', scope: 'panel' },
  { key: 'system.manage_printers', category: 'reports_system', title: 'Manage Printers and Kitchen Routing', description: 'Can configure thermal printers and category-based kitchen ticket routing.', scope: 'panel' },
  { key: 'system.manage_settings', category: 'reports_system', title: 'General Restaurant Settings', description: 'Can update restaurant contact details, tax ID, social media links, and working hours.', scope: 'panel' },
];

const PERMISSION_SET = new Set<string>(PERMISSION_KEYS);

export function isValidPermissionKey(key: string): key is PermissionKey {
  return PERMISSION_SET.has(key);
}

export function sanitizePermissionKeys(input: unknown): PermissionKey[] {
  if (!Array.isArray(input)) return [];
  const unique = new Set<PermissionKey>();
  for (const item of input) {
    if (typeof item === 'string' && isValidPermissionKey(item)) {
      unique.add(item);
    }
  }
  return Array.from(unique);
}

export * from './role-templates.catalog';
