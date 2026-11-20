import { Injectable, ConflictException, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { RestaurantEntity } from '../domain/restaurant.entity';
import { RootAdminEntity } from '../domain/root-admin.entity';
import { BossRestaurantEntity } from '../domain/boss-restaurant.entity';
import { PlatformBillingConfigEntity } from '../domain/platform-billing-config.entity';
import { RestaurantSubscriptionPaymentEntity } from '../domain/restaurant-subscription-payment.entity';
import {
  buildConsecutivePeriods,
  computeRestaurantBillingSummary,
  dateToIstanbulPeriod,
  isValidBillingPeriod,
  toPaymentRecordDto,
} from '../domain/subscription-billing.policy';
import { CreateRestaurantDto } from '../api/dto/create-restaurant.dto';
import { UpdateRestaurantDto } from '../api/dto/update-restaurant.dto';
import { formatCanonicalCorderEmail, toCorderEmailTenantSlug } from '../../common/text/corder-email.policy';
import { normalizeStorageText } from '../../common/text/text-normalizer';
import { OrdersGateway } from '../../restaurant/api/orders.gateway';
import { buildPaymentSuspendedErrorMessage } from '../../restaurant/domain/services/billing-suspension.policy';

export function getCurrentBillingPeriod(now = new Date()): string {
  return dateToIstanbulPeriod(now);
}

export interface AssignedBossDto {
  id: string;
  name: string;
  email: string;
  bossTier: string;
  title: string;
}

@Injectable()
export class RestaurantService {
  constructor(
    @InjectRepository(RestaurantEntity)
    private readonly repo: Repository<RestaurantEntity>,
    @InjectRepository(RootAdminEntity)
    private readonly rootAdminRepo: Repository<RootAdminEntity>,
    @InjectRepository(BossRestaurantEntity)
    private readonly bossRestaurantRepo: Repository<BossRestaurantEntity>,
    @InjectRepository(RestaurantSubscriptionPaymentEntity)
    private readonly paymentRepo: Repository<RestaurantSubscriptionPaymentEntity>,
    @InjectRepository(PlatformBillingConfigEntity)
    private readonly billingConfigRepo: Repository<PlatformBillingConfigEntity>,
    private readonly ordersGateway: OrdersGateway,
    @Optional()
    private readonly dataSource?: DataSource,
  ) {}

  private async assertUniqueTerminalEmail(
    terminalEmail: string | null,
    excludeRestaurantId?: string,
  ): Promise<void> {
    if (!terminalEmail) return;
    const owner = await this.repo.findOne({ where: { terminalEmail } });
    if (owner && owner.id !== excludeRestaurantId) {
      throw new ConflictException('Terminal email already in use by another branch');
    }
  }

  private async getCollectionEndDay(): Promise<number> {
    const configs = await this.billingConfigRepo.find({
      order: { updatedAt: 'DESC' },
      take: 1,
    });
    return configs[0]?.collectionEndDay ?? 30;
  }

  private resolveAssignedBossesForRestaurant(
    r: RestaurantEntity,
    links: BossRestaurantEntity[],
    allBosses: RootAdminEntity[],
    bossById: Map<string, RootAdminEntity>,
  ): AssignedBossDto[] {
    const assignedMap = new Map<string, AssignedBossDto>();
    const addBoss = (b: RootAdminEntity, customTitle?: string | null) => {
      if (assignedMap.has(b.id)) return;
      const bossTier = b.bossTier || 'franchise_owner';
      assignedMap.set(b.id, {
        id: b.id,
        name: b.name,
        email: b.email,
        bossTier,
        title:
          customTitle ||
          (bossTier === 'brand_owner' ? 'Brand Owner (HQ)' : 'Franchise / Branch Owner'),
      });
    };

    for (const link of links) {
      if (link.restaurantId !== r.id) continue;
      const b = bossById.get(link.bossId);
      if (b) addBoss(b, link.title);
    }
    if (r.rootAdminId) {
      const b = bossById.get(r.rootAdminId);
      if (b) addBoss(b);
    }
    if (r.brandName) {
      const normalizedBrand = r.brandName.trim().toLowerCase();
      for (const b of allBosses) {
        if (b.bossTier === 'brand_owner' && b.brandName?.trim().toLowerCase() === normalizedBrand) {
          addBoss(b, 'Brand Owner (HQ)');
        }
      }
    }
    return Array.from(assignedMap.values());
  }

  async enrichRestaurantsWithBosses(restaurants: RestaurantEntity[]) {
    if (restaurants.length === 0) return [];
    const restIds = restaurants.map((r) => r.id);
    const [links, allPayments, collectionEndDay] = await Promise.all([
      this.bossRestaurantRepo.find({ where: { restaurantId: In(restIds) } }),
      this.paymentRepo.find({
        where: { restaurantId: In(restIds) },
        order: { paidAt: 'DESC', createdAt: 'DESC' },
      }),
      this.getCollectionEndDay(),
    ]);

    const candidateBossIds = Array.from(
      new Set<string>([
        ...links.map((l) => l.bossId),
        ...restaurants.map((r) => r.rootAdminId).filter((id): id is string => Boolean(id)),
      ]),
    );
    const hasAnyBrand = restaurants.some((r) => Boolean(r.brandName?.trim()));
    const bossWhere =
      hasAnyBrand && candidateBossIds.length > 0
        ? [{ id: In(candidateBossIds) }, { bossTier: 'brand_owner' as const }]
        : hasAnyBrand
          ? { bossTier: 'brand_owner' as const }
          : candidateBossIds.length > 0
            ? { id: In(candidateBossIds) }
            : null;
    const allBosses = bossWhere ? await this.rootAdminRepo.find({ where: bossWhere }) : [];
    const bossById = new Map(allBosses.map((b) => [b.id, b]));
    const paymentsByRestId = new Map<string, RestaurantSubscriptionPaymentEntity[]>();
    for (const p of allPayments) {
      const arr = paymentsByRestId.get(p.restaurantId) ?? [];
      arr.push(p);
      paymentsByRestId.set(p.restaurantId, arr);
    }

    const now = new Date();
    return restaurants.map((r) => {
      const restPayments = paymentsByRestId.get(r.id) ?? [];
      const summary = computeRestaurantBillingSummary({
        status: r.status,
        monthlyFee: r.monthlyFee,
        billingStartPeriod: r.billingStartPeriod,
        createdAt: r.createdAt,
        isAccessSuspended: r.isAccessSuspended,
        payments: restPayments,
        collectionEndDay,
        now,
      });
      return {
        ...r,
        monthlyFee: Number(r.monthlyFee || 0),
        royaltyRate: Number(r.royaltyRate || 0),
        ...summary,
        paymentHistory: restPayments.map(toPaymentRecordDto),
        bosses: this.resolveAssignedBossesForRestaurant(r, links, allBosses, bossById),
      };
    });
  }

  async syncPersistedBillingSummary(
    restaurantId: string,
    em?: EntityManager,
  ): Promise<void> {
    const run = async (manager: EntityManager) => {
      const entity = await manager.findOne(RestaurantEntity, {
        where: { id: restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!entity) throw new NotFoundException('Restaurant not found');
      const [payments, configs] = await Promise.all([
        manager.find(RestaurantSubscriptionPaymentEntity, {
          where: { restaurantId },
          order: { paidAt: 'DESC', createdAt: 'DESC' },
        }),
        manager.find(PlatformBillingConfigEntity, { order: { updatedAt: 'DESC' }, take: 1 }),
      ]);
      const summary = computeRestaurantBillingSummary({
        status: entity.status,
        monthlyFee: entity.monthlyFee,
        billingStartPeriod: entity.billingStartPeriod,
        createdAt: entity.createdAt,
        isAccessSuspended: entity.isAccessSuspended,
        payments,
        collectionEndDay: configs[0]?.collectionEndDay ?? 30,
      });
      entity.billingStartPeriod = summary.billingStartPeriod;
      entity.billingStatus = summary.billingStatus;
      entity.lastPaymentDate = summary.lastPaymentDate;
      entity.lastPaidPeriod = summary.lastPaidPeriod;
      await manager.save(RestaurantEntity, entity);
    };
    if (em) {
      await run(em);
      return;
    }
    if (this.dataSource) {
      await this.dataSource.transaction(run);
      return;
    }
    await this.repo.manager.transaction(run);
  }

  async findAll() {
    const list = await this.repo.find({ order: { createdAt: 'DESC' } });
    return this.enrichRestaurantsWithBosses(list);
  }

  async findOne(id: string): Promise<RestaurantEntity> {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Restaurant not found');
    return r;
  }

  async findOneEnriched(id: string) {
    const r = await this.findOne(id);
    const [enriched] = await this.enrichRestaurantsWithBosses([r]);
    return enriched;
  }

  async findBySlug(slug: string): Promise<RestaurantEntity | null> {
    return this.repo.findOne({ where: { slug } });
  }

  private async autoLinkBrandOwners(restaurant: RestaurantEntity): Promise<void> {
    if (!restaurant.brandName) return;
    const brandOwners = await this.rootAdminRepo.find({
      where: { bossTier: 'brand_owner' },
    });
    const normalized = restaurant.brandName.trim().toLowerCase();
    const matchingBosses = brandOwners.filter(
      (b) => b.brandName && b.brandName.trim().toLowerCase() === normalized,
    );
    if (matchingBosses.length === 0) return;
    const existing = await this.bossRestaurantRepo.find({
      where: {
        bossId: In(matchingBosses.map((b) => b.id)),
        restaurantId: restaurant.id,
      },
    });
    const existingBossIds = new Set(existing.map((e) => e.bossId));
    const toCreate = matchingBosses
      .filter((b) => !existingBossIds.has(b.id))
      .map((b) =>
        this.bossRestaurantRepo.create({
          bossId: b.id,
          restaurantId: restaurant.id,
          title: 'Brand Owner (HQ)',
        }),
      );
    if (toCreate.length > 0) {
      await this.bossRestaurantRepo.save(toCreate);
    }
  }

  private async resolveDeviceCredentials(params: {
    tenantSlug: string;
    terminalEmail?: string | null;
    terminalPassword?: string;
    printAgentUsername?: string | null;
    printAgentPassword?: string;
    excludeRestaurantId?: string;
  }) {
    const terminalEmail = formatCanonicalCorderEmail(
      params.terminalEmail,
      params.tenantSlug,
    );
    await this.assertUniqueTerminalEmail(terminalEmail, params.excludeRestaurantId);
    const terminalPasswordHash =
      params.terminalPassword && params.terminalPassword.length > 0
        ? await bcrypt.hash(params.terminalPassword, 10)
        : null;

    const printAgentUsername = formatCanonicalCorderEmail(
      params.printAgentUsername,
      params.tenantSlug,
    );
    if (printAgentUsername) {
      const owner = await this.repo.findOne({ where: { printAgentUsername } });
      if (owner && owner.id !== params.excludeRestaurantId) {
        throw new ConflictException('Print agent email already in use');
      }
    }
    const printAgentPasswordHash =
      params.printAgentPassword && params.printAgentPassword.length > 0
        ? await bcrypt.hash(params.printAgentPassword, 10)
        : null;

    return {
      terminalEmail,
      terminalPasswordHash,
      printAgentUsername,
      printAgentPasswordHash,
    };
  }

  async create(dto: CreateRestaurantDto, recordedBy = 'Platform Admin') {
    const slug = toCorderEmailTenantSlug(dto.slug || dto.name);
    if (!slug) throw new ConflictException('Invalid restaurant slug');
    const existing = await this.repo.findOne({ where: { slug } });
    if (existing) throw new ConflictException('Slug already in use');

    const {
      terminalEmail: rawTerminalEmail, terminalPassword: rawTerminalPassword,
      printAgentUsername: rawUsername, printAgentPassword: rawPassword,
      monthlyFee, royaltyRate, brandName, branchType, franchiseeCompanyName,
      billingStartPeriod: rawStartPeriod, recordInitialPayment, initialPaidMonths,
      initialPaymentMethod, isAccessSuspended, billingNotes, email: rawEmail,
      receiptFooterEnabled, receiptFooterTitle, receiptFooterUrl, ...restDto
    } = dto;

    const creds = await this.resolveDeviceCredentials({
      tenantSlug: slug, terminalEmail: rawTerminalEmail, terminalPassword: rawTerminalPassword,
      printAgentUsername: rawUsername, printAgentPassword: rawPassword,
    });

    const now = new Date();
    const billingStartPeriod = isValidBillingPeriod(rawStartPeriod)
      ? rawStartPeriod.trim()
      : dateToIstanbulPeriod(now);
    const effectiveSuspended = Boolean(isAccessSuspended);
    const feeValue = monthlyFee != null ? Math.max(0, Number(monthlyFee) || 0) : 0;

    const saved = await this.repo.save(
      this.repo.create({
        ...restDto,
        name: normalizeStorageText(restDto.name),
        slug,
        email: rawEmail?.trim().toLowerCase() || undefined,
        brandName: brandName?.trim() ? normalizeStorageText(brandName) : null,
        branchType: branchType ?? 'independent',
        franchiseeCompanyName: franchiseeCompanyName?.trim() ? normalizeStorageText(franchiseeCompanyName) : null,
        royaltyRate: royaltyRate != null ? String(Number(royaltyRate)) : '0',
        monthlyFee: String(feeValue),
        billingStartPeriod,
        billingStatus: effectiveSuspended ? 'suspended' : 'pending',
        isAccessSuspended: effectiveSuspended,
        suspensionReason: effectiveSuspended ? 'payment_overdue' : null,
        suspendedAt: effectiveSuspended ? now : null,
        lastPaymentDate: null,
        lastPaidPeriod: null,
        billingNotes: billingNotes?.trim() || null,
        receiptFooterEnabled: receiptFooterEnabled !== false,
        receiptFooterTitle:
          receiptFooterTitle !== undefined ? (receiptFooterTitle?.trim().slice(0, 120) ?? 'Compart Software') : 'Compart Software',
        receiptFooterUrl:
          receiptFooterUrl !== undefined ? (receiptFooterUrl?.trim().slice(0, 160) ?? 'compartsoftware.com') : 'compartsoftware.com',
        ...creds,
      }),
    );

    if (recordInitialPayment && feeValue >= 0) {
      const months = Math.max(1, Math.min(36, initialPaidMonths ?? 1));
      const coveredPeriods = buildConsecutivePeriods(billingStartPeriod, months);
      await this.paymentRepo.save(
        this.paymentRepo.create({
          restaurantId: saved.id, paidAt: now, amount: String(Number((feeValue * months).toFixed(2))),
          periods: coveredPeriods, periodStart: coveredPeriods[0],
          periodEnd: coveredPeriods[coveredPeriods.length - 1], monthsCount: coveredPeriods.length,
          paymentMethod: initialPaymentMethod ?? 'bank_transfer',
          note: billingNotes?.trim() || 'Başlangıç abonelik tahsilatı', recordedBy,
        }),
      );
    }

    await this.syncPersistedBillingSummary(saved.id);
    await this.autoLinkBrandOwners(saved);
    return this.findOneEnriched(saved.id);
  }

  private applyMutableScalarFields(entity: RestaurantEntity, dto: UpdateRestaurantDto): void {
    if (dto.name !== undefined) entity.name = normalizeStorageText(dto.name);
    if (dto.address !== undefined) entity.address = dto.address;
    if (dto.phone !== undefined) entity.phone = dto.phone;
    if (dto.email !== undefined) {
      entity.email = dto.email?.trim().toLowerCase() || (null as unknown as string);
    }
    if (dto.status !== undefined) entity.status = dto.status;
    if (dto.brandName !== undefined) entity.brandName = dto.brandName?.trim() ? normalizeStorageText(dto.brandName) : null;
    if (dto.branchType !== undefined) entity.branchType = dto.branchType;
    if (dto.franchiseeCompanyName !== undefined) {
      entity.franchiseeCompanyName = dto.franchiseeCompanyName?.trim() ? normalizeStorageText(dto.franchiseeCompanyName) : null;
    }
    if (dto.royaltyRate !== undefined) {
      entity.royaltyRate = String(Math.max(0, Math.min(100, Number(dto.royaltyRate) || 0)));
    }
    if (dto.monthlyFee !== undefined) {
      entity.monthlyFee = String(Math.max(0, Number(dto.monthlyFee) || 0));
    }
    if (dto.billingStartPeriod !== undefined && isValidBillingPeriod(dto.billingStartPeriod)) {
      entity.billingStartPeriod = dto.billingStartPeriod.trim();
    }
    if (dto.billingNotes !== undefined) {
      entity.billingNotes = dto.billingNotes?.trim() || null;
    }
    if (dto.taxId !== undefined) entity.taxId = dto.taxId ?? null;
    if (dto.whatsapp !== undefined) entity.whatsapp = dto.whatsapp ?? null;
    if (dto.instagram !== undefined) entity.instagram = dto.instagram ?? null;
    if (dto.facebook !== undefined) entity.facebook = dto.facebook ?? null;
    if (dto.website !== undefined) entity.website = dto.website ?? null;
    if (dto.workingHours !== undefined) entity.workingHours = dto.workingHours ?? null;
    if (dto.receiptFooterEnabled !== undefined) {
      entity.receiptFooterEnabled = Boolean(dto.receiptFooterEnabled);
    }
    if (dto.receiptFooterTitle !== undefined) {
      entity.receiptFooterTitle = (dto.receiptFooterTitle ?? '').trim().slice(0, 120);
    }
    if (dto.receiptFooterUrl !== undefined) {
      entity.receiptFooterUrl = (dto.receiptFooterUrl ?? '').trim().slice(0, 160);
    }
  }

  async update(id: string, dto: UpdateRestaurantDto) {
    const entity = await this.findOne(id);
    if (dto.slug !== undefined) {
      const slug = toCorderEmailTenantSlug(dto.slug);
      if (slug && slug !== entity.slug) {
        const existing = await this.repo.findOne({ where: { slug } });
        if (existing) throw new ConflictException('Slug already in use');
        entity.slug = slug;
        if (entity.terminalEmail && dto.terminalEmail === undefined) {
          entity.terminalEmail = formatCanonicalCorderEmail(entity.terminalEmail, slug);
        }
      }
    }

    this.applyMutableScalarFields(entity, dto);

    if (dto.isAccessSuspended !== undefined) {
      entity.isAccessSuspended = dto.isAccessSuspended;
      entity.billingStatus = dto.isAccessSuspended ? 'suspended' : entity.billingStatus;
      entity.suspensionReason = dto.isAccessSuspended ? 'payment_overdue' : null;
      entity.suspendedAt = dto.isAccessSuspended ? (entity.suspendedAt ?? new Date()) : null;
    }

    if (dto.terminalEmail !== undefined || dto.printAgentUsername !== undefined) {
      const creds = await this.resolveDeviceCredentials({
        tenantSlug: entity.slug,
        terminalEmail: dto.terminalEmail !== undefined ? dto.terminalEmail : entity.terminalEmail,
        terminalPassword: dto.terminalPassword,
        printAgentUsername: dto.printAgentUsername !== undefined ? dto.printAgentUsername : entity.printAgentUsername,
        printAgentPassword: dto.printAgentPassword,
        excludeRestaurantId: entity.id,
      });
      if (dto.terminalEmail !== undefined) entity.terminalEmail = creds.terminalEmail;
      if (creds.terminalPasswordHash) entity.terminalPasswordHash = creds.terminalPasswordHash;
      if (dto.printAgentUsername !== undefined) entity.printAgentUsername = creds.printAgentUsername;
      if (creds.printAgentPasswordHash) entity.printAgentPasswordHash = creds.printAgentPasswordHash;
    } else {
      if (dto.terminalPassword?.length) entity.terminalPasswordHash = await bcrypt.hash(dto.terminalPassword, 10);
      if (dto.printAgentPassword?.length) entity.printAgentPasswordHash = await bcrypt.hash(dto.printAgentPassword, 10);
    }

    const saved = await this.repo.save(entity);
    await this.syncPersistedBillingSummary(saved.id);
    await this.autoLinkBrandOwners(saved);
    if (
      dto.receiptFooterEnabled !== undefined ||
      dto.receiptFooterTitle !== undefined ||
      dto.receiptFooterUrl !== undefined ||
      dto.name !== undefined
    ) {
      this.ordersGateway.emitPrintersUpdated(saved.id);
    }
    if (saved.isAccessSuspended || saved.status !== 'active') {
      this.ordersGateway.emitAuthExpired(saved.id, buildPaymentSuspendedErrorMessage(saved.name));
    }
    return this.findOneEnriched(saved.id);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    await this.repo.remove(entity);
  }
}
