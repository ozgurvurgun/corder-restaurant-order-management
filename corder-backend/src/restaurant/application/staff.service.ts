import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { RestaurantStaffEntity } from '../domain/restaurant-staff.entity';
import { RestaurantRoleEntity } from '../domain/restaurant-role.entity';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import {
  EffectivePolicyLimits,
  normalizeRoleKey,
  PermissionKey,
  sanitizePermissionKeys,
} from '../domain/permissions.catalog';
import { RolesService } from './roles.service';
import { StaffSessionService } from './staff-session.service';
import { OrdersGateway } from '../api/orders.gateway';
import {
  evaluateRestaurantGeofenceAccess,
  evaluateStaffShiftAccess,
} from '../domain/services/terminal-access.policy';
import { CreateStaffDto } from '../api/dto/create-staff.dto';
import { UpdateStaffDto } from '../api/dto/update-staff.dto';
import { normalizeStorageText } from '../../common/text/text-normalizer';
import { formatCanonicalCorderEmail } from '../../common/text/corder-email.policy';

const DUMMY_PIN_HASH = bcrypt.hashSync('00000000', 10);

export interface StaffMutationActor {
  id?: string; sub?: string; role?: string; isBoss?: boolean;
  permissions?: PermissionKey[]; limits?: EffectivePolicyLimits;
}

export interface StaffPublicDto {
  id: string; restaurantId: string; name: string; email: string | null;
  role: string; roleLabel: string; roleColor: string; phone?: string;
  isActive: boolean; canAccessPanel: boolean; canAccessTerminal: boolean;
  hasPin: boolean; hasPassword: boolean;
  permissions: PermissionKey[]; grantedPermissions: PermissionKey[]; revokedPermissions: PermissionKey[];
  limits: EffectivePolicyLimits;
  maxDiscountPercentOverride: number | null; maxDiscountAmountOverride: number | null;
  shiftRestrictionEnabled: boolean; shiftStartTime: string | null; shiftEndTime: string | null;
  shiftCutoffOffsetMinutes: number; effectiveShiftEndTime: string | null;
  createdAt: string;
}

