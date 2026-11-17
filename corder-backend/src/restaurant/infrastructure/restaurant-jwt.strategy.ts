import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { RootAdminEntity } from '../../platform/domain/root-admin.entity';
import { BossRestaurantEntity } from '../../platform/domain/boss-restaurant.entity';
import { RestaurantStaffEntity } from '../domain/restaurant-staff.entity';
import { PERMISSION_KEYS } from '../domain/permissions.catalog';
import { RolesService } from '../application/roles.service';
import {
  buildPaymentSuspendedErrorMessage,
  computeSecretFingerprint,
  isRestaurantPaymentSuspended,
  RestaurantAuthService,
  RestaurantTokenPayload,
} from '../application/restaurant-auth.service';
import { getBossRoleLabel } from '../domain/services/billing-suspension.policy';
import { requireConfigSecret } from '../../common/security/env.validation';

@Injectable()
export class RestaurantJwtStrategy extends PassportStrategy(Strategy, 'restaurant-jwt') {
  constructor(
    config: ConfigService,
    @InjectRepository(RestaurantEntity)
    private readonly restaurantRepo: Repository<RestaurantEntity>,
    @InjectRepository(RootAdminEntity)
    private readonly rootAdminRepo: Repository<RootAdminEntity>,
    @InjectRepository(BossRestaurantEntity)
    private readonly bossRestaurantRepo: Repository<BossRestaurantEntity>,
    @InjectRepository(RestaurantStaffEntity)
    private readonly staffRepo: Repository<RestaurantStaffEntity>,
    private readonly rolesService: RolesService,
    private readonly authService: RestaurantAuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requireConfigSecret(config, 'JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: RestaurantTokenPayload) {
    if (
      payload.type !== 'restaurant' ||
      !payload.restaurantId ||
      (payload.role !== 'root' && payload.role !== 'staff' && payload.role !== 'terminal')
    ) {
      throw new UnauthorizedException();
    }

    const reqPath = (req.originalUrl || req.url || '').toLowerCase();
    const isBossMultiBranchRoute =
      reqPath.includes('/restaurant/auth/me') ||
      reqPath.includes('/restaurant/auth/switch-branch') ||
      reqPath.includes('/restaurant/boss');
    const isBillingInspectionRoute =
      req.method === 'GET' && reqPath.includes('/restaurant/settings/billing');
    const isOpeningNewShift =
      req.method === 'POST' && /\/restaurant\/shifts(?:\?|$)/.test(reqPath);

    if (payload.role === 'root') {
      const admin = await this.rootAdminRepo.findOne({ where: { id: payload.sub } });
      if (!admin || admin.isActive === false || !admin.passwordHash) {
        throw new UnauthorizedException('Boss account is inactive or not found');
      }
      if (
        payload.pwdFp &&
        payload.pwdFp !== computeSecretFingerprint(admin.passwordHash)
      ) {
        throw new UnauthorizedException('Boss password has been changed; please sign in again');
      }

      const owned = await this.authService.getBossOwnedRestaurants(
        admin.id,
        admin.restaurantId,
        admin,
      );
      if (owned.length === 0) {
        throw new UnauthorizedException('No restaurant branch assigned to this Boss account');
      }

      const headerRestId = req.headers['x-restaurant-id'];
      const explicitHeaderId = Array.isArray(headerRestId)
        ? headerRestId[0]?.trim()
        : headerRestId?.trim();
      const switchBodyId =
        reqPath.includes('/restaurant/auth/switch-branch') &&
        typeof (req.body as { restaurantId?: unknown } | undefined)?.restaurantId === 'string'
          ? ((req.body as { restaurantId: string }).restaurantId || '').trim()
          : '';

      const requestedId = explicitHeaderId || switchBodyId;
      let targetRestaurant = owned.find(
        (r) => r.id === (requestedId || payload.restaurantId),
      );

      if (requestedId && !targetRestaurant) {
        throw new UnauthorizedException('You do not have access to this branch');
      }

      const activeBranches = owned.filter(
        (r) => r.status === 'active' && !isRestaurantPaymentSuspended(r),
      );

      if (
        !explicitHeaderId &&
        isBossMultiBranchRoute &&
        (!targetRestaurant ||
          targetRestaurant.status !== 'active' ||
          isRestaurantPaymentSuspended(targetRestaurant)) &&
        activeBranches.length > 0
      ) {
        targetRestaurant = activeBranches[0];
      }

      if (!targetRestaurant) {
        throw new UnauthorizedException('You do not have access to this branch');
      }

      if (!isBillingInspectionRoute && isRestaurantPaymentSuspended(targetRestaurant)) {
        const hasOpenShift =
          !isOpeningNewShift && (await this.authService.hasOpenCashShift(targetRestaurant.id));
        if (!hasOpenShift) {
          const cfg = await this.authService.loadBillingConfig();
          throw new UnauthorizedException(
            buildPaymentSuspendedErrorMessage(targetRestaurant.name, cfg),
          );
        }
      }
      if (targetRestaurant.status !== 'active') {
        throw new UnauthorizedException('Restaurant is not active');
      }

      const tier = admin.bossTier || 'franchise_owner';
      return {
        id: admin.id,
        sub: admin.id,
        restaurantId: targetRestaurant.id,
        slug: targetRestaurant.slug,
        email: admin.email,
        name: admin.name || payload.name || admin.email,
        role: 'root' as const,
        staffRole: 'boss',
        roleLabel: getBossRoleLabel(tier),
        isBoss: true,
        bossTier: tier,
        brandName: admin.brandName ?? null,
        permissions: [...PERMISSION_KEYS],
        limits: { maxDiscountPercent: 100, maxDiscountAmount: null },
      };
    }

    const restaurant = await this.restaurantRepo.findOne({
      where: { id: payload.restaurantId },
      select: {
        id: true,
        name: true,
        status: true,
        slug: true,
        isAccessSuspended: true,
        billingStatus: true,
        terminalEmail: true,
        terminalPasswordHash: true,
      },
    });
    if (!restaurant) {
      throw new UnauthorizedException('Restaurant not found');
    }
    if (!isBillingInspectionRoute && isRestaurantPaymentSuspended(restaurant)) {
      const hasOpenShift =
        !isOpeningNewShift && (await this.authService.hasOpenCashShift(restaurant.id));
      if (!hasOpenShift) {
        const cfg = await this.authService.loadBillingConfig();
        throw new UnauthorizedException(
          buildPaymentSuspendedErrorMessage(restaurant.name, cfg),
        );
      }
    }
    if (restaurant.status !== 'active') {
      throw new UnauthorizedException('Restaurant is not active');
    }

    if (payload.role === 'staff') {
      const staff = await this.staffRepo.findOne({
        where: { id: payload.sub, restaurantId: restaurant.id, isActive: true },
      });
      if (!staff || !staff.passwordHash) {
        throw new UnauthorizedException('Staff account is inactive or not found');
      }
      if (
        payload.pwdFp &&
        payload.pwdFp !== computeSecretFingerprint(staff.passwordHash)
      ) {
        throw new UnauthorizedException('Staff password has been changed; please sign in again');
      }
      const resolved = await this.rolesService.resolveForStaff(staff);
      if (!resolved.canAccessPanel) {
        throw new UnauthorizedException('Merchant panel access has been revoked');
      }
      return {
        id: staff.id,
        sub: staff.id,
        restaurantId: restaurant.id,
        slug: restaurant.slug,
        email: staff.email ?? payload.email,
        name: staff.name,
        role: 'staff' as const,
        staffRole: resolved.roleKey,
        roleLabel: resolved.roleLabel,
        isBoss: false,
        permissions: resolved.permissions,
        limits: resolved.limits,
      };
    }

    if (
      !restaurant.terminalEmail ||
      !restaurant.terminalPasswordHash ||
      restaurant.terminalEmail.toLowerCase().trim() !== (payload.email || '').toLowerCase().trim()
    ) {
      throw new UnauthorizedException('Terminal credentials are inactive or have been changed');
    }
    if (
      payload.pwdFp &&
      payload.pwdFp !== computeSecretFingerprint(restaurant.terminalPasswordHash)
    ) {
      throw new UnauthorizedException('Terminal password has been changed; please sign in again');
    }

    return {
      id: restaurant.id,
      sub: payload.sub,
      restaurantId: restaurant.id,
      slug: restaurant.slug,
      email: restaurant.terminalEmail,
      name: payload.name ?? 'Terminal',
      role: 'terminal' as const,
      staffRole: 'terminal',
      roleLabel: 'POS Terminal',
      isBoss: false,
      permissions: [],
      limits: { maxDiscountPercent: 0, maxDiscountAmount: 0 },
    };
  }
}
