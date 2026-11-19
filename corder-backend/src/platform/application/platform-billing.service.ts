import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { RestaurantEntity } from '../domain/restaurant.entity';
import { PlatformBillingConfigEntity } from '../domain/platform-billing-config.entity';
import { RestaurantSubscriptionPaymentEntity } from '../domain/restaurant-subscription-payment.entity';
import {
  buildConsecutivePeriods,
  comparePeriods,
  computeRestaurantBillingSummary,
  normalizeAndSortPeriods,
} from '../domain/subscription-billing.policy';
import { CashShiftEntity } from '../../restaurant/domain/cash-shift.entity';
import { OrdersGateway } from '../../restaurant/api/orders.gateway';
import { buildPaymentSuspendedErrorMessage } from '../../restaurant/domain/services/billing-suspension.policy';
import {
  RecordRestaurantPaymentDto,
  UpdatePlatformBillingConfigDto,
  UpdateRestaurantPaymentDto,
} from '../api/dto/platform-billing.dto';
import { RestaurantService } from './restaurant.service';

function parsePaidAtInput(raw?: string | null): Date {
  if (!raw || !raw.trim()) {
    return new Date();
  }
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T12:00:00.000Z`);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('Invalid payment date format.');
    }
    return d;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('Invalid payment date format.');
  }
  return parsed;
}

@Injectable()
export class PlatformBillingService {
  constructor(
    @InjectRepository(RestaurantEntity)
    private readonly repo: Repository<RestaurantEntity>,
    @InjectRepository(PlatformBillingConfigEntity)
    private readonly billingConfigRepo: Repository<PlatformBillingConfigEntity>,
    @InjectRepository(RestaurantSubscriptionPaymentEntity)
    private readonly paymentRepo: Repository<RestaurantSubscriptionPaymentEntity>,
    private readonly restaurantService: RestaurantService,
    private readonly ordersGateway: OrdersGateway,
    @Optional()
    private readonly dataSource?: DataSource,
  ) {}

  private runInTransaction<T>(work: (em: EntityManager) => Promise<T>): Promise<T> {
    if (this.dataSource) {
      return this.dataSource.transaction(work);
    }
    return this.repo.manager.transaction(work);
  }

  private async hasOpenCashShift(restaurantId: string, em?: EntityManager): Promise<boolean> {
    const manager = em ?? this.repo.manager;
    return manager.exists(CashShiftEntity, {
      where: { restaurantId, status: 'open' },
    });
  }

  async getBillingConfig(em?: EntityManager): Promise<PlatformBillingConfigEntity> {
    const existing = em
      ? await em.find(PlatformBillingConfigEntity, {
          order: { updatedAt: 'DESC' },
          take: 1,
        })
      : await this.billingConfigRepo.find({
          order: { updatedAt: 'DESC' },
          take: 1,
        });
    if (existing.length > 0) {
      return existing[0];
    }
    const created = this.billingConfigRepo.create({
      receiverName: 'Corder Software and Technology Inc.',
      iban: 'TR33 0006 1005 1978 6457 8413 26',
      bankName: 'Garanti BBVA',
      collectionStartDay: 25,
      collectionEndDay: 30,
      supportPhone: '0850 300 00 00',
      supportEmail: 'finance@corder.com',
      paymentInstructions:
        'Aylık abonelik ödemeleri her ayın 25 ile 30\'u arasında tahsil edilir. Havale açıklamasına işletme adını ekleyiniz.',
    });
    return this.billingConfigRepo.save(created);
  }

  async updateBillingConfig(
    dto: UpdatePlatformBillingConfigDto,
  ): Promise<PlatformBillingConfigEntity> {
    const cfg = await this.getBillingConfig();
    if (dto.receiverName !== undefined) cfg.receiverName = dto.receiverName.trim();
    if (dto.iban !== undefined) cfg.iban = dto.iban.trim();
    if (dto.bankName !== undefined) cfg.bankName = dto.bankName.trim();
    if (dto.collectionStartDay !== undefined) cfg.collectionStartDay = dto.collectionStartDay;
    if (dto.collectionEndDay !== undefined) cfg.collectionEndDay = dto.collectionEndDay;
    if (dto.supportPhone !== undefined) cfg.supportPhone = dto.supportPhone?.trim() || null;
    if (dto.supportEmail !== undefined) cfg.supportEmail = dto.supportEmail?.trim() || null;
    if (dto.paymentInstructions !== undefined) {
      cfg.paymentInstructions = dto.paymentInstructions?.trim() || null;
    }
    return this.billingConfigRepo.save(cfg);
  }

  private async assertNoOverlappingPeriods(
    restaurantId: string,
    targetPeriods: string[],
    excludePaymentId?: string,
    em?: EntityManager,
  ): Promise<void> {
    const existing = em
      ? await em.find(RestaurantSubscriptionPaymentEntity, { where: { restaurantId } })
      : await this.paymentRepo.find({ where: { restaurantId } });
    const alreadyPaid = new Set<string>();
    for (const p of existing) {
      if (excludePaymentId && p.id === excludePaymentId) continue;
      for (const per of p.periods ?? []) {
        alreadyPaid.add(per);
      }
    }
    const overlaps = targetPeriods.filter((per) => alreadyPaid.has(per));
    if (overlaps.length > 0) {
      throw new ConflictException(
        `Seçilen dönem(ler) için zaten tahsilat kaydı mevcut: ${overlaps.join(', ')}`,
      );
    }
  }

  async recordPaymentReceived(
    id: string,
    dto: RecordRestaurantPaymentDto,
    recordedBy = 'Platform Admin',
  ) {
    await this.runInTransaction(async (em) => {
      const entity = await em.findOne(RestaurantEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!entity) throw new NotFoundException('Restaurant not found');

      const [existingPayments, cfg] = await Promise.all([
        em.find(RestaurantSubscriptionPaymentEntity, {
          where: { restaurantId: id },
          order: { paidAt: 'DESC', createdAt: 'DESC' },
        }),
        this.getBillingConfig(em),
      ]);

      let resolvedPeriods: string[];
      if (dto.periods && dto.periods.length > 0) {
        resolvedPeriods = normalizeAndSortPeriods(dto.periods);
      } else if (dto.startPeriod) {
        resolvedPeriods = buildConsecutivePeriods(dto.startPeriod, dto.monthsCount ?? 1);
      } else if (dto.period) {
        resolvedPeriods = buildConsecutivePeriods(dto.period, dto.monthsCount ?? 1);
      } else {
        const currentSummary = computeRestaurantBillingSummary({
          status: entity.status,
          monthlyFee: entity.monthlyFee,
          billingStartPeriod: entity.billingStartPeriod,
          createdAt: entity.createdAt,
          isAccessSuspended: entity.isAccessSuspended,
          payments: existingPayments,
          collectionEndDay: cfg.collectionEndDay,
        });
        resolvedPeriods = buildConsecutivePeriods(
          currentSummary.nextUnpaidPeriod,
          dto.monthsCount ?? 1,
        );
      }

      await this.assertNoOverlappingPeriods(id, resolvedPeriods, undefined, em);

      const paidAt = parsePaidAtInput(dto.paidAt);
      const monthlyFee = Math.max(0, Number(entity.monthlyFee || 0));
      const amount =
        dto.amount !== undefined
          ? Math.max(0, Number(dto.amount) || 0)
          : Number((monthlyFee * resolvedPeriods.length).toFixed(2));

      const payment = em.create(RestaurantSubscriptionPaymentEntity, {
        restaurantId: id,
        paidAt,
        amount: String(Number(amount.toFixed(2))),
        periods: resolvedPeriods,
        periodStart: resolvedPeriods[0],
        periodEnd: resolvedPeriods[resolvedPeriods.length - 1],
        monthsCount: resolvedPeriods.length,
        paymentMethod: dto.paymentMethod ?? 'bank_transfer',
        note: dto.note?.trim() || null,
        recordedBy,
      });
      await em.save(RestaurantSubscriptionPaymentEntity, payment);

      if (
        entity.billingStartPeriod &&
        comparePeriods(resolvedPeriods[0], entity.billingStartPeriod) < 0
      ) {
        entity.billingStartPeriod = resolvedPeriods[0];
      }

      if (dto.reopenAccess !== false) {
        entity.isAccessSuspended = false;
        entity.suspensionReason = null;
        entity.suspendedAt = null;
        entity.status = 'active';
      }

      await em.save(RestaurantEntity, entity);
      await this.restaurantService.syncPersistedBillingSummary(id, em);
    });
    return this.restaurantService.findOneEnriched(id);
  }

  async updatePaymentRecord(
    restaurantId: string,
    paymentId: string,
    dto: UpdateRestaurantPaymentDto,
    recordedBy = 'Platform Admin',
  ) {
    await this.runInTransaction(async (em) => {
      const entity = await em.findOne(RestaurantEntity, {
        where: { id: restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!entity) throw new NotFoundException('Restaurant not found');

      const payment = await em.findOne(RestaurantSubscriptionPaymentEntity, {
        where: { id: paymentId, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment) {
        throw new NotFoundException('Tahsilat kaydı bulunamadı.');
      }

      if (dto.periods !== undefined) {
        const normalized = normalizeAndSortPeriods(dto.periods);
        await this.assertNoOverlappingPeriods(restaurantId, normalized, paymentId, em);
        payment.periods = normalized;
        payment.periodStart = normalized[0];
        payment.periodEnd = normalized[normalized.length - 1];
        payment.monthsCount = normalized.length;
      }

      if (dto.paidAt !== undefined) {
        payment.paidAt = parsePaidAtInput(dto.paidAt);
      }
      if (dto.amount !== undefined) {
        payment.amount = String(Number(Math.max(0, Number(dto.amount) || 0).toFixed(2)));
      }
      if (dto.paymentMethod !== undefined) {
        payment.paymentMethod = dto.paymentMethod;
      }
      if (dto.note !== undefined) {
        payment.note = dto.note?.trim() || null;
      }

      payment.recordedBy = recordedBy;
      await em.save(RestaurantSubscriptionPaymentEntity, payment);
      await this.restaurantService.syncPersistedBillingSummary(restaurantId, em);
    });
    return this.restaurantService.findOneEnriched(restaurantId);
  }

  async deletePaymentRecord(restaurantId: string, paymentId: string) {
    await this.runInTransaction(async (em) => {
      const entity = await em.findOne(RestaurantEntity, {
        where: { id: restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!entity) throw new NotFoundException('Restaurant not found');

      const payment = await em.findOne(RestaurantSubscriptionPaymentEntity, {
        where: { id: paymentId, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment) {
        throw new NotFoundException('Tahsilat kaydı bulunamadı.');
      }
      await em.remove(RestaurantSubscriptionPaymentEntity, payment);
      await this.restaurantService.syncPersistedBillingSummary(restaurantId, em);
    });
    return this.restaurantService.findOneEnriched(restaurantId);
  }

  async suspendForNonPayment(id: string, note?: string) {
    const entityName = await this.runInTransaction(async (em) => {
      const entity = await em.findOne(RestaurantEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!entity) throw new NotFoundException('Restaurant not found');

      entity.billingStatus = 'suspended';
      entity.isAccessSuspended = true;
      entity.suspensionReason = 'payment_overdue';
      entity.suspendedAt = new Date();
      if (note !== undefined && note.trim()) {
        entity.billingNotes = note.trim();
      }
      await em.save(RestaurantEntity, entity);
      await this.restaurantService.syncPersistedBillingSummary(id, em);
      return entity.name;
    });
    this.ordersGateway.emitAuthExpired(
      id,
      buildPaymentSuspendedErrorMessage(entityName),
    );
    return this.restaurantService.findOneEnriched(id);
  }

  async unsuspendAccess(id: string, note?: string) {
    await this.runInTransaction(async (em) => {
      const entity = await em.findOne(RestaurantEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!entity) throw new NotFoundException('Restaurant not found');

      entity.isAccessSuspended = false;
      entity.suspensionReason = null;
      entity.suspendedAt = null;
      if (note !== undefined && note.trim()) {
        entity.billingNotes = note.trim();
      }
      await em.save(RestaurantEntity, entity);
      await this.restaurantService.syncPersistedBillingSummary(id, em);
    });
    return this.restaurantService.findOneEnriched(id);
  }

  async suspendAllUnpaidRestaurants() {
    const newlySuspended: Array<{ id: string; name: string }> = [];
    const { suspendedCount, deferredOpenShiftCount } = await this.runInTransaction(async (em) => {
      const [all, allPayments, cfg] = await Promise.all([
        em.find(RestaurantEntity, {
          order: { id: 'ASC' },
          lock: { mode: 'pessimistic_write' },
        }),
        em.find(RestaurantSubscriptionPaymentEntity),
        this.getBillingConfig(em),
      ]);

      const paymentsByRest = new Map<string, RestaurantSubscriptionPaymentEntity[]>();
      for (const p of allPayments) {
        const arr = paymentsByRest.get(p.restaurantId) ?? [];
        arr.push(p);
        paymentsByRest.set(p.restaurantId, arr);
      }

      let suspended = 0;
      let deferred = 0;
      const now = new Date();

      for (const r of all) {
        const fee = Number(r.monthlyFee || 0);
        if (fee <= 0 || r.status !== 'active' || r.isAccessSuspended) continue;

        const summary = computeRestaurantBillingSummary({
          status: r.status,
          monthlyFee: fee,
          billingStartPeriod: r.billingStartPeriod,
          createdAt: r.createdAt,
          isAccessSuspended: r.isAccessSuspended,
          payments: paymentsByRest.get(r.id) ?? [],
          collectionEndDay: cfg.collectionEndDay,
          now,
        });

        if (summary.overduePeriods.length > 0) {
          const hasOpenShift = await this.hasOpenCashShift(r.id, em);
          if (hasOpenShift) {
            r.billingStatus = 'overdue';
            r.isAccessSuspended = false;
            r.suspensionReason = 'payment_overdue_grace_open_shift';
            await em.save(RestaurantEntity, r);
            deferred += 1;
            continue;
          }
          r.billingStatus = 'suspended';
          r.isAccessSuspended = true;
          r.suspensionReason = 'payment_overdue';
          r.suspendedAt = now;
          await em.save(RestaurantEntity, r);
          newlySuspended.push({ id: r.id, name: r.name });
          suspended += 1;
        }
      }
      return { suspendedCount: suspended, deferredOpenShiftCount: deferred };
    });

    for (const s of newlySuspended) {
      this.ordersGateway.emitAuthExpired(
        s.id,
        buildPaymentSuspendedErrorMessage(s.name),
      );
    }
    return { suspendedCount, deferredOpenShiftCount };
  }
}
