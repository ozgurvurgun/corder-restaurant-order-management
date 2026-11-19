import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RestaurantRoleEntity } from '../domain/restaurant-role.entity';
import { RestaurantStaffEntity } from '../domain/restaurant-staff.entity';
import { OrdersGateway } from '../api/orders.gateway';
import {
  DEFAULT_ROLE_TEMPLATES,
  EffectivePolicyLimits,
  getDefaultRoleTemplate,
  normalizeRoleKey,
  PERMISSION_CATEGORY_META,
  PERMISSION_DEFINITIONS,
  PermissionKey,
  resolveEffectiveLimits,
  resolveEffectivePermissions,
  sanitizePermissionKeys,
} from '../domain/permissions.catalog';
import { CreateRoleDto } from '../api/dto/create-role.dto';
import { UpdateRoleDto } from '../api/dto/update-role.dto';

export interface RolePolicyActor {
  id?: string;
  sub?: string;
  role?: string;
  isBoss?: boolean;
  permissions?: PermissionKey[];
  limits?: EffectivePolicyLimits;
}

export function assertActorPolicyCeiling(
  actor: RolePolicyActor | undefined,
  targetPermissions: string[],
  targetLimits: {
    maxDiscountPercent?: number | null;
    maxDiscountAmount?: number | null;
  },
): void {
  if (!actor || actor.isBoss || actor.role === 'root' || actor.role === 'boss') {
    return;
  }
  const actorPerms = new Set<PermissionKey>(actor.permissions ?? []);
  for (const perm of sanitizePermissionKeys(targetPermissions)) {
    if (!actorPerms.has(perm)) {
      throw new ForbiddenException(
        `You cannot grant a permission that your own account does not possess (${perm})`,
      );
    }
  }
  const actorMaxPct = Number(actor.limits?.maxDiscountPercent ?? 0);
  if (
    targetLimits.maxDiscountPercent != null &&
    Number(targetLimits.maxDiscountPercent) > actorMaxPct
  ) {
    throw new ForbiddenException(
      `You cannot set a discount percentage limit higher than your own (${actorMaxPct}%)`,
    );
  }
  const actorMaxAmt = actor.limits?.maxDiscountAmount;
  if (actorMaxAmt != null) {
    if (
      targetLimits.maxDiscountAmount == null ||
      Number(targetLimits.maxDiscountAmount) > Number(actorMaxAmt)
    ) {
      throw new ForbiddenException(
        `You cannot set a discount amount limit higher than your own (${actorMaxAmt})`,
      );
    }
  }
}

export function assertActorCanGrantStaffPolicies(
  actor: RolePolicyActor | undefined,
  params: {
    role?: string;
    grantedPermissions?: string[];
    revokedPermissions?: string[];
    maxDiscountPercentOverride?: number | null;
    maxDiscountAmountOverride?: number | null;
  },
  roleEntity?: RestaurantRoleEntity | null,
): void {
  if (!actor || actor.isBoss || actor.role === 'root' || actor.role === 'boss') return;
  const hasTargetRole = Boolean(params.role?.trim() || roleEntity);
  const tpl = hasTargetRole
    ? getDefaultRoleTemplate(roleEntity?.key ?? params.role ?? 'waiter')
    : null;
  const rolePerms = roleEntity ? roleEntity.permissions : (tpl?.permissions ?? []);
  const effectivePerms = resolveEffectivePermissions({
    isBoss: false,
    rolePermissions: rolePerms,
    grantedPermissions: params.grantedPermissions,
    revokedPermissions: params.revokedPermissions,
  });
  const allCheckedPerms = Array.from(
    new Set([...effectivePerms, ...sanitizePermissionKeys(params.grantedPermissions)]),
  );
  const roleMaxPct = roleEntity
    ? roleEntity.maxDiscountPercent
    : (tpl?.maxDiscountPercent ?? 0);
  const roleMaxAmt = roleEntity
    ? roleEntity.maxDiscountAmount != null
      ? Number(roleEntity.maxDiscountAmount)
      : null
    : (tpl?.maxDiscountAmount ?? 0);
  const effectiveLimits = resolveEffectiveLimits({
    isBoss: false,
    roleMaxDiscountPercent: roleMaxPct,
    roleMaxDiscountAmount: roleMaxAmt,
    userMaxDiscountPercentOverride: params.maxDiscountPercentOverride,
    userMaxDiscountAmountOverride: params.maxDiscountAmountOverride,
  });
  assertActorPolicyCeiling(actor, allCheckedPerms, {
    maxDiscountPercent:
      params.maxDiscountPercentOverride != null
        ? Number(params.maxDiscountPercentOverride)
        : hasTargetRole
          ? effectiveLimits.maxDiscountPercent
          : null,
    maxDiscountAmount:
      params.maxDiscountAmountOverride != null
        ? Number(params.maxDiscountAmountOverride)
        : hasTargetRole
          ? effectiveLimits.maxDiscountAmount
          : (actor.limits?.maxDiscountAmount ?? null),
  });
}

