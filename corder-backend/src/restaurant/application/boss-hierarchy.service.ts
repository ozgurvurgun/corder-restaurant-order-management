import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { BossTier, RootAdminEntity } from '../../platform/domain/root-admin.entity';
import { BossRestaurantEntity } from '../../platform/domain/boss-restaurant.entity';
import { RestaurantRoleEntity } from '../domain/restaurant-role.entity';
import { normalizeStorageText } from '../../common/text/text-normalizer';
import { RestaurantAuthService } from './restaurant-auth.service';
import { RolesService } from './roles.service';

export interface CreateOrAssignSubBossInput {
  name: string;
  email: string;
  phone?: string;
  password?: string;
  bossTier?: 'franchise_owner' | 'regional_manager';
  restaurantIds: string[];
}

@Injectable()
export class BossHierarchyService {
  constructor(
    @InjectRepository(RootAdminEntity)
    private readonly rootAdminRepo: Repository<RootAdminEntity>,
    @InjectRepository(BossRestaurantEntity)
    private readonly bossRestaurantRepo: Repository<BossRestaurantEntity>,
    @InjectRepository(RestaurantRoleEntity)
    private readonly roleRepo: Repository<RestaurantRoleEntity>,
    private readonly authService: RestaurantAuthService,
    private readonly rolesService: RolesService,
  ) {}

  async loadBossOwnedBranches(bossId: string): Promise<RestaurantEntity[]> {
    const admin = await this.rootAdminRepo.findOne({ where: { id: bossId } });
    if (!admin || admin.isActive === false) {
      throw new ForbiddenException('Boss account not found or inactive');
    }
    return this.authService.getBossOwnedRestaurants(
      bossId,
      admin.restaurantId,
      admin,
    );
  }

  async listBranchBosses(bossId: string) {
    const ownedBranches = await this.loadBossOwnedBranches(bossId);
    if (ownedBranches.length === 0) return [];
    const branchIds = ownedBranches.map((b) => b.id);
    const branchMap = new Map(ownedBranches.map((b) => [b.id, b]));
    const links = await this.bossRestaurantRepo.find({
      where: { restaurantId: In(branchIds) },
      order: { createdAt: 'ASC' },
    });
    const bossIds = Array.from(new Set(links.map((l) => l.bossId)));
    if (bossIds.length === 0) return [];
    const bosses = await this.rootAdminRepo.find({
      where: { id: In(bossIds) },
      order: { createdAt: 'ASC' },
    });

    return bosses.map((b) => ({
      id: b.id,
      name: b.name,
      email: b.email,
      phone: b.phone ?? null,
      bossTier: b.bossTier || 'franchise_owner',
      brandName: b.brandName ?? null,
      isSelf: b.id === bossId,
      branches: links
        .filter((l) => l.bossId === b.id)
        .map((l) => {
          const br = branchMap.get(l.restaurantId);
          return br
            ? {
                id: br.id,
                name: br.name,
                slug: br.slug,
                branchType: br.branchType || 'independent',
                title: l.title,
              }
            : null;
        })
        .filter(Boolean),
    }));
  }

