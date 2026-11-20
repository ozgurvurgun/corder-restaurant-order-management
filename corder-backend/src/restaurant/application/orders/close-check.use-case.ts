import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { OrderEntity } from '../../domain/order.entity';
import { OrderItemEntity } from '../../domain/order-item.entity';
import { TableEntity } from '../../domain/table.entity';
import { RestaurantStaffEntity } from '../../domain/restaurant-staff.entity';
import { RootAdminEntity } from '../../../platform/domain/root-admin.entity';
import { ProductEntity } from '../../domain/product.entity';
import { CashShiftEntity } from '../../domain/cash-shift.entity';
import { CashTransactionEntity } from '../../domain/cash-transaction.entity';
import { CompletedOrderEntity } from '../../domain/completed-order.entity';
import { LedgerCustomerEntity } from '../../domain/ledger-customer.entity';
import { CheckSettlementPolicy, CheckSettlementResult, SettlementActorPolicy } from '../../domain/services/check-settlement.policy';
import { BilledOrderLineForStock } from '../../domain/services/recipe-stock.policy';
import { OrderStatusPolicy } from '../../domain/services/order-status.policy';
import { CloseCheckDto, CloseCheckOrderLineDto, CloseCheckWalkInItemDto } from '../../api/dto/close-check.dto';
import { OrdersGateway } from '../../api/orders.gateway';
import { LedgerService } from '../ledger.service';
import { StockMovementsService } from '../stock-movements.service';
import { SESSION_LOCK_STALE_MS, TableService } from '../table.service';
import { fromMinorUnits, toMinorUnits } from '../../../common/money/minor-units';
import { normalizeStorageText } from '../../../common/text/text-normalizer';
import { allocateNextOrderNumber } from './create-order.use-case';
import {
  applyConsolidatedCompletedOrderUpdate,
  findExistingSessionCompletedOrder,
} from './completed-order-consolidation.helper';
import { buildClosedOrderSnapshot, buildCompletedPaymentSnapshot, serializeCashShift, serializeCashTransaction, serializeCompletedOrder, serializeStockMovement } from './order.mapper';

interface PartialItemMutation {
  item: OrderItemEntity;
  quantity: number;
}

interface BillContext {
  table: TableEntity | null;
  tableName: string;
  section: string;
  waiterName: string;
  openedAt: Date;
  rawTotalMinorUnits: number;
  orderIdsToClose: string[];
  ordersSnapshot: Array<Record<string, unknown>>;
  billLinesForStock: BilledOrderLineForStock[];
  activeOrders?: OrderEntity[];
  itemsByOrderId?: Map<string, OrderItemEntity[]>;
  allOrderItems?: OrderItemEntity[];
  partialMutations?: PartialItemMutation[];
}

