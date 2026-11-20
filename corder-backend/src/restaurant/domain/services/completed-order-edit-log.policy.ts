import { randomUUID } from 'crypto';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { fromMinorUnits, toMinorUnits } from '../../../common/money/minor-units';
import { normalizeStorageText } from '../../../common/text/text-normalizer';
import {
  CheckSettlementPolicy,
  type CheckSettlementResult,
  type SettlementActorPolicy,
} from './check-settlement.policy';
import { OrderStatusPolicy } from './order-status.policy';
import type { BilledOrderLineForStock } from './recipe-stock.policy';

export function sumActiveCompletedOrderLinesMinorUnits(
  orders: { items: { status: string; price: number; quantity: number }[] }[],
): number {
  let sumMinorUnits = 0;
  for (const order of orders) {
    for (const item of order.items || []) {
      if (!OrderStatusPolicy.isItemOnActiveBill(item.status)) continue;
      const qty = Math.max(0, Math.floor(Number(item.quantity) || 0));
      const unitMinor = toMinorUnits(item.price);
      if (unitMinor < 0) {
        throw new BadRequestException('Invalid item price in completed order');
      }
      sumMinorUnits += unitMinor * qty;
    }
  }
  return sumMinorUnits;
}

export function extractStockLinesFromCompletedOrdersSnapshot(
  ordersSnapshot: unknown,
): BilledOrderLineForStock[] {
  if (!Array.isArray(ordersSnapshot)) return [];
  const out: BilledOrderLineForStock[] = [];
  for (const ord of ordersSnapshot) {
    const items =
      (
        ord as {
          items?: Array<{
            productId?: string;
            productName?: string;
            quantity?: number;
            status?: string;
          }>;
        }
      )?.items ?? [];
    for (const item of items) {
      if (
        !item?.productId ||
        !OrderStatusPolicy.isItemOnActiveBill(String(item.status ?? 'served'))
      ) {
        continue;
      }
      const qty = Math.max(0, Math.floor(Number(item.quantity) || 0));
      if (qty > 0) {
        out.push({
          productId: String(item.productId),
          productName: String(item.productName ?? 'Product'),
          quantity: qty,
        });
      }
    }
  }
  return out;
}

export function preserveCompletedOrderSnapshotNumbers(
  prevOrdersSnapshot: unknown,
  nextOrders: Array<{ id: string; orderNumber?: string | null }>,
): void {
  const prevOrderNumberById = new Map<string, string>();
  if (Array.isArray(prevOrdersSnapshot)) {
    for (const snap of prevOrdersSnapshot as Array<{ id?: unknown; orderNumber?: unknown }>) {
      if (
        typeof snap?.id === 'string' &&
        typeof snap?.orderNumber === 'string' &&
        snap.orderNumber.trim()
      ) {
        prevOrderNumberById.set(snap.id, snap.orderNumber.trim());
      }
    }
  }
  for (const ord of nextOrders) {
    if (!ord.orderNumber && prevOrderNumberById.has(ord.id)) {
      ord.orderNumber = prevOrderNumberById.get(ord.id);
    }
  }
}

export function assertCompletedOrderEditPermissions(params: {
  settlement: CheckSettlementResult;
  prevDiscountMinor: number;
  prevLedgerMinor: number;
  prevPaymentDiscount: unknown;
  prevDiscountAppliedBy?: string;
  requestedDiscount: {
    type: 'percent' | 'amount' | 'complimentary';
    value: number;
    amount?: number;
    reason?: string;
    appliedBy?: string;
  } | null;
  safeActorName: string;
  actor?: { id?: string } & SettlementActorPolicy;
}): void {
  const {
    settlement,
    prevDiscountMinor,
    prevLedgerMinor,
    prevPaymentDiscount,
    prevDiscountAppliedBy,
    requestedDiscount,
    safeActorName,
    actor,
  } = params;
  const discountChanged =
    settlement.discountMinorUnits > prevDiscountMinor ||
    JSON.stringify(requestedDiscount ?? null) !==
      JSON.stringify(prevPaymentDiscount ?? null);
  if (discountChanged && settlement.discountMinorUnits > 0) {
    CheckSettlementPolicy.assertDiscountAllowedForActor(
      settlement.rawTotalMinorUnits,
      settlement.discountMinorUnits,
      requestedDiscount ?? null,
      actor,
    );
  }
  if (settlement.discountSnapshot) {
    settlement.discountSnapshot.appliedBy = discountChanged
      ? safeActorName
      : normalizeStorageText(
          requestedDiscount?.appliedBy || prevDiscountAppliedBy || safeActorName,
        );
  }
  if (
    settlement.ledgerMinorUnits > prevLedgerMinor &&
    actor &&
    !actor.isBoss &&
    !(actor.permissions ?? []).includes('ledger.assign_order')
  ) {
    throw new ForbiddenException(
      'You do not have permission to assign checks to a customer ledger (ledger.assign_order)',
    );
  }
}

