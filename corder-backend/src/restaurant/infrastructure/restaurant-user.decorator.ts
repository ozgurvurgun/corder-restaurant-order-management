import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RestaurantJwtRole } from '../application/restaurant-auth.service';
import { EffectivePolicyLimits, PermissionKey } from '../domain/permissions.catalog';

export const RestaurantUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user as {
    sub: string;
    restaurantId: string;
    email: string;
    name: string;
    role: RestaurantJwtRole;
    staffRole?: string;
    roleLabel?: string;
    isBoss?: boolean;
    permissions?: PermissionKey[];
    limits?: EffectivePolicyLimits;
  };
  return {
    id: user.sub,
    sub: user.sub,
    restaurantId: user.restaurantId,
    email: user.email,
    name: user.name,
    role: user.role,
    staffRole: user.staffRole ?? user.role,
    roleLabel: user.roleLabel ?? user.role,
    isBoss: Boolean(user.isBoss ?? user.role === 'root'),
    permissions: user.permissions ?? [],
    limits: user.limits ?? { maxDiscountPercent: 0, maxDiscountAmount: 0 },
  };
});