export interface TerminalStaffMemberDto {
  id: string; name: string; role: string; roleLabel: string; roleColor: string; hasPin: boolean;
  shiftRestrictionEnabled: boolean; shiftStartTime: string | null; shiftEndTime: string | null;
  shiftCutoffOffsetMinutes: number; effectiveStartTime: string | null; effectiveEndTime: string | null;
  isWithinShift: boolean; shiftBlockReason: string | null;
  terminalLocationRestrictionEnabled?: boolean;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  locationRadiusMeters?: number;
}

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(RestaurantStaffEntity)
    private readonly staffRepo: Repository<RestaurantStaffEntity>,
    @InjectRepository(RestaurantEntity)
    private readonly restaurantRepo: Repository<RestaurantEntity>,
    private readonly staffSession: StaffSessionService,
    private readonly rolesService: RolesService,
    private readonly ordersGateway: OrdersGateway,
  ) {}

  private async resolveCanonicalStaffEmail(
    restaurantId: string,
    rawEmail: string,
  ): Promise<string> {
    const rest = await this.restaurantRepo.findOne({
      where: { id: restaurantId },
      select: ['id', 'slug', 'name'],
    });
    const canonical = formatCanonicalCorderEmail(
      rawEmail,
      rest?.slug || rest?.name,
    );
    if (!canonical) {
      throw new BadRequestException('Invalid email username');
    }
    return canonical;
  }

  private async toPublicDto(
    s: RestaurantStaffEntity,
    preloadedRoles?: RestaurantRoleEntity[],
  ): Promise<StaffPublicDto> {
    const resolved = await this.rolesService.resolveForStaff(s, preloadedRoles);
    const shiftEval = evaluateStaffShiftAccess(s);
    return {
      id: s.id, restaurantId: s.restaurantId, name: s.name, email: s.email ?? null,
      role: resolved.roleKey, roleLabel: resolved.roleLabel, roleColor: resolved.roleColor,
      phone: s.phone ?? undefined, isActive: s.isActive,
      canAccessPanel: resolved.canAccessPanel, canAccessTerminal: resolved.canAccessTerminal,
      hasPin: Boolean(s.pinHash), hasPassword: Boolean(s.passwordHash),
      permissions: resolved.permissions,
      grantedPermissions: sanitizePermissionKeys(s.grantedPermissions),
      revokedPermissions: sanitizePermissionKeys(s.revokedPermissions),
      limits: resolved.limits,
      maxDiscountPercentOverride: s.maxDiscountPercentOverride != null ? Number(s.maxDiscountPercentOverride) : null,
      maxDiscountAmountOverride: s.maxDiscountAmountOverride != null ? Number(s.maxDiscountAmountOverride) : null,
      shiftRestrictionEnabled: Boolean(s.shiftRestrictionEnabled),
      shiftStartTime: s.shiftStartTime ?? null, shiftEndTime: s.shiftEndTime ?? null,
      shiftCutoffOffsetMinutes: Number(s.shiftCutoffOffsetMinutes ?? 0),
      effectiveShiftEndTime: shiftEval.effectiveEndTime,
      createdAt: s.createdAt.toISOString(),
    };
  }

  async list(restaurantId: string): Promise<StaffPublicDto[]> {
    const roles = await this.rolesService.ensureDefaultRoles(restaurantId);
    const list = await this.staffRepo.find({ where: { restaurantId }, order: { createdAt: 'ASC' } });
    return Promise.all(list.map((s) => this.toPublicDto(s, roles)));
  }

  private async assertUniqueEmail(email: string, excludeStaffId?: string): Promise<void> {
    const normalized = email.toLowerCase().trim();
    const existing = await this.staffRepo.findOne({ where: { email: normalized } });
    if (existing && existing.id !== excludeStaffId) {
      throw new ConflictException('This email address is already in use by another user');
    }
  }

  private assertActorCanGrantPolicies(
    actor: StaffMutationActor | undefined,
    params: {
      grantedPermissions?: string[];
      maxDiscountPercentOverride?: number | null;
      maxDiscountAmountOverride?: number | null;
    },
  ): void {
    if (!actor || actor.isBoss || actor.role === 'root') return;
    const actorPerms = new Set<PermissionKey>(actor.permissions ?? []);
    if (actorPerms.has('roles.manage')) return;
    for (const perm of sanitizePermissionKeys(params.grantedPermissions)) {
      if (!actorPerms.has(perm)) {
        throw new ForbiddenException(`You cannot grant a permission that your own account does not possess (${perm})`);
      }
    }
    const maxPct = actor.limits?.maxDiscountPercent ?? 0;
    if (params.maxDiscountPercentOverride != null && Number(params.maxDiscountPercentOverride) > maxPct) {
      throw new ForbiddenException(`You cannot set a discount percentage limit higher than your own (${maxPct}%)`);
    }
    const maxAmt = actor.limits?.maxDiscountAmount;
    if (maxAmt != null && params.maxDiscountAmountOverride != null && Number(params.maxDiscountAmountOverride) > maxAmt) {
      throw new ForbiddenException(`You cannot set a discount amount limit higher than your own (${maxAmt})`);
    }
  }

  async create(
    restaurantId: string,
    dto: CreateStaffDto,
    actor?: StaffMutationActor,
  ): Promise<StaffPublicDto> {
    this.assertActorCanGrantPolicies(actor, dto);
    await this.rolesService.ensureDefaultRoles(restaurantId);
    const roleKey = normalizeRoleKey(dto.role);
    const roleEntity = await this.rolesService
      .findByKeyOrId(restaurantId, roleKey)
      .catch(() => null);

    const canAccessPanel =
      dto.canAccessPanel !== undefined
        ? Boolean(dto.canAccessPanel)
        : Boolean(dto.email && dto.password) || Boolean(roleEntity?.canAccessPanel);
    const canAccessTerminal =
      dto.canAccessTerminal !== undefined
        ? Boolean(dto.canAccessTerminal)
        : Boolean(dto.pin) || Boolean(roleEntity?.canAccessTerminal ?? true);

    let pinHash: string | null = null;
    if (dto.pin && dto.pin.trim()) {
      const pin = dto.pin.trim();
      pinHash = await bcrypt.hash(pin, 10);
    } else if (canAccessTerminal) {
      throw new BadRequestException('A 4-8 digit PIN is required for terminal users');
    }

    let email: string | null = null;
    let passwordHash: string | null = null;
    if (dto.email && dto.email.trim()) {
      email = await this.resolveCanonicalStaffEmail(restaurantId, dto.email);
      await this.assertUniqueEmail(email);
    }
    if (dto.password && dto.password.trim()) {
      passwordHash = await bcrypt.hash(dto.password, 10);
    }
    if (canAccessPanel && (!email || !passwordHash)) {
      throw new BadRequestException(
        'Email and password are required for users with Merchant Panel access',
      );
    }

    const staff = this.staffRepo.create({
      restaurantId,
      email,
      passwordHash,
      pinHash,
      name: normalizeStorageText(dto.name),
      role: roleEntity?.key ?? roleKey,
      phone: dto.phone?.trim() || null,
      isActive: true,
      canAccessPanel,
      canAccessTerminal,
      grantedPermissions: sanitizePermissionKeys(dto.grantedPermissions),
      revokedPermissions: sanitizePermissionKeys(dto.revokedPermissions),
      maxDiscountPercentOverride:
        dto.maxDiscountPercentOverride != null
          ? Math.max(0, Math.min(100, Number(dto.maxDiscountPercentOverride)))
          : null,
      maxDiscountAmountOverride:
        dto.maxDiscountAmountOverride != null && Number(dto.maxDiscountAmountOverride) >= 0
          ? String(Number(dto.maxDiscountAmountOverride))
          : null,
      shiftRestrictionEnabled: Boolean(dto.shiftRestrictionEnabled),
      shiftStartTime: dto.shiftStartTime?.trim() || null,
      shiftEndTime: dto.shiftEndTime?.trim() || null,
      shiftCutoffOffsetMinutes:
        dto.shiftCutoffOffsetMinutes != null ? Math.round(Number(dto.shiftCutoffOffsetMinutes) || 0) : 0,
    });
    const saved = await this.staffRepo.save(staff);
    return this.toPublicDto(saved);
  }

  async update(
    restaurantId: string,
    id: string,
    dto: UpdateStaffDto,
    actor?: StaffMutationActor,
  ): Promise<StaffPublicDto> {
    const staff = await this.staffRepo.findOne({ where: { id, restaurantId } });
    if (!staff) throw new NotFoundException('Staff not found');

    const actorId = actor?.sub ?? actor?.id;
    const isSelf = Boolean(actorId && actorId === id && !actor?.isBoss && actor?.role !== 'root');
    if (isSelf) {
      if (dto.isActive === false || dto.canAccessPanel === false) {
        throw new ForbiddenException(
          'You cannot deactivate or revoke Merchant Panel access on your own account',
        );
      }
      if (
        (dto.role !== undefined && normalizeRoleKey(dto.role) !== normalizeRoleKey(staff.role)) ||
        dto.grantedPermissions !== undefined ||
        dto.revokedPermissions !== undefined ||
        dto.maxDiscountPercentOverride !== undefined ||
        dto.maxDiscountAmountOverride !== undefined
      ) {
        throw new ForbiddenException(
          'You cannot modify your own role, permissions, or discount limits',
        );
      }
    }
    this.assertActorCanGrantPolicies(actor, dto);

    if (dto.name != null && dto.name.trim()) {
      staff.name = normalizeStorageText(dto.name);
    }
    if (dto.role != null && dto.role.trim()) {
      const normalized = normalizeRoleKey(dto.role);
      const roleEntity = await this.rolesService
        .findByKeyOrId(restaurantId, normalized)
        .catch(() => null);
      staff.role = roleEntity?.key ?? normalized;
    }
    if (dto.pin != null && dto.pin !== '') {
      const pin = dto.pin.trim();
      staff.pinHash = await bcrypt.hash(pin, 10);
    }
    if (dto.email !== undefined) {
      if (dto.email && dto.email.trim()) {
        const nextEmail = await this.resolveCanonicalStaffEmail(
          restaurantId,
          dto.email,
        );
        await this.assertUniqueEmail(nextEmail, id);
        staff.email = nextEmail;
      } else {
        staff.email = null;
      }
    }
    if (dto.password != null && dto.password.trim() !== '') {
      staff.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    if (dto.phone !== undefined) {
      staff.phone = dto.phone?.trim() || null;
    }
    if (dto.isActive !== undefined) {
      staff.isActive = dto.isActive;
    }
    if (dto.canAccessPanel !== undefined) {
      staff.canAccessPanel = Boolean(dto.canAccessPanel);
    }
    if (dto.canAccessTerminal !== undefined) {
      staff.canAccessTerminal = Boolean(dto.canAccessTerminal);
    }
    if (dto.grantedPermissions !== undefined) {
      staff.grantedPermissions = sanitizePermissionKeys(dto.grantedPermissions);
    }
    if (dto.revokedPermissions !== undefined) {
      staff.revokedPermissions = sanitizePermissionKeys(dto.revokedPermissions);
    }
    if (dto.maxDiscountPercentOverride !== undefined) {
      staff.maxDiscountPercentOverride =
        dto.maxDiscountPercentOverride != null
          ? Math.max(0, Math.min(100, Number(dto.maxDiscountPercentOverride)))
          : null;
    }
    if (dto.maxDiscountAmountOverride !== undefined) {
      staff.maxDiscountAmountOverride =
        dto.maxDiscountAmountOverride != null && Number(dto.maxDiscountAmountOverride) >= 0
          ? String(Number(dto.maxDiscountAmountOverride))
          : null;
    }
    if (dto.shiftRestrictionEnabled !== undefined) {
      staff.shiftRestrictionEnabled = Boolean(dto.shiftRestrictionEnabled);
    }
    if (dto.shiftStartTime !== undefined) {
      staff.shiftStartTime = dto.shiftStartTime?.trim() || null;
    }
    if (dto.shiftEndTime !== undefined) {
      staff.shiftEndTime = dto.shiftEndTime?.trim() || null;
    }
    if (dto.shiftCutoffOffsetMinutes !== undefined) {
      staff.shiftCutoffOffsetMinutes =
        dto.shiftCutoffOffsetMinutes != null ? Math.round(Number(dto.shiftCutoffOffsetMinutes) || 0) : 0;
    }

    if (staff.canAccessPanel && (!staff.email || !staff.passwordHash)) {
      throw new BadRequestException(
        'Email and password are required for users with Merchant Panel access',
      );
    }
    if (dto.canAccessTerminal === true && !staff.pinHash) {
      throw new BadRequestException('A 4-8 digit PIN is required for terminal users');
    }

    const saved = await this.staffRepo.save(staff);
    this.ordersGateway.emitStaffSessionUpdated(restaurantId, saved.id);
    return this.toPublicDto(saved);
  }

  async delete(
    restaurantId: string,
    id: string,
    actor?: StaffMutationActor,
  ): Promise<void> {
    const actorId = actor?.sub ?? actor?.id;
    if (actorId && actorId === id && !actor?.isBoss && actor?.role !== 'root') {
      throw new ForbiddenException('You cannot delete your own staff account');
    }
    const result = await this.staffRepo.delete({ id, restaurantId });
    if (result.affected === 0) throw new NotFoundException('Staff not found');
  }

  async listTerminalUsers(restaurantId: string): Promise<TerminalStaffMemberDto[]> {
    const [roles, list, rest] = await Promise.all([
      this.rolesService.ensureDefaultRoles(restaurantId),
      this.staffRepo.find({ where: { restaurantId, isActive: true }, order: { createdAt: 'ASC' } }),
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
    const locEnabled = Boolean(rest?.terminalLocationRestrictionEnabled);
    const locLat = rest?.locationLatitude != null ? Number(rest.locationLatitude) : null;
    const locLng = rest?.locationLongitude != null ? Number(rest.locationLongitude) : null;
    const locRad = Number(rest?.locationRadiusMeters || 150);
    const result: TerminalStaffMemberDto[] = [];
    for (const member of list) {
      const resolved = await this.rolesService.resolveForStaff(member, roles);
      if (!resolved.canAccessTerminal) continue;
      const shiftEval = evaluateStaffShiftAccess(member);
      result.push({
        id: member.id,
        name: member.name,
        role: resolved.roleKey,
        roleLabel: resolved.roleLabel,
        roleColor: resolved.roleColor,
        hasPin: Boolean(member.pinHash),
        shiftRestrictionEnabled: Boolean(member.shiftRestrictionEnabled),
        shiftStartTime: member.shiftStartTime ?? null,
        shiftEndTime: member.shiftEndTime ?? null,
        shiftCutoffOffsetMinutes: Number(member.shiftCutoffOffsetMinutes ?? 0),
        effectiveStartTime: shiftEval.effectiveStartTime,
        effectiveEndTime: shiftEval.effectiveEndTime,
        isWithinShift: shiftEval.allowed,
        shiftBlockReason: shiftEval.reason ?? null,
        terminalLocationRestrictionEnabled: locEnabled,
        locationLatitude: locLat,
        locationLongitude: locLng,
        locationRadiusMeters: locRad,
      });
    }
    return result;
  }

  async verifyPin(
    restaurantId: string,
    pin: string,
    staffId?: string,
    clientCoords?: { latitude?: number | null; longitude?: number | null } | null,
  ): Promise<{
    staffId: string;
    name: string;
    role: string;
    roleLabel: string;
    permissions: PermissionKey[];
    limits: EffectivePolicyLimits;
    staffToken: string;
    shiftAccessUntil: string | null;
    effectiveEndTime: string | null;
  }> {
    const restaurant = await this.restaurantRepo.findOne({
      where: { id: restaurantId },
      select: {
        id: true,
        terminalLocationRestrictionEnabled: true,
        locationLatitude: true,
        locationLongitude: true,
        locationRadiusMeters: true,
      },
    });
    if (restaurant?.terminalLocationRestrictionEnabled) {
      const geoEval = evaluateRestaurantGeofenceAccess(restaurant, clientCoords);
      if (!geoEval.allowed) {
        throw new UnauthorizedException(geoEval.reason);
      }
    }

    const trimmed = pin.trim();
    const activeStaff = staffId
      ? await this.staffRepo.find({ where: { id: staffId, restaurantId, isActive: true } })
      : await this.staffRepo.find({ where: { restaurantId, isActive: true } });
    let comparedAny = false;
    for (const member of activeStaff) {
      if (!member.pinHash) continue;
      comparedAny = true;
      if (await bcrypt.compare(trimmed, member.pinHash)) {
        const resolved = await this.rolesService.resolveForStaff(member);
        if (!resolved.canAccessTerminal) {
          throw new UnauthorizedException('Terminal access is disabled for this user');
        }
        const shiftEval = evaluateStaffShiftAccess(member);
        if (!shiftEval.allowed) {
          throw new UnauthorizedException(shiftEval.reason);
        }
        const staffToken = this.staffSession.signStaffToken(
          {
            id: member.id,
            restaurantId,
            name: member.name,
            role: resolved.roleKey,
            pinHash: member.pinHash,
          },
          shiftEval.remainingSeconds,
        );
        return {
          staffId: member.id,
          name: member.name,
          role: resolved.roleKey,
          roleLabel: resolved.roleLabel,
          permissions: resolved.permissions,
          limits: resolved.limits,
          staffToken,
          shiftAccessUntil: shiftEval.shiftAccessUntilIso,
          effectiveEndTime: shiftEval.effectiveEndTime,
        };
      }
    }
    if (!comparedAny) {
      await bcrypt.compare(trimmed, DUMMY_PIN_HASH);
    }
    throw new UnauthorizedException('Invalid PIN code');
  }
}
