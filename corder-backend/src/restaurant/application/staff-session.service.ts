import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import { RestaurantStaffEntity } from '../domain/restaurant-staff.entity';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import {
  EffectivePolicyLimits,
  PERMISSION_KEYS,
  PermissionKey,
} from '../domain/permissions.catalog';
import { computeSecretFingerprint } from '../domain/services/billing-suspension.policy';
import {
  evaluateRestaurantGeofenceAccess,
  evaluateStaffShiftAccess,
} from '../domain/services/terminal-access.policy';
import { RolesService } from './roles.service';
import {
  DEFAULT_JWT_EXPIRES_IN,
  requireConfigSecret,
} from '../../common/security/env.validation';

export interface StaffSessionTokenPayload {
  typ: 'staff_session';
  sub: string;
  restaurantId: string;
  name: string;
  role: string;
  pinFp?: string;
}

export interface VerifiedStaffIdentity {
  staffId: string;
  name: string;
  role: string;
  roleLabel: string;
  permissions: PermissionKey[];
  limits: EffectivePolicyLimits;
}

export interface RequestActorContext {
  actorId: string;
  actorName: string;
  role: string;
  roleLabel: string;
  isBoss: boolean;
  permissions: PermissionKey[];
  limits: EffectivePolicyLimits;
}

