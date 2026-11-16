import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { RestaurantStaffEntity } from '../domain/restaurant-staff.entity';
import { RestaurantRoleEntity } from '../domain/restaurant-role.entity';
import {
  EffectivePolicyLimits,
  normalizeRoleKey,
  PermissionKey,
  sanitizePermissionKeys,
} from '../domain/permissions.catalog';
import { RolesService } from './roles.service';
import { StaffSessionService } from './staff-session.service';
import { CreateStaffDto } from '../api/dto/create-staff.dto';
import { UpdateStaffDto } from '../api/dto/update-staff.dto';

export interface StaffPublicDto {
  id: string;
  restaurantId: string;
  name: string;
  email: string | null;
  role: string;
  roleLabel: string;
  roleColor: string;
  phone?: string;
  isActive: boolean;
  canAccessPanel: boolean;
  canAccessTerminal: boolean;
  hasPin: boolean;
  hasPassword: boolean;
  permissions: PermissionKey[];
  permissionsOverride: PermissionKey[] | null;
  grantedPermissions: PermissionKey[];
  revokedPermissions: PermissionKey[];
  limits: EffectivePolicyLimits;
  maxDiscountPercentOverride: number | null;
  maxDiscountAmountOverride: number | null;
  createdAt: string;
}

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(RestaurantStaffEntity)
    private readonly staffRepo: Repository<RestaurantStaffEntity>,
    private readonly staffSession: StaffSessionService,
    private readonly rolesService: RolesService,
  ) {}

  private async toPublicDto(
    s: RestaurantStaffEntity,
    preloadedRoles?: RestaurantRoleEntity[],
  ): Promise<StaffPublicDto> {
    const resolved = await this.rolesService.resolveForStaff(s, preloadedRoles);
    return {
      id: s.id,
      restaurantId: s.restaurantId,
      name: s.name,
      email: s.email ?? null,
      role: resolved.roleKey,
      roleLabel: resolved.roleLabel,
      roleColor: resolved.roleColor,
      phone: s.phone ?? undefined,
      isActive: s.isActive,
      canAccessPanel: resolved.canAccessPanel,
      canAccessTerminal: resolved.canAccessTerminal,
      hasPin: Boolean(s.pinHash),
      hasPassword: Boolean(s.passwordHash),
      permissions: resolved.permissions,
      permissionsOverride: s.permissionsOverride
        ? sanitizePermissionKeys(s.permissionsOverride)
        : null,
      grantedPermissions: sanitizePermissionKeys(s.grantedPermissions),
      revokedPermissions: sanitizePermissionKeys(s.revokedPermissions),
      limits: resolved.limits,
      maxDiscountPercentOverride:
        s.maxDiscountPercentOverride != null ? Number(s.maxDiscountPercentOverride) : null,
      maxDiscountAmountOverride:
        s.maxDiscountAmountOverride != null ? Number(s.maxDiscountAmountOverride) : null,
      createdAt: s.createdAt.toISOString(),
    };
  }

  async list(restaurantId: string): Promise<StaffPublicDto[]> {
    const roles = await this.rolesService.ensureDefaultRoles(restaurantId);
    const list = await this.staffRepo.find({
      where: { restaurantId },
      order: { createdAt: 'ASC' },
    });
    return Promise.all(list.map((s) => this.toPublicDto(s, roles)));
  }

  private async assertUniquePinInRestaurant(
    restaurantId: string,
    plainPin: string,
    excludeStaffId?: string,
  ): Promise<void> {
    const existingList = await this.staffRepo.find({ where: { restaurantId } });
    for (const member of existingList) {
      if (excludeStaffId && member.id === excludeStaffId) continue;
      if (member.pinHash && (await bcrypt.compare(plainPin, member.pinHash))) {
        throw new ConflictException(
          'This PIN code is already in use by another staff member in this branch',
        );
      }
    }
  }

  private async assertUniqueEmail(
    email: string,
    excludeStaffId?: string,
  ): Promise<void> {
    const normalized = email.toLowerCase().trim();
    const existing = await this.staffRepo.findOne({ where: { email: normalized } });
    if (existing && existing.id !== excludeStaffId) {
      throw new ConflictException(
        'This email address is already in use by another user',
      );
    }
  }

  async create(restaurantId: string, dto: CreateStaffDto): Promise<StaffPublicDto> {
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
      await this.assertUniquePinInRestaurant(restaurantId, pin);
      pinHash = await bcrypt.hash(pin, 10);
    } else if (canAccessTerminal && !canAccessPanel) {
      throw new BadRequestException('A 4-8 digit PIN is required for terminal users');
    }

    let email: string | null = null;
    let passwordHash: string | null = null;
    if (dto.email && dto.email.trim()) {
      email = dto.email.toLowerCase().trim();
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
      name: dto.name.trim(),
      role: roleEntity?.key ?? roleKey,
      phone: dto.phone?.trim() || null,
      isActive: true,
      canAccessPanel,
      canAccessTerminal,
      permissionsOverride:
        dto.permissionsOverride !== undefined && dto.permissionsOverride !== null
          ? sanitizePermissionKeys(dto.permissionsOverride)
          : null,
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
    });
    const saved = await this.staffRepo.save(staff);
    return this.toPublicDto(saved);
  }

  async update(
    restaurantId: string,
    id: string,
    dto: UpdateStaffDto,
  ): Promise<StaffPublicDto> {
    const staff = await this.staffRepo.findOne({ where: { id, restaurantId } });
    if (!staff) throw new NotFoundException('Staff not found');

    if (dto.name != null && dto.name.trim()) {
      staff.name = dto.name.trim();
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
      await this.assertUniquePinInRestaurant(restaurantId, pin, id);
      staff.pinHash = await bcrypt.hash(pin, 10);
    }
    if (dto.email !== undefined) {
      if (dto.email && dto.email.trim()) {
        const nextEmail = dto.email.toLowerCase().trim();
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
    if (dto.permissionsOverride !== undefined) {
      staff.permissionsOverride =
        dto.permissionsOverride !== null
          ? sanitizePermissionKeys(dto.permissionsOverride)
          : null;
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

    const saved = await this.staffRepo.save(staff);
    return this.toPublicDto(saved);
  }

  async delete(restaurantId: string, id: string): Promise<void> {
    const result = await this.staffRepo.delete({ id, restaurantId });
    if (result.affected === 0) throw new NotFoundException('Staff not found');
  }

  async verifyPin(
    restaurantId: string,
    pin: string,
  ): Promise<{
    staffId: string;
    name: string;
    role: string;
    roleLabel: string;
    permissions: PermissionKey[];
    limits: EffectivePolicyLimits;
    staffToken: string;
  }> {
    const trimmed = pin.trim();
    const activeStaff = await this.staffRepo.find({
      where: { restaurantId, isActive: true },
    });
    for (const member of activeStaff) {
      if (member.pinHash && (await bcrypt.compare(trimmed, member.pinHash))) {
        const resolved = await this.rolesService.resolveForStaff(member);
        if (!resolved.canAccessTerminal) {
          throw new UnauthorizedException(
            'Terminal access is disabled for this user',
          );
        }
        const staffToken = this.staffSession.signStaffToken({
          id: member.id,
          restaurantId,
          name: member.name,
          role: resolved.roleKey,
        });
        return {
          staffId: member.id,
          name: member.name,
          role: resolved.roleKey,
          roleLabel: resolved.roleLabel,
          permissions: resolved.permissions,
          limits: resolved.limits,
          staffToken,
        };
      }
    }
    throw new UnauthorizedException('Invalid PIN code');
  }
}
