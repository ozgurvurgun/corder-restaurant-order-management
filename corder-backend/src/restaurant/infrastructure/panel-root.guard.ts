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
export const ALLOW_TERMINAL_STAFF_KEY = 'corder:allow_terminal_staff';

/**
 * Requires the actor to have AT LEAST ONE of the specified permissions
 * (Boss / 'root' always passes).
 */
export const RequirePermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

/**
 * Restricts an endpoint strictly to the Business Owner / Boss ('root').
 */
export const BossOnly = () => SetMetadata(BOSS_ONLY_KEY, true);

/**
 * Marks a route as also callable by a POS Terminal JWT ('terminal'),
 * where the controller handler verifies the `x-staff-token` staff PIN session.
 */
export const AllowTerminalStaff = () => SetMetadata(ALLOW_TERMINAL_STAFF_KEY, true);

/**
 * Enforces Boss ('root') or authorized Merchant Panel Staff ('staff') permissions.
 * Uses explicit `@RequirePermissions(...)` / `@BossOnly()` metadata with strict default-deny.
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

    const bossOnly = this.reflector.getAllAndOverride<boolean>(BOSS_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (bossOnly) {
      throw new ForbiddenException(
        'This action can only be performed by the Business Owner (Boss).',
      );
    }

    const allowTerminalStaff = this.reflector.getAllAndOverride<boolean>(
      ALLOW_TERMINAL_STAFF_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (user.role === 'terminal' && allowTerminalStaff) {
      return true;
    }

    if (user.role !== 'staff') {
      throw new ForbiddenException('Merchant panel access is required for this action');
    }

    const explicitPermissions = this.reflector.getAllAndOverride<PermissionKey[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!explicitPermissions || explicitPermissions.length === 0) {
      throw new ForbiddenException('Insufficient permissions for this resource');
    }

    const userPermissions = user.permissions ?? [];
    const hasAny = explicitPermissions.some((perm) => userPermissions.includes(perm));
    if (!hasAny) {
      throw new ForbiddenException(
        `Insufficient permissions for this action (requires: ${explicitPermissions.join(' or ')})`,
      );
    }

    return true;
  }
}
