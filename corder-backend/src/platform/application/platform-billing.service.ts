import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  RestaurantEntity,
  RestaurantPaymentRecord,
} from '../domain/restaurant.entity';
import { PlatformBillingConfigEntity } from '../domain/platform-billing-config.entity';
import { CashShiftEntity } from '../../restaurant/domain/cash-shift.entity';
import {
  RecordRestaurantPaymentDto,
  UpdatePlatformBillingConfigDto,
  UpdateRestaurantBillingStatusDto,
} from '../api/dto/platform-billing.dto';
import { getCurrentBillingPeriod, RestaurantService } from './restaurant.service';

@Injectable()
export class PlatformBillingService {
  constructor(
    @InjectRepository(RestaurantEntity)
    private readonly repo: Repository<RestaurantEntity>,
    @InjectRepository(PlatformBillingConfigEntity)
    private readonly billingConfigRepo: Repository<PlatformBillingConfigEntity>,
    private readonly restaurantService: RestaurantService,
  ) {}

  private async hasOpenCashShift(restaurantId: string): Promise<boolean> {
    return this.repo.manager.exists(CashShiftEntity, {
      where: { restaurantId, status: 'open' },
    });
  }

  async getBillingConfig(): Promise<PlatformBillingConfigEntity> {
    const existing = await this.billingConfigRepo.find({
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
        'Monthly subscription payments are collected between the 25th and 30th of each month. Please include your business name in the wire transfer note.',
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

  async recordPaymentReceived(
    id: string,
    dto: RecordRestaurantPaymentDto,
    recordedBy = 'Platform Admin',
  ) {
    const entity = await this.restaurantService.findOne(id);
    const period = dto.period?.trim() || getCurrentBillingPeriod();
    const amount =
      dto.amount !== undefined ? Number(dto.amount) : Number(entity.monthlyFee || 0);
    const now = new Date();

    const record: RestaurantPaymentRecord = {
      id: randomUUID(),
      period,
      amount,
      paidAt: now.toISOString(),
      note: dto.note?.trim() || null,
      recordedBy,
    };

    const history = Array.isArray(entity.paymentHistory) ? [...entity.paymentHistory] : [];
    history.unshift(record);

    entity.billingStatus = 'paid';
    entity.isAccessSuspended = false;
    entity.suspensionReason = null;
    entity.suspendedAt = null;
    entity.status = 'active';
    entity.lastPaymentDate = now;
    entity.lastPaidPeriod = period;
    entity.paymentHistory = history.slice(0, 60);
    if (dto.note !== undefined) {
      entity.billingNotes = dto.note?.trim() || null;
    }

    await this.repo.save(entity);
    return this.restaurantService.findOneEnriched(entity.id);
  }

  async suspendForNonPayment(id: string, note?: string) {
    const entity = await this.restaurantService.findOne(id);
    entity.billingStatus = 'suspended';
    entity.isAccessSuspended = true;
    entity.suspensionReason = 'payment_overdue';
    entity.suspendedAt = new Date();
    if (note !== undefined && note.trim()) {
      entity.billingNotes = note.trim();
    }
    await this.repo.save(entity);
    return this.restaurantService.findOneEnriched(entity.id);
  }

  async updateBillingStatus(
    id: string,
    dto: UpdateRestaurantBillingStatusDto,
    recordedBy = 'Platform Admin',
  ) {
    const entity = await this.restaurantService.findOne(id);
    if (dto.monthlyFee !== undefined) {
      entity.monthlyFee = String(Math.max(0, Number(dto.monthlyFee) || 0));
      await this.repo.save(entity);
    }
    if (dto.billingStatus === 'paid') {
      return this.recordPaymentReceived(
        id,
        {
          amount: dto.monthlyFee !== undefined ? dto.monthlyFee : Number(entity.monthlyFee || 0),
          period: dto.period,
          note: dto.note ?? undefined,
        },
        recordedBy,
      );
    }
    if (dto.billingStatus === 'suspended') {
      return this.suspendForNonPayment(id, dto.note ?? undefined);
    }
    entity.billingStatus = dto.billingStatus;
    entity.isAccessSuspended = false;
    entity.suspensionReason = null;
    entity.suspendedAt = null;
    if (dto.note !== undefined) {
      entity.billingNotes = dto.note?.trim() || null;
    }
    await this.repo.save(entity);
    return this.restaurantService.findOneEnriched(entity.id);
  }

  async startMonthlyCollectionCycle(periodInput?: string) {
    const targetPeriod = periodInput?.trim() || getCurrentBillingPeriod();
    const all = await this.repo.find();
    let updatedCount = 0;
    for (const r of all) {
      const fee = Number(r.monthlyFee || 0);
      if (
        r.status === 'active' &&
        !r.isAccessSuspended &&
        fee > 0 &&
        r.lastPaidPeriod !== targetPeriod
      ) {
        r.billingStatus = 'pending';
        await this.repo.save(r);
        updatedCount += 1;
      }
    }
    return { period: targetPeriod, updatedCount };
  }

  async suspendAllUnpaidRestaurants() {
    const all = await this.repo.find();
    let suspendedCount = 0;
    let deferredOpenShiftCount = 0;
    for (const r of all) {
      const fee = Number(r.monthlyFee || 0);
      if (fee <= 0) continue;
      if (r.billingStatus === 'pending' || r.billingStatus === 'overdue') {
        const hasOpenShift = await this.hasOpenCashShift(r.id);
        if (hasOpenShift) {
          r.billingStatus = 'overdue';
          r.isAccessSuspended = false;
          r.suspensionReason = 'payment_overdue_grace_open_shift';
          await this.repo.save(r);
          deferredOpenShiftCount += 1;
          continue;
        }
        r.billingStatus = 'suspended';
        r.isAccessSuspended = true;
        r.suspensionReason = 'payment_overdue';
        r.suspendedAt = new Date();
        await this.repo.save(r);
        suspendedCount += 1;
      }
    }
    return { suspendedCount, deferredOpenShiftCount };
  }
}

