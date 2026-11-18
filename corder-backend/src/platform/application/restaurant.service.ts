import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
import {
  formatCanonicalCorderEmail,
  toCorderEmailTenantSlug,
} from '../../common/text/corder-email.policy';

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

    for (const link of links) {
      if (link.restaurantId !== r.id) continue;
      const b = bossById.get(link.bossId);
      if (b) {
        assignedMap.set(b.id, {
          id: b.id,
          name: b.name,
          email: b.email,
          bossTier: b.bossTier || 'franchise_owner',
          title:
            link.title ||
            (b.bossTier === 'brand_owner' ? 'Brand Owner (HQ)' : 'Franchise / Branch Owner'),
        });
      }
    }

    if (r.rootAdminId && !assignedMap.has(r.rootAdminId)) {
      const b = bossById.get(r.rootAdminId);
      if (b) {
        assignedMap.set(b.id, {
          id: b.id,
          name: b.name,
          email: b.email,
          bossTier: b.bossTier || 'franchise_owner',
          title: b.bossTier === 'brand_owner' ? 'Brand Owner (HQ)' : 'Franchise / Branch Owner',
        });
      }
    }

    if (r.brandName) {
      const normalizedBrand = r.brandName.trim().toLowerCase();
      for (const b of allBosses) {
        if (
          b.bossTier === 'brand_owner' &&
          b.brandName &&
          b.brandName.trim().toLowerCase() === normalizedBrand &&
          !assignedMap.has(b.id)
        ) {
          assignedMap.set(b.id, {
            id: b.id,
            name: b.name,
            email: b.email,
            bossTier: 'brand_owner',
            title: 'Brand Owner (HQ)',
          });
        }
      }
    }

    return Array.from(assignedMap.values());
  }

  async enrichRestaurantsWithBosses(restaurants: RestaurantEntity[]) {
    if (restaurants.length === 0) return [];
    const restIds = restaurants.map((r) => r.id);
    const [links, allBosses, allPayments, collectionEndDay] = await Promise.all([
      this.bossRestaurantRepo.find({ where: { restaurantId: In(restIds) } }),
      this.rootAdminRepo.find(),
      this.paymentRepo.find({
        where: { restaurantId: In(restIds) },
        order: { paidAt: 'DESC', createdAt: 'DESC' },
      }),
      this.getCollectionEndDay(),
    ]);
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
        billingStartPeriod: summary.billingStartPeriod,
        billingStatus: summary.billingStatus,
        currentPeriod: summary.currentPeriod,
        isCurrentPeriodPaid: summary.isCurrentPeriodPaid,
        paidPeriods: summary.paidPeriods,
        paidThroughPeriod: summary.paidThroughPeriod,
        prepaidFuturePeriods: summary.prepaidFuturePeriods,
        overduePeriods: summary.overduePeriods,
        duePeriods: summary.duePeriods,
        nextUnpaidPeriod: summary.nextUnpaidPeriod,
        lastPaymentDate: summary.lastPaymentDate,
        lastPaidPeriod: summary.lastPaidPeriod,
        totalCollectedAmount: summary.totalCollectedAmount,
        paymentHistory: restPayments.map(toPaymentRecordDto),
        bosses: this.resolveAssignedBossesForRestaurant(r, links, allBosses, bossById),
      };
    });
  }

  async syncPersistedBillingSummary(restaurantId: string): Promise<void> {
    const [entity, payments, collectionEndDay] = await Promise.all([
      this.findOne(restaurantId),
      this.paymentRepo.find({
        where: { restaurantId },
        order: { paidAt: 'DESC', createdAt: 'DESC' },
      }),
      this.getCollectionEndDay(),
    ]);

    const summary = computeRestaurantBillingSummary({
      status: entity.status,
      monthlyFee: entity.monthlyFee,
      billingStartPeriod: entity.billingStartPeriod,
      createdAt: entity.createdAt,
      isAccessSuspended: entity.isAccessSuspended,
      payments,
      collectionEndDay,
    });

    entity.billingStartPeriod = summary.billingStartPeriod;
    entity.billingStatus = summary.billingStatus;
    entity.lastPaymentDate = summary.lastPaymentDate;
    entity.lastPaidPeriod = summary.lastPaidPeriod;
    await this.repo.save(entity);
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
    for (const boss of brandOwners) {
      if (boss.brandName && boss.brandName.trim().toLowerCase() === normalized) {
        const existing = await this.bossRestaurantRepo.findOne({
          where: { bossId: boss.id, restaurantId: restaurant.id },
        });
        if (!existing) {
          await this.bossRestaurantRepo.save(
            this.bossRestaurantRepo.create({
              bossId: boss.id,
              restaurantId: restaurant.id,
              title: 'Brand Owner (HQ)',
            }),
          );
        }
      }
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

    const printAgentUsername = params.printAgentUsername?.trim().toLowerCase() || null;
    if (printAgentUsername) {
      const owner = await this.repo.findOne({ where: { printAgentUsername } });
      if (owner && owner.id !== params.excludeRestaurantId) {
        throw new ConflictException('Print agent username already in use');
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
      terminalEmail: rawTerminalEmail,
      terminalPassword: rawTerminalPassword,
      printAgentUsername: rawUsername,
      printAgentPassword: rawPassword,
      monthlyFee,
      royaltyRate,
      brandName,
      branchType,
      franchiseeCompanyName,
      billingStartPeriod: rawStartPeriod,
      recordInitialPayment,
      initialPaidMonths,
      initialPaymentMethod,
      isAccessSuspended,
      billingNotes,
      email: rawEmail,
      ...restDto
    } = dto;

    const creds = await this.resolveDeviceCredentials({
      tenantSlug: slug,
      terminalEmail: rawTerminalEmail,
      terminalPassword: rawTerminalPassword,
      printAgentUsername: rawUsername,
      printAgentPassword: rawPassword,
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
        slug,
        email: formatCanonicalCorderEmail(rawEmail, slug) ?? undefined,
        brandName: brandName?.trim() || null,
        branchType: branchType ?? 'independent',
        franchiseeCompanyName: franchiseeCompanyName?.trim() || null,
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
        ...creds,
      }),
    );

    if (recordInitialPayment && feeValue >= 0) {
      const months = Math.max(1, Math.min(36, initialPaidMonths ?? 1));
      const coveredPeriods = buildConsecutivePeriods(billingStartPeriod, months);
      await this.paymentRepo.save(
        this.paymentRepo.create({
          restaurantId: saved.id,
          paidAt: now,
          amount: String(Number((feeValue * months).toFixed(2))),
          periods: coveredPeriods,
          periodStart: coveredPeriods[0],
          periodEnd: coveredPeriods[coveredPeriods.length - 1],
          monthsCount: coveredPeriods.length,
          paymentMethod: initialPaymentMethod ?? 'bank_transfer',
          note: billingNotes?.trim() || 'Başlangıç abonelik tahsilatı',
          recordedBy,
        }),
      );
    }

    await this.syncPersistedBillingSummary(saved.id);
    await this.autoLinkBrandOwners(saved);
    return this.findOneEnriched(saved.id);
  }

  private applyMutableScalarFields(entity: RestaurantEntity, dto: UpdateRestaurantDto): void {
    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.address !== undefined) entity.address = dto.address;
    if (dto.phone !== undefined) entity.phone = dto.phone;
    if (dto.email !== undefined) {
      entity.email = formatCanonicalCorderEmail(dto.email, entity.slug) ?? (null as unknown as string);
    }
    if (dto.status !== undefined) entity.status = dto.status;
    if (dto.brandName !== undefined) entity.brandName = dto.brandName?.trim() || null;
    if (dto.branchType !== undefined) entity.branchType = dto.branchType;
    if (dto.franchiseeCompanyName !== undefined) {
      entity.franchiseeCompanyName = dto.franchiseeCompanyName?.trim() || null;
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
  }

  async update(id: string, dto: UpdateRestaurantDto) {
    const entity = await this.findOne(id);
    if (dto.slug !== undefined) {
      const slug = toCorderEmailTenantSlug(dto.slug);
      if (slug && slug !== entity.slug) {
        const existing = await this.repo.findOne({ where: { slug } });
        if (existing) throw new ConflictException('Slug already in use');
        entity.slug = slug;
        if (entity.email && dto.email === undefined) {
          entity.email = formatCanonicalCorderEmail(entity.email, slug) ?? entity.email;
        }
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
        terminalEmail:
          dto.terminalEmail !== undefined ? dto.terminalEmail : entity.terminalEmail,
        terminalPassword: dto.terminalPassword,
        printAgentUsername:
          dto.printAgentUsername !== undefined
            ? dto.printAgentUsername
            : entity.printAgentUsername,
        printAgentPassword: dto.printAgentPassword,
        excludeRestaurantId: entity.id,
      });
      if (dto.terminalEmail !== undefined) entity.terminalEmail = creds.terminalEmail;
      if (creds.terminalPasswordHash) entity.terminalPasswordHash = creds.terminalPasswordHash;
      if (dto.printAgentUsername !== undefined) {
        entity.printAgentUsername = creds.printAgentUsername;
      }
      if (creds.printAgentPasswordHash) {
        entity.printAgentPasswordHash = creds.printAgentPasswordHash;
      }
    } else {
      if (dto.terminalPassword && dto.terminalPassword.length > 0) {
        entity.terminalPasswordHash = await bcrypt.hash(dto.terminalPassword, 10);
      }
      if (dto.printAgentPassword && dto.printAgentPassword.length > 0) {
        entity.printAgentPasswordHash = await bcrypt.hash(dto.printAgentPassword, 10);
      }
    }

    const saved = await this.repo.save(entity);
    await this.syncPersistedBillingSummary(saved.id);
    await this.autoLinkBrandOwners(saved);
    return this.findOneEnriched(saved.id);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    await this.repo.remove(entity);
  }
}
