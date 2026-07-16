import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { OrderEntity } from '../domain/order.entity';
import { OrderItemEntity } from '../domain/order-item.entity';
import { TableEntity } from '../domain/table.entity';
import { RestaurantStaffEntity } from '../domain/restaurant-staff.entity';
import { ProductEntity } from '../domain/product.entity';
import { CreateOrderDto } from '../api/dto/create-order.dto';
import { PrintReceiptDto } from '../api/dto/print-receipt.dto';
import { OrdersGateway } from '../api/orders.gateway';
import { CashShiftService } from './cash-shift.service';
import { TableService } from './table.service';
import { LedgerService } from './ledger.service';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly itemRepo: Repository<OrderItemEntity>,
    @InjectRepository(TableEntity)
    private readonly tableRepo: Repository<TableEntity>,
    @InjectRepository(RestaurantStaffEntity)
    private readonly staffRepo: Repository<RestaurantStaffEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    private readonly ordersGateway: OrdersGateway,
    private readonly cashShiftService: CashShiftService,
    private readonly tableService: TableService,
    private readonly ledgerService: LedgerService,
  ) {}

  /** Attaches the product category UUID to order items (for print-agent category→printer mapping). */
  private async attachCategoryIdsToItems(
    items: Array<{ productId?: string } & Record<string, unknown>>,
    restaurantId: string,
  ): Promise<void> {
    const ids = [...new Set(items.map((i) => i.productId).filter(Boolean))] as string[];
    if (!ids.length) return;
    const products = await this.productRepo.find({
      where: { id: In(ids) },
      relations: ['category'],
    });
    const map = new Map<string, string>();
    for (const p of products) {
      if (p.category?.restaurantId === restaurantId) {
        map.set(p.id, p.categoryId);
      }
    }
    for (const item of items) {
      const pid = item.productId;
      if (pid && map.has(pid)) {
        item.categoryId = map.get(pid);
      }
    }
  }

  /** Lines counted on receipts / kitchen tickets and table totals (excludes cancelled and ledger-assigned). */
  private itemOnActiveBill(status: string): boolean {
    return status !== 'cancelled' && status !== 'ledger';
  }

  private async staffNameMap(
    restaurantId: string,
    userIds: (string | null | undefined)[],
  ): Promise<Map<string, string>> {
    const ids = [
      ...new Set(
        userIds
          .map((x) => (typeof x === 'string' ? x.trim() : ''))
          .filter((x): x is string => Boolean(x)),
      ),
    ];
    if (!ids.length) return new Map();
    const rows = await this.staffRepo.find({
      where: { restaurantId, id: In(ids) },
      select: ['id', 'name'],
    });
    const m = new Map<string, string>();
    for (const s of rows) {
      const n = (s.name ?? '').trim();
      if (n) m.set(s.id, n);
    }
    return m;
  }

  private serializeOrderEntity(o: OrderEntity, nameMap: Map<string, string>): Record<string, unknown> {
    const uid = o.userId?.trim() ?? null;
    const userName =
      (o.userDisplayName && o.userDisplayName.trim()) || (uid ? nameMap.get(uid) ?? null : null);
    return {
      id: o.id,
      restaurantId: o.restaurantId,
      tableId: o.tableId,
      userId: o.userId,
      userName,
      status: o.status,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      mergedFrom: o.mergedFrom ?? null,
      kitchenTicketPrintedAt: o.kitchenTicketPrintedAt ?? null,
      items: (o.items || []).map((i) => ({
        id: i.id,
        orderId: i.orderId,
        productId: i.productId,
        productName: i.productName,
        price: Number(i.price),
        quantity: i.quantity,
        note: i.note ?? undefined,
        status: i.status,
        createdAt: i.createdAt,
        cancelReason: i.cancelReason ?? undefined,
        cancelledBy: i.cancelledBy ?? undefined,
        cancelledAt: i.cancelledAt?.toISOString(),
      })),
    };
  }

  private async serializeOrderEntities(
    restaurantId: string,
    orders: OrderEntity[],
  ): Promise<Record<string, unknown>[]> {
    const map = await this.staffNameMap(
      restaurantId,
      orders.map((o) => o.userId),
    );
    return orders.map((o) => this.serializeOrderEntity(o, map));
  }

  private async loadActiveOrdersEntities(restaurantId: string, tableId?: string): Promise<OrderEntity[]> {
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .where('o.restaurant_id = :restaurantId', { restaurantId })
      .andWhere('o.status = :status', { status: 'active' })
      .orderBy('o.created_at', 'DESC');
    if (tableId) qb.andWhere('o.table_id = :tableId', { tableId });
    return qb.getMany();
  }

  private async loadOrderEntity(id: string, restaurantId: string): Promise<OrderEntity | null> {
    return this.orderRepo.findOne({
      where: { id, restaurantId },
      relations: ['items'],
    });
  }

  async findByRestaurant(restaurantId: string, tableId?: string): Promise<Record<string, unknown>[]> {
    const orders = await this.loadActiveOrdersEntities(restaurantId, tableId);
    return this.serializeOrderEntities(restaurantId, orders);
  }

  async findOne(id: string, restaurantId: string): Promise<Record<string, unknown>> {
    const o = await this.loadOrderEntity(id, restaurantId);
    if (!o) throw new NotFoundException('Order not found');
    const map = await this.staffNameMap(restaurantId, [o.userId]);
    return this.serializeOrderEntity(o, map);
  }

  async create(restaurantId: string, dto: CreateOrderDto): Promise<Record<string, unknown>> {
    const table = await this.tableRepo.findOne({ where: { id: dto.tableId, restaurantId } });
    if (!table) throw new NotFoundException('Table not found');
    this.tableService.assertStaffMayUseTable(table, dto.userId ?? null);
    await this.cashShiftService.requireCurrent(restaurantId);
    const waiter = dto.userId
      ? await this.staffRepo.findOne({ where: { id: dto.userId, restaurantId } })
      : null;
    const order = this.orderRepo.create({
      restaurantId,
      tableId: dto.tableId,
      userId: dto.userId ?? null,
      userDisplayName: waiter?.name?.trim() ?? null,
      status: 'active',
    });
    const saved = await this.orderRepo.save(order) as OrderEntity;
    const items = dto.items.map((i) =>
      this.itemRepo.create({
        orderId: saved.id,
        productId: i.productId,
        productName: i.productName,
        price: i.price,
        quantity: i.quantity,
        note: i.note,
        status: 'sent',
      }),
    );
    await this.itemRepo.save(items);
    const createdEntity = await this.loadOrderEntity(saved.id, restaurantId);
    if (!createdEntity) throw new NotFoundException('Order not found');
    const map = await this.staffNameMap(restaurantId, [createdEntity.userId]);
    const serialized = this.serializeOrderEntity(createdEntity, map);
    const payload = {
      ...serialized,
      restaurantId,
      tableName: table.name ?? null,
      waiterName: (serialized.userName as string | null) ?? null,
    } as Record<string, unknown>;
    const pItems = payload.items as Array<{ productId?: string } & Record<string, unknown>> | undefined;
    if (pItems?.length) {
      await this.attachCategoryIdsToItems(pItems, restaurantId);
    }
    this.ordersGateway.emitOrderCreated(restaurantId, payload);
    return serialized;
  }

  /** Move all active orders from one table to another (merge/transfer). */
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
      throw new BadRequestException('Hesap kesimindeki masa tasinamaz');
    }
    this.tableService.assertTableFreeForMergeOrMove(toTable);
    const result = await this.orderRepo.update(
      { restaurantId, tableId: fromTableId, status: 'active' },
      { tableId: toTableId },
    );
    const moved = result.affected ?? 0;
    if (moved > 0) {
      await this.tableRepo.update(
        { id: fromTableId, restaurantId },
        { sessionStaffId: null, sessionStaffName: null, sessionLockedAt: null },
      );
      void this.ordersGateway.emitTableSessionPresence(restaurantId).catch(() => undefined);
      this.ordersGateway.emitOrdersMoved(restaurantId, { fromTableId, toTableId });
      this.ordersGateway.emitOrdersUpdated(restaurantId);
    }
    return { moved };
  }

  /**
   * Moves selected order items into a new active check on the target table; source lines are removed.
   * On the new order, `mergedFrom` = source table name (where they were moved from).
   */
  async moveItemsToTable(
    restaurantId: string,
    dto: {
      fromTableId: string;
      toTableId: string;
      itemIds: string[];
      userId?: string | null;
      actorDisplayName?: string | null;
    },
  ): Promise<Record<string, unknown>> {
    const { fromTableId, toTableId, itemIds } = dto;
    const uniqueIds = [...new Set(itemIds)];
    if (fromTableId === toTableId) {
      throw new BadRequestException('Ayni masaya tasinamaz');
    }
    await this.cashShiftService.requireCurrent(restaurantId);

    const items = await this.itemRepo.find({
      where: { id: In(uniqueIds) },
      relations: ['order'],
    });
    if (items.length !== uniqueIds.length) {
      throw new BadRequestException('Bir veya daha fazla kalem bulunamadi');
    }

    for (const it of items) {
      const o = it.order;
      if (!o || o.restaurantId !== restaurantId) {
        throw new BadRequestException('Gecersiz kalem');
      }
      if (o.tableId !== fromTableId || o.status !== 'active') {
        throw new BadRequestException('Kalem bu masada aktif degil');
      }
      if (it.status === 'cancelled') {
        throw new BadRequestException('Iptal edilmis kalem tasinamaz');
      }
      if (it.status === 'ledger') {
        throw new BadRequestException('Cariye yazilmis kalem tasinamaz');
      }
    }

    const [fromTable, toTable] = await Promise.all([
      this.tableRepo.findOne({ where: { id: fromTableId, restaurantId } }),
      this.tableRepo.findOne({ where: { id: toTableId, restaurantId } }),
    ]);
    if (!fromTable || !toTable) {
      throw new NotFoundException('Table not found');
    }
    if (fromTable.status === 'checkout' || toTable.status === 'checkout') {
      throw new BadRequestException('Hesap kesimindeki masadan veya masaya kalem tasinamaz');
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
      const ord = em.create(OrderEntity, {
        restaurantId,
        tableId: toTableId,
        userId: newUserId,
        userDisplayName: moverName,
        status: 'active',
        mergedFrom: fromTableLabel,
      });
      const saved = await em.save(ord);
      const newRows = items.map((src) =>
        em.create(OrderItemEntity, {
          orderId: saved.id,
          productId: src.productId,
          productName: src.productName,
          price: src.price,
          quantity: src.quantity,
          note: src.note ?? undefined,
          status: 'sent',
        }),
      );
      await em.save(newRows);
      return saved.id;
    });

    const createdEntity = await this.loadOrderEntity(newOrderId, restaurantId);
    if (!createdEntity) throw new NotFoundException('Order not found');
    const map = await this.staffNameMap(restaurantId, [createdEntity.userId]);
    const serialized = this.serializeOrderEntity(createdEntity, map);
    const waiter = newUserId
      ? await this.staffRepo.findOne({ where: { id: newUserId, restaurantId } })
      : null;
    const payload = {
      ...serialized,
      restaurantId,
      tableName: toTable.name ?? null,
      waiterName:
        (serialized.userName as string | null) ?? (waiter?.name ?? null),
    } as Record<string, unknown>;
    const pItems = payload.items as Array<{ productId?: string } & Record<string, unknown>> | undefined;
    if (pItems?.length) {
      await this.attachCategoryIdsToItems(pItems, restaurantId);
    }
    this.ordersGateway.emitOrdersUpdated(restaurantId);
    this.ordersGateway.emitOrderCreated(restaurantId, payload);
    return serialized;
  }

  /** Close check: marks all active orders on the table as closed (instant panel/terminal sync). */
  async closeTable(restaurantId: string, tableId: string): Promise<{ closed: number }> {
    const result = await this.orderRepo.update(
      { restaurantId, tableId, status: 'active' },
      { status: 'closed' },
    );
    const closed = result.affected ?? 0;
    await this.tableRepo.update(
      { id: tableId, restaurantId },
      { sessionStaffId: null, sessionStaffName: null, sessionLockedAt: null },
    );
    void this.ordersGateway.emitTableSessionPresence(restaurantId).catch(() => undefined);
    if (closed > 0) {
      this.ordersGateway.emitOrdersUpdated(restaurantId);
    }
    return { closed };
  }

  /** Cancels an active order item; emits orders:updated for panel/register sync. */
  async cancelOrderItem(
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
    if (!item?.order) throw new NotFoundException('Kalem bulunamadi');
    const order = item.order;
    if (order.restaurantId !== restaurantId) {
      throw new BadRequestException('Gecersiz isletme');
    }
    if (order.status !== 'active') {
      throw new BadRequestException('Siparis aktif degil');
    }
    if (item.status === 'ledger') {
      throw new BadRequestException('Cariye yazilmis kalem iptal edilemez');
    }
    if (item.status === 'cancelled') {
      throw new BadRequestException('Kalem zaten iptal');
    }
    const table = await this.tableRepo.findOne({
      where: { id: order.tableId, restaurantId },
    });
    if (!table) throw new NotFoundException('Masa bulunamadi');
    if (table.status === 'checkout') {
      throw new BadRequestException('Hesap kesiminde kalem iptal edilemez');
    }

    item.status = 'cancelled';
    item.cancelReason = (reason ?? '').trim() || null;
    item.cancelledBy = (cancelledByName ?? '').trim() || null;
    item.cancelledAt = new Date();
    await this.itemRepo.save(item);
    await this.orderRepo.update(
      { id: order.id, restaurantId },
      { updatedAt: new Date() },
    );
    this.ordersGateway.emitOrdersUpdated(restaurantId);

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
    await this.attachCategoryIdsToItems(printItems, restaurantId);
    this.ordersGateway.emitPrintJob(restaurantId, {
      type: 'order.print_job',
      jobId: cancelJobId,
      restaurantId,
      printType: 'kitchen_cancel',
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
    });

    return { ok: true };
  }

  /**
   * Consolidated register receipt: same product name + unit price collapsed into one line; note field dropped.
   */
  private aggregateConsolidatedReceiptLines(
    lines: Array<{
      productName: string;
      quantity: number;
      price: number;
      note?: string;
      productId?: string;
      categoryId?: string;
    }>,
  ): Array<{
    productName: string;
    quantity: number;
    price: number;
    productId?: string;
    categoryId?: string;
  }> {
    const map = new Map<
      string,
      { productName: string; quantity: number; price: number; productId?: string; categoryId?: string }
    >();
    for (const raw of lines) {
      const name = (raw.productName || '').trim() || 'Urun';
      const price = Number(raw.price) || 0;
      const key = `${name}\u0000${price}`;
      const qty = Number(raw.quantity) || 0;
      if (qty <= 0) continue;
      const cur = map.get(key);
      if (cur) {
        cur.quantity += qty;
      } else {
        map.set(key, {
          productName: name,
          quantity: qty,
          price,
          productId: raw.productId,
          categoryId: raw.categoryId,
        });
      }
    }
    return [...map.values()];
  }

  /**
   * Merges all active orders on the table into one receipt, or sends walk-in sale lines directly.
   * Single check via `orderId` (including notes). Print-agent receives it over WebSocket `order.print_job`.
   */
  async printReceipt(restaurantId: string, dto: PrintReceiptDto): Promise<{ ok: true; jobId: string }> {
    const jobId = randomUUID();
    const createdAt = new Date().toISOString();
    const receiptMode = dto.receiptMode ?? 'split';

    let tableName: string;
    let waiterName: string;
    let items: Array<{
      productName: string;
      quantity: number;
      price: number;
      note?: string;
      productId?: string;
      categoryId?: string;
    }>;
    let total: number;

    if (dto.orderId) {
      const o = await this.orderRepo.findOne({
        where: { id: dto.orderId, restaurantId, status: In(['active', 'closed']) },
        relations: ['items', 'table'],
      });
      if (!o) {
        throw new NotFoundException('Sipariş bulunamadı');
      }
      tableName = o.table?.name ?? '-';
      const rawItems = o.items?.filter((i) => this.itemOnActiveBill(i.status)) ?? [];
      items = rawItems.map((i) => ({
        productName: i.productName,
        quantity: i.quantity,
        price: Number(i.price),
        note: i.note ?? undefined,
        productId: i.productId,
      }));
      await this.attachCategoryIdsToItems(items, restaurantId);
      total = items.reduce((s, i) => s + i.price * i.quantity, 0);
      const waiter = o.userId
        ? await this.staffRepo.findOne({ where: { id: o.userId, restaurantId } })
        : null;
      waiterName =
        (o.userDisplayName && o.userDisplayName.trim()) || waiter?.name?.trim() || '-';
    } else if (dto.tableId) {
      const orders = await this.loadActiveOrdersEntities(restaurantId, dto.tableId);
      if (!orders.length) {
        throw new BadRequestException('Bu masada aktif sipariş yok');
      }
      const table = await this.tableRepo.findOne({ where: { id: dto.tableId, restaurantId } });
      tableName = table?.name ?? dto.tableId;
      const flat = orders.flatMap((o) => o.items.filter((i) => this.itemOnActiveBill(i.status)));
      items = flat.map((i) => ({
        productName: i.productName,
        quantity: i.quantity,
        price: Number(i.price),
        note: i.note ?? undefined,
        productId: i.productId,
      }));
      await this.attachCategoryIdsToItems(items, restaurantId);
      if (receiptMode === 'consolidated') {
        items = this.aggregateConsolidatedReceiptLines(items);
      }
      total = items.reduce((s, i) => s + i.price * i.quantity, 0);
      const firstWithUser = orders.find((ord) => ord.userId);
      const firstUserId = firstWithUser?.userId;
      const waiter = firstUserId
        ? await this.staffRepo.findOne({ where: { id: firstUserId, restaurantId } })
        : null;
      waiterName =
        (firstWithUser?.userDisplayName && firstWithUser.userDisplayName.trim()) ||
        waiter?.name?.trim() ||
        '-';
    } else {
      if (!dto.tableName?.trim() || !dto.items?.length || dto.total === undefined) {
        throw new BadRequestException('tableId yoksa tableName, items ve total gerekli');
      }
      tableName = dto.tableName.trim();
      waiterName = dto.waiterName?.trim() || '-';
      items = dto.items.map((i) => ({
        productName: i.productName,
        quantity: i.quantity,
        price: i.price,
        note: i.note,
        productId: i.productId,
        categoryId: i.categoryId,
      }));
      await this.attachCategoryIdsToItems(items, restaurantId);
      if (receiptMode === 'consolidated') {
        items = this.aggregateConsolidatedReceiptLines(items);
      }
      const computedFromLines = items.reduce((s, i) => s + i.price * i.quantity, 0);
      total =
        dto.total !== undefined && dto.total !== null ? Number(dto.total) : computedFromLines;
    }

    const includeLineNotes = receiptMode === 'split' || Boolean(dto.orderId);

    this.ordersGateway.emitPrintJob(restaurantId, {
      type: 'order.print_job',
      jobId,
      restaurantId,
      printType: 'receipt',
      createdAt,
      receiptMode,
      includeLineNotes,
      order: {
        tableName,
        waiterName,
        items,
        total,
      },
    });

    return { ok: true, jobId };
  }

  /**
   * Creates a ledger debt from selected check lines (optional quantity).
   * Fully ledger-assigned lines become `ledger`; on partial split the remainder stays on the line and the ledger portion is added as a new `ledger` line.
   */
  async assignItemsToLedger(
    restaurantId: string,
    lines: { itemId: string; quantity?: number }[],
    ledgerCustomerId: string,
    staffName: string,
  ): Promise<{ ok: true; amount: number }> {
    const seen = new Set<string>();
    for (const l of lines) {
      if (seen.has(l.itemId)) {
        throw new BadRequestException('Ayni kalem iki kez secilemez');
      }
      seen.add(l.itemId);
    }

    let total = 0;
    await this.orderRepo.manager.transaction(async (em) => {
      const staged: { line: { itemId: string; quantity?: number }; item: OrderItemEntity }[] = [];
      for (const line of lines) {
        const item = await em.findOne(OrderItemEntity, {
          where: { id: line.itemId },
          relations: ['order', 'order.table'],
        });
        if (!item?.order) {
          throw new NotFoundException('Kalem bulunamadi');
        }
        const order = item.order;
        if (order.restaurantId !== restaurantId) {
          throw new BadRequestException('Gecersiz kalem');
        }
        if (order.status !== 'active') {
          throw new BadRequestException('Siparis aktif degil');
        }
        if (item.status === 'cancelled') {
          throw new BadRequestException('Kalem iptal edilmis');
        }
        if (item.status === 'ledger') {
          throw new BadRequestException('Kalem zaten cariye yazilmis');
        }
        staged.push({ line, item });
      }

      const tableIds = new Set(staged.map((s) => s.item.order!.tableId));
      if (tableIds.size !== 1) {
        throw new BadRequestException('Tum kalemler ayni masada olmali');
      }
      const table = staged[0].item.order?.table;
      if (!table || table.restaurantId !== restaurantId) {
        throw new NotFoundException('Masa bulunamadi');
      }
      if (table.status === 'checkout') {
        throw new BadRequestException('Hesap kesiminde cariye atilamaz');
      }
      const tableId = table.id;
      const tableName = (table.name ?? '').trim() || null;

      const snapshotLines: Array<Record<string, unknown>> = [];
      const now = new Date();

      for (const { line, item } of staged) {
        const q = item.quantity;
        const reqQ =
          line.quantity != null ? Math.floor(Number(line.quantity)) : q;
        if (!Number.isInteger(reqQ) || reqQ < 1 || reqQ > q) {
          throw new BadRequestException('Adet gecersiz');
        }
        const lineAmount = Number(item.price) * reqQ;
        total += lineAmount;

        if (reqQ < q) {
          item.quantity = q - reqQ;
          await em.save(OrderItemEntity, item);
          const newRow = em.create(OrderItemEntity, {
            orderId: item.orderId,
            productId: item.productId,
            productName: item.productName,
            price: item.price,
            quantity: reqQ,
            note: item.note ?? undefined,
            status: 'ledger',
            cancelReason: null,
            cancelledBy: null,
            cancelledAt: null,
          });
          const savedNew = await em.save(OrderItemEntity, newRow);
          snapshotLines.push({
            orderItemId: savedNew.id,
            productId: item.productId,
            productName: item.productName,
            price: Number(item.price),
            quantity: reqQ,
            note: item.note ?? null,
          });
        } else {
          item.status = 'ledger';
          item.cancelReason = null;
          item.cancelledBy = null;
          item.cancelledAt = null;
          await em.save(OrderItemEntity, item);
          snapshotLines.push({
            orderItemId: item.id,
            productId: item.productId,
            productName: item.productName,
            price: Number(item.price),
            quantity: reqQ,
            note: item.note ?? null,
          });
        }
      }

      let desc = snapshotLines.map((l) => `${l.productName} x${l.quantity}`).join(', ');
      if (desc.length > 480) desc = desc.slice(0, 477) + '...';
      desc = `Adisyon cari: ${desc}`;

      await this.ledgerService.recordStandaloneDebt(em, {
        restaurantId,
        customerId: ledgerCustomerId,
        amount: total,
        description: desc,
        tableId,
        tableName,
        snapshot: { items: snapshotLines, tableId, tableName },
        recordedBy: (staffName ?? '').trim() || null,
      });

      const orderIds = new Set(staged.map((s) => s.item.orderId));
      for (const oid of orderIds) {
        await em.update(OrderEntity, { id: oid, restaurantId }, { updatedAt: now });
      }
    });

    this.ordersGateway.emitOrdersUpdated(restaurantId);
    return { ok: true, amount: total };
  }

  /** Moves a ledger-assigned line back onto the check; posts a `credit` against the ledger debt. */
  async revertLedgerOrderItem(
    restaurantId: string,
    itemId: string,
    actorName: string,
  ): Promise<{ ok: true; amount: number }> {
    await this.cashShiftService.requireCurrent(restaurantId);
    let amountOut = 0;
    await this.orderRepo.manager.transaction(async (em) => {
      const item = await em.findOne(OrderItemEntity, {
        where: { id: itemId },
        relations: ['order', 'order.table'],
      });
      if (!item?.order) {
        throw new NotFoundException('Kalem bulunamadi');
      }
      const order = item.order;
      if (order.restaurantId !== restaurantId) {
        throw new BadRequestException('Gecersiz kalem');
      }
      if (order.status !== 'active') {
        throw new BadRequestException('Siparis aktif degil');
      }
      if (item.status !== 'ledger') {
        throw new BadRequestException('Sadece cariye yazilmis satirlar geri alinabilir');
      }
      const table = await this.tableRepo.findOne({
        where: { id: order.tableId, restaurantId },
      });
      if (!table) {
        throw new NotFoundException('Masa bulunamadi');
      }
      if (table.status === 'checkout') {
        throw new BadRequestException('Hesap kesiminde geri alinamaz');
      }

      const debtEntry = await this.ledgerService.findStandaloneDebtEntryForOrderItem(
        em,
        restaurantId,
        itemId,
      );
      if (!debtEntry) {
        throw new BadRequestException('Cari borc kaydi bulunamadi; manuel duzeltme gerekebilir');
      }

      const lineAmount = Number(item.price) * item.quantity;
      if (!Number.isFinite(lineAmount) || lineAmount <= 0) {
        throw new BadRequestException('Tutar gecersiz');
      }
      amountOut = lineAmount;

      const tableName = (table.name ?? '').trim() || null;
      await this.ledgerService.recordStandaloneCredit(em, {
        restaurantId,
        customerId: debtEntry.customerId,
        amount: lineAmount,
        description: `Adisyon geri al: ${item.productName} x${item.quantity}`,
        tableId: order.tableId,
        tableName,
        snapshot: {
          revertedOrderItemId: itemId,
          originalDebtEntryId: debtEntry.id,
          productName: item.productName,
          quantity: item.quantity,
        },
        recordedBy: (actorName ?? '').trim() || null,
      });

      const noteN = (item.note ?? '').trim();
      const priceN = Number(item.price);
      const siblings = await em.find(OrderItemEntity, {
        where: {
          orderId: item.orderId,
          productId: item.productId,
          status: Not(In(['cancelled', 'ledger'])),
        },
      });
      const partner = siblings
        .filter(
          (s) =>
            s.id !== item.id &&
            (s.note ?? '').trim() === noteN &&
            Number(s.price) === priceN,
        )
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

      const now = new Date();
      if (partner) {
        await em.delete(OrderItemEntity, { id: item.id });
        partner.quantity += item.quantity;
        await em.save(OrderItemEntity, partner);
      } else {
        item.status = 'sent';
        await em.save(OrderItemEntity, item);
      }

      await em.update(OrderEntity, { id: order.id, restaurantId }, { updatedAt: now });
    });

    this.ordersGateway.emitOrdersUpdated(restaurantId);
    return { ok: true, amount: amountOut };
  }

  /** Print-agent HTTP: completes the kitchen ticket even if the WebSocket was missed. */
  async findPendingKitchenPrints(restaurantId: string): Promise<Record<string, unknown>[]> {
    const orders = await this.orderRepo.find({
      where: {
        restaurantId,
        status: 'active',
        kitchenTicketPrintedAt: IsNull(),
      },
      relations: ['items', 'table'],
      order: { createdAt: 'ASC' },
      take: 100,
    });

    const out: Record<string, unknown>[] = [];
    for (const o of orders) {
      const items = o.items?.filter((i) => this.itemOnActiveBill(i.status)) ?? [];
      if (!items.length) continue;
      const waiter = o.userId
        ? await this.staffRepo.findOne({ where: { id: o.userId, restaurantId } })
        : null;
      const snapshot = { ...o, items };
      const row = {
        ...JSON.parse(JSON.stringify(snapshot)),
        restaurantId,
        tableName: o.table?.name ?? null,
        waiterName:
          (o.userDisplayName && o.userDisplayName.trim()) || waiter?.name?.trim() || null,
      } as Record<string, unknown>;
      const rowItems = row.items as Array<{ productId?: string } & Record<string, unknown>> | undefined;
      if (rowItems?.length) {
        await this.attachCategoryIdsToItems(rowItems, restaurantId);
      }
      out.push(row);
    }
    return out;
  }

  async markKitchenTicketPrinted(restaurantId: string, orderId: string): Promise<{ ok: true }> {
    const res = await this.orderRepo.update(
      { id: orderId, restaurantId, status: 'active' },
      { kitchenTicketPrintedAt: new Date() },
    );
    if (!res.affected) {
      throw new NotFoundException('Sipariş bulunamadı veya kapatılmış');
    }
    return { ok: true };
  }
}
