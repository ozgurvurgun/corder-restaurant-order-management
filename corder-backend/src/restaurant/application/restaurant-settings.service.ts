import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RESTAURANT_MENU_TEMPLATES,
  RestaurantEntity,
  RestaurantMenuTemplate,
  RestaurantPaymentRecord,
} from '../../platform/domain/restaurant.entity';
import { PlatformBillingConfigEntity } from '../../platform/domain/platform-billing-config.entity';
import { RestaurantSubscriptionPaymentEntity } from '../../platform/domain/restaurant-subscription-payment.entity';
import {
  computeRestaurantBillingSummary,
  toPaymentRecordDto,
} from '../../platform/domain/subscription-billing.policy';
import { OrdersGateway } from '../api/orders.gateway';

export interface RestaurantSettingsDto {
  name: string;
  slug?: string;
  address?: string | null;
  phone?: string | null;
  taxId?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  website?: string | null;
  workingHours?: string | null;
  logoUrl?: string | null;
  menuTemplate?: RestaurantMenuTemplate;
  terminalLocationRestrictionEnabled?: boolean;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  locationRadiusMeters?: number;
}

export interface MerchantBillingInfoDto {
  restaurantId: string;
  restaurantName: string;
  slug: string;
  brandName: string | null;
  branchType: string;
  monthlyFee: number;
  billingStartPeriod: string;
  billingStatus: string;
  currentPeriod: string;
  isCurrentPeriodPaid: boolean;
  paidPeriods: string[];
  paidThroughPeriod: string | null;
  prepaidFuturePeriods: string[];
  overduePeriods: string[];
  duePeriods: string[];
  nextUnpaidPeriod: string;
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

function formatTurkishPeriodLabel(period: string): string {
  const [y, m] = period.split('-');
  const d = new Date(Date.UTC(Number(y), Number(m) - 1, 15));
  if (Number.isNaN(d.getTime())) return period;
  return new Intl.DateTimeFormat('tr-TR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

@Injectable()
export class RestaurantSettingsService {
  constructor(
    @InjectRepository(RestaurantEntity)
    private readonly repo: Repository<RestaurantEntity>,
    @InjectRepository(PlatformBillingConfigEntity)
    private readonly billingConfigRepo: Repository<PlatformBillingConfigEntity>,
    @InjectRepository(RestaurantSubscriptionPaymentEntity)
    private readonly paymentRepo: Repository<RestaurantSubscriptionPaymentEntity>,
    private readonly ordersGateway: OrdersGateway,
  ) {}

  async get(restaurantId: string): Promise<RestaurantSettingsDto> {
    const r = await this.repo.findOne({ where: { id: restaurantId } });
    if (!r) {
      throw new NotFoundException('Restaurant not found');
    }
    return {
      name: r.name,
      slug: r.slug,
      address: r.menuAddress ?? null,
      phone: r.menuPhone ?? null,
      taxId: r.taxId,
      whatsapp: r.whatsapp,
      instagram: r.instagram,
      facebook: r.facebook,
      website: r.website,
      workingHours: r.workingHours,
      logoUrl: r.logoUrl ?? null,
      menuTemplate: (r.menuTemplate as RestaurantMenuTemplate) || 'classic',
      terminalLocationRestrictionEnabled: Boolean(r.terminalLocationRestrictionEnabled),
      locationLatitude: r.locationLatitude != null ? Number(r.locationLatitude) : null,
      locationLongitude: r.locationLongitude != null ? Number(r.locationLongitude) : null,
      locationRadiusMeters: Number(r.locationRadiusMeters || 150),
    };
  }

  async getBillingInfo(restaurantId: string): Promise<MerchantBillingInfoDto> {
    const [r, configs, payments] = await Promise.all([
      this.repo.findOne({ where: { id: restaurantId } }),
      this.billingConfigRepo.find({
        order: { updatedAt: 'DESC' },
        take: 1,
      }),
      this.paymentRepo.find({
        where: { restaurantId },
        order: { paidAt: 'DESC', createdAt: 'DESC' },
      }),
    ]);
    if (!r) {
      throw new NotFoundException('Restaurant not found');
    }
    const cfg = configs[0] ?? {
      receiverName: 'Corder Software and Technology Inc.',
      iban: 'TR33 0006 1005 1978 6457 8413 26',
      bankName: 'Garanti BBVA',
      collectionStartDay: 25,
      collectionEndDay: 30,
      supportPhone: '0850 300 00 00',
      supportEmail: 'finance@corder.com',
      paymentInstructions:
        'Aylık abonelik ödemeleri her ayın 25 ile 30\'u arasında tahsil edilir. Havale açıklamasına işletme adını ekleyiniz.',
    };

    const summary = computeRestaurantBillingSummary({
      status: r.status,
      monthlyFee: r.monthlyFee,
      billingStartPeriod: r.billingStartPeriod,
      createdAt: r.createdAt,
      isAccessSuspended: r.isAccessSuspended,
      payments,
      collectionEndDay: cfg.collectionEndDay ?? 30,
    });

    const targetPeriodText =
      summary.duePeriods.length > 1
        ? `${formatTurkishPeriodLabel(summary.duePeriods[0])} - ${formatTurkishPeriodLabel(summary.duePeriods[summary.duePeriods.length - 1])}`
        : formatTurkishPeriodLabel(summary.nextUnpaidPeriod);
    const suggestedTransferNote = `${r.name} - ${targetPeriodText} Abonelik Ücreti`;

    return {
      restaurantId: r.id,
      restaurantName: r.name,
      slug: r.slug,
      brandName: r.brandName ?? null,
      branchType: r.branchType || 'independent',
      monthlyFee: Number(r.monthlyFee || 0),
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
      isAccessSuspended: Boolean(r.isAccessSuspended),
      suspensionReason: r.suspensionReason ?? null,
      lastPaymentDate: summary.lastPaymentDate
        ? summary.lastPaymentDate.toISOString()
        : null,
      lastPaidPeriod: summary.lastPaidPeriod,
      billingNotes: r.billingNotes ?? null,
      paymentHistory: payments.map(toPaymentRecordDto),
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
    if (dto.address !== undefined) r.menuAddress = dto.address?.trim() || null;
    if (dto.phone !== undefined) r.menuPhone = dto.phone?.trim() || null;
    if (dto.taxId !== undefined) r.taxId = dto.taxId?.trim() || null;
    if (dto.whatsapp !== undefined) r.whatsapp = dto.whatsapp?.trim() || null;
    if (dto.instagram !== undefined) r.instagram = dto.instagram?.trim() || null;
    if (dto.facebook !== undefined) r.facebook = dto.facebook?.trim() || null;
    if (dto.website !== undefined) r.website = dto.website?.trim() || null;
    if (dto.workingHours !== undefined) {
      r.workingHours = dto.workingHours?.trim() || null;
    }
    if (dto.logoUrl !== undefined) {
      r.logoUrl = dto.logoUrl?.trim() || null;
    }
    if (dto.menuTemplate !== undefined) {
      if (!RESTAURANT_MENU_TEMPLATES.includes(dto.menuTemplate)) {
        throw new BadRequestException('Invalid menu template');
      }
      r.menuTemplate = dto.menuTemplate;
    }
    let geofenceChanged = false;
    if (dto.terminalLocationRestrictionEnabled !== undefined) {
      r.terminalLocationRestrictionEnabled = Boolean(
        dto.terminalLocationRestrictionEnabled,
      );
      geofenceChanged = true;
    }
    if (dto.locationLatitude !== undefined) {
      r.locationLatitude =
        dto.locationLatitude != null && Number.isFinite(Number(dto.locationLatitude))
          ? Number(dto.locationLatitude)
          : null;
      geofenceChanged = true;
    }
    if (dto.locationLongitude !== undefined) {
      r.locationLongitude =
        dto.locationLongitude != null && Number.isFinite(Number(dto.locationLongitude))
          ? Number(dto.locationLongitude)
          : null;
      geofenceChanged = true;
    }
    if (dto.locationRadiusMeters !== undefined) {
      r.locationRadiusMeters = Math.max(
        20,
        Math.min(10000, Math.round(Number(dto.locationRadiusMeters) || 150)),
      );
      geofenceChanged = true;
    }
    if (r.terminalLocationRestrictionEnabled) {
      const lat = r.locationLatitude != null ? Number(r.locationLatitude) : NaN;
      const lng = r.locationLongitude != null ? Number(r.locationLongitude) : NaN;
      if (
        r.locationLatitude == null ||
        r.locationLongitude == null ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        throw new BadRequestException(
          'Konum kısıtlamasını etkinleştirmek için geçerli enlem ve boylam koordinatları girilmelidir.',
        );
      }
    }
    await this.repo.save(r);
    if (geofenceChanged) {
      this.ordersGateway.emitStaffSessionUpdated(restaurantId);
    }
    return this.get(restaurantId);
  }
}