export type CompletedOrderEditChangeType =
  | 'item_cancelled'
  | 'item_restored'
  | 'item_quantity_changed'
  | 'item_cancel_reason_changed'
  | 'payment_method_changed'
  | 'payment_split_changed'
  | 'ledger_customer_changed'
  | 'discount_changed'
  | 'net_amount_changed';

export interface CompletedOrderEditSplitPart {
  method: string;
  amount: number;
}

export interface CompletedOrderEditChangeItem {
  type: CompletedOrderEditChangeType;
  orderIndex?: number;
  orderNumber?: string | null;
  productName?: string;
  unitPrice?: number;
  quantity?: number;
  previousQuantity?: number;
  nextQuantity?: number;
  lineTotal?: number;
  previousLineTotal?: number;
  nextLineTotal?: number;
  cancelReason?: string | null;
  previousCancelReason?: string | null;
  previousMethod?: string;
  nextMethod?: string;
  previousSplit?: CompletedOrderEditSplitPart[] | null;
  nextSplit?: CompletedOrderEditSplitPart[] | null;
  previousCustomerName?: string | null;
  nextCustomerName?: string | null;
  previousDiscountAmount?: number;
  nextDiscountAmount?: number;
  previousTotalAmount?: number;
  nextTotalAmount?: number;
  previousNetAmount?: number;
  nextNetAmount?: number;
}

export interface CompletedOrderEditLogEntry {
  id: string;
  editedAt: string;
  editedBy: string;
  editedByUserId?: string | null;
  previousTotalAmount: number;
  nextTotalAmount: number;
  previousDiscountAmount: number;
  nextDiscountAmount: number;
  previousNetAmount: number;
  nextNetAmount: number;
  previousMethod: string;
  nextMethod: string;
  previousSplit?: CompletedOrderEditSplitPart[] | null;
  nextSplit?: CompletedOrderEditSplitPart[] | null;
  previousLedgerCustomerName?: string | null;
  nextLedgerCustomerName?: string | null;
  changes: CompletedOrderEditChangeItem[];
}

interface SnapshotOrderItemLike {
  id?: string;
  productId?: string;
  productName?: string;
  price?: number;
  quantity?: number;
  status?: string;
  cancelReason?: string;
}

interface SnapshotOrderLike {
  id?: string;
  orderNumber?: string | null;
  items?: SnapshotOrderItemLike[];
}

function normalizeSplitParts(raw: unknown): CompletedOrderEditSplitPart[] | null {
  if (!Array.isArray(raw)) return null;
  const parts = raw
    .map((s) => {
      const m = String((s as { method?: unknown })?.method ?? '').trim();
      const amt = fromMinorUnits(toMinorUnits(Number((s as { amount?: unknown })?.amount ?? 0)));
      return { method: m, amount: amt };
    })
    .filter((s) => s.method && s.amount > 0);
  return parts.length > 0 ? parts : null;
}

function splitsAreEqual(
  a: CompletedOrderEditSplitPart[] | null,
  b: CompletedOrderEditSplitPart[] | null,
): boolean {
  const listA = a ?? [];
  const listB = b ?? [];
  if (listA.length !== listB.length) return false;
  const sig = (list: CompletedOrderEditSplitPart[]) =>
    [...list]
      .sort((x, y) => x.method.localeCompare(y.method))
      .map((x) => `${x.method}:${toMinorUnits(x.amount)}`)
      .join('|');
  return sig(listA) === sig(listB);
}

