import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { RootAdminEntity } from '../../platform/domain/root-admin.entity';
import { RestaurantStaffEntity } from '../domain/restaurant-staff.entity';
import { PERMISSION_KEYS } from '../domain/permissions.catalog';
import {
  buildPaymentSuspendedErrorMessage,
  computeSecretFingerprint,
  getBossRoleLabel,
  isRestaurantPaymentSuspended,
  RestaurantTokenPayload,
} from '../domain/services/billing-suspension.policy';
import { RestaurantAuthService } from './restaurant-auth.service';
import { RolesService } from './roles.service';

export interface HttpSessionContext {
  requestedRestaurantId?: string;
  isBossMultiBranchRoute: boolean;
  isBillingInspectionRoute: boolean;
  isOpeningNewShift: boolean;
}

export interface VerifiedSocketPrincipal {
  restaurantId: string;
  role: RestaurantTokenPayload['role'];
  authType: 'print-agent-jwt' | 'jwt';
  expMs: number | null;
}

@Injectable()
export class RestaurantSessionValidatorService {
  constructor(
    @InjectRepository(RestaurantEntity)
    private readonly restaurantRepo: Repository<RestaurantEntity>,
    @InjectRepository(RootAdminEntity)
    private readonly rootAdminRepo: Repository<RootAdminEntity>,
    @InjectRepository(RestaurantStaffEntity)
    private readonly staffRepo: Repository<RestaurantStaffEntity>,
    private readonly rolesService: RolesService,
    private readonly authService: RestaurantAuthService,
  ) {}

  private async assertBranchActiveAndUnsuspended(
    restaurant: Pick<
      RestaurantEntity,
      'id' | 'name' | 'status' | 'isAccessSuspended' | 'billingStatus'
    >,
    opts: { isBillingInspectionRoute: boolean; isOpeningNewShift: boolean },
  ): Promise<void> {
    if (!opts.isBillingInspectionRoute && isRestaurantPaymentSuspended(restaurant)) {
      const hasOpenShift =
        !opts.isOpeningNewShift && (await this.authService.hasOpenCashShift(restaurant.id));
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
  }

  async validateHttpPrincipal(
    payload: RestaurantTokenPayload,
    ctx: HttpSessionContext,
  ) {
    if (
      payload.type !== 'restaurant' ||
      !payload.restaurantId ||
      (payload.role !== 'root' && payload.role !== 'staff' && payload.role !== 'terminal')
    ) {
      throw new UnauthorizedException();
    }

    if (payload.role === 'root') {
      return this.validateHttpBossPrincipal(payload, ctx);
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

    await this.assertBranchActiveAndUnsuspended(restaurant, ctx);

    if (payload.role === 'staff') {
      return this.validateHttpStaffPrincipal(payload, restaurant);
    }
    return this.validateHttpTerminalPrincipal(payload, restaurant);
  }

  private async validateHttpBossPrincipal(
    payload: RestaurantTokenPayload,
    ctx: HttpSessionContext,
  ) {
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

    const requestedId = ctx.requestedRestaurantId || '';
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
      !requestedId &&
      ctx.isBossMultiBranchRoute &&
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

    await this.assertBranchActiveAndUnsuspended(targetRestaurant, ctx);

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

  private async validateHttpStaffPrincipal(
    payload: RestaurantTokenPayload,
    restaurant: Pick<RestaurantEntity, 'id' | 'slug'>,
  ) {
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

  private validateHttpTerminalPrincipal(
    payload: RestaurantTokenPayload,
    restaurant: Pick<
      RestaurantEntity,
      'id' | 'slug' | 'terminalEmail' | 'terminalPasswordHash'
    >,
  ) {
    if (
      !restaurant.terminalEmail ||
      !restaurant.terminalPasswordHash ||
      restaurant.terminalEmail.toLowerCase().trim() !==
        (payload.email || '').toLowerCase().trim()
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

  async validateSocketTokenPayload(
    payload: RestaurantTokenPayload & { exp?: number },
    requestedRestaurantId?: string,
  ): Promise<VerifiedSocketPrincipal | null> {
    if (
      payload.type !== 'restaurant' ||
      !payload.restaurantId ||
      (payload.role !== 'root' &&
        payload.role !== 'staff' &&
        payload.role !== 'terminal' &&
        payload.role !== 'print_agent')
    ) {
      return null;
    }

    const expMs = typeof payload.exp === 'number' ? payload.exp * 1000 : null;
    if (expMs !== null && expMs <= Date.now()) {
      return null;
    }

    const targetRestId =
      payload.role === 'root' && requestedRestaurantId?.trim()
        ? requestedRestaurantId.trim()
        : payload.restaurantId;

    if (payload.role === 'root') {
      await this.authService.assertBossOwnsRestaurant(payload.sub, targetRestId);
    }

    const activeRestaurant = await this.restaurantRepo.findOne({
      where: { id: targetRestId },
      select: {
        id: true,
        status: true,
        terminalEmail: true,
        terminalPasswordHash: true,
        printAgentUsername: true,
        printAgentPasswordHash: true,
        isAccessSuspended: true,
        billingStatus: true,
      },
    });
    if (!activeRestaurant || activeRestaurant.status !== 'active') {
      return null;
    }
    if (
      isRestaurantPaymentSuspended(activeRestaurant) &&
      !(await this.authService.hasOpenCashShift(targetRestId))
    ) {
      return null;
    }

    const principalValid = await this.verifySocketRoleCredentials(
      payload,
      activeRestaurant,
      targetRestId,
    );
    if (!principalValid) return null;

    return {
      restaurantId: targetRestId,
      role: payload.role,
      authType: payload.role === 'print_agent' ? 'print-agent-jwt' : 'jwt',
      expMs,
    };
  }

  private async verifySocketRoleCredentials(
    payload: RestaurantTokenPayload,
    restaurant: RestaurantEntity,
    targetRestId: string,
  ): Promise<boolean> {
    if (payload.role === 'print_agent') {
      if (
        !restaurant.printAgentUsername ||
        !restaurant.printAgentPasswordHash ||
        restaurant.printAgentUsername !== payload.email
      ) {
        return false;
      }
      const expectedFp = computeSecretFingerprint(restaurant.printAgentPasswordHash);
      return !payload.pwdFp || payload.pwdFp === expectedFp;
    }

    if (payload.role === 'terminal') {
      if (
        !restaurant.terminalEmail ||
        !restaurant.terminalPasswordHash ||
        restaurant.terminalEmail.toLowerCase().trim() !==
          (payload.email || '').toLowerCase().trim()
      ) {
        return false;
      }
      const expectedFp = computeSecretFingerprint(restaurant.terminalPasswordHash);
      return !payload.pwdFp || payload.pwdFp === expectedFp;
    }

    if (payload.role === 'staff') {
      const staff = await this.staffRepo.findOne({
        where: { id: payload.sub, restaurantId: targetRestId, isActive: true },
      });
      if (!staff || !staff.passwordHash) return false;
      if (payload.pwdFp && payload.pwdFp !== computeSecretFingerprint(staff.passwordHash)) {
        return false;
      }
      const resolved = await this.rolesService.resolveForStaff(staff);
      return resolved.canAccessPanel || resolved.canAccessTerminal;
    }

    return true;
  }
}

