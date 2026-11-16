import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { OrderEntity } from '../../domain/order.entity';
import { OrderItemEntity } from '../../domain/order-item.entity';
import { TableEntity } from '../../domain/table.entity';
import { RestaurantStaffEntity } from '../../domain/restaurant-staff.entity';
import { ProductEntity } from '../../domain/product.entity';
import { CashShiftEntity } from '../../domain/cash-shift.entity';
import { CashTransactionEntity } from '../../domain/cash-transaction.entity';
import { CompletedOrderEntity } from '../../domain/completed-order.entity';
import { LedgerCustomerEntity } from '../../domain/ledger-customer.entity';
import {
  CheckSettlementPolicy,
  CheckSettlementResult,
  SettlementActorPolicy,
} from '../../domain/services/check-settlement.policy';
import { BilledOrderLineForStock } from '../../domain/services/recipe-stock.policy';
import { OrderStatusPolicy } from '../../domain/services/order-status.policy';
import { CloseCheckDto, CloseCheckWalkInItemDto } from '../../api/dto/close-check.dto';
import { OrdersGateway } from '../../api/orders.gateway';
import { LedgerService } from '../ledger.service';
import { StockMovementsService } from '../stock-movements.service';
import { fromMinorUnits, toMinorUnits } from '../../../common/money/minor-units';
import {
  buildClosedOrderSnapshot,
  buildCompletedPaymentSnapshot,
  serializeCashShift,
  serializeCashTransaction,
  serializeCompletedOrder,
  serializeStockMovement,
} from './order.mapper';

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
}

