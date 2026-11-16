import { randomUUID } from 'crypto';
import { OrderEntity } from '../../domain/order.entity';
import { OrderItemEntity } from '../../domain/order-item.entity';
import { CompletedOrderEntity } from '../../domain/completed-order.entity';
import { CashShiftEntity } from '../../domain/cash-shift.entity';
import { CashTransactionEntity } from '../../domain/cash-transaction.entity';
import { StockMovementEntity } from '../../domain/stock-movement.entity';
import { LedgerCustomerEntity } from '../../domain/ledger-customer.entity';
import { CheckSettlementResult } from '../../domain/services/check-settlement.policy';
import { fromMinorUnits, toMinorUnits } from '../../../common/money/minor-units';

export function serializeOrder(
  order: OrderEntity,
  staffNameMap: Map<string, string>,
): Record<string, unknown> {
  const uid = order.userId?.trim() ?? null;
  const userName =
    (order.userDisplayName && order.userDisplayName.trim()) ||
    (uid ? staffNameMap.get(uid) ?? null : null);
  return {
    id: order.id,
    restaurantId: order.restaurantId,
    tableId: order.tableId,
    userId: order.userId,
    userName,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    mergedFrom: order.mergedFrom ?? null,
    kitchenTicketPrintedAt: order.kitchenTicketPrintedAt ?? null,
    items: (order.items || []).map((item) => ({
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      productName: item.productName,
      price: Number(item.price),
      quantity: item.quantity,
      note: item.note ?? undefined,
      status: item.status,
      createdAt: item.createdAt,
      cancelReason: item.cancelReason ?? undefined,
      cancelledBy: item.cancelledBy ?? undefined,
      cancelledAt: item.cancelledAt?.toISOString(),
    })),
  };
}

export function buildClosedOrderSnapshot(
  order: OrderEntity,
  lines: OrderItemEntity[],
  staffNameById: Map<string, string>,
  fallbackUserId: string,
  closedAt: Date,
): Record<string, unknown> {
  const uid = order.userId?.trim() || '';
  const resolvedUserName =
    order.userDisplayName?.trim() ||
    (uid ? staffNameById.get(uid) || undefined : undefined);

  return {
    id: order.id,
    tableId: order.tableId,
    userId: order.userId ?? fallbackUserId,
    ...(resolvedUserName ? { userName: resolvedUserName } : {}),
    ...(order.mergedFrom ? { mergedFrom: order.mergedFrom } : {}),
    status: 'closed',
    createdAt: order.createdAt.toISOString(),
    updatedAt: closedAt.toISOString(),
    items: lines.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      price: fromMinorUnits(toMinorUnits(i.price)),
      quantity: i.quantity,
      ...(i.note ? { note: i.note } : {}),
      status: i.status,
      createdAt: i.createdAt.toISOString(),
      ...(i.cancelReason ? { cancelReason: i.cancelReason } : {}),
      ...(i.cancelledBy ? { cancelledBy: i.cancelledBy } : {}),
      ...(i.cancelledAt ? { cancelledAt: i.cancelledAt.toISOString() } : {}),
    })),
  };
}

export function buildCompletedPaymentSnapshot(params: {
  tableId: string;
  tableName: string;
  orderIds: string[];
  method: string;
  settlement: CheckSettlementResult;
  processedBy: string;
  createdAt: Date;
  ledgerCustomer: LedgerCustomerEntity | null;
}): Record<string, unknown> {
  const { settlement, ledgerCustomer } = params;
  return {
    id: randomUUID(),
    tableId: params.tableId,
    tableName: params.tableName,
    orderIds: params.orderIds,
    amount: fromMinorUnits(settlement.netMinorUnits),
    method: params.method,
    ...(settlement.normalizedSplits ? { splitDetails: settlement.normalizedSplits } : {}),
    ...(settlement.discountSnapshot ? { discount: settlement.discountSnapshot } : {}),
    ...(settlement.tipMinorUnits > 0
      ? { tip: fromMinorUnits(settlement.tipMinorUnits) }
      : {}),
    processedBy: params.processedBy,
    createdAt: params.createdAt.toISOString(),
    ...(ledgerCustomer
      ? {
          ledgerCustomerId: ledgerCustomer.id,
          ledgerCustomerName: ledgerCustomer.name,
        }
      : {}),
  };
}

export function serializeCompletedOrder(entity: CompletedOrderEntity) {
  return {
    id: entity.id,
    tableName: entity.tableName,
    section: entity.section,
    waiter: entity.waiter,
    orders: entity.ordersSnapshot,
    payment: entity.paymentSnapshot,
    totalAmount: Number(entity.totalAmount),
    discountAmount: Number(entity.discountAmount),
    netAmount: Number(entity.netAmount),
    closedBy: entity.closedBy,
    openedAt: entity.openedAt,
    closedAt: entity.closedAt,
    paymentMethod: entity.paymentMethod,
    paymentSplit: entity.paymentSplit,
    paymentDiscount: entity.paymentDiscount,
    paymentTip: Number(entity.paymentTip),
    createdAt: entity.createdAt,
  };
}

export function serializeCashShift(shift: CashShiftEntity) {
  return {
    id: shift.id,
    openedBy: shift.openedBy,
    openedAt: shift.openedAt,
    closedAt: shift.closedAt,
    closedBy: shift.closedBy,
    status: shift.status,
    openingBalance: Number(shift.openingBalance),
    closingBalance: shift.closingBalance != null ? Number(shift.closingBalance) : null,
    notes: shift.notes,
    cashIn: Number(shift.cashIn ?? 0),
    cashOut: Number(shift.cashOut ?? 0),
    totalRevenue: Number(shift.totalRevenue ?? 0),
    totalCash: Number(shift.totalCash ?? 0),
    totalCard: Number(shift.totalCard ?? 0),
    totalMealCard: Number(shift.totalMealCard ?? 0),
    totalMultinet: Number(shift.totalMultinet ?? 0),
    transactionCount: shift.transactionCount ?? 0,
  };
}

export function serializeCashTransaction(tx: CashTransactionEntity) {
  return {
    id: tx.id,
    restaurantId: tx.restaurantId,
    shiftId: tx.shiftId,
    type: tx.type,
    amount: Number(tx.amount),
    description: tx.description,
    reference: tx.reference,
    createdBy: tx.createdBy,
    createdAt: tx.createdAt,
  };
}

export function serializeStockMovement(movement: StockMovementEntity) {
  return {
    id: movement.id,
    restaurantId: movement.restaurantId,
    materialId: movement.materialId,
    materialName: movement.materialName,
    type: movement.type,
    quantity: Number(movement.quantity),
    previousStock: Number(movement.previousStock),
    newStock: Number(movement.newStock),
    unitCost: movement.unitCost != null ? Number(movement.unitCost) : null,
    totalCost: movement.totalCost != null ? Number(movement.totalCost) : null,
    supplierId: movement.supplierId,
    reason: movement.reason,
    createdBy: movement.createdBy,
    createdAt: movement.createdAt,
  };
}
