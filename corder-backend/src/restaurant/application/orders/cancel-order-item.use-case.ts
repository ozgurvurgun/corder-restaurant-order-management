import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly itemRepo: Repository<OrderItemEntity>,
    @InjectRepository(TableEntity)
    private readonly tableRepo: Repository<TableEntity>,
    @InjectRepository(RestaurantStaffEntity)
    private readonly staffRepo: Repository<RestaurantStaffEntity>,
    @InjectRepository(PrintJobEntity)
    private readonly printJobRepo: Repository<PrintJobEntity>,
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
    const item = await this.itemRepo.findOne({
      where: { id: itemId },
      relations: ['order'],
    });
    if (!item?.order) throw new NotFoundException('Order item not found');
    const order = item.order;
    if (order.restaurantId !== restaurantId) {
      throw new BadRequestException('Invalid restaurant');
    }
    if (order.status !== 'active') {
      throw new BadRequestException('Order is not active');
    }
    const table = await this.tableRepo.findOne({
      where: { id: order.tableId, restaurantId },
    });
    if (!table) throw new NotFoundException('Table not found');
    if (table.status === 'checkout') {
      throw new BadRequestException('Cannot cancel an order item while table is in checkout');
    }

    item.cancel(reason, cancelledByName);
    await this.itemRepo.save(item);
    await this.orderRepo.update(
      { id: order.id, restaurantId },
      { updatedAt: new Date() },
    );
    this.ordersGateway.emitOrdersUpdated(restaurantId);

    await this.enqueueKitchenCancelTicket(restaurantId, order, table, item);
    return { ok: true };
  }

  private async enqueueKitchenCancelTicket(
    restaurantId: string,
    order: OrderEntity,
    table: TableEntity,
    item: OrderItemEntity,
  ): Promise<void> {
    const cancelJobId = randomUUID();
    const createdAt = new Date().toISOString();
    const waiter = order.userId
      ? await this.staffRepo.findOne({ where: { id: order.userId, restaurantId } })
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
    await this.printJobRepo.save(
      this.printJobRepo.create({
        id: cancelJobId,
        restaurantId,
        printType: 'kitchen_cancel',
        payload: cancelPayload as unknown as Record<string, unknown>,
        printedAt: null,
      }),
    );
    this.ordersGateway.emitPrintJob(restaurantId, cancelPayload);
  }
}
