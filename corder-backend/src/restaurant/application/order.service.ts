import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { OrderEntity } from '../domain/order.entity';
import { OrderItemEntity } from '../domain/order-item.entity';
import { TableEntity } from '../domain/table.entity';
import { RestaurantStaffEntity } from '../domain/restaurant-staff.entity';
import { ProductEntity } from '../domain/product.entity';
import { CashShiftEntity } from '../domain/cash-shift.entity';
import { CashTransactionEntity } from '../domain/cash-transaction.entity';
import { CompletedOrderEntity } from '../domain/completed-order.entity';
import { LedgerCustomerEntity } from '../domain/ledger-customer.entity';
import { StockMaterialEntity } from '../domain/stock-material.entity';
import { StockMovementEntity } from '../domain/stock-movement.entity';
import { CreateOrderDto } from '../api/dto/create-order.dto';
import { CloseCheckDto } from '../api/dto/close-check.dto';
import { PrintReceiptDto } from '../api/dto/print-receipt.dto';
import { OrdersGateway } from '../api/orders.gateway';
import { CashShiftService, serializeCashShift } from './cash-shift.service';
import { serializeCashTransaction } from './cash-transactions.service';
import { serializeCompletedOrder } from './completed-orders.service';
import { TableService } from './table.service';
import { LedgerService } from './ledger.service';
import { computeDiscountKurus, fromKurus, toKurus } from '../../common/money/kurus';

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

  async create(
    restaurantId: string,
    dto: CreateOrderDto,
    actor?: { staffId?: string | null; displayName?: string | null },
  ): Promise<Record<string, unknown>> {
    if (!dto.items?.length) {
      throw new BadRequestException('Siparis en az bir kalem icermeli');
    }
    const table = await this.tableRepo.findOne({ where: { id: dto.tableId, restaurantId } });
    if (!table) throw new NotFoundException('Table not found');
    const staffId = actor?.staffId ?? null;
    this.tableService.assertStaffMayUseTable(table, staffId);
    await this.cashShiftService.requireCurrent(restaurantId);

    const uniqueProductIds = [...new Set(dto.items.map((i) => i.productId))];
    const products = await this.productRepo.find({
      where: { id: In(uniqueProductIds) },
      relations: ['category'],
    });
    const productById = new Map<string, ProductEntity>();
    for (const product of products) {
      if (product.category?.restaurantId === restaurantId) {
        productById.set(product.id, product);
      }
    }
    for (const line of dto.items) {
      if (!productById.has(line.productId)) {
        throw new BadRequestException('Urun bulunamadi veya bu restorana ait degil');
      }
    }

    const waiter = staffId
      ? await this.staffRepo.findOne({ where: { id: staffId, restaurantId } })
      : null;

    const savedId = await this.orderRepo.manager.transaction(async (em) => {
      const txOrderRepo = em.getRepository(OrderEntity);
      const txItemRepo = em.getRepository(OrderItemEntity);
      const order = txOrderRepo.create({
        restaurantId,
        tableId: dto.tableId,
        userId: waiter ? waiter.id : null,
        userDisplayName: waiter?.name?.trim() || actor?.displayName?.trim() || null,
        status: 'active',
      });
      const saved = await txOrderRepo.save(order);
      const items = dto.items.map((i) => {
        const product = productById.get(i.productId)!;
        return txItemRepo.create({
          orderId: saved.id,
          productId: product.id,
          productName: product.name,
          price: Number(product.price),
          quantity: i.quantity,
          note: i.note?.trim() || undefined,
          status: 'sent',
        });
      });
      await txItemRepo.save(items);
      return saved.id;
    });

    const createdEntity = await this.loadOrderEntity(savedId, restaurantId);
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
      for (const item of pItems) {
        const pid = item.productId;
        const prod = pid ? productById.get(pid) : undefined;
        if (prod) {
          item.categoryId = prod.categoryId;
        }
      }
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

  /**
   * Single-transaction server-side check closing and walk-in quick sale in integer kurus.
   * Client amounts/prices are never accepted; active orders or walk-in products are loaded from DB.
   */
  async closeCheck(
    restaurantId: string,
    dto: CloseCheckDto,
    actor: { id: string; name: string },
  ) {
    const hasTable = Boolean(dto.tableId?.trim());
    const hasWalkInItems = Boolean(dto.items && dto.items.length > 0);
    if ((hasTable && hasWalkInItems) || (!hasTable && !hasWalkInItems)) {
      throw new BadRequestException(
        'tableId veya walk-in items alanlarindan yalnizca biri gonderilmelidir',
      );
    }

    const txResult = await this.orderRepo.manager.transaction(async (em) => {
      const shift = await em.findOne(CashShiftEntity, {
        where: { restaurantId, status: 'open' },
        order: { openedAt: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!shift) {
        throw new BadRequestException('Kasa açılmadan işlem yapılamaz. Önce kasayı açın.');
      }

      const now = new Date();
      const actorId = (actor.id || '').trim() || restaurantId;
      const actorName = (actor.name || '').trim() || 'Kasa';

      let table: TableEntity | null = null;
      let tableName = 'Elden Satis';
      let section = 'Kasa';
      let waiterName = actorName;
      let openedAt = now;
      let rawTotalKurus = 0;
      let orderIdsToClose: string[] = [];
      let ordersSnapshot: Array<Record<string, unknown>> = [];
      const billLinesForStock: Array<{
        productId: string;
        productName: string;
        quantity: number;
      }> = [];

      if (hasTable) {
        table = await em.findOne(TableEntity, {
          where: { id: dto.tableId!, restaurantId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!table) {
          throw new NotFoundException('Masa bulunamadi');
        }

        const activeOrders = await em.find(OrderEntity, {
          where: { restaurantId, tableId: table.id, status: 'active' },
          order: { createdAt: 'ASC' },
          lock: { mode: 'pessimistic_write' },
        });
        if (!activeOrders.length) {
          throw new BadRequestException('Bu masada aktif siparis bulunamadi');
        }

        orderIdsToClose = activeOrders.map((o) => o.id);
        const orderItems = await em.find(OrderItemEntity, {
          where: { orderId: In(orderIdsToClose) },
          order: { createdAt: 'ASC' },
        });
        const itemsByOrderId = new Map<string, OrderItemEntity[]>();
        for (const item of orderItems) {
          const arr = itemsByOrderId.get(item.orderId) ?? [];
          arr.push(item);
          itemsByOrderId.set(item.orderId, arr);
        }

        const staffIds = [
          ...new Set(
            activeOrders
              .map((o) => o.userId?.trim() || '')
              .filter((id): id is string => Boolean(id)),
          ),
        ];
        const staffRows = staffIds.length
          ? await em.find(RestaurantStaffEntity, {
              where: { restaurantId, id: In(staffIds) },
              select: ['id', 'name'],
            })
          : [];
        const staffNameById = new Map(
          staffRows.map((s) => [s.id, (s.name || '').trim()]),
        );

        tableName = (table.name || '').trim() || table.id;
        section = (table.section || '').trim() || 'default';
        openedAt = activeOrders[0].createdAt ?? now;

        const latestOrder = [...activeOrders].sort(
          (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
        )[0];
        const latestUid = latestOrder?.userId?.trim() || '';
        waiterName =
          latestOrder?.userDisplayName?.trim() ||
          (latestUid ? staffNameById.get(latestUid) : '') ||
          actorName;

        for (const o of activeOrders) {
          const lines = itemsByOrderId.get(o.id) ?? [];
          for (const line of lines) {
            if (this.itemOnActiveBill(line.status)) {
              const unitKurus = toKurus(line.price);
              if (unitKurus < 0 || line.quantity < 1) {
                throw new BadRequestException('Gecersiz siparis kalemi');
              }
              rawTotalKurus += unitKurus * line.quantity;
              billLinesForStock.push({
                productId: line.productId,
                productName: line.productName,
                quantity: line.quantity,
              });
            }
          }
          const uid = o.userId?.trim() || '';
          const resolvedUserName =
            o.userDisplayName?.trim() ||
            (uid ? staffNameById.get(uid) || undefined : undefined);

          ordersSnapshot.push({
            id: o.id,
            tableId: o.tableId,
            userId: o.userId ?? actorId,
            ...(resolvedUserName ? { userName: resolvedUserName } : {}),
            ...(o.mergedFrom ? { mergedFrom: o.mergedFrom } : {}),
            status: 'closed',
            createdAt: o.createdAt.toISOString(),
            updatedAt: now.toISOString(),
            items: lines.map((i) => ({
              id: i.id,
              productId: i.productId,
              productName: i.productName,
              price: fromKurus(toKurus(i.price)),
              quantity: i.quantity,
              ...(i.note ? { note: i.note } : {}),
              status: i.status,
              createdAt: i.createdAt.toISOString(),
              ...(i.cancelReason ? { cancelReason: i.cancelReason } : {}),
              ...(i.cancelledBy ? { cancelledBy: i.cancelledBy } : {}),
              ...(i.cancelledAt ? { cancelledAt: i.cancelledAt.toISOString() } : {}),
            })),
          });
        }
      } else {
        const walkInItems = dto.items!;
        const uniqueProductIds = [...new Set(walkInItems.map((i) => i.productId))];
        const products = await em.find(ProductEntity, {
          where: { id: In(uniqueProductIds) },
          relations: ['category'],
        });
        const productById = new Map<string, ProductEntity>();
        for (const p of products) {
          if (p.category?.restaurantId === restaurantId) {
            productById.set(p.id, p);
          }
        }

        const quickOrderId = randomUUID();
        const snapItems: Array<Record<string, unknown>> = [];
        for (const reqItem of walkInItems) {
          const product = productById.get(reqItem.productId);
          if (!product) {
            throw new BadRequestException(
              'Urun bulunamadi veya bu restorana ait degil',
            );
          }
          const unitKurus = toKurus(product.price);
          if (unitKurus < 0) {
            throw new BadRequestException('Urun fiyati gecersiz');
          }
          rawTotalKurus += unitKurus * reqItem.quantity;
          billLinesForStock.push({
            productId: product.id,
            productName: product.name,
            quantity: reqItem.quantity,
          });
          snapItems.push({
            id: randomUUID(),
            productId: product.id,
            productName: product.name,
            price: fromKurus(unitKurus),
            quantity: reqItem.quantity,
            ...(reqItem.note?.trim() ? { note: reqItem.note.trim() } : {}),
            status: 'served',
            createdAt: now.toISOString(),
          });
        }

        orderIdsToClose = [quickOrderId];
        ordersSnapshot = [
          {
            id: quickOrderId,
            tableId: 'quick-sale',
            userId: actorId,
            userName: actorName,
            status: 'closed',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            items: snapItems,
          },
        ];
      }

      const discountKurus = computeDiscountKurus(rawTotalKurus, dto.discount ?? null);
      const netKurus = Math.max(0, rawTotalKurus - discountKurus);
      const tipKurus = dto.tip != null ? Math.max(0, toKurus(dto.tip)) : 0;

      let nakitKurus = 0;
      let kartKurus = 0;
      let yemekKartiKurus = 0;
      let multinetKurus = 0;
      let cariKurus = 0;
      let normalizedSplits: Array<{ method: string; amount: number }> | undefined;

      if (dto.method === 'nakit') {
        nakitKurus = netKurus;
      } else if (dto.method === 'kredi-karti') {
        kartKurus = netKurus;
      } else if (dto.method === 'yemek-karti') {
        yemekKartiKurus = netKurus;
      } else if (dto.method === 'multinet') {
        multinetKurus = netKurus;
      } else if (dto.method === 'cari') {
        if (!dto.ledgerCustomerId) {
          throw new BadRequestException('Cari hesap kapatma icin cari musteri secilmelidir');
        }
        cariKurus =
          dto.ledgerDebtAmount != null
            ? Math.min(netKurus, Math.max(0, toKurus(dto.ledgerDebtAmount)))
            : netKurus;
      } else if (dto.method === 'coklu') {
        if (netKurus > 0 && (!dto.splitDetails || dto.splitDetails.length === 0)) {
          throw new BadRequestException('Karma odeme dagilimi gerekli');
        }
        normalizedSplits = [];
        for (const s of dto.splitDetails ?? []) {
          const partKurus = toKurus(s.amount);
          if (partKurus < 0) {
            throw new BadRequestException('Karma odeme kalemi negatif olamaz');
          }
          if (partKurus === 0) continue;
          if (s.method === 'nakit') nakitKurus += partKurus;
          else if (s.method === 'kredi-karti') kartKurus += partKurus;
          else if (s.method === 'yemek-karti') yemekKartiKurus += partKurus;
          else if (s.method === 'multinet') multinetKurus += partKurus;
          else if (s.method === 'cari') cariKurus += partKurus;
          normalizedSplits.push({ method: s.method, amount: fromKurus(partKurus) });
        }
        if (cariKurus === 0 && dto.ledgerCustomerId && dto.ledgerDebtAmount != null) {
          const extraCariKurus = Math.max(0, toKurus(dto.ledgerDebtAmount));
          if (extraCariKurus > 0) {
            cariKurus += extraCariKurus;
            normalizedSplits.push({ method: 'cari', amount: fromKurus(extraCariKurus) });
          }
        }
        const splitSumKurus =
          nakitKurus + kartKurus + yemekKartiKurus + multinetKurus + cariKurus;
        if (splitSumKurus !== netKurus) {
          throw new BadRequestException('Karma odeme toplami net tutara esit olmalidir');
        }
      }

      let ledgerCustomer: LedgerCustomerEntity | null = null;
      if (cariKurus > 0 || dto.method === 'cari') {
        if (!dto.ledgerCustomerId) {
          throw new BadRequestException('Cari borc kaydi icin ledgerCustomerId gerekli');
        }
        ledgerCustomer = await em.findOne(LedgerCustomerEntity, {
          where: { id: dto.ledgerCustomerId, restaurantId },
        });
        if (!ledgerCustomer) {
          throw new NotFoundException('Cari bulunamadi');
        }
      }

      const discountSnapshot =
        dto.discount && discountKurus > 0
          ? {
              type: dto.discount.type,
              value: dto.discount.value,
              reason: dto.discount.reason?.trim() || 'Indirim',
            }
          : undefined;

      const paymentSnapshot: Record<string, unknown> = {
        id: randomUUID(),
        tableId: table ? table.id : 'quick-sale',
        tableName,
        orderIds: orderIdsToClose,
        amount: fromKurus(netKurus),
        method: dto.method,
        ...(normalizedSplits ? { splitDetails: normalizedSplits } : {}),
        ...(discountSnapshot ? { discount: discountSnapshot } : {}),
        ...(tipKurus > 0 ? { tip: fromKurus(tipKurus) } : {}),
        processedBy: actorId,
        createdAt: now.toISOString(),
        ...(ledgerCustomer
          ? {
              ledgerCustomerId: ledgerCustomer.id,
              ledgerCustomerName: ledgerCustomer.name,
            }
          : {}),
      };

      const completedEntity = em.create(CompletedOrderEntity, {
        restaurantId,
        tableName,
        section,
        waiter: waiterName,
        totalAmount: fromKurus(rawTotalKurus),
        discountAmount: fromKurus(discountKurus),
        netAmount: fromKurus(netKurus),
        closedBy: actorName,
        openedAt,
        closedAt: now,
        paymentMethod: dto.method,
        paymentSplit: normalizedSplits ?? null,
        paymentDiscount: discountSnapshot ?? null,
        paymentTip: fromKurus(tipKurus),
        ordersSnapshot,
        paymentSnapshot,
      });
      const savedCompleted = await em.save(CompletedOrderEntity, completedEntity);

      if (ledgerCustomer && cariKurus > 0) {
        await this.ledgerService.recordDebtInTransaction(em, {
          restaurantId,
          customerId: ledgerCustomer.id,
          amount: fromKurus(cariKurus),
          description: `${tableName} masasi hesabi`,
          tableId: table ? table.id : null,
          tableName,
          completedOrderId: savedCompleted.id,
          snapshot: ordersSnapshot,
          recordedBy: actorName,
        });
      }

      if (table) {
        await em.update(
          OrderEntity,
          { id: In(orderIdsToClose), restaurantId },
          { status: 'closed', updatedAt: now },
        );
        table.status = 'empty';
        table.sessionStaffId = null;
        table.sessionStaffName = null;
        table.sessionLockedAt = null;
        await em.save(TableEntity, table);
      }

      let savedCashTx: CashTransactionEntity | null = null;
      if (nakitKurus > 0) {
        const tx = em.create(CashTransactionEntity, {
          restaurantId,
          shiftId: shift.id,
          type: 'sale',
          amount: fromKurus(nakitKurus),
          description:
            dto.method === 'coklu'
              ? `${tableName} - Hesap (karma nakit)`
              : `${tableName} - Hesap`,
          reference: tableName,
          createdBy: actorName,
        });
        savedCashTx = await em.save(CashTransactionEntity, tx);
        shift.cashIn = fromKurus(toKurus(shift.cashIn) + nakitKurus);
      }

      shift.totalRevenue = fromKurus(toKurus(shift.totalRevenue) + netKurus);
      shift.totalNakit = fromKurus(toKurus(shift.totalNakit) + nakitKurus);
      shift.totalKart = fromKurus(toKurus(shift.totalKart) + kartKurus);
      shift.totalYemekKarti = fromKurus(toKurus(shift.totalYemekKarti) + yemekKartiKurus);
      shift.totalMultinet = fromKurus(toKurus(shift.totalMultinet) + multinetKurus);
      shift.transactionCount = (shift.transactionCount ?? 0) + 1;
      const savedShift = await em.save(CashShiftEntity, shift);

      const savedMovements: StockMovementEntity[] = [];
      if (billLinesForStock.length > 0) {
        const soldProductIds = [...new Set(billLinesForStock.map((l) => l.productId))];
        const recipeProducts = await em.find(ProductEntity, {
          where: { id: In(soldProductIds) },
          relations: ['category'],
        });
        const validProductById = new Map<string, ProductEntity>();
        for (const p of recipeProducts) {
          if (p.category?.restaurantId === restaurantId) {
            validProductById.set(p.id, p);
          }
        }

        const uuidRe =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const byMaterial = new Map<string, { quantity: number; labels: string[] }>();

        for (const line of billLinesForStock) {
          const prod = validProductById.get(line.productId);
          if (!prod || !Array.isArray(prod.ingredients) || prod.ingredients.length === 0) {
            continue;
          }
          for (const ing of prod.ingredients) {
            const matId = typeof ing?.materialId === 'string' ? ing.materialId.trim() : '';
            if (!uuidRe.test(matId)) continue;
            const perUnit = Number(ing.quantity);
            if (!Number.isFinite(perUnit) || perUnit <= 0) continue;
            const deduct = perUnit * line.quantity;
            if (deduct <= 0) continue;
            const label = `${prod.name} x${line.quantity}`;
            const existing = byMaterial.get(matId);
            if (existing) {
              existing.quantity += deduct;
              existing.labels.push(label);
            } else {
              byMaterial.set(matId, { quantity: deduct, labels: [label] });
            }
          }
        }

        if (byMaterial.size > 0) {
          const sortedMaterialIds = [...byMaterial.keys()].sort();
          const materials = await em.find(StockMaterialEntity, {
            where: { id: In(sortedMaterialIds), restaurantId },
            lock: { mode: 'pessimistic_write' },
          });
          const matById = new Map(materials.map((m) => [m.id, m]));

          for (const matId of sortedMaterialIds) {
            const material = matById.get(matId);
            if (!material || material.restaurantId !== restaurantId) {
              continue;
            }
            const entry = byMaterial.get(matId)!;
            const deductQty = Number(entry.quantity.toFixed(3));
            if (deductQty <= 0) continue;
            const prevStock = Number(material.currentStock ?? 0);
            const nextStock = Number((prevStock - deductQty).toFixed(3));
            material.currentStock = nextStock;
            await em.save(StockMaterialEntity, material);

            const uniqLabels = [...new Set(entry.labels)];
            const reason =
              uniqLabels.length === 1
                ? `Siparis: ${uniqLabels[0]}`
                : `Siparis: ${uniqLabels.join(', ')}`;

            const mv = em.create(StockMovementEntity, {
              restaurantId,
              materialId: material.id,
              materialName: material.name,
              type: 'out',
              quantity: deductQty,
              previousStock: prevStock,
              newStock: nextStock,
              unitCost: null,
              totalCost: null,
              supplierId: null,
              reason,
              createdBy: actorName,
            });
            const savedMv = await em.save(StockMovementEntity, mv);
            savedMovements.push(savedMv);
          }
        }
      }

      return {
        savedCompleted,
        savedShift,
        savedCashTx,
        savedMovements,
      };
    });

    if (hasTable) {
      void this.ordersGateway.emitTableSessionPresence(restaurantId).catch(() => undefined);
      this.ordersGateway.emitOrdersUpdated(restaurantId);
    }

    return {
      completedOrder: serializeCompletedOrder(txResult.savedCompleted),
      shift: serializeCashShift(txResult.savedShift),
      cashTransaction: txResult.savedCashTx
        ? serializeCashTransaction(txResult.savedCashTx)
        : null,
      stockMovements: txResult.savedMovements.map((m) => ({
        id: m.id,
        restaurantId: m.restaurantId,
        materialId: m.materialId,
        materialName: m.materialName,
        type: m.type,
        quantity: Number(m.quantity),
        previousStock: Number(m.previousStock),
        newStock: Number(m.newStock),
        unitCost: m.unitCost != null ? Number(m.unitCost) : null,
        totalCost: m.totalCost != null ? Number(m.totalCost) : null,
        supplierId: m.supplierId,
        reason: m.reason,
        createdBy: m.createdBy,
        createdAt: m.createdAt,
      })),
    };
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
