import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RestaurantEntity,
  RestaurantPaymentRecord,
} from '../../platform/domain/restaurant.entity';
import { PlatformBillingConfigEntity } from '../../platform/domain/platform-billing-config.entity';

export interface RestaurantSettingsDto {
  name: string;
  address?: string | null;
  phone?: string | null;
  taxId?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  website?: string | null;
  workingHours?: string | null;
}

export interface MerchantBillingInfoDto {
  restaurantId: string;
  restaurantName: string;
  slug: string;
  brandName: string | null;
  branchType: string;
  monthlyFee: number;
  billingStatus: string;
  isAccessSuspended: boolean;
  suspensionReason: string | null;
  lastPaymentDate: string | null;
  lastPaidPeriod: string | null;
  billingNotes: string | null;
  paymentHistory: RestaurantPaymentRecord[];
  paymentAccount: {
    receiverName: string;
    iban: string;
    bankName: string;
    collectionStartDay: number;
    collectionEndDay: number;
    supportPhone: string | null;
    supportEmail: string | null;
    paymentInstructions: string | null;
    suggestedTransferNote: string;
  };
}

@Injectable()
export class RestaurantSettingsService {
  constructor(
    @InjectRepository(RestaurantEntity)
    private readonly repo: Repository<RestaurantEntity>,
    @InjectRepository(PlatformBillingConfigEntity)
    private readonly billingConfigRepo: Repository<PlatformBillingConfigEntity>,
  ) {}

  async get(restaurantId: string): Promise<RestaurantSettingsDto> {
    const r = await this.repo.findOne({ where: { id: restaurantId } });
    if (!r) {
      throw new NotFoundException('Restaurant not found');
    }
    return {
      name: r.name,
      address: r.address,
      phone: r.phone,
      taxId: r.taxId,
      whatsapp: r.whatsapp,
      instagram: r.instagram,
      facebook: r.facebook,
      website: r.website,
      workingHours: r.workingHours,
    };
  }

  async getBillingInfo(restaurantId: string): Promise<MerchantBillingInfoDto> {
    const r = await this.repo.findOne({ where: { id: restaurantId } });
    if (!r) {
      throw new NotFoundException('Restaurant not found');
    }
    const configs = await this.billingConfigRepo.find({
      order: { updatedAt: 'DESC' },
      take: 1,
    });
    const cfg = configs[0] ?? {
      receiverName: 'Corder Software and Technology Inc.',
      iban: 'TR33 0006 1005 1978 6457 8413 26',
      bankName: 'Garanti BBVA',
      collectionStartDay: 25,
      collectionEndDay: 30,
      supportPhone: '0850 300 00 00',
      supportEmail: 'finance@corder.com',
      paymentInstructions:
        'Monthly subscription payments are collected between the 25th and 30th of each month. Please include your business name in the wire transfer note.',
    };

    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Istanbul',
      month: '2-digit',
      year: 'numeric',
    }).formatToParts(new Date());
    const month = parts.find((p) => p.type === 'month')?.value ?? '01';
    const year = parts.find((p) => p.type === 'year')?.value ?? '2026';
    const periodLabel = `${month}/${year}`;
    const suggestedTransferNote = `${r.name} - ${periodLabel} Monthly Subscription Fee`;

    return {
      restaurantId: r.id,
      restaurantName: r.name,
      slug: r.slug,
      brandName: r.brandName ?? null,
      branchType: r.branchType || 'independent',
      monthlyFee: Number(r.monthlyFee || 0),
      billingStatus: r.billingStatus || 'paid',
      isAccessSuspended: Boolean(r.isAccessSuspended),
      suspensionReason: r.suspensionReason ?? null,
      lastPaymentDate: r.lastPaymentDate ? r.lastPaymentDate.toISOString() : null,
      lastPaidPeriod: r.lastPaidPeriod ?? null,
      billingNotes: r.billingNotes ?? null,
      paymentHistory: Array.isArray(r.paymentHistory) ? r.paymentHistory : [],
      paymentAccount: {
        receiverName: cfg.receiverName,
        iban: cfg.iban,
        bankName: cfg.bankName,
        collectionStartDay: cfg.collectionStartDay ?? 25,
        collectionEndDay: cfg.collectionEndDay ?? 30,
        supportPhone: cfg.supportPhone ?? null,
        supportEmail: cfg.supportEmail ?? null,
        paymentInstructions: cfg.paymentInstructions ?? null,
        suggestedTransferNote,
      },
    };
  }

  async update(
    restaurantId: string,
    dto: Partial<RestaurantSettingsDto>,
  ): Promise<RestaurantSettingsDto> {
    const r = await this.repo.findOne({ where: { id: restaurantId } });
    if (!r) {
      throw new NotFoundException('Restaurant not found');
    }
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Restaurant name cannot be empty');
      r.name = name;
    }
    if (dto.address !== undefined) r.address = (dto.address?.trim() || null) as string;
    if (dto.phone !== undefined) r.phone = (dto.phone?.trim() || null) as string;
    if (dto.taxId !== undefined) r.taxId = dto.taxId?.trim() || null;
    if (dto.whatsapp !== undefined) r.whatsapp = dto.whatsapp?.trim() || null;
    if (dto.instagram !== undefined) r.instagram = dto.instagram?.trim() || null;
    if (dto.facebook !== undefined) r.facebook = dto.facebook?.trim() || null;
    if (dto.website !== undefined) r.website = dto.website?.trim() || null;
    if (dto.workingHours !== undefined) {
      r.workingHours = dto.workingHours?.trim() || null;
    }
    await this.repo.save(r);
    return this.get(restaurantId);
  }
}
