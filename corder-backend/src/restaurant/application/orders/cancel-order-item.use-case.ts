import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { OrderEntity } from '../../domain/order.entity';
import { OrderItemEntity } from '../../domain/order-item.entity';
import { TableEntity } from '../../domain/table.entity';
import { RestaurantStaffEntity } from '../../domain/restaurant-staff.entity';
import { PrintJobEntity } from '../../domain/print-job.entity';
import { OrdersGateway } from '../../api/orders.gateway';
import { CashShiftService } from '../cash-shift.service';
import { OrderQueryService } from './order-query.service';

@Injectable()
export class CancelOrderItemUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly ordersGateway: OrdersGateway,
    private readonly cashShiftService: CashShiftService,
    private readonly orderQuery: OrderQueryService,
  ) {}

  async execute(
    restaurantId: string,
    itemId: string,
    reason?: string,
    cancelledByName?: string,
  ): Promise<{ ok: true }> {
    await this.cashShiftService.requireCurrent(restaurantId);

    const cancelPayload = await this.dataSource.transaction(async (em) => {
      const item = await em.findOne(OrderItemEntity, {
        where: { id: itemId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!item) throw new NotFoundException('Order item not found');

      const order = await em.findOne(OrderEntity, {
        where: { id: item.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.restaurantId !== restaurantId) {
        throw new BadRequestException('Invalid restaurant');
      }
      if (order.status !== 'active') {
        throw new BadRequestException('Order is not active');
      }

      const table = await em.findOne(TableEntity, {
        where: { id: order.tableId, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!table) throw new NotFoundException('Table not found');
      if (table.status === 'checkout') {
        throw new BadRequestException('Cannot cancel an order item while table is in checkout');
      }

      item.cancel(reason, cancelledByName);
      await em.save(OrderItemEntity, item);
      await em.update(OrderEntity, { id: order.id, restaurantId }, { updatedAt: new Date() });

      return this.persistKitchenCancelTicket(em, restaurantId, order, table, item);
    });

    this.ordersGateway.emitOrdersUpdated(restaurantId);
    this.ordersGateway.emitPrintJob(restaurantId, cancelPayload);
    return { ok: true };
  }

  private async persistKitchenCancelTicket(
    em: EntityManager,
    restaurantId: string,
    order: OrderEntity,
    table: TableEntity,
    item: OrderItemEntity,
  ) {
    const cancelJobId = randomUUID();
    const createdAt = new Date().toISOString();
    const waiter = order.userId
      ? await em.findOne(RestaurantStaffEntity, { where: { id: order.userId, restaurantId } })
      : null;
    const waiterName =
      (order.userDisplayName && order.userDisplayName.trim()) || waiter?.name?.trim() || '-';
    const printItems = [
      {
        productName: item.productName,
        quantity: item.quantity,
        price: Number(item.price),
        note: item.note ?? undefined,
        productId: item.productId,
      },
    ];
    await this.orderQuery.attachCategoryIdsToItems(printItems, restaurantId);
    const cancelPayload = {
      type: 'order.print_job' as const,
      jobId: cancelJobId,
      restaurantId,
      printType: 'kitchen_cancel' as const,
      createdAt,
      includeLineNotes: true,
      order: {
        tableName: (table.name ?? '').trim() || '-',
        waiterName,
        cancelledBy: item.cancelledBy ?? '-',
        cancelReason: item.cancelReason ?? '-',
        items: printItems,
        total: Number(item.price) * item.quantity,
      },
    };
    await em.save(
      PrintJobEntity,
      em.create(PrintJobEntity, {
        id: cancelJobId,
        restaurantId,
        printType: 'kitchen_cancel',
        payload: cancelPayload as unknown as Record<string, unknown>,
        printedAt: null,
      }),
    );
    return cancelPayload;
  }
}
