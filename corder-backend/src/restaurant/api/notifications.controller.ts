import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { PlatformNotificationEntity } from '../../platform/domain/platform-notification.entity';
import { WaiterCallEntity } from '../domain/waiter-call.entity';
import { computeIstanbulDateBoundaries } from '../domain/services/boss-overview.policy';
import { StaffSessionService } from '../application/staff-session.service';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';
import { DismissNotificationsDto } from './dto/dismiss-notifications.dto';
import { OrdersGateway } from './orders.gateway';

@Controller('restaurant/notifications')
@UseGuards(RestaurantJwtGuard)
export class NotificationsController {
  constructor(
    @InjectRepository(RestaurantEntity)
    private readonly restaurantRepo: Repository<RestaurantEntity>,
    @InjectRepository(WaiterCallEntity)
    private readonly waiterCallRepo: Repository<WaiterCallEntity>,
    @InjectRepository(PlatformNotificationEntity)
    private readonly platformNotifRepo: Repository<PlatformNotificationEntity>,
    private readonly ordersGateway: OrdersGateway,
    private readonly staffSession?: StaffSessionService,
  ) {}

  private async assertAuthorizedActor(
    restaurantId: string,
    user?: { role?: string },
    req?: Request,
  ): Promise<void> {
    if (!user || user.role === 'print_agent') {
      throw new ForbiddenException('Unauthorized notification access');
    }
    if (user.role === 'terminal') {
      if (!this.staffSession || !req) {
        throw new UnauthorizedException('Staff PIN verification is required');
      }
      await this.staffSession.requireFromRequest(req, restaurantId);
    }
  }

  private async queryPlatformNotifications(
    restaurantId: string,
    role: string | undefined,
    platformSince: Date,
  ): Promise<PlatformNotificationEntity[]> {
    if (role === 'terminal') {
      return [];
    }
    const targetApps = role === 'staff' ? ['merchant'] : ['merchant', 'boss'];
    if (typeof this.platformNotifRepo.createQueryBuilder === 'function') {
      const qb = this.platformNotifRepo
        .createQueryBuilder('pn')
        .where('pn.status = :status', { status: 'sent' })
        .andWhere('pn.sent_at >= :platformSince', { platformSince })
        .andWhere(
          "(pn.target_restaurant_ids = '[]'::jsonb OR pn.target_restaurant_ids @> :targetRestJson::jsonb)",
          { targetRestJson: JSON.stringify([restaurantId]) },
        );
      if (targetApps.length === 1) {
        qb.andWhere(
          "(pn.target_apps = '[]'::jsonb OR pn.target_apps @> :targetAppJson::jsonb)",
          { targetAppJson: JSON.stringify([targetApps[0]]) },
        );
      } else {
        qb.andWhere(
          "(pn.target_apps = '[]'::jsonb OR pn.target_apps @> :merchantAppJson::jsonb OR pn.target_apps @> :bossAppJson::jsonb)",
          {
            merchantAppJson: JSON.stringify(['merchant']),
            bossAppJson: JSON.stringify(['boss']),
          },
        );
      }
      return qb.orderBy('pn.sent_at', 'DESC').take(50).getMany();
    }
    const rows = await this.platformNotifRepo.find({
      where: {
        status: 'sent',
        sentAt: MoreThanOrEqual(platformSince),
      },
      order: { sentAt: 'DESC' },
      take: 50,
    });
    return rows.filter((pn) => {
      const restIds = Array.isArray(pn.targetRestaurantIds)
        ? pn.targetRestaurantIds
        : [];
      if (restIds.length > 0 && !restIds.includes(restaurantId)) return false;
      const apps = Array.isArray(pn.targetApps) ? pn.targetApps : [];
      return apps.length === 0 || apps.some((a) => targetApps.includes(a));
    });
  }

  private async findLatestSystemUpdate(
    restaurantId: string,
    platformSince: Date,
    dismissedSet: Set<string>,
  ) {
    const rows = await this.queryPlatformNotifications(
      restaurantId,
      'root',
      platformSince,
    );
    const match = rows.find((pn) => {
      if (pn.level !== 'system_update') return false;
      if (
        dismissedSet.has(pn.id) ||
        dismissedSet.has(`platform:${pn.id}`) ||
        dismissedSet.has(`platform-notif-${pn.id}`)
      ) {
        return false;
      }
      const targets = Array.isArray(pn.targetRestaurantIds)
        ? pn.targetRestaurantIds
        : [];
      return targets.length === 0 || targets.includes(restaurantId);
    });
    if (!match) return null;
    return {
      id: match.id,
      title: match.title,
      message: match.message,
      level: 'system_update',
      targetApps: Array.isArray(match.targetApps)
        ? match.targetApps
        : ['merchant', 'boss', 'terminal'],
      sentAt: (match.sentAt ?? match.createdAt).toISOString(),
      createdAt: match.createdAt.toISOString(),
    };
  }

