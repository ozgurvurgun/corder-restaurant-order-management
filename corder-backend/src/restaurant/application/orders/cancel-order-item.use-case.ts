import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { OrderEntity } from '../../domain/order.entity';
import { OrderItemEntity } from '../../domain/order-item.entity';
import { TableEntity } from '../../domain/table.entity';
import { RestaurantStaffEntity } from '../../domain/restaurant-staff.entity';
import { PrintJobEntity } from '../../domain/print-job.entity';
import { OrderStatusPolicy } from '../../domain/services/order-status.policy';
import { OrdersGateway } from '../../api/orders.gateway';
import { CashShiftService } from '../cash-shift.service';
import { TableService } from '../table.service';
import { FraudDetectionService } from '../fraud-detection.service';
import { OrderQueryService } from './order-query.service';
import { fromMinorUnits, toMinorUnits } from '../../../common/money/minor-units';

@Injectable()
export class CancelOrderItemUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly ordersGateway: OrdersGateway,
    private readonly cashShiftService: CashShiftService,
    private readonly tableService: TableService,
    private readonly orderQuery: OrderQueryService,
    @Optional()
    private readonly fraudDetection?: FraudDetectionService,
  ) {}

  async execute(
    restaurantId: string,
    itemId: string,
    reason?: string,
    cancelledByName?: string,
    actorStaffId?: string | null,
    quantity?: number | null,
  ): Promise<{ ok: true }> {
    await this.cashShiftService.requireCurrent(restaurantId);

    const { cancelPayload, tableEmptied } = await this.dataSource.transaction(async (em) => {
      const itemProbe = await em.findOne(OrderItemEntity, {
        where: { id: itemId },
        select: { id: true, orderId: true },
      });
      if (!itemProbe) throw new NotFoundException('Order item not found');

      const orderProbe = await em.findOne(OrderEntity, {
        where: { id: itemProbe.orderId, restaurantId },
        select: { id: true, tableId: true },
      });
      if (!orderProbe) throw new NotFoundException('Order not found');

      const table = await em.findOne(TableEntity, {
        where: { id: orderProbe.tableId, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!table) throw new NotFoundException('Table not found');
      this.tableService.assertStaffMayUseTable(table, actorStaffId);

      const order = await em.findOne(OrderEntity, {
        where: { id: orderProbe.id, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status !== 'active') {
        throw new BadRequestException('Order is not active');
      }

      const item = await em.findOne(OrderItemEntity, {
        where: { id: itemId, orderId: order.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!item) throw new NotFoundException('Order item not found');

      const now = new Date();
      const taken = item.takeQuantity(quantity);
      let cancelledLine: OrderItemEntity;
      if (taken.full) {
        item.cancel(reason, cancelledByName, now);
        cancelledLine = await em.save(OrderItemEntity, item);
      } else {
        // Keep remaining units on the original line; audit the void as its own cancelled row.
        await em.save(OrderItemEntity, item);
        const voidRow = em.create(OrderItemEntity, {
          orderId: order.id,
          productId: item.productId,
          productName: item.productName,
          price: item.price,
          quantity: taken.quantity,
          note: item.note ?? undefined,
          status: 'sent',
        });
        voidRow.cancel(reason, cancelledByName, now);
        cancelledLine = await em.save(OrderItemEntity, voidRow);
      }

      const siblingItems = await em.find(OrderItemEntity, {
        where: { orderId: order.id },
        lock: { mode: 'pessimistic_write' },
      });
      const nextOrderStatus = OrderStatusPolicy.resolveOrderStatus(siblingItems);
      await em.update(
        OrderEntity,
        { id: order.id, restaurantId },
        { status: nextOrderStatus, updatedAt: now },
      );

      let isTableNowEmpty = false;
      if (nextOrderStatus === 'closed') {
        const remainingActiveOrders = await em.find(OrderEntity, {
          where: { restaurantId, tableId: table.id, status: 'active' },
          lock: { mode: 'pessimistic_write' },
        });
        if (remainingActiveOrders.length === 0) {
          table.markEmpty();
          await em.save(TableEntity, table);
          isTableNowEmpty = true;
        } else {
          const remOrderIds = remainingActiveOrders.map((o) => o.id);
          const remItems = await em.find(OrderItemEntity, {
            where: { orderId: In(remOrderIds) },
          });
          const anyBillable = remItems.some((i) =>
            OrderStatusPolicy.isItemOnActiveBill(i.status),
          );
          if (!anyBillable) {
            await em.update(
              OrderEntity,
              { id: In(remOrderIds), restaurantId },
              { status: 'closed', updatedAt: now },
            );
            table.markEmpty();
            await em.save(TableEntity, table);
            isTableNowEmpty = true;
          }
        }
      }

      const payload = await this.persistKitchenCancelTicket(
        em,
        restaurantId,
        order,
        table,
        cancelledLine,
      );
      return { cancelPayload: payload, tableEmptied: isTableNowEmpty };
    });

    if (tableEmptied) {
      void this.ordersGateway.emitTableSessionPresence(restaurantId).catch(() => undefined);
    }
    this.ordersGateway.emitOrdersUpdated(restaurantId);
    this.ordersGateway.emitPrintJob(restaurantId, cancelPayload);
    void this.fraudDetection?.analyzeRestaurantAnomalies(restaurantId).catch(() => undefined);
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
        total: fromMinorUnits(toMinorUnits(item.price) * item.quantity),
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
