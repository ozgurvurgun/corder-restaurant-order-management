import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { RestaurantEntity } from '../domain/restaurant.entity';
import {
  PlatformNotificationEntity,
  PlatformNotificationLevel,
  PlatformNotificationTargetApp,
} from '../domain/platform-notification.entity';
import { OrdersGateway } from '../../restaurant/api/orders.gateway';

export interface CreatePlatformNotificationInput {
  title: string;
  message: string;
  level?: PlatformNotificationLevel;
  targetApps?: PlatformNotificationTargetApp[];
  targetRestaurantIds?: string[];
  scheduledAt?: string | null;
}

const VALID_LEVELS: Set<PlatformNotificationLevel> = new Set([
  'info',
  'warning',
  'urgent',
  'success',
]);
const VALID_APPS: Set<PlatformNotificationTargetApp> = new Set([
  'merchant',
  'boss',
]);

@Injectable()
export class PlatformNotificationsService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PlatformNotificationsService.name);
  private schedulerTimer: NodeJS.Timeout | null = null;
  private isProcessingDue = false;

  constructor(
    @InjectRepository(PlatformNotificationEntity)
    private readonly notifRepo: Repository<PlatformNotificationEntity>,
    @InjectRepository(RestaurantEntity)
    private readonly restaurantRepo: Repository<RestaurantEntity>,
    private readonly ordersGateway: OrdersGateway,
  ) {}

  onModuleInit(): void {
    this.schedulerTimer = setInterval(() => {
      void this.processDueScheduledNotifications();
    }, 15_000);
    if (typeof this.schedulerTimer.unref === 'function') {
      this.schedulerTimer.unref();
    }
  }

  onModuleDestroy(): void {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  async processDueScheduledNotifications(): Promise<void> {
    if (this.isProcessingDue) return;
    this.isProcessingDue = true;
    try {
      const now = new Date();
      const dueList = await this.notifRepo.find({
        where: {
          status: 'scheduled',
          scheduledAt: LessThanOrEqual(now),
        },
        order: { scheduledAt: 'ASC' },
        take: 50,
      });

      for (const notif of dueList) {
        notif.status = 'sent';
        notif.sentAt = new Date();
        const saved = await this.notifRepo.save(notif);
        await this.dispatchNotification(saved);
      }
    } catch (err) {
      this.logger.warn(
        `Scheduled notification processing failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.isProcessingDue = false;
    }
  }

  private async resolveTargetRestaurantIds(
    targetIds: string[],
  ): Promise<string[]> {
    if (Array.isArray(targetIds) && targetIds.length > 0) {
      const found = await this.restaurantRepo.find({
        where: { id: In(targetIds) },
        select: { id: true },
      });
      return found.map((r) => r.id);
    }
    const allActive = await this.restaurantRepo.find({
      where: { status: 'active' },
      select: { id: true },
    });
    return allActive.map((r) => r.id);
  }

  private async dispatchNotification(
    notif: PlatformNotificationEntity,
  ): Promise<void> {
    const restaurantIds = await this.resolveTargetRestaurantIds(
      notif.targetRestaurantIds ?? [],
    );
    if (restaurantIds.length === 0) return;

    const sentIso = (notif.sentAt ?? notif.createdAt ?? new Date()).toISOString();
    this.ordersGateway.emitPlatformNotification(restaurantIds, {
      id: notif.id,
      title: notif.title,
      message: notif.message,
      level: notif.level || 'info',
      targetApps: Array.isArray(notif.targetApps)
        ? notif.targetApps
        : ['merchant', 'boss'],
      targetRestaurantIds: Array.isArray(notif.targetRestaurantIds)
        ? notif.targetRestaurantIds
        : [],
      sentAt: sentIso,
      createdAt: (notif.createdAt ?? new Date()).toISOString(),
    });
  }

  private formatNotification(
    n: PlatformNotificationEntity,
    restById: Map<string, { id: string; name: string; slug: string }>,
  ) {
    const targetIds = Array.isArray(n.targetRestaurantIds)
      ? n.targetRestaurantIds
      : [];
    const targetRestaurants = targetIds
      .map((id) => restById.get(id))
      .filter(
        (r): r is { id: string; name: string; slug: string } => Boolean(r),
      );
    return {
      id: n.id,
      title: n.title,
      message: n.message,
      level: n.level,
      targetApps: Array.isArray(n.targetApps)
        ? n.targetApps
        : ['merchant', 'boss'],
      targetRestaurantIds: targetIds,
      targetRestaurants,
      isAllRestaurants: targetIds.length === 0,
      scheduledAt: n.scheduledAt ? n.scheduledAt.toISOString() : null,
      sentAt: n.sentAt ? n.sentAt.toISOString() : null,
      status: n.status,
      createdBy: n.createdBy,
      createdAt: (n.createdAt ?? new Date()).toISOString(),
    };
  }

  private async formatSingleNotification(n: PlatformNotificationEntity) {
    const targetIds = Array.isArray(n.targetRestaurantIds)
      ? n.targetRestaurantIds
      : [];
    const restaurants =
      targetIds.length > 0
        ? await this.restaurantRepo.find({
            where: { id: In(targetIds) },
            select: { id: true, name: true, slug: true },
          })
        : [];
    const restById = new Map(
      restaurants.map((r) => [r.id, { id: r.id, name: r.name, slug: r.slug }]),
    );
    return this.formatNotification(n, restById);
  }

  async listAll() {
    const notifications = await this.notifRepo.find({
      order: { createdAt: 'DESC' },
      take: 200,
    });
    const referencedRestIds = Array.from(
      new Set(
        notifications.flatMap((n) =>
          Array.isArray(n.targetRestaurantIds) ? n.targetRestaurantIds : [],
        ),
      ),
    );
    const restaurants =
      referencedRestIds.length > 0
        ? await this.restaurantRepo.find({
            where: { id: In(referencedRestIds) },
            select: { id: true, name: true, slug: true },
          })
        : [];

    const restById = new Map(
      restaurants.map((r) => [r.id, { id: r.id, name: r.name, slug: r.slug }]),
    );

    return notifications.map((n) => this.formatNotification(n, restById));
  }

  async create(
    dto: CreatePlatformNotificationInput,
    createdBy = 'Platform Admin',
  ) {
    const title = (dto.title ?? '').trim();
    const message = (dto.message ?? '').trim();
    if (!title) {
      throw new BadRequestException('Bildirim başlığı zorunludur.');
    }
    if (!message) {
      throw new BadRequestException('Bildirim içeriği zorunludur.');
    }

    const level: PlatformNotificationLevel =
      dto.level && VALID_LEVELS.has(dto.level) ? dto.level : 'info';

    const rawApps = Array.isArray(dto.targetApps)
      ? dto.targetApps.filter((a): a is PlatformNotificationTargetApp =>
          VALID_APPS.has(a),
        )
      : [];
    const targetApps: PlatformNotificationTargetApp[] =
      rawApps.length > 0 ? Array.from(new Set(rawApps)) : ['merchant', 'boss'];

    const targetRestaurantIds = Array.isArray(dto.targetRestaurantIds)
      ? Array.from(
          new Set(
            dto.targetRestaurantIds
              .filter((id): id is string => typeof id === 'string')
              .map((id) => id.trim())
              .filter(Boolean),
          ),
        )
      : [];

    if (targetRestaurantIds.length > 0) {
      const existing = await this.restaurantRepo.find({
        where: { id: In(targetRestaurantIds) },
        select: { id: true },
      });
      if (existing.length === 0) {
        throw new BadRequestException('Seçilen mekan(lar) bulunamadı.');
      }
    }

    let scheduledDate: Date | null = null;
    if (dto.scheduledAt && dto.scheduledAt.trim()) {
      const parsed = new Date(dto.scheduledAt.trim());
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('Geçersiz zamanlama tarihi.');
      }
      scheduledDate = parsed;
    }

    const now = new Date();
    const isFutureSchedule =
      scheduledDate !== null && scheduledDate.getTime() > now.getTime() + 5_000;

    const entity = this.notifRepo.create({
      title: title.slice(0, 200),
      message,
      level,
      targetApps,
      targetRestaurantIds,
      scheduledAt: isFutureSchedule ? scheduledDate : null,
      sentAt: isFutureSchedule ? null : now,
      status: isFutureSchedule ? 'scheduled' : 'sent',
      createdBy: createdBy || 'Platform Admin',
    });

    const saved = await this.notifRepo.save(entity);
    if (!isFutureSchedule) {
      await this.dispatchNotification(saved);
    }

    return this.formatSingleNotification(saved);
  }

  async sendNow(id: string) {
    const entity = await this.notifRepo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException('Bildirim kaydı bulunamadı.');
    }
    entity.status = 'sent';
    entity.sentAt = new Date();
    const saved = await this.notifRepo.save(entity);
    await this.dispatchNotification(saved);

    return this.formatSingleNotification(saved);
  }

  async remove(id: string) {
    const entity = await this.notifRepo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException('Bildirim kaydı bulunamadı.');
    }
    await this.notifRepo.remove(entity);
    return { ok: true, id };
  }
}

