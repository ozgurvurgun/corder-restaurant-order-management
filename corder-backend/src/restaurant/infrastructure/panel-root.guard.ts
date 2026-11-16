import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PermissionKey } from '../domain/permissions.catalog';

export const REQUIRED_PERMISSIONS_KEY = 'corder:required_permissions';
export const BOSS_ONLY_KEY = 'corder:boss_only';

/**
 * Requires the actor to have AT LEAST ONE of the specified permissions
 * (Boss / 'root' always passes).
 */
export const RequirePermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

/**
 * Restricts an endpoint to Boss ('root') or users with `roles.manage`.
 */
export const BossOnly = () => SetMetadata(BOSS_ONLY_KEY, true);

/**
 * Infers required permissions from route path & HTTP method when no explicit
 * `@RequirePermissions` decorator is attached.
 */
function inferPermissionsForRequest(method: string, path: string): PermissionKey[] {
  const m = method.toUpperCase();
  const p = path.toLowerCase();

  if (p.includes('/restaurant/roles')) {
    return m === 'GET' ? ['roles.manage', 'staff.view', 'staff.manage'] : ['roles.manage'];
  }
  if (p.includes('/restaurant/staff')) {
    return m === 'GET' ? ['staff.view', 'staff.manage'] : ['staff.manage'];
  }
  if (p.includes('/restaurant/tables')) {
    return m === 'GET' ? ['order.view', 'system.manage_tables'] : ['system.manage_tables'];
  }
  if (p.includes('/restaurant/orders/assign-to-ledger')) {
    return ['ledger.assign_order'];
  }
  if (p.includes('/restaurant/orders/revert-ledger-item')) {
    return ['ledger.revert_item'];
  }
  if (p.includes('/restaurant/shifts')) {
    if (m === 'GET') return ['cash.view', 'cash.view_history', 'billing.close_check'];
    if (p.includes('/close')) return ['cash.shift_close'];
    return ['cash.shift_open'];
  }
  if (p.includes('/restaurant/cash-transactions')) {
    if (m === 'GET') return ['cash.view', 'cash.view_history'];
    return ['cash.transaction_in', 'cash.transaction_out'];
  }
  if (p.includes('/restaurant/completed-orders')) {
    if (m === 'GET') {
      return [
        'reports.view_operational',
        'reports.view_financial',
        'billing.close_check',
        'cash.view',
      ];
    }
    return ['billing.edit_completed_order'];
  }
  if (p.includes('/restaurant/open-accounts')) {
    if (m === 'GET') return ['ledger.view', 'cash.view'];
    if (p.includes('/pay')) return ['ledger.collect_payment'];
    return ['ledger.manage_customers', 'ledger.assign_order'];
  }
  if (p.includes('/restaurant/ledger-customers')) {
    if (m === 'GET') return ['ledger.view', 'ledger.assign_order', 'billing.close_check'];
    if (p.includes('/payments')) return ['ledger.collect_payment'];
    return ['ledger.manage_customers'];
  }
  if (p.includes('/restaurant/products')) {
    if (m === 'GET') return ['catalog.view', 'order.view', 'order.create'];
    return ['catalog.manage_products', 'catalog.change_price', 'catalog.toggle_stock'];
  }
  if (p.includes('/restaurant/categories')) {
    if (m === 'GET') return ['catalog.view', 'order.view', 'order.create'];
    return ['catalog.manage_categories'];
  }
  if (p.includes('/restaurant/campaigns')) {
    if (m === 'GET') return ['catalog.view', 'catalog.manage_campaigns'];
    return ['catalog.manage_campaigns'];
  }
  if (p.includes('/restaurant/upload')) {
    return ['catalog.manage_products', 'catalog.manage_campaigns'];
  }
  if (p.includes('/restaurant/stock/materials')) {
    if (m === 'GET') return ['inventory.view', 'catalog.view'];
    return ['inventory.manage_materials'];
  }
  if (p.includes('/restaurant/stock/movements')) {
    if (m === 'GET') return ['inventory.view'];
    return ['inventory.stock_movement'];
  }
  if (p.includes('/restaurant/suppliers') || p.includes('/restaurant/purchase-orders')) {
    if (m === 'GET') return ['inventory.view'];
    return ['inventory.manage_suppliers'];
  }
  if (p.includes('/restaurant/inventory-counts')) {
    if (m === 'GET') return ['inventory.view'];
    return ['inventory.count_adjust'];
  }
  if (p.includes('/restaurant/printers')) {
    if (m === 'GET') return ['system.manage_printers', 'order.print_receipt'];
    return ['system.manage_printers'];
  }
  if (p.includes('/restaurant/audit-logs')) {
    if (m === 'GET') return ['reports.view_audit_logs'];
    return ['order.view', 'reports.view_audit_logs'];
  }
  if (p.includes('/restaurant/settings')) {
    if (m === 'GET') return ['order.view', 'system.manage_settings'];
    return ['system.manage_settings'];
  }
  return [];
}

/**
 * Enforces Boss ('root') or authorized Merchant Panel Staff ('staff') permissions.
 */
@Injectable()
export class PanelRootGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<
      Request & {
        user?: {
          role?: string;
          isBoss?: boolean;
          permissions?: PermissionKey[];
        };
      }
    >();
    const user = req.user;
    if (!user) {
      throw new ForbiddenException('Session authentication is required');
    }

    // Boss ('root') always has full authority
    if (user.role === 'root' || user.isBoss) {
      return true;
    }

    if (user.role !== 'staff') {
      throw new ForbiddenException('Merchant panel access is required for this action');
    }

    const bossOnly = this.reflector.getAllAndOverride<boolean>(BOSS_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const userPermissions = user.permissions ?? [];
    if (bossOnly && !userPermissions.includes('roles.manage')) {
      throw new ForbiddenException(
        'This action can only be performed by the Owner (Boss)',
      );
    }

    const explicitPermissions = this.reflector.getAllAndOverride<PermissionKey[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const required =
      explicitPermissions && explicitPermissions.length > 0
        ? explicitPermissions
        : inferPermissionsForRequest(req.method, req.originalUrl || req.url || '');

    if (required.length === 0) {
      throw new ForbiddenException('Insufficient permissions for this resource');
    }

    const hasAny = required.some((perm) => userPermissions.includes(perm));
    if (!hasAny) {
      throw new ForbiddenException(
        `Insufficient permissions for this action (requires: ${required.join(' or ')})`,
      );
    }

    return true;
  }
}
