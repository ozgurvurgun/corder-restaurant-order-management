import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { BossTier, RootAdminEntity } from '../domain/root-admin.entity';
import { BossRestaurantEntity } from '../domain/boss-restaurant.entity';
import { RestaurantEntity } from '../domain/restaurant.entity';
import { CreateRootAdminDto } from '../api/dto/create-root-admin.dto';
import { UpdateRootAdminDto } from '../api/dto/update-root-admin.dto';
import { normalizeStorageText } from '../../common/text/text-normalizer';

export interface BossWithRestaurantsDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  bossTier: BossTier;
  brandName: string | null;
  isActive: boolean;
  restaurantId: string | null;
  restaurants: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    brandName: string | null;
    branchType: string;
    billingStatus: string;
    isAccessSuspended: boolean;
  }>;
  createdAt: Date;
}

function defaultTitleForTier(tier?: BossTier): string {
  if (tier === 'brand_owner') return 'Brand Owner (HQ)';
  if (tier === 'regional_manager') return 'Regional Manager';
  return 'Franchise / Branch Owner';
}

@Injectable()
export class RootAdminService {
  constructor(
    @InjectRepository(RootAdminEntity)
    private readonly rootAdminRepo: Repository<RootAdminEntity>,
    @InjectRepository(BossRestaurantEntity)
    private readonly bossRestaurantRepo: Repository<BossRestaurantEntity>,
    @InjectRepository(RestaurantEntity)
    private readonly restaurantRepo: Repository<RestaurantEntity>,
  ) {}