@Injectable()
export class CloseCheckUseCase {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    private readonly ordersGateway: OrdersGateway,
    private readonly ledgerService: LedgerService,
    private readonly stockMovementsService: StockMovementsService,
  ) {}

  async execute(
    restaurantId: string,
    dto: CloseCheckDto,
    actor: { id: string; name: string } & SettlementActorPolicy,
  ) {
    const hasTable = Boolean(dto.tableId?.trim());
    const hasWalkInItems = Boolean(dto.items && dto.items.length > 0);
    if ((hasTable && hasWalkInItems) || (!hasTable && !hasWalkInItems)) {
      throw new BadRequestException('Exactly one of tableId or walk-in items must be provided');
    }

    const txResult = await this.orderRepo.manager.transaction(async (em) => {
      const shift = await em.findOne(CashShiftEntity, {
        where: { restaurantId, status: 'open' },
        order: { openedAt: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!shift) {
        throw new BadRequestException(
          'Cannot process transaction without an open cash shift. Please open a shift first.',
        );
      }

      const now = new Date();
      const actorId = (actor.id || '').trim() || restaurantId;
      const actorName = (actor.name || '').trim() || 'Register';

      const billContext = hasTable
        ? await this.loadTableBillContext(em, restaurantId, dto.tableId!, actorId, actorName, now)
        : await this.buildWalkInBillContext(em, restaurantId, dto.items!, actorId, actorName, now);

      const settlement = CheckSettlementPolicy.computeSettlement({
        rawTotalMinorUnits: billContext.rawTotalMinorUnits,
        method: dto.method,
        discount: dto.discount ?? null,
        splitDetails: dto.splitDetails ?? null,
        ledgerCustomerId: dto.ledgerCustomerId ?? null,
        ledgerDebtAmount: dto.ledgerDebtAmount ?? null,
        tip: dto.tip ?? null,
      });

      CheckSettlementPolicy.assertDiscountAllowedForActor(
        settlement.rawTotalMinorUnits,
        settlement.discountMinorUnits,
        dto.discount,
        actor,
      );

      const ledgerCustomer = await this.resolveLedgerCustomer(em, restaurantId, dto, settlement);
      const savedCompleted = await this.saveCompletedOrder(
        em, restaurantId, billContext, settlement, dto.method, actorId, actorName, ledgerCustomer, now,
      );

      if (ledgerCustomer && settlement.ledgerMinorUnits > 0) {
        await this.ledgerService.recordDebtInTransaction(em, {
          restaurantId,
          customerId: ledgerCustomer.id,
          amount: fromMinorUnits(settlement.ledgerMinorUnits),
          description: `${billContext.tableName} table check`,
          tableId: billContext.table ? billContext.table.id : null,
          tableName: billContext.tableName,
          completedOrderId: savedCompleted.id,
          snapshot: billContext.ordersSnapshot,
          recordedBy: actorName,
        });
      }

      if (billContext.table) {
        await em.update(
          OrderEntity,
          { id: In(billContext.orderIdsToClose), restaurantId },
          { status: 'closed', updatedAt: now },
        );
        billContext.table.markEmpty();
        await em.save(TableEntity, billContext.table);
      }

      const savedCashTx = await this.recordCashSaleIfNeeded(
        em, restaurantId, shift.id, billContext.tableName, dto.method, settlement.cashMinorUnits, actorName,
      );

      shift.recordCheckSettlement({
        netMinorUnits: settlement.netMinorUnits,
        cashMinorUnits: settlement.cashMinorUnits,
        cardMinorUnits: settlement.cardMinorUnits,
        mealCardMinorUnits: settlement.mealCardMinorUnits,
        multinetMinorUnits: settlement.multinetMinorUnits,
      });
      const savedShift = await em.save(CashShiftEntity, shift);
      const savedMovements = await this.stockMovementsService.deductRecipeIngredients(
        em, restaurantId, billContext.billLinesForStock, actorName,
      );

      return { savedCompleted, savedShift, savedCashTx, savedMovements };
    });

    if (hasTable) {
      void this.ordersGateway.emitTableSessionPresence(restaurantId).catch(() => undefined);
      this.ordersGateway.emitOrdersUpdated(restaurantId);
    }

    return {
      completedOrder: serializeCompletedOrder(txResult.savedCompleted),
      shift: serializeCashShift(txResult.savedShift),
      cashTransaction: txResult.savedCashTx ? serializeCashTransaction(txResult.savedCashTx) : null,
      stockMovements: txResult.savedMovements.map(serializeStockMovement),
    };
  }

  private async loadTableBillContext(
    em: EntityManager, restaurantId: string, tableId: string, actorId: string, actorName: string, now: Date,
  ): Promise<BillContext> {
    const table = await em.findOne(TableEntity, { where: { id: tableId, restaurantId }, lock: { mode: 'pessimistic_write' } });
    if (!table) throw new NotFoundException('Table not found');

    const activeOrders = await em.find(OrderEntity, {
      where: { restaurantId, tableId: table.id, status: 'active' },
      order: { createdAt: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    if (!activeOrders.length) throw new BadRequestException('No active orders found on this table');

    const orderIdsToClose = activeOrders.map((o) => o.id);
    const orderItems = await em.find(OrderItemEntity, { where: { orderId: In(orderIdsToClose) }, order: { createdAt: 'ASC' } });
    const itemsByOrderId = new Map<string, OrderItemEntity[]>();
    for (const item of orderItems) {
      const arr = itemsByOrderId.get(item.orderId) ?? [];
      arr.push(item);
      itemsByOrderId.set(item.orderId, arr);
    }

    const staffIds = [...new Set(activeOrders.map((o) => o.userId?.trim() || '').filter(Boolean))];
    const staffRows = staffIds.length
      ? await em.find(RestaurantStaffEntity, { where: { restaurantId, id: In(staffIds) }, select: ['id', 'name'] })
      : [];
    const staffNameById = new Map(staffRows.map((s) => [s.id, (s.name || '').trim()]));
    const latestOrder = [...activeOrders].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
    const latestUid = latestOrder?.userId?.trim() || '';
    const waiterName = latestOrder?.userDisplayName?.trim() || (latestUid ? staffNameById.get(latestUid) : '') || actorName;

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
      ordersSnapshot.push(buildClosedOrderSnapshot(order, lines, staffNameById, actorId, now));
    }

    return {
      table,
      tableName: (table.name || '').trim() || table.id,
      section: (table.section || '').trim() || 'default',
      waiterName,
      openedAt: activeOrders[0].createdAt ?? now,
      rawTotalMinorUnits,
      orderIdsToClose,
      ordersSnapshot,
      billLinesForStock,
    };
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
    return {
      table: null, tableName: 'Walk-in Sale', section: 'Register', waiterName: actorName, openedAt: now,
      rawTotalMinorUnits, orderIdsToClose: [quickOrderId],
      ordersSnapshot: [{
        id: quickOrderId, tableId: 'quick-sale', userId: actorId, userName: actorName, status: 'closed',
        createdAt: now.toISOString(), updatedAt: now.toISOString(), items: snapItems,
      }],
      billLinesForStock,
    };
  }

  private async resolveLedgerCustomer(
    em: EntityManager, restaurantId: string, dto: CloseCheckDto, settlement: CheckSettlementResult,
  ): Promise<LedgerCustomerEntity | null> {
    if (settlement.ledgerMinorUnits <= 0 && dto.method !== 'ledger') return null;
    if (!dto.ledgerCustomerId) throw new BadRequestException('ledgerCustomerId is required when recording a ledger debt');
    const customer = await em.findOne(LedgerCustomerEntity, { where: { id: dto.ledgerCustomerId, restaurantId } });
    if (!customer) throw new NotFoundException('Ledger customer not found');
    return customer;
  }

  private async saveCompletedOrder(
    em: EntityManager, restaurantId: string, ctx: BillContext, settlement: CheckSettlementResult,
    method: string, actorId: string, actorName: string, ledgerCustomer: LedgerCustomerEntity | null, now: Date,
  ): Promise<CompletedOrderEntity> {
    const paymentSnapshot = buildCompletedPaymentSnapshot({
      tableId: ctx.table ? ctx.table.id : 'quick-sale',
      tableName: ctx.tableName,
      orderIds: ctx.orderIdsToClose,
      method,
      settlement,
      processedBy: actorId,
      createdAt: now,
      ledgerCustomer,
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
    em: EntityManager, restaurantId: string, shiftId: string, tableName: string, method: string, cashMinorUnits: number, actorName: string,
  ): Promise<CashTransactionEntity | null> {
    if (cashMinorUnits <= 0) return null;
    const tx = em.create(CashTransactionEntity, {
      restaurantId, shiftId, type: 'sale', amount: fromMinorUnits(cashMinorUnits),
      description: method === 'split' ? `${tableName} - Check (split cash)` : `${tableName} - Check`,
      reference: tableName, createdBy: actorName,
    });
    return em.save(CashTransactionEntity, tx);
  }
}