  private async upsertSubordinateBossAccount(
    actorBossId: string,
    ownedIds: Set<string>,
    primaryBranchId: string,
    dto: CreateOrAssignSubBossInput,
  ): Promise<RootAdminEntity> {
    const email = dto.email.toLowerCase().trim();
    const tier: BossTier = dto.bossTier ?? 'franchise_owner';
    const existing = await this.rootAdminRepo.findOne({ where: { email } });

    if (existing) {
      if (existing.id === actorBossId) {
        throw new ConflictException(
          'You cannot assign your own account as a subordinate branch manager',
        );
      }
      if (existing.bossTier === 'brand_owner') {
        throw new ForbiddenException(
          'Brand Owner (HQ) account cannot be modified or reassigned',
        );
      }
      if (existing.restaurantId && !ownedIds.has(existing.restaurantId)) {
        throw new ConflictException(
          'An account with this email already exists in another organization',
        );
      }
      const existingSubLinks = await this.bossRestaurantRepo.find({
        where: { bossId: existing.id },
      });
      if (existingSubLinks.some((l) => !ownedIds.has(l.restaurantId))) {
        throw new ConflictException(
          'This boss account is linked to branches outside your authority',
        );
      }
      if (dto.name?.trim()) existing.name = normalizeStorageText(dto.name);
      if (dto.phone !== undefined) existing.phone = dto.phone?.trim() || null;
      if (dto.password && dto.password.length >= 8) {
        existing.passwordHash = await bcrypt.hash(dto.password, 10);
      }
      return this.rootAdminRepo.save(existing);
    }

    if (!dto.password || dto.password.length < 8) {
      throw new BadRequestException(
        'A password of at least 8 characters is required for a new Branch / Franchise Boss account',
      );
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.rootAdminRepo.save(
      this.rootAdminRepo.create({
        restaurantId: primaryBranchId,
        email,
        name: normalizeStorageText(dto.name),
        phone: dto.phone?.trim() || null,
        bossTier: tier,
        isActive: true,
        passwordHash,
      }),
    );
  }

  async createOrAssignBranchBoss(
    actorBossId: string,
    dto: CreateOrAssignSubBossInput,
  ) {
    const ownedBranches = await this.loadBossOwnedBranches(actorBossId);
    const ownedIds = new Set(ownedBranches.map((b) => b.id));
    const targetIds = Array.from(
      new Set((dto.restaurantIds ?? []).filter((id) => ownedIds.has(id))),
    );
    if (targetIds.length === 0) {
      throw new BadRequestException('Please select at least one authorized branch');
    }

    const tier: BossTier = dto.bossTier ?? 'franchise_owner';
    const title =
      tier === 'regional_manager' ? 'Regional Manager' : 'Franchise / Branch Owner';
    const subBoss = await this.upsertSubordinateBossAccount(
      actorBossId,
      ownedIds,
      targetIds[0],
      dto,
    );

    for (const rId of targetIds) {
      const existing = await this.bossRestaurantRepo.findOne({
        where: { bossId: subBoss.id, restaurantId: rId },
      });
      if (!existing) {
        await this.bossRestaurantRepo.save(
          this.bossRestaurantRepo.create({
            bossId: subBoss.id,
            restaurantId: rId,
            title,
          }),
        );
      }
    }

    return this.listBranchBosses(actorBossId);
  }

  async unlinkBranchBoss(
    actorBossId: string,
    targetBossId: string,
    branchId: string,
  ) {
    if (actorBossId === targetBossId) {
      throw new BadRequestException('You cannot unlink your own account from a branch');
    }
    const ownedBranches = await this.loadBossOwnedBranches(actorBossId);
    if (!ownedBranches.some((b) => b.id === branchId)) {
      throw new ForbiddenException('You do not have authority over this branch');
    }
    const target = await this.rootAdminRepo.findOne({ where: { id: targetBossId } });
    if (!target) throw new NotFoundException('Boss account not found');
    if (target.bossTier === 'brand_owner') {
      throw new ForbiddenException('Brand Owner (HQ) cannot be unlinked from a branch');
    }
    await this.bossRestaurantRepo.delete({
      bossId: targetBossId,
      restaurantId: branchId,
    });
    return this.listBranchBosses(actorBossId);
  }

  async syncRolesAcrossBranches(
    bossId: string,
    sourceRestaurantId: string,
    targetRestaurantIds?: string[],
  ): Promise<{ syncedBranches: number; syncedRoles: number }> {
    const ownedBranches = await this.loadBossOwnedBranches(bossId);
    const ownedIds = new Set(ownedBranches.map((b) => b.id));
    if (!ownedIds.has(sourceRestaurantId)) {
      throw new ForbiddenException('Source branch does not belong to this Boss');
    }

    const sourceRoles = await this.rolesService.ensureDefaultRoles(sourceRestaurantId);
    const targets =
      targetRestaurantIds && targetRestaurantIds.length > 0
        ? targetRestaurantIds.filter((id) => ownedIds.has(id) && id !== sourceRestaurantId)
        : ownedBranches.map((b) => b.id).filter((id) => id !== sourceRestaurantId);

    let syncedRoles = 0;
    for (const targetRestId of targets) {
      syncedRoles += await this.syncBranchRoles(targetRestId, sourceRoles);
    }
    return { syncedBranches: targets.length, syncedRoles };
  }

  private async syncBranchRoles(
    targetRestId: string,
    sourceRoles: RestaurantRoleEntity[],
  ): Promise<number> {
    await this.rolesService.ensureDefaultRoles(targetRestId);
    const targetRoles = await this.roleRepo.find({
      where: { restaurantId: targetRestId },
    });
    const targetByKey = new Map(targetRoles.map((r) => [r.key, r]));

    for (const src of sourceRoles) {
      const existing = targetByKey.get(src.key);
      const rolePayload = {
        name: src.name,
        description: src.description,
        color: src.color,
        canAccessPanel: src.canAccessPanel,
        canAccessTerminal: src.canAccessTerminal,
        permissions: [...src.permissions],
        maxDiscountPercent: src.maxDiscountPercent,
        maxDiscountAmount: src.maxDiscountAmount,
      };
      if (existing) {
        Object.assign(existing, rolePayload);
        await this.roleRepo.save(existing);
      } else {
        await this.roleRepo.save(
          this.roleRepo.create({
            restaurantId: targetRestId,
            key: src.key,
            isSystem: src.isSystem,
            ...rolePayload,
          }),
        );
      }
    }
    return sourceRoles.length;
  }
}