export interface RolePublicDto {
  id: string;
  restaurantId: string;
  key: string;
  name: string;
  description: string | null;
  color: string;
  isSystem: boolean;
  canAccessPanel: boolean;
  canAccessTerminal: boolean;
  permissions: PermissionKey[];
  maxDiscountPercent: number;
  maxDiscountAmount: number | null;
  updatedAt: string;
}

export function serializeRole(entity: RestaurantRoleEntity): RolePublicDto {
  return {
    id: entity.id,
    restaurantId: entity.restaurantId,
    key: entity.key,
    name: entity.name,
    description: entity.description,
    color: entity.color || '#e63462',
    isSystem: entity.isSystem,
    canAccessPanel: entity.canAccessPanel,
    canAccessTerminal: entity.canAccessTerminal,
    permissions: sanitizePermissionKeys(entity.permissions),
    maxDiscountPercent: Number(entity.maxDiscountPercent ?? 0),
    maxDiscountAmount:
      entity.maxDiscountAmount != null ? Number(entity.maxDiscountAmount) : null,
    updatedAt: entity.updatedAt ? entity.updatedAt.toISOString() : new Date().toISOString(),
  };
}

function slugifyRoleKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\u011f/g, 'g')
    .replace(/\u00fc/g, 'u')
    .replace(/\u015f/g, 's')
    .replace(/\u0131/g, 'i')
    .replace(/\u00f6/g, 'o')
    .replace(/\u00e7/g, 'c')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(RestaurantRoleEntity)
    private readonly roleRepo: Repository<RestaurantRoleEntity>,
    @InjectRepository(RestaurantStaffEntity)
    private readonly staffRepo: Repository<RestaurantStaffEntity>,
    @Optional()
    @Inject(forwardRef(() => OrdersGateway))
    private readonly ordersGateway?: OrdersGateway,
  ) {}

  getPermissionCatalog() {
    return {
      categories: PERMISSION_CATEGORY_META,
      permissions: PERMISSION_DEFINITIONS,
      defaultRoleTemplates: DEFAULT_ROLE_TEMPLATES,
    };
  }

  async ensureDefaultRoles(restaurantId: string): Promise<RestaurantRoleEntity[]> {
    const existing = await this.roleRepo.find({
      where: { restaurantId },
      order: { createdAt: 'ASC' },
    });
    const byKey = new Map(existing.map((r) => [r.key, r]));
    const toInsert: RestaurantRoleEntity[] = [];

    for (const tpl of DEFAULT_ROLE_TEMPLATES) {
      if (!byKey.has(tpl.key)) {
        toInsert.push(
          this.roleRepo.create({
            restaurantId,
            key: tpl.key,
            name: tpl.name,
            description: tpl.description,
            color: tpl.color,
            isSystem: true,
            canAccessPanel: tpl.canAccessPanel,
            canAccessTerminal: tpl.canAccessTerminal,
            permissions: [...tpl.permissions],
            maxDiscountPercent: tpl.maxDiscountPercent,
            maxDiscountAmount:
              tpl.maxDiscountAmount != null ? String(tpl.maxDiscountAmount) : null,
          }),
        );
      }
    }

    if (toInsert.length > 0) {
      await this.roleRepo
        .createQueryBuilder()
        .insert()
        .into(RestaurantRoleEntity)
        .values(toInsert)
        .orIgnore()
        .execute();
      return this.roleRepo.find({
        where: { restaurantId },
        order: { createdAt: 'ASC' },
      });
    }

    return existing;
  }

  async list(restaurantId: string): Promise<RolePublicDto[]> {
    const roles = await this.ensureDefaultRoles(restaurantId);
    return roles.map(serializeRole);
  }

  async findByKeyOrId(
    restaurantId: string,
    idOrKey: string,
  ): Promise<RestaurantRoleEntity> {
    await this.ensureDefaultRoles(restaurantId);
    const normalized = normalizeRoleKey(idOrKey);
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrKey);
    const role = await this.roleRepo.findOne({
      where: isUuid
        ? [{ id: idOrKey, restaurantId }, { key: normalized, restaurantId }]
        : { key: normalized, restaurantId },
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async create(
    restaurantId: string,
    dto: CreateRoleDto,
    actor?: RolePolicyActor,
  ): Promise<RolePublicDto> {
    const name = (dto.name || '').trim();
    if (!name) throw new BadRequestException('Role name is required');
    const key = slugifyRoleKey(dto.key?.trim() || name);
    if (!key || key === 'boss' || key === 'root' || key === 'terminal') {
      throw new BadRequestException('Reserved or invalid role key');
    }
    const permissions = sanitizePermissionKeys(dto.permissions);
    const maxDiscountPercent = Math.max(0, Math.min(100, Number(dto.maxDiscountPercent ?? 0)));
    const maxDiscountAmountNum =
      dto.maxDiscountAmount != null && Number(dto.maxDiscountAmount) >= 0
        ? Number(dto.maxDiscountAmount)
        : null;
    assertActorPolicyCeiling(actor, permissions, {
      maxDiscountPercent,
      maxDiscountAmount: maxDiscountAmountNum,
    });
    await this.ensureDefaultRoles(restaurantId);
    const existing = await this.roleRepo.findOne({ where: { restaurantId, key } });
    if (existing) {
      throw new ConflictException('A role with this key already exists in this branch');
    }

    const entity = this.roleRepo.create({
      restaurantId,
      key,
      name,
      description: dto.description?.trim() || null,
      color: dto.color?.trim() || '#e63462',
      isSystem: false,
      canAccessPanel: Boolean(dto.canAccessPanel),
      canAccessTerminal: dto.canAccessTerminal ?? true,
      permissions,
      maxDiscountPercent,
      maxDiscountAmount:
        maxDiscountAmountNum != null ? String(maxDiscountAmountNum) : null,
    });
    const saved = await this.roleRepo.save(entity);
    return serializeRole(saved);
  }

  async update(
    restaurantId: string,
    idOrKey: string,
    dto: UpdateRoleDto,
    actor?: RolePolicyActor,
  ): Promise<RolePublicDto> {
    const role = await this.findByKeyOrId(restaurantId, idOrKey);
    if (dto.name != null && dto.name.trim()) {
      role.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      role.description = dto.description?.trim() || null;
    }
    if (dto.color != null && dto.color.trim()) {
      role.color = dto.color.trim();
    }
    if (dto.canAccessPanel !== undefined) {
      role.canAccessPanel = Boolean(dto.canAccessPanel);
    }
    if (dto.canAccessTerminal !== undefined) {
      role.canAccessTerminal = Boolean(dto.canAccessTerminal);
    }
    if (dto.permissions !== undefined) {
      role.permissions = sanitizePermissionKeys(dto.permissions);
    }
    if (dto.maxDiscountPercent !== undefined) {
      role.maxDiscountPercent = Math.max(
        0,
        Math.min(100, Number(dto.maxDiscountPercent) || 0),
      );
    }
    if (dto.maxDiscountAmount !== undefined) {
      role.maxDiscountAmount =
        dto.maxDiscountAmount != null && Number(dto.maxDiscountAmount) >= 0
          ? String(Number(dto.maxDiscountAmount))
          : null;
    }
    assertActorPolicyCeiling(actor, role.permissions, {
      maxDiscountPercent: role.maxDiscountPercent,
      maxDiscountAmount:
        role.maxDiscountAmount != null ? Number(role.maxDiscountAmount) : null,
    });
    const saved = await this.roleRepo.save(role);
    this.ordersGateway?.emitStaffSessionUpdated(restaurantId);
    return serializeRole(saved);
  }

  async resetToDefault(
    restaurantId: string,
    idOrKey: string,
    actor?: RolePolicyActor,
  ): Promise<RolePublicDto> {
    const role = await this.findByKeyOrId(restaurantId, idOrKey);
    const tpl = DEFAULT_ROLE_TEMPLATES.find((t) => t.key === role.key);
    if (!tpl) {
      throw new BadRequestException('Only system role templates can be reset to default');
    }
    assertActorPolicyCeiling(actor, tpl.permissions, {
      maxDiscountPercent: tpl.maxDiscountPercent,
      maxDiscountAmount: tpl.maxDiscountAmount,
    });
    role.name = tpl.name;
    role.description = tpl.description;
    role.color = tpl.color;
    role.canAccessPanel = tpl.canAccessPanel;
    role.canAccessTerminal = tpl.canAccessTerminal;
    role.permissions = [...tpl.permissions];
    role.maxDiscountPercent = tpl.maxDiscountPercent;
    role.maxDiscountAmount =
      tpl.maxDiscountAmount != null ? String(tpl.maxDiscountAmount) : null;
    const saved = await this.roleRepo.save(role);
    this.ordersGateway?.emitStaffSessionUpdated(restaurantId);
    return serializeRole(saved);
  }

  async reset(
    restaurantId: string,
    idOrKey: string,
    actor?: RolePolicyActor,
  ): Promise<RolePublicDto> {
    return this.resetToDefault(restaurantId, idOrKey, actor);
  }

  async delete(restaurantId: string, idOrKey: string): Promise<void> {
    const role = await this.findByKeyOrId(restaurantId, idOrKey);
    if (role.isSystem) {
      throw new BadRequestException('System roles cannot be deleted');
    }
    const assignedCount = await this.staffRepo.count({
      where: { restaurantId, role: role.key },
    });
    if (assignedCount > 0) {
      throw new ConflictException(
        'Cannot delete role while staff members are assigned to it',
      );
    }
    await this.roleRepo.remove(role);
    this.ordersGateway?.emitStaffSessionUpdated(restaurantId);
  }

  async remove(restaurantId: string, idOrKey: string): Promise<void> {
    return this.delete(restaurantId, idOrKey);
  }

  async resolveForStaff(
    staff: RestaurantStaffEntity,
    preloadedRoles?: RestaurantRoleEntity[],
  ): Promise<{
    roleKey: string;
    roleLabel: string;
    roleColor: string;
    canAccessPanel: boolean;
    canAccessTerminal: boolean;
    permissions: PermissionKey[];
    limits: EffectivePolicyLimits;
  }> {
    const roles = preloadedRoles ?? (await this.ensureDefaultRoles(staff.restaurantId));
    const normalizedKey = normalizeRoleKey(staff.role);
    const roleEntity = roles.find((r) => r.key === normalizedKey);
    const fallbackTpl = getDefaultRoleTemplate(normalizedKey);

    const rolePermissions = roleEntity
      ? roleEntity.permissions
      : fallbackTpl.permissions;
    const roleMaxPct = roleEntity
      ? roleEntity.maxDiscountPercent
      : fallbackTpl.maxDiscountPercent;
    const roleMaxAmt = roleEntity
      ? roleEntity.maxDiscountAmount != null
        ? Number(roleEntity.maxDiscountAmount)
        : null
      : fallbackTpl.maxDiscountAmount;

    const permissions = resolveEffectivePermissions({
      isBoss: false,
      rolePermissions,
      grantedPermissions: staff.grantedPermissions,
      revokedPermissions: staff.revokedPermissions,
    });

    const limits = resolveEffectiveLimits({
      isBoss: false,
      roleMaxDiscountPercent: roleMaxPct,
      roleMaxDiscountAmount: roleMaxAmt,
      userMaxDiscountPercentOverride: staff.maxDiscountPercentOverride,
      userMaxDiscountAmountOverride:
        staff.maxDiscountAmountOverride != null
          ? Number(staff.maxDiscountAmountOverride)
          : null,
    });

    const canAccessPanel = Boolean(
      staff.canAccessPanel &&
        staff.email &&
        staff.passwordHash &&
        (roleEntity?.canAccessPanel ?? fallbackTpl.canAccessPanel),
    );
    const canAccessTerminal =
      staff.canAccessTerminal !== undefined
        ? Boolean(staff.canAccessTerminal)
        : Boolean(roleEntity?.canAccessTerminal ?? fallbackTpl.canAccessTerminal);

    return {
      roleKey: normalizedKey,
      roleLabel: roleEntity?.name ?? fallbackTpl.name,
      roleColor: roleEntity?.color ?? fallbackTpl.color,
      canAccessPanel,
      canAccessTerminal,
      permissions,
      limits,
    };
  }
}

