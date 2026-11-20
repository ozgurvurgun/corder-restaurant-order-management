import { ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { BossTier, RootAdminEntity } from '../domain/root-admin.entity';
import { BossRestaurantEntity } from '../domain/boss-restaurant.entity';
import { RestaurantEntity } from '../domain/restaurant.entity';
import { CreateRootAdminDto } from '../api/dto/create-root-admin.dto';
import { UpdateRootAdminDto } from '../api/dto/update-root-admin.dto';
import { normalizeStorageText } from '../../common/text/text-normalizer';
import { formatCanonicalCorderEmail } from '../../common/text/corder-email.policy';
import { ActorNameSyncService } from '../../common/text/actor-name-sync.service';
import { OrdersGateway } from '../../restaurant/api/orders.gateway';

export interface BossWithRestaurantsDto {
  id: string; name: string; email: string; phone: string | null;
  bossTier: BossTier; brandName: string | null; isActive: boolean;
  restaurantId: string | null;
  restaurants: Array<{
    id: string; name: string; slug: string; status: string;
    brandName: string | null; branchType: string; billingStatus: string;
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
    private readonly actorNameSync: ActorNameSyncService,
    private readonly ordersGateway: OrdersGateway,
    @Optional()
    private readonly dataSource?: DataSource,
  ) {}

  private async runInTransaction<T>(fn: (em?: EntityManager) => Promise<T>): Promise<T> {
    if (this.dataSource && typeof this.dataSource.transaction === 'function') {
      return this.dataSource.transaction((em) => fn(em));
    }
    if (typeof this.rootAdminRepo.manager?.transaction === 'function') {
      return this.rootAdminRepo.manager.transaction((em) => fn(em));
    }
    return fn(undefined);
  }

  private getRepos(em?: EntityManager) {
    const getRepo = <E extends object>(target: new () => E, fallback: Repository<E>): Repository<E> =>
      em && typeof em.getRepository === 'function' ? em.getRepository(target) : fallback;
    return {
      rootAdminRepo: getRepo(RootAdminEntity, this.rootAdminRepo),
      bossRestaurantRepo: getRepo(BossRestaurantEntity, this.bossRestaurantRepo),
      restaurantRepo: getRepo(RestaurantEntity, this.restaurantRepo),
    };
  }

  async enrichBosses(admins: RootAdminEntity[], em?: EntityManager): Promise<BossWithRestaurantsDto[]> {
    if (admins.length === 0) return [];
    const { bossRestaurantRepo, restaurantRepo } = this.getRepos(em);
    const bossIds = admins.map((a) => a.id);
    const allLinks = await bossRestaurantRepo.find({
      where: { bossId: In(bossIds) },
      order: { createdAt: 'ASC' },
    });

    const directIds = new Set<string>();
    const brandNorms = new Set<string>();
    for (const admin of admins) {
      if (admin.restaurantId) directIds.add(admin.restaurantId);
      if (admin.bossTier === 'brand_owner' && admin.brandName?.trim()) {
        brandNorms.add(admin.brandName.trim().toLowerCase());
      }
    }
    for (const link of allLinks) directIds.add(link.restaurantId);

    let candidateRestaurants: RestaurantEntity[] = [];
    if (brandNorms.size > 0) {
      if (typeof restaurantRepo.createQueryBuilder === 'function') {
        const qb = restaurantRepo.createQueryBuilder('r');
        const idArr = Array.from(directIds);
        const brandArr = Array.from(brandNorms);
        if (idArr.length > 0) {
          qb.where('r.id IN (:...idArr) OR LOWER(TRIM(r.brand_name)) IN (:...brandArr)', { idArr, brandArr });
        } else {
          qb.where('LOWER(TRIM(r.brand_name)) IN (:...brandArr)', { brandArr });
        }
        candidateRestaurants = await qb.orderBy('r.createdAt', 'ASC').getMany();
      } else {
        candidateRestaurants = await restaurantRepo.find({ order: { createdAt: 'ASC' } });
      }
    } else if (directIds.size > 0) {
      candidateRestaurants = await restaurantRepo.find({
        where: { id: In(Array.from(directIds)) },
        order: { createdAt: 'ASC' },
      });
    }

    const restIdsByBoss = new Map<string, Set<string>>();
    for (const admin of admins) {
      const set = new Set<string>();
      if (admin.restaurantId) set.add(admin.restaurantId);
      if (admin.bossTier === 'brand_owner' && admin.brandName) {
        const brandNorm = admin.brandName.trim().toLowerCase();
        for (const r of candidateRestaurants) {
          if (r.brandName && r.brandName.trim().toLowerCase() === brandNorm) set.add(r.id);
        }
      }
      restIdsByBoss.set(admin.id, set);
    }
    for (const link of allLinks) {
      const set = restIdsByBoss.get(link.bossId) ?? new Set<string>();
      set.add(link.restaurantId);
      restIdsByBoss.set(link.bossId, set);
    }

    const restaurantById = new Map(candidateRestaurants.map((r) => [r.id, r]));
    return admins.map((admin) => {
      const restIds = restIdsByBoss.get(admin.id) ?? new Set<string>();
      const bossRestaurants = Array.from(restIds)
        .map((id) => restaurantById.get(id))
        .filter((r): r is RestaurantEntity => Boolean(r))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return {
        id: admin.id, name: admin.name, email: admin.email, phone: admin.phone ?? null,
        bossTier: admin.bossTier || 'franchise_owner', brandName: admin.brandName ?? null,
        isActive: admin.isActive ?? true,
        restaurantId: admin.restaurantId ?? bossRestaurants[0]?.id ?? null,
        restaurants: bossRestaurants.map((r) => ({
          id: r.id, name: r.name, slug: r.slug, status: r.status,
          brandName: r.brandName ?? null, branchType: r.branchType || 'independent',
          billingStatus: r.billingStatus || 'paid',
          isAccessSuspended: Boolean(r.isAccessSuspended),
        })),
        createdAt: admin.createdAt,
      };
    });
  }

  async enrichBoss(admin: RootAdminEntity, em?: EntityManager): Promise<BossWithRestaurantsDto> {
    const [enriched] = await this.enrichBosses([admin], em);
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
    const bossIds = new Set<string>([...links.map((l) => l.bossId), ...direct.map((d) => d.id)]);
    if (rest?.brandName) {
      const brandOwners = await this.rootAdminRepo.find({ where: { bossTier: 'brand_owner' } });
      const brandNorm = rest.brandName.trim().toLowerCase();
      for (const bo of brandOwners) {
        if (bo.brandName && bo.brandName.trim().toLowerCase() === brandNorm) bossIds.add(bo.id);
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
    if (contextRestaurantId && !enriched.restaurants.some((r) => r.id === contextRestaurantId)) {
      throw new NotFoundException('Boss account is not linked to this restaurant');
    }
    return enriched;
  }

  private async assertUniqueTerminalEmail(
    terminalEmail: string | null,
    excludeRestaurantId?: string,
    restRepo: Repository<RestaurantEntity> = this.restaurantRepo,
  ): Promise<void> {
    if (!terminalEmail) return;
    const owner = await restRepo.findOne({ where: { terminalEmail } });
    if (owner && owner.id !== excludeRestaurantId) {
      throw new ConflictException('Terminal email already in use by another branch');
    }
  }

  async findOneByEmail(
    email: string,
    adminRepo: Repository<RootAdminEntity> = this.rootAdminRepo,
  ): Promise<RootAdminEntity | null> {
    return adminRepo.findOne({
      where: { email: email.toLowerCase().trim() },
      relations: ['restaurant'],
    });
  }

  private async ensureBossRestaurantLinks(
    bossId: string,
    restaurantIds: string[],
    bossTier?: BossTier,
    em?: EntityManager,
  ): Promise<void> {
    const uniqueIds = Array.from(new Set(restaurantIds));
    if (uniqueIds.length === 0) return;
    const { bossRestaurantRepo, restaurantRepo } = this.getRepos(em);
    const title = defaultTitleForTier(bossTier);
    const [existingLinks, restaurants] = await Promise.all([
      bossRestaurantRepo.find({ where: { bossId, restaurantId: In(uniqueIds) } }),
      restaurantRepo.find({ where: { id: In(uniqueIds) } }),
    ]);
    const existingByRestId = new Map(existingLinks.map((l) => [l.restaurantId, l]));
    const restById = new Map(restaurants.map((r) => [r.id, r]));
    const toSave: BossRestaurantEntity[] = [];

    for (const rId of uniqueIds) {
      const existing = existingByRestId.get(rId);
      if (!existing) {
        toSave.push(bossRestaurantRepo.create({ bossId, restaurantId: rId, title }));
      } else if (existing.title !== title) {
        existing.title = title;
        toSave.push(existing);
      }
      const rest = restById.get(rId);
      if (rest && (!rest.rootAdminId || bossTier === 'franchise_owner')) {
        await restaurantRepo.update(rId, { rootAdminId: bossId });
      }
    }
    if (toSave.length > 0) await bossRestaurantRepo.save(toSave);
  }

  private async resolveBrandRestaurantIds(
    brandName?: string | null,
    restRepo: Repository<RestaurantEntity> = this.restaurantRepo,
  ): Promise<string[]> {
    if (!brandName || !brandName.trim()) return [];
    const norm = brandName.trim().toLowerCase();
    if (typeof restRepo.createQueryBuilder === 'function') {
      const rows = await restRepo
        .createQueryBuilder('r')
        .select(['r.id'])
        .where('LOWER(TRIM(r.brand_name)) = :norm', { norm })
        .getMany();
      return rows.map((r) => r.id);
    }
    const all = await restRepo.find();
    return all.filter((r) => r.brandName && r.brandName.trim().toLowerCase() === norm).map((r) => r.id);
  }

  async create(dto: CreateRootAdminDto): Promise<BossWithRestaurantsDto> {
    return this.runInTransaction(async (em) => {
      const { rootAdminRepo, restaurantRepo } = this.getRepos(em);
      const bossTier: BossTier = dto.bossTier ?? 'franchise_owner';
      const brandName = dto.brandName?.trim() ? normalizeStorageText(dto.brandName) : null;
      const brandBranchIds =
        bossTier === 'brand_owner' && brandName
          ? await this.resolveBrandRestaurantIds(brandName, restaurantRepo)
          : [];

      const targetRestaurantIds = Array.from(
        new Set([
          ...(dto.restaurantId ? [dto.restaurantId] : []),
          ...(dto.restaurantIds ?? []),
          ...brandBranchIds,
        ]),
      );
      let primaryBranchSlug: string | null = null;
      if (targetRestaurantIds.length > 0) {
        const found = await restaurantRepo.find({ where: { id: In(targetRestaurantIds) } });
        if (found.length !== targetRestaurantIds.length) {
          throw new NotFoundException('One or more selected restaurants were not found');
        }
        const primaryBranch = found.find((r) => r.id === targetRestaurantIds[0]) ?? found[0];
        primaryBranchSlug = primaryBranch?.slug ?? null;
      }

      const tenantContext = bossTier === 'brand_owner' && brandName ? brandName : primaryBranchSlug;
      const email = formatCanonicalCorderEmail(dto.email, tenantContext) ?? dto.email.toLowerCase().trim();
      const existingGlobal = await this.findOneByEmail(email, rootAdminRepo);
      if (existingGlobal) {
        throw new ConflictException('A Boss account with this email address already exists');
      }

      const primaryRestaurantId = targetRestaurantIds[0] ?? null;
      const normalizedTerminalEmail = dto.terminalEmail
        ? formatCanonicalCorderEmail(dto.terminalEmail, primaryBranchSlug)
        : null;
      if (primaryRestaurantId && normalizedTerminalEmail) {
        await this.assertUniqueTerminalEmail(normalizedTerminalEmail, primaryRestaurantId, restaurantRepo);
      }

      const passwordHash = await bcrypt.hash(dto.password, 10);
      const saved = await rootAdminRepo.save(
        rootAdminRepo.create({
          restaurantId: primaryRestaurantId, email,
          name: normalizeStorageText(dto.name), phone: dto.phone?.trim() || null,
          bossTier, brandName, isActive: true, passwordHash,
        }),
      );

      if (targetRestaurantIds.length > 0) {
        await this.ensureBossRestaurantLinks(saved.id, targetRestaurantIds, bossTier, em);
      }
      if (primaryRestaurantId && normalizedTerminalEmail && dto.terminalPassword) {
        const terminalPasswordHash = await bcrypt.hash(dto.terminalPassword, 10);
        await restaurantRepo.update(primaryRestaurantId, {
          terminalEmail: normalizedTerminalEmail,
          terminalPasswordHash,
        });
      }
      return this.enrichBoss(saved, em);
    });
  }

  async linkExistingBossToRestaurant(bossId: string, restaurantId: string): Promise<BossWithRestaurantsDto> {
    return this.runInTransaction(async (em) => {
      const { rootAdminRepo, restaurantRepo } = this.getRepos(em);
      const boss = await rootAdminRepo.findOne({ where: { id: bossId } });
      if (!boss) throw new NotFoundException('Boss account not found');
      const rest = await restaurantRepo.findOne({ where: { id: restaurantId } });
      if (!rest) throw new NotFoundException('Restaurant not found');
      await this.ensureBossRestaurantLinks(boss.id, [restaurantId], boss.bossTier, em);
      if (!boss.restaurantId) {
        boss.restaurantId = restaurantId;
        await rootAdminRepo.save(boss);
      }
      return this.enrichBoss(boss, em);
    });
  }

  async unlinkBossFromRestaurant(bossId: string, restaurantId: string, em?: EntityManager): Promise<void> {
    const { rootAdminRepo, bossRestaurantRepo, restaurantRepo } = this.getRepos(em);
    await bossRestaurantRepo.delete({ bossId, restaurantId });
    const boss = await rootAdminRepo.findOne({ where: { id: bossId } });
    if (boss && boss.restaurantId === restaurantId) {
      const remaining = await bossRestaurantRepo.find({ where: { bossId }, order: { createdAt: 'ASC' } });
      boss.restaurantId = remaining[0]?.restaurantId ?? null;
      await rootAdminRepo.save(boss);
    }
    const rest = await restaurantRepo.findOne({ where: { id: restaurantId } });
    if (rest && rest.rootAdminId === bossId) {
      const remainingOnBranch = await bossRestaurantRepo.find({
        where: { restaurantId },
        order: { createdAt: 'ASC' },
      });
      await restaurantRepo.update(restaurantId, { rootAdminId: remainingOnBranch[0]?.bossId ?? null });
    }
  }

  async update(
    id: string,
    dto: UpdateRootAdminDto,
    contextRestaurantId?: string,
  ): Promise<BossWithRestaurantsDto> {
    const { enriched, previousName, nextName } = await this.runInTransaction(async (em) => {
      const { rootAdminRepo, bossRestaurantRepo, restaurantRepo } = this.getRepos(em);
      const entity = await rootAdminRepo.findOne({ where: { id } });
      if (!entity) throw new NotFoundException('Boss account not found');
      if (contextRestaurantId) {
        const enrichedBefore = await this.enrichBoss(entity, em);
        const belongsToContext =
          enrichedBefore.restaurants.some((r) => r.id === contextRestaurantId) ||
          Boolean(dto.restaurantIds?.includes(contextRestaurantId));
        if (!belongsToContext) {
          throw new NotFoundException('Boss account is not linked to this restaurant');
        }
      }

      const prevName = entity.name;
      if (dto.name !== undefined) entity.name = normalizeStorageText(dto.name);
      if (dto.phone !== undefined) entity.phone = dto.phone?.trim() || null;
      if (dto.isActive !== undefined) entity.isActive = Boolean(dto.isActive);
      if (dto.bossTier !== undefined) entity.bossTier = dto.bossTier;
      if (dto.brandName !== undefined) entity.brandName = dto.brandName?.trim() ? normalizeStorageText(dto.brandName) : null;

      if (dto.restaurantIds !== undefined || dto.brandName !== undefined || dto.bossTier !== undefined) {
        const brandBranchIds =
          entity.bossTier === 'brand_owner' && entity.brandName
            ? await this.resolveBrandRestaurantIds(entity.brandName, restaurantRepo)
            : [];
        if (dto.restaurantIds !== undefined) {
          const nextIds = Array.from(new Set([...dto.restaurantIds, ...brandBranchIds]));
          if (nextIds.length > 0) {
            const foundRestaurants = await restaurantRepo.find({ where: { id: In(nextIds) } });
            if (foundRestaurants.length !== nextIds.length) {
              throw new NotFoundException('One or more selected restaurants were not found');
            }
          }
          await bossRestaurantRepo.delete({ bossId: id });
          if (nextIds.length > 0) {
            await this.ensureBossRestaurantLinks(id, nextIds, entity.bossTier, em);
          }
          entity.restaurantId = nextIds[0] ?? null;
        } else if (brandBranchIds.length > 0) {
          await this.ensureBossRestaurantLinks(id, brandBranchIds, entity.bossTier, em);
          if (!entity.restaurantId) entity.restaurantId = brandBranchIds[0] ?? null;
        }
      }

      if (dto.email !== undefined) {
        const targetRestId = dto.restaurantIds?.[0] ?? contextRestaurantId ?? entity.restaurantId;
        const targetRest = targetRestId ? await restaurantRepo.findOne({ where: { id: targetRestId } }) : null;
        const tenantContext =
          entity.bossTier === 'brand_owner' && entity.brandName ? entity.brandName : (targetRest?.slug ?? null);
        const email = formatCanonicalCorderEmail(dto.email, tenantContext) ?? dto.email.toLowerCase().trim();
        const existing = await this.findOneByEmail(email, rootAdminRepo);
        if (existing && existing.id !== id) {
          throw new ConflictException('This email address is already in use by another Boss account');
        }
        entity.email = email;
      }
      if (dto.password !== undefined && dto.password.length > 0) {
        entity.passwordHash = await bcrypt.hash(dto.password, 10);
      }

      const saved = await rootAdminRepo.save(entity);
      const terminalTargetRestaurantId = contextRestaurantId ?? saved.restaurantId;
      if (
        terminalTargetRestaurantId &&
        (dto.terminalEmail !== undefined || (dto.terminalPassword !== undefined && dto.terminalPassword.length > 0))
      ) {
        const targetTerminalRest = await restaurantRepo.findOne({ where: { id: terminalTargetRestaurantId } });
        const update: { terminalEmail?: string | null; terminalPasswordHash?: string } = {};
        if (dto.terminalEmail !== undefined) {
          const rawTerminalEmail = dto.terminalEmail?.trim() || null;
          const nextTerminalEmail = rawTerminalEmail
            ? formatCanonicalCorderEmail(rawTerminalEmail, targetTerminalRest?.slug)
            : null;
          await this.assertUniqueTerminalEmail(nextTerminalEmail, terminalTargetRestaurantId, restaurantRepo);
          update.terminalEmail = nextTerminalEmail;
        }
        if (dto.terminalPassword !== undefined && dto.terminalPassword.length > 0) {
          update.terminalPasswordHash = await bcrypt.hash(dto.terminalPassword, 10);
        }
        if (Object.keys(update).length) {
          await restaurantRepo.update(terminalTargetRestaurantId, update);
        }
      }
      const enrichedOut = await this.enrichBoss(saved, em);
      return { enriched: enrichedOut, previousName: prevName, nextName: saved.name };
    });

    if (previousName && nextName && previousName !== nextName) {
      const restIds = enriched.restaurants.map((r) => r.id);
      await this.actorNameSync.syncActorNameChange({
        restaurantIds: restIds,
        actorId: enriched.id,
        oldName: previousName,
        newName: nextName,
      });
      for (const rId of restIds) this.ordersGateway.emitOrdersUpdated(rId);
    }
    return enriched;
  }

  async remove(id: string, fromRestaurantId?: string): Promise<void> {
    await this.runInTransaction(async (em) => {
      const { rootAdminRepo, bossRestaurantRepo, restaurantRepo } = this.getRepos(em);
      const entity = await rootAdminRepo.findOne({ where: { id } });
      if (!entity) throw new NotFoundException('Boss account not found');
      if (fromRestaurantId) {
        await this.unlinkBossFromRestaurant(id, fromRestaurantId, em);
        return;
      }
      const links = await bossRestaurantRepo.find({ where: { bossId: id } });
      await bossRestaurantRepo.delete({ bossId: id });
      for (const l of links) {
        const remaining = await bossRestaurantRepo.find({ where: { restaurantId: l.restaurantId } });
        await restaurantRepo.update(l.restaurantId, { rootAdminId: remaining[0]?.bossId ?? null });
      }
      if (entity.restaurantId) {
        const remaining = await bossRestaurantRepo.find({ where: { restaurantId: entity.restaurantId } });
        await restaurantRepo.update(entity.restaurantId, { rootAdminId: remaining[0]?.bossId ?? null });
      }
      await rootAdminRepo.remove(entity);
    });
  }
}
