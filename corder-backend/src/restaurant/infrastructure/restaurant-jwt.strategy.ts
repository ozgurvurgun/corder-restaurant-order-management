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
  isRestaurantPaymentSuspended,
  RestaurantTokenPayload,
} from '../application/restaurant-auth.service';
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

    let targetRestaurantId = payload.restaurantId;

    // Allow Boss ('root') to switch active branch via x-restaurant-id header
    if (payload.role === 'root') {
      const headerRestId = req.headers['x-restaurant-id'];
      const requestedId = Array.isArray(headerRestId)
        ? headerRestId[0]?.trim()
        : headerRestId?.trim();
      if (requestedId && requestedId !== payload.restaurantId) {
        const admin = await this.rootAdminRepo.findOne({ where: { id: payload.sub } });
        if (!admin || admin.isActive === false) {
          throw new UnauthorizedException('Boss account is inactive');
        }
        const link = await this.bossRestaurantRepo.findOne({
          where: { bossId: payload.sub, restaurantId: requestedId },
        });
        if (link || admin.restaurantId === requestedId) {
          targetRestaurantId = requestedId;
        } else if (admin.bossTier === 'brand_owner' && admin.brandName) {
          const targetRest = await this.restaurantRepo.findOne({
            where: { id: requestedId },
            select: { id: true, brandName: true },
          });
          if (
            targetRest?.brandName &&
            targetRest.brandName.trim().toLowerCase() === admin.brandName.trim().toLowerCase()
          ) {
            targetRestaurantId = requestedId;
          } else {
            throw new UnauthorizedException('You do not have access to this branch');
          }
        } else {
          throw new UnauthorizedException('You do not have access to this branch');
        }
      }
    }

    const restaurant = await this.restaurantRepo.findOne({
      where: { id: targetRestaurantId },
      select: {
        id: true,
        name: true,
        status: true,
        slug: true,
        isAccessSuspended: true,
        billingStatus: true,
      },
    });
    if (!restaurant) {
      throw new UnauthorizedException('Restaurant not found');
    }
    if (isRestaurantPaymentSuspended(restaurant)) {
      throw new UnauthorizedException(
        buildPaymentSuspendedErrorMessage(restaurant.name),
      );
    }
    if (restaurant.status !== 'active') {
      throw new UnauthorizedException('Restaurant is not active');
    }

    if (payload.role === 'root') {
      return {
        restaurantId: restaurant.id,
        slug: restaurant.slug,
        sub: payload.sub,
        email: payload.email,
        name: payload.name ?? payload.email,
        role: 'root' as const,
        staffRole: 'boss',
        roleLabel: 'Owner (Boss)',
        isBoss: true,
        permissions: [...PERMISSION_KEYS],
        limits: { maxDiscountPercent: 100, maxDiscountAmount: null },
      };
    }

    if (payload.role === 'staff') {
      const staff = await this.staffRepo.findOne({
        where: { id: payload.sub, restaurantId: restaurant.id, isActive: true },
      });
      if (!staff) {
        throw new UnauthorizedException('Staff account is inactive or not found');
      }
      const resolved = await this.rolesService.resolveForStaff(staff);
      if (!resolved.canAccessPanel) {
        throw new UnauthorizedException('Merchant panel access has been revoked');
      }
      return {
        restaurantId: restaurant.id,
        slug: restaurant.slug,
        sub: staff.id,
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

    return {
      restaurantId: restaurant.id,
      slug: restaurant.slug,
      sub: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email,
      role: 'terminal' as const,
      staffRole: 'terminal',
      roleLabel: 'POS Terminal',
      isBoss: false,
      permissions: [],
      limits: { maxDiscountPercent: 0, maxDiscountAmount: 0 },
    };
  }
}