export function buildCompletedOrderEditLogEntry(params: {
  editedBy: string;
  editedByUserId?: string | null;
  editedAt?: Date;
  previousOrdersSnapshot: unknown;
  nextOrdersSnapshot: unknown;
  previousTotalAmount: number;
  nextTotalAmount: number;
  previousDiscountAmount: number;
  nextDiscountAmount: number;
  previousNetAmount: number;
  nextNetAmount: number;
  previousMethod: string;
  nextMethod: string;
  previousSplit: unknown;
  nextSplit: unknown;
  previousLedgerCustomerName?: string | null;
  nextLedgerCustomerName?: string | null;
}): CompletedOrderEditLogEntry {
  const changes: CompletedOrderEditChangeItem[] = [];

  const prevOrders: SnapshotOrderLike[] = Array.isArray(params.previousOrdersSnapshot)
    ? (params.previousOrdersSnapshot as SnapshotOrderLike[])
    : [];
  const nextOrders: SnapshotOrderLike[] = Array.isArray(params.nextOrdersSnapshot)
    ? (params.nextOrdersSnapshot as SnapshotOrderLike[])
    : [];

  const prevItemsById = new Map<
    string,
    { item: SnapshotOrderItemLike; orderIndex: number; orderNumber: string | null }
  >();
  prevOrders.forEach((ord, oi) => {
    const orderNumber = typeof ord?.orderNumber === 'string' ? ord.orderNumber : null;
    (ord?.items ?? []).forEach((it, ii) => {
      const key = String(it?.id || `${ord?.id || oi}:${ii}`);
      prevItemsById.set(key, { item: it, orderIndex: oi + 1, orderNumber });
    });
  });

  nextOrders.forEach((ord, oi) => {
    const orderIndex = oi + 1;
    const orderNumber = typeof ord?.orderNumber === 'string' ? ord.orderNumber : null;
    (ord?.items ?? []).forEach((nextIt, ii) => {
      const key = String(nextIt?.id || `${ord?.id || oi}:${ii}`);
      const prevEntry = prevItemsById.get(key);
      const prevIt = prevEntry?.item;
      const productName = String(nextIt?.productName ?? prevIt?.productName ?? 'Ürün');
      const unitPrice = fromMinorUnits(toMinorUnits(Number(nextIt?.price ?? prevIt?.price ?? 0)));
      const prevQty = Math.max(0, Math.floor(Number(prevIt?.quantity ?? nextIt?.quantity ?? 0)));
      const nextQty = Math.max(0, Math.floor(Number(nextIt?.quantity ?? 0)));
      const prevStatus = String(prevIt?.status ?? 'served');
      const nextStatus = String(nextIt?.status ?? 'served');
      const wasCancelled = prevStatus === 'cancelled';
      const isCancelled = nextStatus === 'cancelled';

      if (!wasCancelled && isCancelled) {
        changes.push({
          type: 'item_cancelled',
          orderIndex,
          orderNumber: orderNumber ?? prevEntry?.orderNumber ?? null,
          productName,
          quantity: prevQty || nextQty,
          unitPrice,
          lineTotal: fromMinorUnits(toMinorUnits(unitPrice) * (prevQty || nextQty)),
          cancelReason: nextIt?.cancelReason?.trim() || null,
        });
      } else if (wasCancelled && !isCancelled) {
        changes.push({
          type: 'item_restored',
          orderIndex,
          orderNumber: orderNumber ?? prevEntry?.orderNumber ?? null,
          productName,
          quantity: nextQty,
          unitPrice,
          lineTotal: fromMinorUnits(toMinorUnits(unitPrice) * nextQty),
        });
      } else if (!isCancelled && prevIt && prevQty !== nextQty) {
        changes.push({
          type: 'item_quantity_changed',
          orderIndex,
          orderNumber: orderNumber ?? prevEntry?.orderNumber ?? null,
          productName,
          previousQuantity: prevQty,
          nextQuantity: nextQty,
          unitPrice,
          previousLineTotal: fromMinorUnits(toMinorUnits(unitPrice) * prevQty),
          nextLineTotal: fromMinorUnits(toMinorUnits(unitPrice) * nextQty),
        });
      } else if (
        isCancelled &&
        prevIt &&
        (prevIt.cancelReason?.trim() || '') !== (nextIt.cancelReason?.trim() || '')
      ) {
        changes.push({
          type: 'item_cancel_reason_changed',
          orderIndex,
          orderNumber: orderNumber ?? prevEntry?.orderNumber ?? null,
          productName,
          previousCancelReason: prevIt.cancelReason?.trim() || null,
          cancelReason: nextIt.cancelReason?.trim() || null,
        });
      }
    });
  });

  const prevSplit = normalizeSplitParts(params.previousSplit);
  const nextSplit = normalizeSplitParts(params.nextSplit);

  if (params.previousMethod !== params.nextMethod) {
    changes.push({
      type: 'payment_method_changed',
      previousMethod: params.previousMethod,
      nextMethod: params.nextMethod,
      previousSplit: prevSplit,
      nextSplit: nextSplit,
    });
  }

  if (
    (params.nextMethod === 'split' || params.previousMethod === 'split') &&
    !splitsAreEqual(prevSplit, nextSplit)
  ) {
    changes.push({
      type: 'payment_split_changed',
      previousSplit: prevSplit,
      nextSplit: nextSplit,
    });
  }

  const prevCust = params.previousLedgerCustomerName?.trim() || null;
  const nextCust = params.nextLedgerCustomerName?.trim() || null;
  if (prevCust !== nextCust) {
    changes.push({
      type: 'ledger_customer_changed',
      previousCustomerName: prevCust,
      nextCustomerName: nextCust,
    });
  }

  if (toMinorUnits(params.previousDiscountAmount) !== toMinorUnits(params.nextDiscountAmount)) {
    changes.push({
      type: 'discount_changed',
      previousDiscountAmount: fromMinorUnits(toMinorUnits(params.previousDiscountAmount)),
      nextDiscountAmount: fromMinorUnits(toMinorUnits(params.nextDiscountAmount)),
    });
  }

  if (
    toMinorUnits(params.previousNetAmount) !== toMinorUnits(params.nextNetAmount) ||
    toMinorUnits(params.previousTotalAmount) !== toMinorUnits(params.nextTotalAmount)
  ) {
    changes.push({
      type: 'net_amount_changed',
      previousTotalAmount: fromMinorUnits(toMinorUnits(params.previousTotalAmount)),
      nextTotalAmount: fromMinorUnits(toMinorUnits(params.nextTotalAmount)),
      previousNetAmount: fromMinorUnits(toMinorUnits(params.previousNetAmount)),
      nextNetAmount: fromMinorUnits(toMinorUnits(params.nextNetAmount)),
    });
  }

  return {
    id: randomUUID(),
    editedAt: (params.editedAt ?? new Date()).toISOString(),
    editedBy: params.editedBy,
    editedByUserId: params.editedByUserId ?? null,
    previousTotalAmount: fromMinorUnits(toMinorUnits(params.previousTotalAmount)),
    nextTotalAmount: fromMinorUnits(toMinorUnits(params.nextTotalAmount)),
    previousDiscountAmount: fromMinorUnits(toMinorUnits(params.previousDiscountAmount)),
    nextDiscountAmount: fromMinorUnits(toMinorUnits(params.nextDiscountAmount)),
    previousNetAmount: fromMinorUnits(toMinorUnits(params.previousNetAmount)),
    nextNetAmount: fromMinorUnits(toMinorUnits(params.nextNetAmount)),
    previousMethod: params.previousMethod,
    nextMethod: params.nextMethod,
    previousSplit: prevSplit,
    nextSplit: nextSplit,
    previousLedgerCustomerName: prevCust,
    nextLedgerCustomerName: nextCust,
    changes,
  };
}

