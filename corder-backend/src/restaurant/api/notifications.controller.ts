import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { WaiterCallEntity } from '../domain/waiter-call.entity';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';
import { OrdersGateway } from './orders.gateway';

@Controller('restaurant/notifications')
@UseGuards(RestaurantJwtGuard)
export class NotificationsController {
  constructor(
    @InjectRepository(RestaurantEntity)
    private readonly restaurantRepo: Repository<RestaurantEntity>,
    @InjectRepository(WaiterCallEntity)
    private readonly waiterCallRepo: Repository<WaiterCallEntity>,
    private readonly ordersGateway: OrdersGateway,
  ) {}

  private assertNotPrintAgent(user?: { role?: string }): void {
    if (!user || user.role === 'print_agent') {
      throw new ForbiddenException('Unauthorized notification access');
    }
  }

  @Get()
  async getState(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user?: { role?: string },
  ) {
    this.assertNotPrintAgent(user);
    const restaurant = await this.restaurantRepo.findOne({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    const since =
      restaurant.notificationsClearedAt ??
      new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dismissedSet = new Set(restaurant.dismissedNotificationIds ?? []);

    const calls = await this.waiterCallRepo.find({
      where: {
        restaurantId,
        acknowledged: false,
        createdAt: MoreThanOrEqual(since),
      },
      order: { createdAt: 'DESC' },
      take: 50,
    });

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

    return {
      clearedAt: restaurant.notificationsClearedAt
        ? restaurant.notificationsClearedAt.toISOString()
        : null,
      dismissedIds: Array.isArray(restaurant.dismissedNotificationIds)
        ? restaurant.dismissedNotificationIds
        : [],
      waiterCalls,
    };
  }

  @Post('dismiss')
  async dismiss(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { role?: string },
    @Body() body: { ids?: string[] },
  ) {
    this.assertNotPrintAgent(user);
    const restaurant = await this.restaurantRepo.findOne({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    const incomingIds = Array.isArray(body?.ids)
      ? body.ids
          .filter((id): id is string => typeof id === 'string')
          .map((id) => id.trim())
          .filter(Boolean)
      : [];

    const existing = Array.isArray(restaurant.dismissedNotificationIds)
      ? restaurant.dismissedNotificationIds
      : [];
    const merged = Array.from(new Set([...existing, ...incomingIds])).slice(-500);
    restaurant.dismissedNotificationIds = merged;
    await this.restaurantRepo.save(restaurant);

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
      clearedAt: restaurant.notificationsClearedAt
        ? restaurant.notificationsClearedAt.toISOString()
        : null,
      dismissedIds: merged,
    };
  }

  @Delete()
  async clearAll(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { role?: string },
  ) {
    this.assertNotPrintAgent(user);
    const restaurant = await this.restaurantRepo.findOne({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    const now = new Date();
    restaurant.notificationsClearedAt = now;
    restaurant.dismissedNotificationIds = [];
    await Promise.all([
      this.restaurantRepo.save(restaurant),
      this.waiterCallRepo.update(
        { restaurantId, acknowledged: false },
        { acknowledged: true },
      ),
    ]);

    this.ordersGateway.emitNotificationsUpdated(restaurantId);
    return {
      ok: true,
      clearedAt: now.toISOString(),
      dismissedIds: [],
      waiterCalls: [],
    };
  }
}
