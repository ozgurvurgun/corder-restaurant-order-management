import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThanOrEqual, Repository } from 'typeorm';
import { OrderEntity } from '../../domain/order.entity';
import { RestaurantStaffEntity } from '../../domain/restaurant-staff.entity';
import { RootAdminEntity } from '../../../platform/domain/root-admin.entity';
import { ProductEntity } from '../../domain/product.entity';
import { PrintJobEntity } from '../../domain/print-job.entity';
import { OrderStatusPolicy } from '../../domain/services/order-status.policy';
import { serializeOrder } from './order.mapper';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class OrderQueryService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(RestaurantStaffEntity)
    private readonly staffRepo: Repository<RestaurantStaffEntity>,
    @InjectRepository(RootAdminEntity)
    private readonly rootAdminRepo: Repository<RootAdminEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(PrintJobEntity)
    private readonly printJobRepo: Repository<PrintJobEntity>,
  ) {}

  async attachCategoryIdsToItems(
    items: Array<{ productId?: string; categoryId?: string }>,
    restaurantId: string,
  ): Promise<void> {
    const ids = [
      ...new Set(
        items
          .map((i) => (typeof i.productId === 'string' ? i.productId.trim() : ''))
          .filter((id) => UUID_RE.test(id)),
      ),
    ];
    if (!ids.length) return;
    const products = await this.productRepo.find({
      where: { id: In(ids) },
      relations: ['category'],
    });
    const categoryByProductId = new Map<string, string>();
    for (const p of products) {
      if (p.category?.restaurantId === restaurantId) {
        categoryByProductId.set(p.id, p.categoryId);
      }
    }
    for (const item of items) {
      const pid = typeof item.productId === 'string' ? item.productId.trim() : '';
      if (pid && categoryByProductId.has(pid)) {
        item.categoryId = categoryByProductId.get(pid);
      }
    }
  }

  async buildStaffNameMap(
    restaurantId: string,
    userIds: (string | null | undefined)[],
  ): Promise<Map<string, string>> {
    const ids = [
      ...new Set(
        userIds
          .map((x) => (typeof x === 'string' ? x.trim() : ''))
          .filter((x): x is string => UUID_RE.test(x)),
      ),
    ];
    if (!ids.length) return new Map();
    const [staffRows, bossRows] = await Promise.all([
      this.staffRepo.find({
        where: { restaurantId, id: In(ids) },
        select: ['id', 'name'],
      }),
      this.rootAdminRepo.find({
        where: { id: In(ids) },
        select: ['id', 'name'],
      }),
    ]);
    const map = new Map<string, string>();
    for (const boss of bossRows) {
      const name = (boss.name ?? '').trim();
      if (name) map.set(boss.id, name);
    }
    for (const staff of staffRows) {
      const name = (staff.name ?? '').trim();
      if (name) map.set(staff.id, name);
    }
    return map;
  }

  async loadActiveOrdersEntities(
    restaurantId: string,
    tableId?: string,
  ): Promise<OrderEntity[]> {
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .where('o.restaurant_id = :restaurantId', { restaurantId })
      .andWhere('o.status = :status', { status: 'active' })
      .orderBy('o.created_at', 'DESC');
    if (tableId) qb.andWhere('o.table_id = :tableId', { tableId });
    return qb.getMany();
  }

  async loadOrderEntity(id: string, restaurantId: string): Promise<OrderEntity | null> {
    return this.orderRepo.findOne({
      where: { id, restaurantId },
      relations: ['items'],
    });
  }

  async serializeOrderEntityById(
    id: string,
    restaurantId: string,
  ): Promise<Record<string, unknown>> {
    const order = await this.loadOrderEntity(id, restaurantId);
    if (!order) throw new NotFoundException('Order not found');
    const nameMap = await this.buildStaffNameMap(restaurantId, [order.userId]);
    return serializeOrder(order, nameMap);
  }

  async findByRestaurant(
    restaurantId: string,
    tableId?: string,
  ): Promise<Record<string, unknown>[]> {
    const orders = await this.loadActiveOrdersEntities(restaurantId, tableId);
    const nameMap = await this.buildStaffNameMap(
      restaurantId,
      orders.map((o) => o.userId),
    );
    return orders
      .map((o) => serializeOrder(o, nameMap))
      .filter((o) => Array.isArray(o.items) && o.items.length > 0);
  }

  async findOne(id: string, restaurantId: string): Promise<Record<string, unknown>> {
    return this.serializeOrderEntityById(id, restaurantId);
  }

  async findPendingKitchenOrdersForPrintAgent(
    restaurantId: string,
  ): Promise<Record<string, unknown>[]> {
    const nowMs = Date.now();
    const cutoff = new Date(nowMs - 24 * 60 * 60 * 1000);
    const closedOrderMaxAgeMs = 15 * 60 * 1000;
    const orders = await this.orderRepo.find({
      where: {
        restaurantId,
        status: In(['active', 'closed']),
        kitchenTicketPrintedAt: IsNull(),
        createdAt: MoreThanOrEqual(cutoff),
      },
      relations: ['items', 'table'],
      order: { createdAt: 'ASC' },
      take: 100,
    });

    if (!orders.length) return [];

    const missingNameUserIds = orders
      .filter((o) => !(o.userDisplayName && o.userDisplayName.trim()))
      .map((o) => o.userId);
    const staffNameMap = await this.buildStaffNameMap(
      restaurantId,
      missingNameUserIds,
    );
    const emptyOrderIdsToMark: string[] = [];
    const allRowItems: Array<{ productId?: string; categoryId?: string }> = [];
    const out: Record<string, unknown>[] = [];
    for (const order of orders) {
      if (
        order.status === 'closed' &&
        nowMs - order.createdAt.getTime() > closedOrderMaxAgeMs
      ) {
        emptyOrderIdsToMark.push(order.id);
        continue;
      }
      const items =
        order.items?.filter((i) => OrderStatusPolicy.isItemPrintableForKitchen(i.status)) ?? [];
      if (!items.length) {
        emptyOrderIdsToMark.push(order.id);
        continue;
      }
      const uid = order.userId?.trim() ?? '';
      const snapshot = { ...order, items };
      const row = {
        ...JSON.parse(JSON.stringify(snapshot)),
        restaurantId,
        tableName: order.table?.name ?? null,
        waiterName:
          (uid ? staffNameMap.get(uid) ?? null : null) ||
          (order.userDisplayName && order.userDisplayName.trim()) ||
          null,
      } as Record<string, unknown>;
      const rowItems = row.items as
        | Array<{ productId?: string } & Record<string, unknown>>
        | undefined;
      if (rowItems?.length) {
        allRowItems.push(...rowItems);
      }
      out.push(row);
    }
    if (emptyOrderIdsToMark.length) {
      await this.orderRepo.update(
        { id: In(emptyOrderIdsToMark), restaurantId },
        { kitchenTicketPrintedAt: new Date() },
      );
    }
    if (allRowItems.length) {
      await this.attachCategoryIdsToItems(allRowItems, restaurantId);
    }
    return out;
  }

  async markKitchenTicketPrinted(
    restaurantId: string,
    orderId: string,
  ): Promise<{ ok: true }> {
    const existing = await this.orderRepo.findOne({
      where: { id: orderId, restaurantId },
      select: { id: true, kitchenTicketPrintedAt: true },
    });
    if (!existing) {
      throw new NotFoundException('Order not found');
    }
    if (!existing.kitchenTicketPrintedAt) {
      await this.orderRepo.update(
        { id: orderId, restaurantId },
        { kitchenTicketPrintedAt: new Date() },
      );
    }
    return { ok: true };
  }

  async findPendingPrintJobsForPrintAgent(
    restaurantId: string,
  ): Promise<Record<string, unknown>[]> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const jobs = await this.printJobRepo.find({
      where: {
        restaurantId,
        printedAt: IsNull(),
        createdAt: MoreThanOrEqual(cutoff),
      },
      order: { createdAt: 'ASC' },
      take: 100,
    });
    return jobs.map((job) => ({
      ...job.payload,
      type: 'order.print_job',
      jobId: job.id,
      restaurantId: job.restaurantId,
      printType: job.printType,
    }));
  }

  async markPrintJobPrinted(restaurantId: string, jobId: string): Promise<{ ok: true }> {
    const existing = await this.printJobRepo.findOne({
      where: { id: jobId, restaurantId },
      select: { id: true, printedAt: true },
    });
    if (!existing) {
      throw new NotFoundException('Print job not found');
    }
    if (!existing.printedAt) {
      await this.printJobRepo.update(
        { id: jobId, restaurantId },
        { printedAt: new Date() },
      );
    }
    return { ok: true };
  }
}