  async enrichBosses(admins: RootAdminEntity[]): Promise<BossWithRestaurantsDto[]> {
    if (admins.length === 0) return [];
    const bossIds = admins.map((a) => a.id);
    const [allLinks, allRestaurants] = await Promise.all([
      this.bossRestaurantRepo.find({
        where: { bossId: In(bossIds) },
        order: { createdAt: 'ASC' },
      }),
      this.restaurantRepo.find({ order: { createdAt: 'ASC' } }),
    ]);

    const restIdsByBoss = new Map<string, Set<string>>();
    for (const admin of admins) {
      const set = new Set<string>();
      if (admin.restaurantId) {
        set.add(admin.restaurantId);
      }
      // If brand_owner has brandName, automatically include all branches of that brand
      if (admin.bossTier === 'brand_owner' && admin.brandName) {
        const brandNorm = admin.brandName.trim().toLowerCase();
        for (const r of allRestaurants) {
          if (r.brandName && r.brandName.trim().toLowerCase() === brandNorm) {
            set.add(r.id);
          }
        }
      }
      restIdsByBoss.set(admin.id, set);
    }

    for (const link of allLinks) {
      let set = restIdsByBoss.get(link.bossId);
      if (!set) {
        set = new Set<string>();
        restIdsByBoss.set(link.bossId, set);
      }
      set.add(link.restaurantId);
    }

    const restaurantById = new Map(allRestaurants.map((r) => [r.id, r]));

    return admins.map((admin) => {
      const restIds = restIdsByBoss.get(admin.id) ?? new Set<string>();
      const bossRestaurants = Array.from(restIds)
        .map((id) => restaurantById.get(id))
        .filter((r): r is RestaurantEntity => Boolean(r))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone ?? null,
        bossTier: admin.bossTier || 'franchise_owner',
        brandName: admin.brandName ?? null,
        isActive: admin.isActive ?? true,
        restaurantId: admin.restaurantId ?? bossRestaurants[0]?.id ?? null,
        restaurants: bossRestaurants.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          status: r.status,
          brandName: r.brandName ?? null,
          branchType: r.branchType || 'independent',
          billingStatus: r.billingStatus || 'paid',
          isAccessSuspended: Boolean(r.isAccessSuspended),
        })),
        createdAt: admin.createdAt,
      };
    });
  }

  async enrichBoss(admin: RootAdminEntity): Promise<BossWithRestaurantsDto> {
    const [enriched] = await this.enrichBosses([admin]);
    return enriched;
  }

  async findAllBosses(): Promise<BossWithRestaurantsDto[]> {
    const list = await this.rootAdminRepo.find({ order: { createdAt: 'DESC' } });
    return this.enrichBosses(list);
  }

  async findByRestaurantId(restaurantId: string): Promise<BossWithRestaurantsDto[]> {
    const [links, direct, rest] = await Promise.all([
      this.bossRestaurantRepo.find({ where: { restaurantId } }),
      this.rootAdminRepo.find({ where: { restaurantId } }),
      this.restaurantRepo.findOne({ where: { id: restaurantId } }),
    ]);
    const bossIds = new Set<string>([
      ...links.map((l) => l.bossId),
      ...direct.map((d) => d.id),
    ]);
    if (rest?.brandName) {
      const brandOwners = await this.rootAdminRepo.find({
        where: { bossTier: 'brand_owner' },
      });
      const brandNorm = rest.brandName.trim().toLowerCase();
      for (const bo of brandOwners) {
        if (bo.brandName && bo.brandName.trim().toLowerCase() === brandNorm) {
          bossIds.add(bo.id);
        }
      }
    }
    if (bossIds.size === 0) return [];
    const bosses = await this.rootAdminRepo.find({
      where: { id: In(Array.from(bossIds)) },
      order: { createdAt: 'DESC' },
    });
    return this.enrichBosses(bosses);
  }

  async findOne(id: string, contextRestaurantId?: string): Promise<BossWithRestaurantsDto> {
    const a = await this.rootAdminRepo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Boss account not found');
    const enriched = await this.enrichBoss(a);
    if (
      contextRestaurantId &&
      !enriched.restaurants.some((r) => r.id === contextRestaurantId)
    ) {
      throw new NotFoundException('Boss account is not linked to this restaurant');
    }
    return enriched;
  }

  private async assertUniqueTerminalEmail(
    terminalEmail: string | null,
    excludeRestaurantId?: string,
  ): Promise<void> {
    if (!terminalEmail) return;
    const owner = await this.restaurantRepo.findOne({ where: { terminalEmail } });
    if (owner && owner.id !== excludeRestaurantId) {
      throw new ConflictException('Terminal email already in use by another branch');
    }
  }

  async findOneByEmail(email: string): Promise<RootAdminEntity | null> {
    return this.rootAdminRepo.findOne({
      where: { email: email.toLowerCase().trim() },
      relations: ['restaurant'],
    });
  }

  private async ensureBossRestaurantLinks(
    bossId: string,
    restaurantIds: string[],
    bossTier?: BossTier,
  ): Promise<void> {
    const title = defaultTitleForTier(bossTier);
    for (const rId of restaurantIds) {
      const existing = await this.bossRestaurantRepo.findOne({
        where: { bossId, restaurantId: rId },
      });
      if (!existing) {
        await this.bossRestaurantRepo.save(
          this.bossRestaurantRepo.create({
            bossId,
            restaurantId: rId,
            title,
          }),
        );
      } else if (existing.title !== title) {
        existing.title = title;
        await this.bossRestaurantRepo.save(existing);
      }
      const rest = await this.restaurantRepo.findOne({ where: { id: rId } });
      if (rest && (!rest.rootAdminId || bossTier === 'franchise_owner')) {
        await this.restaurantRepo.update(rId, { rootAdminId: bossId });
      }
    }
  }

  private async resolveBrandRestaurantIds(brandName?: string | null): Promise<string[]> {
    if (!brandName || !brandName.trim()) return [];
    const norm = brandName.trim().toLowerCase();
    const all = await this.restaurantRepo.find();
    return all
      .filter((r) => r.brandName && r.brandName.trim().toLowerCase() === norm)
      .map((r) => r.id);
  }

  async create(dto: CreateRootAdminDto): Promise<BossWithRestaurantsDto> {
    const bossTier: BossTier = dto.bossTier ?? 'franchise_owner';
    const brandName = dto.brandName?.trim() || null;
    const brandBranchIds =
      bossTier === 'brand_owner' && brandName
        ? await this.resolveBrandRestaurantIds(brandName)
        : [];

    const targetRestaurantIds = Array.from(
      new Set([
        ...(dto.restaurantId ? [dto.restaurantId] : []),
        ...(dto.restaurantIds ?? []),
        ...brandBranchIds,
      ]),
    );
    if (targetRestaurantIds.length > 0) {
      const found = await this.restaurantRepo.find({
        where: { id: In(targetRestaurantIds) },
      });
      if (found.length !== targetRestaurantIds.length) {
        throw new NotFoundException('One or more selected restaurants were not found');
      }
    }

    const email = dto.email.toLowerCase().trim();
    const existingGlobal = await this.findOneByEmail(email);

    // If Boss already exists and a restaurantId is being attached, link them to the new branch!
    if (existingGlobal) {
      if (targetRestaurantIds.length > 0) {
        if (dto.bossTier && existingGlobal.bossTier !== 'brand_owner') {
          existingGlobal.bossTier = dto.bossTier;
        }
        if (brandName && !existingGlobal.brandName) {
          existingGlobal.brandName = brandName;
        }
        await this.ensureBossRestaurantLinks(
          existingGlobal.id,
          targetRestaurantIds,
          existingGlobal.bossTier,
        );
        if (!existingGlobal.restaurantId) {
          existingGlobal.restaurantId = targetRestaurantIds[0];
        }
        await this.rootAdminRepo.save(existingGlobal);
        return this.enrichBoss(existingGlobal);
      }
      throw new ConflictException('A Boss account with this email address already exists');
    }

    const primaryRestaurantId = targetRestaurantIds[0] ?? null;
    const normalizedTerminalEmail = dto.terminalEmail?.toLowerCase().trim() || null;
    if (primaryRestaurantId && normalizedTerminalEmail) {
      await this.assertUniqueTerminalEmail(normalizedTerminalEmail, primaryRestaurantId);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const entity = this.rootAdminRepo.create({
      restaurantId: primaryRestaurantId,
      email,
      name: normalizeStorageText(dto.name),
      phone: dto.phone?.trim() || null,
      bossTier,
      brandName,
      isActive: true,
      passwordHash,
    });
    const saved = await this.rootAdminRepo.save(entity);

    if (targetRestaurantIds.length > 0) {
      await this.ensureBossRestaurantLinks(saved.id, targetRestaurantIds, bossTier);
    }

    if (primaryRestaurantId && normalizedTerminalEmail && dto.terminalPassword) {
      const terminalPasswordHash = await bcrypt.hash(dto.terminalPassword, 10);
      await this.restaurantRepo.update(primaryRestaurantId, {
        terminalEmail: normalizedTerminalEmail,
        terminalPasswordHash,
      });
    }
    return this.enrichBoss(saved);
  }

  async linkExistingBossToRestaurant(
    bossId: string,
    restaurantId: string,
  ): Promise<BossWithRestaurantsDto> {
    const boss = await this.rootAdminRepo.findOne({ where: { id: bossId } });
    if (!boss) throw new NotFoundException('Boss account not found');
    const rest = await this.restaurantRepo.findOne({ where: { id: restaurantId } });
    if (!rest) throw new NotFoundException('Restaurant not found');
    await this.ensureBossRestaurantLinks(boss.id, [restaurantId], boss.bossTier);
    if (!boss.restaurantId) {
      boss.restaurantId = restaurantId;
      await this.rootAdminRepo.save(boss);
    }
    return this.enrichBoss(boss);
  }

  async unlinkBossFromRestaurant(
    bossId: string,
    restaurantId: string,
  ): Promise<void> {
    await this.bossRestaurantRepo.delete({ bossId, restaurantId });
    const boss = await this.rootAdminRepo.findOne({ where: { id: bossId } });
    if (boss && boss.restaurantId === restaurantId) {
      const remaining = await this.bossRestaurantRepo.find({
        where: { bossId },
        order: { createdAt: 'ASC' },
      });
      boss.restaurantId = remaining[0]?.restaurantId ?? null;
      await this.rootAdminRepo.save(boss);
    }
    const rest = await this.restaurantRepo.findOne({ where: { id: restaurantId } });
    if (rest && rest.rootAdminId === bossId) {
      const remainingOnBranch = await this.bossRestaurantRepo.find({
        where: { restaurantId },
        order: { createdAt: 'ASC' },
      });
      await this.restaurantRepo.update(restaurantId, {
        rootAdminId: remainingOnBranch[0]?.bossId ?? null,
      });
    }
  }

  async update(
    id: string,
    dto: UpdateRootAdminDto,
    contextRestaurantId?: string,
  ): Promise<BossWithRestaurantsDto> {
    const entity = await this.rootAdminRepo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Boss account not found');
    if (contextRestaurantId) {
      const enrichedBefore = await this.enrichBoss(entity);
      const belongsToContext =
        enrichedBefore.restaurants.some((r) => r.id === contextRestaurantId) ||
        Boolean(dto.restaurantIds?.includes(contextRestaurantId));
      if (!belongsToContext) {
        throw new NotFoundException('Boss account is not linked to this restaurant');
      }
    }

    if (dto.name !== undefined) entity.name = normalizeStorageText(dto.name);
    if (dto.phone !== undefined) entity.phone = dto.phone?.trim() || null;
    if (dto.isActive !== undefined) entity.isActive = Boolean(dto.isActive);
    if (dto.bossTier !== undefined) entity.bossTier = dto.bossTier;
    if (dto.brandName !== undefined) entity.brandName = dto.brandName?.trim() || null;
    if (dto.email !== undefined) {
      const email = dto.email.toLowerCase().trim();
      const existing = await this.findOneByEmail(email);
      if (existing && existing.id !== id) {
        throw new ConflictException('This email address is already in use by another Boss account');
      }
      entity.email = email;
    }
    if (dto.password !== undefined && dto.password.length > 0) {
      entity.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    if (dto.restaurantIds !== undefined || dto.brandName !== undefined || dto.bossTier !== undefined) {
      const brandBranchIds =
        entity.bossTier === 'brand_owner' && entity.brandName
          ? await this.resolveBrandRestaurantIds(entity.brandName)
          : [];
      if (dto.restaurantIds !== undefined) {
        const nextIds = Array.from(new Set([...dto.restaurantIds, ...brandBranchIds]));
        await this.bossRestaurantRepo.delete({ bossId: id });
        if (nextIds.length > 0) {
          await this.ensureBossRestaurantLinks(id, nextIds, entity.bossTier);
        }
        entity.restaurantId = nextIds[0] ?? null;
      } else if (brandBranchIds.length > 0) {
        await this.ensureBossRestaurantLinks(id, brandBranchIds, entity.bossTier);
        if (!entity.restaurantId) {
          entity.restaurantId = brandBranchIds[0] ?? null;
        }
      }
    }

    const saved = await this.rootAdminRepo.save(entity);

    const terminalTargetRestaurantId = contextRestaurantId ?? saved.restaurantId;
    if (
      terminalTargetRestaurantId &&
      (dto.terminalEmail !== undefined ||
        (dto.terminalPassword !== undefined && dto.terminalPassword.length > 0))
    ) {
      const update: { terminalEmail?: string | null; terminalPasswordHash?: string } = {};
      if (dto.terminalEmail !== undefined) {
        const nextTerminalEmail = dto.terminalEmail?.toLowerCase().trim() || null;
        await this.assertUniqueTerminalEmail(nextTerminalEmail, terminalTargetRestaurantId);
        update.terminalEmail = nextTerminalEmail;
      }
      if (dto.terminalPassword !== undefined && dto.terminalPassword.length > 0) {
        update.terminalPasswordHash = await bcrypt.hash(dto.terminalPassword, 10);
      }
      if (Object.keys(update).length) {
        await this.restaurantRepo.update(terminalTargetRestaurantId, update);
      }
    }
    return this.enrichBoss(saved);
  }

  async remove(id: string, fromRestaurantId?: string): Promise<void> {
    const entity = await this.rootAdminRepo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Boss account not found');

    if (fromRestaurantId) {
      await this.unlinkBossFromRestaurant(id, fromRestaurantId);
      return;
    }

    const links = await this.bossRestaurantRepo.find({ where: { bossId: id } });
    await this.bossRestaurantRepo.delete({ bossId: id });
    for (const l of links) {
      const remaining = await this.bossRestaurantRepo.find({
        where: { restaurantId: l.restaurantId },
      });
      await this.restaurantRepo.update(l.restaurantId, {
        rootAdminId: remaining[0]?.bossId ?? null,
      });
    }
    if (entity.restaurantId) {
      const remaining = await this.bossRestaurantRepo.find({
        where: { restaurantId: entity.restaurantId },
      });
      await this.restaurantRepo.update(entity.restaurantId, {
        rootAdminId: remaining[0]?.bossId ?? null,
      });
    }
    await this.rootAdminRepo.remove(entity);
  }
}