@Injectable()
export class CloseCheckUseCase {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    private readonly ordersGateway: OrdersGateway,
    private readonly ledgerService: LedgerService,
    private readonly stockMovementsService: StockMovementsService,
    @Optional()
    private readonly tableService?: TableService,
  ) {}

  async execute(
    restaurantId: string,
    dto: CloseCheckDto,
    actor: { id: string; name: string; staffId?: string | null } & SettlementActorPolicy,
  ) {
    const hasTable = Boolean(dto.tableId?.trim());
    const hasWalkInItems = Boolean(dto.items && dto.items.length > 0);
    const hasPartialLines = Boolean(dto.lines && dto.lines.length > 0);
    if ((hasTable && hasWalkInItems) || (!hasTable && !hasWalkInItems)) {
      throw new BadRequestException('Exactly one of tableId or walk-in items must be provided');
    }
    if (hasPartialLines && !hasTable) {
      throw new BadRequestException('Partial item checkout requires a tableId');
    }

    const txResult = await this.orderRepo.manager.transaction(async (em) => {
      const shift = await em.findOne(CashShiftEntity, {
        where: { restaurantId, status: 'open' }, order: { openedAt: 'DESC' }, lock: { mode: 'pessimistic_write' },
      });
      if (!shift) {
        throw new BadRequestException(
          'Cannot process transaction without an open cash shift. Please open a shift first.',
        );
      }

      const now = new Date();
      const actorId = (actor.id || '').trim() || restaurantId;
      const actorName = normalizeStorageText(actor.name || '') || 'register';
      const actorStaffId = !actor.isBoss
        ? ((actor.staffId !== undefined ? actor.staffId : actor.id) || '').trim() || null
        : null;

      const billContext = hasTable
        ? await this.loadTableBillContext(em, restaurantId, dto.tableId!, dto.lines, actorId, actorName, actorStaffId, now)
        : await this.buildWalkInBillContext(em, restaurantId, dto.items!, actorId, actorName, now);

      const sourceDiscount =
        dto.discount !== undefined ? dto.discount : !hasPartialLines ? (billContext.table?.discount ?? null) : null;
      const effectiveDiscount = sourceDiscount
        ? {
            ...sourceDiscount,
            appliedBy:
              normalizeStorageText(sourceDiscount.appliedBy || '') ||
              normalizeStorageText(billContext.table?.discount?.appliedBy || '') ||
              actorName,
          }
        : null;

      const settlement = CheckSettlementPolicy.computeSettlement({
        rawTotalMinorUnits: billContext.rawTotalMinorUnits, method: dto.method, discount: effectiveDiscount,
        splitDetails: dto.splitDetails ?? null, ledgerCustomerId: dto.ledgerCustomerId ?? null,
        ledgerDebtAmount: dto.ledgerDebtAmount ?? null, tip: dto.tip ?? null,
      });

      CheckSettlementPolicy.assertDiscountAllowedForActor(
        settlement.rawTotalMinorUnits, settlement.discountMinorUnits, effectiveDiscount, actor,
      );

      const ledgerCustomer = await this.resolveLedgerCustomer(em, restaurantId, dto, settlement);
      const savedCompleted = await this.saveCompletedOrder(
        em, restaurantId, billContext, settlement, dto.method, actorId, actorName, ledgerCustomer, now,
      );

      if (ledgerCustomer && settlement.ledgerMinorUnits > 0) {
        await this.ledgerService.recordDebtInTransaction(em, {
          restaurantId, customerId: ledgerCustomer.id, amount: fromMinorUnits(settlement.ledgerMinorUnits),
          description: `${billContext.tableName} table check`, tableId: billContext.table ? billContext.table.id : null,
          tableName: billContext.tableName, completedOrderId: savedCompleted.id,
          snapshot: billContext.ordersSnapshot, recordedBy: actorName,
        });
      }

      const tableFullyClosed = billContext.table
        ? await this.applyTableOrderSettlement(em, restaurantId, billContext, settlement.discountMinorUnits, effectiveDiscount, now)
        : true;

      const savedCashTx = await this.recordCashSaleIfNeeded(
        em, restaurantId, shift.id, billContext.tableName, savedCompleted.id, dto.method, settlement.cashMinorUnits, actorName,
      );

      shift.recordCheckSettlement({
        netMinorUnits: settlement.netMinorUnits, cashMinorUnits: settlement.cashMinorUnits,
        cardMinorUnits: settlement.cardMinorUnits, mealCardMinorUnits: settlement.mealCardMinorUnits,
        multinetMinorUnits: settlement.multinetMinorUnits,
      });
      const savedShift = await em.save(CashShiftEntity, shift);
      const savedMovements = await this.stockMovementsService.deductRecipeIngredients(
        em, restaurantId, billContext.billLinesForStock, actorName,
      );

      return { savedCompleted, savedShift, savedCashTx, savedMovements, tableFullyClosed };
    });

    if (hasTable) {
      void this.ordersGateway.emitTableSessionPresence(restaurantId).catch(() => undefined);
    }
    this.ordersGateway.emitOrdersUpdated(restaurantId);

    return {
      completedOrder: serializeCompletedOrder(txResult.savedCompleted),
      shift: serializeCashShift(txResult.savedShift),
      cashTransaction: txResult.savedCashTx ? serializeCashTransaction(txResult.savedCashTx) : null,
      stockMovements: txResult.savedMovements.map(serializeStockMovement),
      tableFullyClosed: txResult.tableFullyClosed,
    };
  }

  private async loadTableBillContext(
    em: EntityManager, restaurantId: string, tableId: string,
    requestedLines: CloseCheckOrderLineDto[] | undefined, actorId: string, actorName: string,
    actorStaffId: string | null, now: Date,
  ): Promise<BillContext> {
    const table = await em.findOne(TableEntity, { where: { id: tableId, restaurantId }, lock: { mode: 'pessimistic_write' } });
    if (!table) throw new NotFoundException('Table not found');
    if (actorStaffId) {
      if (this.tableService) {
        const prevStatus = table.status;
        if (prevStatus === 'checkout') table.status = 'occupied';
        try {
          this.tableService.assertStaffMayUseTable(table, actorStaffId);
        } finally {
          table.status = prevStatus;
        }
      } else if (table.isLockedByOther(actorStaffId, SESSION_LOCK_STALE_MS)) {
        const holder = (table.sessionStaffName ?? 'Waiter').trim() || 'Waiter';
        throw new ForbiddenException(`Table is currently being served by ${holder}`);
      }
    }

    const activeOrders = await em.find(OrderEntity, {
      where: { restaurantId, tableId: table.id, status: 'active' }, order: { id: 'ASC' }, lock: { mode: 'pessimistic_write' },
    });
    if (!activeOrders.length) throw new BadRequestException('No active orders found on this table');
    activeOrders.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const activeOrderIds = activeOrders.map((o) => o.id);
    const orderItems = await em.find(OrderItemEntity, {
      where: { orderId: In(activeOrderIds) }, order: { id: 'ASC' }, lock: { mode: 'pessimistic_write' },
    });
    orderItems.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const itemsByOrderId = new Map<string, OrderItemEntity[]>();
    for (const item of orderItems) {
      const arr = itemsByOrderId.get(item.orderId) ?? [];
      arr.push(item);
      itemsByOrderId.set(item.orderId, arr);
    }

    const staffIds = [...new Set(activeOrders.map((o) => o.userId?.trim() || '').filter(Boolean))];
    const [staffRows, bossRows] = staffIds.length
      ? await Promise.all([
          em.find(RestaurantStaffEntity, { where: { restaurantId, id: In(staffIds) }, select: ['id', 'name'] }),
          em.find(RootAdminEntity, { where: { id: In(staffIds) }, select: ['id', 'name'] }),
        ])
      : [[], []];
    const staffNameById = new Map<string, string>();
    for (const b of bossRows) {
      const n = normalizeStorageText(b.name || '');
      if (n) staffNameById.set(b.id, n);
    }
    for (const s of staffRows) {
      const n = normalizeStorageText(s.name || '');
      if (n) staffNameById.set(s.id, n);
    }
    const latestOrder = [...activeOrders].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
    const latestUid = latestOrder?.userId?.trim() || '';
    const waiterName = (latestUid ? staffNameById.get(latestUid) : '') || normalizeStorageText(latestOrder?.userDisplayName || '') || actorName;

    if (requestedLines && requestedLines.length > 0) {
      return this.buildPartialTableBillContext(
        table, activeOrders, orderItems, itemsByOrderId, staffNameById, waiterName, requestedLines, actorId, now,
      );
    }

    let rawTotalMinorUnits = 0;
    const ordersSnapshot: Array<Record<string, unknown>> = [];
    const billLinesForStock: BilledOrderLineForStock[] = [];

    for (const order of activeOrders) {
      const lines = itemsByOrderId.get(order.id) ?? [];
      for (const line of lines) {
        if (OrderStatusPolicy.isItemOnActiveBill(line.status)) {
          const unitMinor = toMinorUnits(line.price);
          if (unitMinor < 0 || line.quantity < 1) throw new BadRequestException('Invalid order item');
          rawTotalMinorUnits += unitMinor * line.quantity;
          billLinesForStock.push({ productId: line.productId, productName: line.productName, quantity: line.quantity });
        }
      }
      const snapshotLines = lines.filter((l) => l.status !== 'paid');
      if (snapshotLines.length > 0) {
        ordersSnapshot.push(buildClosedOrderSnapshot(order, snapshotLines, staffNameById, actorId, now));
      }
    }

    if (billLinesForStock.length === 0) {
      throw new BadRequestException('No billable items found on this table');
    }

    return {
      table, tableName: normalizeStorageText(table.name || '') || table.id, section: normalizeStorageText(table.section || '') || 'default',
      waiterName, openedAt: activeOrders[0].createdAt ?? now, rawTotalMinorUnits,
      orderIdsToClose: activeOrderIds, ordersSnapshot, billLinesForStock, activeOrders,
    };
  }

  private buildPartialTableBillContext(
    table: TableEntity, activeOrders: OrderEntity[], orderItems: OrderItemEntity[],
    itemsByOrderId: Map<string, OrderItemEntity[]>, staffNameById: Map<string, string>,
    waiterName: string, requestedLines: CloseCheckOrderLineDto[], actorId: string, now: Date,
  ): BillContext {
    const itemById = new Map(orderItems.map((i) => [i.id, i]));
    const paidQtyByItemId = new Map<string, number>();
    const partialMutations: PartialItemMutation[] = [];
    let rawTotalMinorUnits = 0;
    const billLinesForStock: BilledOrderLineForStock[] = [];

    for (const reqLine of requestedLines) {
      if (paidQtyByItemId.has(reqLine.itemId)) throw new BadRequestException('Duplicate order item in partial checkout lines');
      const item = itemById.get(reqLine.itemId);
      if (!item || !OrderStatusPolicy.isItemOnActiveBill(item.status)) {
        throw new BadRequestException('Selected order item is not active on this table bill');
      }
      if (reqLine.quantity < 1 || reqLine.quantity > item.quantity) {
        throw new BadRequestException('Selected quantity exceeds available order item quantity');
      }
      const unitMinor = toMinorUnits(item.price);
      if (unitMinor < 0) throw new BadRequestException('Invalid order item');
      paidQtyByItemId.set(reqLine.itemId, reqLine.quantity);
      partialMutations.push({ item, quantity: reqLine.quantity });
      rawTotalMinorUnits += unitMinor * reqLine.quantity;
      billLinesForStock.push({ productId: item.productId, productName: item.productName, quantity: reqLine.quantity });
    }

    const willCloseAllBillable = orderItems.every((i) =>
      !OrderStatusPolicy.isItemOnActiveBill(i.status) || (paidQtyByItemId.get(i.id) ?? 0) >= i.quantity,
    );
    const ordersSnapshot: Array<Record<string, unknown>> = [];
    const affectedOrderIds: string[] = [];
    for (const order of activeOrders) {
      const orderLines = itemsByOrderId.get(order.id) ?? [];
      const paidLines = orderLines
        .filter((i) => paidQtyByItemId.has(i.id))
        .map((i) => Object.assign(new OrderItemEntity(), i, { quantity: paidQtyByItemId.get(i.id)! }));
      const extraLines = willCloseAllBillable
        ? orderLines.filter((i) => i.status === 'cancelled' || i.status === 'ledger')
        : [];
      const snapshotLines = [...paidLines, ...extraLines];
      if (snapshotLines.length > 0) {
        affectedOrderIds.push(order.id);
        ordersSnapshot.push(buildClosedOrderSnapshot(order, snapshotLines, staffNameById, actorId, now));
      }
    }

    return {
      table, tableName: normalizeStorageText(table.name || '') || table.id, section: normalizeStorageText(table.section || '') || 'default',
      waiterName, openedAt: activeOrders[0].createdAt ?? now, rawTotalMinorUnits,
      orderIdsToClose: affectedOrderIds, ordersSnapshot, billLinesForStock,
      activeOrders, itemsByOrderId, allOrderItems: orderItems, partialMutations,
    };
  }

  private async applyTableOrderSettlement(
    em: EntityManager, restaurantId: string, ctx: BillContext,
    discountMinorUnits: number, appliedDiscount: CloseCheckDto['discount'] | null, now: Date,
  ): Promise<boolean> {
    const table = ctx.table!;
    if (!ctx.partialMutations) {
      await em.update(OrderEntity, { id: In(ctx.orderIdsToClose), restaurantId }, { status: 'closed', updatedAt: now });
      table.markEmpty();
      await em.save(TableEntity, table);
      return true;
    }

    for (const { item, quantity } of ctx.partialMutations) {
      if (quantity < item.quantity) {
        item.quantity -= quantity;
        await em.save(OrderItemEntity, item);
        await em.save(OrderItemEntity, em.create(OrderItemEntity, {
          orderId: item.orderId, productId: item.productId, productName: item.productName,
          price: item.price, quantity, note: item.note ?? undefined, status: 'paid',
          cancelReason: null, cancelledBy: null, cancelledAt: null,
        }));
      } else {
        item.status = 'paid';
        await em.save(OrderItemEntity, item);
      }
    }

    const activeOrders = ctx.activeOrders ?? [];
    const allOrderItems = ctx.allOrderItems ?? [];
    const hasRemainingBillable = allOrderItems.some((i) => OrderStatusPolicy.isItemOnActiveBill(i.status));

    if (hasRemainingBillable) {
      await em.update(OrderEntity, { id: In(activeOrders.map((o) => o.id)), restaurantId }, { updatedAt: now });
      if (table.discount?.type === 'amount' && appliedDiscount?.type === 'amount' && discountMinorUnits > 0) {
        const remDiscountMinor = Math.max(0, toMinorUnits(table.discount.value) - discountMinorUnits);
        table.discount = remDiscountMinor > 0 ? { ...table.discount, value: fromMinorUnits(remDiscountMinor) } : null;
      }
      table.status = 'occupied';
      table.splitInfo = null;
      await em.save(TableEntity, table);
      return false;
    }

    await em.update(OrderEntity, { id: In(activeOrders.map((o) => o.id)), restaurantId }, { status: 'closed', updatedAt: now });
    table.markEmpty();
    await em.save(TableEntity, table);
    return true;
  }

  private async buildWalkInBillContext(
    em: EntityManager, restaurantId: string, walkInItems: CloseCheckWalkInItemDto[], actorId: string, actorName: string, now: Date,
  ): Promise<BillContext> {
    const uniqueProductIds = [...new Set(walkInItems.map((i) => i.productId))];
    const products = await em.find(ProductEntity, { where: { id: In(uniqueProductIds) }, relations: ['category'] });
    const productById = new Map(products.filter((p) => p.category?.restaurantId === restaurantId).map((p) => [p.id, p]));

    let rawTotalMinorUnits = 0;
    const billLinesForStock: BilledOrderLineForStock[] = [];
    const snapItems: Array<Record<string, unknown>> = [];

    for (const reqItem of walkInItems) {
      const product = productById.get(reqItem.productId);
      if (!product) throw new BadRequestException('Product not found or does not belong to this restaurant');
      if (product.inStock === false) throw new BadRequestException(`Product "${product.name}" is out of stock`);
      const unitMinor = toMinorUnits(product.price);
      if (unitMinor < 0) throw new BadRequestException('Invalid product price');
      rawTotalMinorUnits += unitMinor * reqItem.quantity;
      billLinesForStock.push({ productId: product.id, productName: product.name, quantity: reqItem.quantity });
      snapItems.push({
        id: randomUUID(), productId: product.id, productName: product.name, price: fromMinorUnits(unitMinor),
        quantity: reqItem.quantity, ...(reqItem.note?.trim() ? { note: reqItem.note.trim() } : {}),
        status: 'served', createdAt: now.toISOString(),
      });
    }

    const quickOrderId = randomUUID();
    const orderNumber = await allocateNextOrderNumber(em, restaurantId, now);
    return {
      table: null, tableName: 'hızlı satış', section: 'kasa', waiterName: actorName, openedAt: now,
      rawTotalMinorUnits, orderIdsToClose: [quickOrderId],
      ordersSnapshot: [{
        id: quickOrderId, orderNumber, tableId: 'quick-sale', userId: actorId, userName: actorName,
        status: 'closed', createdAt: now.toISOString(), updatedAt: now.toISOString(), items: snapItems,
      }],
      billLinesForStock,
    };
  }

  private async resolveLedgerCustomer(
    em: EntityManager, restaurantId: string, dto: CloseCheckDto, settlement: CheckSettlementResult,
  ): Promise<LedgerCustomerEntity | null> {
    if (settlement.ledgerMinorUnits <= 0 && dto.method !== 'ledger') return null;
    if (!dto.ledgerCustomerId) throw new BadRequestException('ledgerCustomerId is required when recording a ledger debt');
    const customer = await em.findOne(LedgerCustomerEntity, {
      where: { id: dto.ledgerCustomerId, restaurantId }, lock: { mode: 'pessimistic_write' },
    });
    if (!customer) throw new NotFoundException('Ledger customer not found');
    return customer;
  }

  private async saveCompletedOrder(
    em: EntityManager, restaurantId: string, ctx: BillContext, settlement: CheckSettlementResult,
    method: string, actorId: string, actorName: string, ledgerCustomer: LedgerCustomerEntity | null, now: Date,
  ): Promise<CompletedOrderEntity> {
    if (ctx.table) {
      const sessionOrderIds = [...new Set([...(ctx.activeOrders ?? []).map((o) => o.id), ...ctx.orderIdsToClose])];
      const existing = await findExistingSessionCompletedOrder(
        em, restaurantId, ctx.tableName, ctx.openedAt, sessionOrderIds,
      );
      if (existing) {
        applyConsolidatedCompletedOrderUpdate({
          existing, tableId: ctx.table.id, tableName: ctx.tableName, section: ctx.section,
          waiterName: ctx.waiterName, orderIdsToClose: ctx.orderIdsToClose,
          ordersSnapshot: ctx.ordersSnapshot, settlement, method, actorName, ledgerCustomer, now,
        });
        return em.save(CompletedOrderEntity, existing);
      }
    }
    const paymentSnapshot = buildCompletedPaymentSnapshot({
      tableId: ctx.table ? ctx.table.id : 'quick-sale', tableName: ctx.tableName, orderIds: ctx.orderIdsToClose,
      method, settlement, processedBy: actorName, createdAt: now, ledgerCustomer,
    });
    const entity = em.create(CompletedOrderEntity, {
      restaurantId, tableName: ctx.tableName, section: ctx.section, waiter: ctx.waiterName,
      totalAmount: fromMinorUnits(settlement.rawTotalMinorUnits),
      discountAmount: fromMinorUnits(settlement.discountMinorUnits),
      netAmount: fromMinorUnits(settlement.netMinorUnits),
      closedBy: actorName, openedAt: ctx.openedAt, closedAt: now, paymentMethod: method,
      paymentSplit: settlement.normalizedSplits ?? null, paymentDiscount: settlement.discountSnapshot ?? null,
      paymentTip: fromMinorUnits(settlement.tipMinorUnits), ordersSnapshot: ctx.ordersSnapshot, paymentSnapshot,
    });
    return em.save(CompletedOrderEntity, entity);
  }

  private async recordCashSaleIfNeeded(
    em: EntityManager, restaurantId: string, shiftId: string, tableName: string, completedOrderId: string, method: string, cashMinorUnits: number, actorName: string,
  ): Promise<CashTransactionEntity | null> {
    if (cashMinorUnits <= 0) return null;
    const existingTx = await em.findOne(CashTransactionEntity, {
      where: { restaurantId, shiftId, type: 'sale', reference: completedOrderId },
    });
    if (existingTx) {
      existingTx.amount = fromMinorUnits(toMinorUnits(existingTx.amount) + cashMinorUnits);
      existingTx.description = `${tableName} - Check (split cash)`;
      existingTx.createdBy = actorName;
      return em.save(CashTransactionEntity, existingTx);
    }
    const tx = em.create(CashTransactionEntity, {
      restaurantId, shiftId, type: 'sale', amount: fromMinorUnits(cashMinorUnits),
      description: method === 'split' ? `${tableName} - Check (split cash)` : `${tableName} - Check`,
      reference: completedOrderId, createdBy: actorName,
    });
    return em.save(CashTransactionEntity, tx);
  }
}