@Injectable()
export class StaffSessionService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(RestaurantStaffEntity)
    private readonly staffRepo: Repository<RestaurantStaffEntity>,
    @InjectRepository(RestaurantEntity)
    private readonly restaurantRepo: Repository<RestaurantEntity>,
    private readonly rolesService: RolesService,
  ) {}

  signStaffToken(
    staff: {
      id: string;
      restaurantId: string;
      name: string;
      role: string;
      pinHash?: string | null;
    },
    maxTtlSeconds?: number | null,
  ): string {
    const pinFp = computeSecretFingerprint(staff.pinHash);
    const payload: StaffSessionTokenPayload = {
      typ: 'staff_session',
      sub: staff.id,
      restaurantId: staff.restaurantId,
      name: staff.name,
      role: staff.role,
      ...(pinFp ? { pinFp } : {}),
    };
    const defaultExp = this.config.get<string>('JWT_EXPIRES_IN', DEFAULT_JWT_EXPIRES_IN);
    const expiresIn =
      maxTtlSeconds != null && Number.isFinite(maxTtlSeconds) && maxTtlSeconds > 0
        ? Math.max(5, Math.min(43200, Math.floor(maxTtlSeconds)))
        : defaultExp;
    return this.jwt.sign(payload, {
      secret: requireConfigSecret(this.config, 'JWT_SECRET'),
      expiresIn,
    });
  }

  async requireFromRequest(
    req: Request,
    restaurantId: string,
  ): Promise<VerifiedStaffIdentity> {
    const raw = req.headers['x-staff-token'];
    const token = Array.isArray(raw) ? raw[0]?.trim() : raw?.trim();
    if (!token) {
      throw new UnauthorizedException('Staff PIN verification is required');
    }
    return this.verifyToken(token, restaurantId, req);
  }

  async resolveOptionalFromRequest(
    req: Request,
    restaurantId: string,
  ): Promise<VerifiedStaffIdentity | null> {
    const raw = req.headers['x-staff-token'];
    const token = Array.isArray(raw) ? raw[0]?.trim() : raw?.trim();
    if (!token) return null;
    return this.verifyToken(token, restaurantId, req);
  }

  async resolveActorContext(
    req: Request,
    restaurantId: string,
    jwtUser?: {
      sub?: string;
      id?: string;
      name?: string;
      role?: string;
      staffRole?: string;
      permissions?: PermissionKey[];
      limits?: EffectivePolicyLimits;
    },
  ): Promise<RequestActorContext> {
    const staff = await this.resolveOptionalFromRequest(req, restaurantId);
    if (staff) {
      return {
        actorId: staff.staffId,
        actorName: staff.name,
        role: staff.role,
        roleLabel: staff.roleLabel,
        isBoss: false,
        permissions: staff.permissions,
        limits: staff.limits,
      };
    }

    if (jwtUser?.role === 'root' || jwtUser?.role === 'boss') {
      return {
        actorId: jwtUser.sub ?? jwtUser.id ?? restaurantId,
        actorName: jwtUser.name ?? 'Boss',
        role: 'boss',
        roleLabel: 'Owner (Boss)',
        isBoss: true,
        permissions: [...PERMISSION_KEYS],
        limits: { maxDiscountPercent: 100, maxDiscountAmount: null },
      };
    }

    if (jwtUser?.role === 'staff') {
      return {
        actorId: jwtUser.sub ?? jwtUser.id ?? restaurantId,
        actorName: jwtUser.name ?? 'Staff',
        role: jwtUser.staffRole ?? 'staff',
        roleLabel: jwtUser.staffRole ?? 'Staff',
        isBoss: false,
        permissions: jwtUser.permissions ?? [],
        limits: jwtUser.limits ?? { maxDiscountPercent: 0, maxDiscountAmount: 0 },
      };
    }

    // Terminal JWT without x-staff-token: require staff session if terminal
    if (jwtUser?.role === 'terminal') {
      const requiredStaff = await this.requireFromRequest(req, restaurantId);
      return {
        actorId: requiredStaff.staffId,
        actorName: requiredStaff.name,
        role: requiredStaff.role,
        roleLabel: requiredStaff.roleLabel,
        isBoss: false,
        permissions: requiredStaff.permissions,
        limits: requiredStaff.limits,
      };
    }

    throw new UnauthorizedException('Actor session could not be verified');
  }

  async assertActorPermission(
    req: Request,
    restaurantId: string,
    requiredPermission: PermissionKey,
    jwtUser?: {
      sub?: string;
      id?: string;
      name?: string;
      role?: string;
      staffRole?: string;
      permissions?: PermissionKey[];
      limits?: EffectivePolicyLimits;
    },
  ): Promise<RequestActorContext> {
    const actor = await this.resolveActorContext(req, restaurantId, jwtUser);
    if (!actor.isBoss && !actor.permissions.includes(requiredPermission)) {
      throw new ForbiddenException(
        `You do not have permission for this action (${requiredPermission})`,
      );
    }
    return actor;
  }

  private extractClientCoords(req?: Request): {
    latitude: number | null;
    longitude: number | null;
  } {
    if (!req?.headers) return { latitude: null, longitude: null };
    const rawLat = req.headers['x-terminal-lat'];
    const rawLng = req.headers['x-terminal-lng'];
    const latStr = Array.isArray(rawLat) ? rawLat[0] : rawLat;
    const lngStr = Array.isArray(rawLng) ? rawLng[0] : rawLng;
    const lat = latStr != null && latStr !== '' ? Number(latStr) : NaN;
    const lng = lngStr != null && lngStr !== '' ? Number(lngStr) : NaN;
    return {
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lng) ? lng : null,
    };
  }

  private async verifyToken(
    token: string,
    restaurantId: string,
    req?: Request,
  ): Promise<VerifiedStaffIdentity> {
    let payload: StaffSessionTokenPayload;
    try {
      payload = this.jwt.verify<StaffSessionTokenPayload>(token, {
        secret: requireConfigSecret(this.config, 'JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Personel PIN oturum süreniz sona erdi. Lütfen tekrar giriş yapın.');
    }
    if (
      payload.typ !== 'staff_session' ||
      !payload.sub ||
      payload.restaurantId !== restaurantId
    ) {
      throw new UnauthorizedException('Invalid staff session');
    }
    const [staff, restaurant] = await Promise.all([
      this.staffRepo.findOne({
        where: { id: payload.sub, restaurantId, isActive: true },
      }),
      this.restaurantRepo.findOne({
        where: { id: restaurantId },
        select: {
          id: true,
          terminalLocationRestrictionEnabled: true,
          locationLatitude: true,
          locationLongitude: true,
          locationRadiusMeters: true,
        },
      }),
    ]);
    if (!staff || !staff.pinHash) {
      throw new UnauthorizedException('Staff member not found or PIN disabled');
    }
    if (
      !payload.pinFp ||
      payload.pinFp !== computeSecretFingerprint(staff.pinHash)
    ) {
      throw new UnauthorizedException('Staff PIN has been changed; please sign in again');
    }
    const resolved = await this.rolesService.resolveForStaff(staff);
    if (!resolved.canAccessTerminal) {
      throw new UnauthorizedException('Terminal access is disabled for this user');
    }

    const shiftEval = evaluateStaffShiftAccess(staff);
    if (!shiftEval.allowed) {
      throw new UnauthorizedException(
        shiftEval.reason || 'Personel mesai süreniz sona erdiği için terminal erişiminiz kapatıldı.',
      );
    }

    if (restaurant?.terminalLocationRestrictionEnabled) {
      const coords = this.extractClientCoords(req);
      const geoEval = evaluateRestaurantGeofenceAccess(restaurant, coords);
      if (!geoEval.allowed) {
        throw new UnauthorizedException(
          geoEval.reason || 'Personel konum doğrulaması başarısız olduğu için terminal erişiminiz kapatıldı.',
        );
      }
    }

    return {
      staffId: staff.id,
      name: staff.name,
      role: resolved.roleKey,
      roleLabel: resolved.roleLabel,
      permissions: resolved.permissions,
      limits: resolved.limits,
    };
  }
}