  @Get('system-update')
  async getSystemUpdate(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user?: { role?: string },
  ) {
    if (!user || user.role === 'print_agent') {
      throw new ForbiddenException('Unauthorized notification access');
    }
    const restaurant = await this.restaurantRepo.findOne({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }
    const platformSince =
      restaurant.notificationsClearedAt ??
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dismissedSet = new Set(restaurant.dismissedNotificationIds ?? []);
    const latestSystemUpdate = await this.findLatestSystemUpdate(
      restaurantId,
      platformSince,
      dismissedSet,
    );
    return { latestSystemUpdate };
  }

  @Get()
  async getState(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user?: { role?: string },
    @Req() req?: Request,
  ) {
    await this.assertAuthorizedActor(restaurantId, user, req);
    const restaurant = await this.restaurantRepo.findOne({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    const { startOfToday } = computeIstanbulDateBoundaries(new Date());
    const since = restaurant.notificationsClearedAt ?? startOfToday;
    const dismissedSet = new Set(restaurant.dismissedNotificationIds ?? []);

    const platformSince =
      restaurant.notificationsClearedAt ??
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [calls, sentPlatformNotifs, terminalSystemUpdate] = await Promise.all([
      this.waiterCallRepo.find({
        where: {
          restaurantId,
          acknowledged: false,
          createdAt: MoreThanOrEqual(since),
        },
        order: { createdAt: 'DESC' },
        take: 50,
      }),
      this.queryPlatformNotifications(restaurantId, user?.role, platformSince),
      user?.role === 'terminal'
        ? this.findLatestSystemUpdate(restaurantId, platformSince, dismissedSet)
        : Promise.resolve(null),
    ]);

    const waiterCalls = calls
      .filter(
        (c) =>
          !dismissedSet.has(c.id) &&
          !dismissedSet.has(`waiter:${c.id}`) &&
          !dismissedSet.has(`waiter-call:${c.id}`),
      )
      .map((c) => ({
        id: c.id,
        restaurantId: c.restaurantId,
        tableId: c.tableId,
        tableName: c.tableName,
        sectionName: c.sectionName,
        requestType: c.requestType,
        note: c.note,
        acknowledged: c.acknowledged,
        createdAt: c.createdAt.toISOString(),
      }));

    const platformNotifications = sentPlatformNotifs
      .filter((pn) => {
        if (
          dismissedSet.has(pn.id) ||
          dismissedSet.has(`platform:${pn.id}`) ||
          dismissedSet.has(`platform-notif-${pn.id}`)
        ) {
          return false;
        }
        const targets = Array.isArray(pn.targetRestaurantIds)
          ? pn.targetRestaurantIds
          : [];
        return targets.length === 0 || targets.includes(restaurantId);
      })
      .map((pn) => ({
        id: pn.id,
        title: pn.title,
        message: pn.message,
        level: pn.level || 'info',
        targetApps: Array.isArray(pn.targetApps)
          ? pn.targetApps
          : ['merchant', 'boss'],
        sentAt: (pn.sentAt ?? pn.createdAt).toISOString(),
        createdAt: pn.createdAt.toISOString(),
      }));

    const latestSystemUpdate =
      platformNotifications.find((pn) => pn.level === 'system_update') ??
      terminalSystemUpdate ??
      null;

    return {
      clearedAt: restaurant.notificationsClearedAt
        ? restaurant.notificationsClearedAt.toISOString()
        : null,
      dismissedIds: Array.isArray(restaurant.dismissedNotificationIds)
        ? restaurant.dismissedNotificationIds
        : [],
      waiterCalls,
      platformNotifications,
      latestSystemUpdate,
    };
  }

  @Post('dismiss')
  async dismiss(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { role?: string },
    @Body() body: DismissNotificationsDto,
    @Req() req?: Request,
  ) {
    await this.assertAuthorizedActor(restaurantId, user, req);
    const incomingIds = Array.isArray(body?.ids)
      ? Array.from(
          new Set(
            body.ids
              .filter((id): id is string => typeof id === 'string')
              .map((id) => id.trim())
              .filter(Boolean),
          ),
        )
      : [];

    let clearedAt: Date | null = null;
    let merged: string[] = [];

    if (typeof this.restaurantRepo.query === 'function') {
      const rows = (await this.restaurantRepo.query(
        `UPDATE restaurants
         SET dismissed_notification_ids = COALESCE(
           (
             SELECT jsonb_agg(elem ORDER BY ord)
             FROM (
               SELECT elem, MIN(ord) AS ord
               FROM jsonb_array_elements_text(
                 COALESCE(dismissed_notification_ids, '[]'::jsonb) || $2::jsonb
               ) WITH ORDINALITY AS t(elem, ord)
               GROUP BY elem
               ORDER BY MIN(ord) DESC
               LIMIT 500
             ) sub
           ),
           '[]'::jsonb
         )
         WHERE id = $1
         RETURNING notifications_cleared_at AS "notificationsClearedAt",
                   dismissed_notification_ids AS "dismissedNotificationIds"`,
        [restaurantId, JSON.stringify(incomingIds)],
      )) as Array<{
        notificationsClearedAt?: Date | string | null;
        dismissedNotificationIds?: string[] | null;
      }>;
      const updated = Array.isArray(rows) ? rows[0] : undefined;
      if (!updated) {
        throw new NotFoundException('Restaurant not found');
      }
      clearedAt = updated.notificationsClearedAt
        ? new Date(updated.notificationsClearedAt)
        : null;
      merged = Array.isArray(updated.dismissedNotificationIds)
        ? updated.dismissedNotificationIds
        : [];
    } else {
      const restaurant = await this.restaurantRepo.findOne({
        where: { id: restaurantId },
        select: ['id', 'notificationsClearedAt', 'dismissedNotificationIds'],
      });
      if (!restaurant) {
        throw new NotFoundException('Restaurant not found');
      }
      const existing = Array.isArray(restaurant.dismissedNotificationIds)
        ? restaurant.dismissedNotificationIds
        : [];
      merged = Array.from(new Set([...existing, ...incomingIds])).slice(-500);
      clearedAt = restaurant.notificationsClearedAt ?? null;
      if (typeof this.restaurantRepo.update === 'function') {
        await this.restaurantRepo.update(
          { id: restaurantId },
          { dismissedNotificationIds: merged },
        );
      }
    }

    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const candidateCallIds = incomingIds
      .map((raw) => raw.replace(/^(waiter-call:|waiter:)/i, '').trim())
      .filter((id) => uuidRe.test(id));
    if (candidateCallIds.length > 0) {
      await this.waiterCallRepo.update(
        { restaurantId, id: In(candidateCallIds) },
        { acknowledged: true },
      );
    }

    this.ordersGateway.emitNotificationsUpdated(restaurantId);
    return {
      ok: true,
      clearedAt: clearedAt ? clearedAt.toISOString() : null,
      dismissedIds: merged,
    };
  }

  @Delete()
  async clearAll(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { role?: string },
  ) {
    if (!user || user.role === 'print_agent') {
      throw new ForbiddenException('Unauthorized notification access');
    }
    if (user.role === 'terminal') {
      throw new ForbiddenException(
        'Branch-wide notification clearing is restricted to Merchant Panel and Boss users',
      );
    }

    const now = new Date();
    if (typeof this.restaurantRepo.query === 'function') {
      const rows = (await this.restaurantRepo.query(
        `UPDATE restaurants SET notifications_cleared_at = $1, dismissed_notification_ids = '[]'::jsonb WHERE id = $2 RETURNING id`,
        [now, restaurantId],
      )) as Array<{ id: string }>;
      if (!Array.isArray(rows) || rows.length === 0) {
        throw new NotFoundException('Restaurant not found');
      }
      await this.waiterCallRepo.update(
        { restaurantId, acknowledged: false },
        { acknowledged: true },
      );
    } else {
      const restaurant = await this.restaurantRepo.findOne({
        where: { id: restaurantId },
        select: ['id'],
      });
      if (!restaurant) {
        throw new NotFoundException('Restaurant not found');
      }
      await Promise.all([
        typeof this.restaurantRepo.update === 'function'
          ? this.restaurantRepo.update(
              { id: restaurantId },
              {
                notificationsClearedAt: now,
                dismissedNotificationIds: [],
              },
            )
          : Promise.resolve(),
        this.waiterCallRepo.update(
          { restaurantId, acknowledged: false },
          { acknowledged: true },
        ),
      ]);
    }

    this.ordersGateway.emitNotificationsUpdated(restaurantId);
    return {
      ok: true,
      clearedAt: now.toISOString(),
      dismissedIds: [],
      waiterCalls: [],
    };
  }
}
