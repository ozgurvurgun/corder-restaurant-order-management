import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OrderEntity } from '../../domain/order.entity';
import { OrderItemEntity } from '../../domain/order-item.entity';
import { TableEntity } from '../../domain/table.entity';
import { RestaurantStaffEntity } from '../../domain/restaurant-staff.entity';
import { OrderStatusPolicy } from '../../domain/services/order-status.policy';
import { OrdersGateway } from '../../api/orders.gateway';
import { CashShiftService } from '../cash-shift.service';
import { TableService } from '../table.service';
import { OrderQueryService } from './order-query.service';

export interface MoveItemsToTableInput {
  fromTableId: string;
  toTableId: string;
  itemIds: string[];
  userId?: string | null;
  actorDisplayName?: string | null;
}

@Injectable()
export class TransferOrderUseCase {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly itemRepo: Repository<OrderItemEntity>,
    @InjectRepository(TableEntity)
    private readonly tableRepo: Repository<TableEntity>,
    @InjectRepository(RestaurantStaffEntity)
    private readonly staffRepo: Repository<RestaurantStaffEntity>,
    private readonly ordersGateway: OrdersGateway,
    private readonly cashShiftService: CashShiftService,
    private readonly tableService: TableService,
    private readonly orderQuery: OrderQueryService,
  ) {}

  async moveTable(
    restaurantId: string,
    fromTableId: string,
    toTableId: string,
  ): Promise<{ moved: number }> {
    if (fromTableId === toTableId) return { moved: 0 };
    const [fromTable, toTable] = await Promise.all([
      this.tableRepo.findOne({ where: { id: fromTableId, restaurantId } }),
      this.tableRepo.findOne({ where: { id: toTableId, restaurantId } }),
    ]);
    if (!fromTable || !toTable) {
      throw new NotFoundException('Table not found');
    }
    if (fromTable.status === 'checkout' || toTable.status === 'checkout') {
      throw new BadRequestException('Cannot transfer a table that is in checkout');
    }
    this.tableService.assertTableFreeForMergeOrMove(toTable);
    const result = await this.orderRepo.update(
      { restaurantId, tableId: fromTableId, status: 'active' },
      { tableId: toTableId },
    );
    const moved = result.affected ?? 0;
    if (moved > 0) {
      fromTable.releaseSession();
      await this.tableRepo.save(fromTable);
      void this.ordersGateway.emitTableSessionPresence(restaurantId).catch(() => undefined);
      this.ordersGateway.emitOrdersMoved(restaurantId, { fromTableId, toTableId });
      this.ordersGateway.emitOrdersUpdated(restaurantId);
    }
    return { moved };
  }

  async moveItemsToTable(
    restaurantId: string,
    dto: MoveItemsToTableInput,
  ): Promise<Record<string, unknown>> {
    const { fromTableId, toTableId, itemIds } = dto;
    const uniqueIds = [...new Set(itemIds)];
    if (fromTableId === toTableId) {
      throw new BadRequestException('Cannot move items to the same table');
    }
    await this.cashShiftService.requireCurrent(restaurantId);

    const items = await this.itemRepo.find({
      where: { id: In(uniqueIds) },
      relations: ['order'],
    });
    if (items.length !== uniqueIds.length) {
      throw new BadRequestException('One or more order items were not found');
    }
    for (const item of items) {
      OrderStatusPolicy.assertItemTransferable(item, restaurantId, fromTableId);
    }

    const [fromTable, toTable] = await Promise.all([
      this.tableRepo.findOne({ where: { id: fromTableId, restaurantId } }),
      this.tableRepo.findOne({ where: { id: toTableId, restaurantId } }),
    ]);
    if (!fromTable || !toTable) {
      throw new NotFoundException('Table not found');
    }
    if (fromTable.status === 'checkout' || toTable.status === 'checkout') {
      throw new BadRequestException('Cannot move items from or to a table in checkout');
    }
    this.tableService.assertStaffMayUseTable(fromTable, dto.userId ?? null);
    this.tableService.assertStaffMayUseTable(toTable, dto.userId ?? null);

    const fromTableLabel = (fromTable.name ?? '').trim() || fromTableId;
    const firstOrderUserId = items[0].order?.userId ?? null;
    const newUserId = (dto.userId ?? firstOrderUserId)?.trim() || null;
    const moverName =
      (dto.actorDisplayName ?? '').trim() ||
      (newUserId
        ? (await this.staffRepo.findOne({ where: { id: newUserId, restaurantId } }))?.name?.trim() ||
          null
        : null);

    const newOrderId = await this.orderRepo.manager.transaction(async (em) => {
      for (const id of uniqueIds) {
        await em.delete(OrderItemEntity, { id });
      }
      const affectedOrderIds = [...new Set(items.map((i) => i.orderId))];
      for (const oid of affectedOrderIds) {
        const remaining = await em.count(OrderItemEntity, { where: { orderId: oid } });
        if (remaining === 0) {
          await em.delete(OrderEntity, { id: oid });
        }
      }
      const order = em.create(OrderEntity, {
        restaurantId,
        tableId: toTableId,
        userId: newUserId,
        userDisplayName: moverName,
        status: 'active',
        mergedFrom: fromTableLabel,
        kitchenTicketPrintedAt: new Date(),
      });
      const savedOrder = await em.save(order);
      const newRows = items.map((src) =>
        em.create(OrderItemEntity, {
          orderId: savedOrder.id,
          productId: src.productId,
          productName: src.productName,
          price: src.price,
          quantity: src.quantity,
          note: src.note ?? undefined,
          status: 'sent',
        }),
      );
      await em.save(newRows);
      return savedOrder.id;
    });

    const serialized = await this.orderQuery.serializeOrderEntityById(newOrderId, restaurantId);
    this.ordersGateway.emitOrdersUpdated(restaurantId);
    return serialized;
  }
}
