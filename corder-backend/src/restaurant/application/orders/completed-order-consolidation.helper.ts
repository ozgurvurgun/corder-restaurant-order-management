import { EntityManager } from 'typeorm';
import { CompletedOrderEntity } from '../../domain/completed-order.entity';
import { LedgerCustomerEntity } from '../../domain/ledger-customer.entity';
import {
  CheckSettlementResult,
  DiscountSnapshot,
  NormalizedPaymentSplit,
} from '../../domain/services/check-settlement.policy';
import { OrderStatusPolicy } from '../../domain/services/order-status.policy';
import { fromMinorUnits, toMinorUnits } from '../../../common/money/minor-units';
import { normalizeStorageText } from '../../../common/text/text-normalizer';
import { buildCompletedPaymentSnapshot } from './order.mapper';

interface SnapshotItemRecord extends Record<string, unknown> {
  id?: string;
  productId?: string;
  productName?: string;
  price?: number;
  quantity?: number;
  note?: string;
  status?: string;
}

interface SnapshotOrderRecord extends Record<string, unknown> {
  id?: string;
  orderNumber?: string;
  items?: SnapshotItemRecord[];
}

export function extractPaymentParts(
  method: string,
  netMinorUnits: number,
  splits: unknown,
): NormalizedPaymentSplit[] {
  if (method === 'split' && Array.isArray(splits)) {
    const out: NormalizedPaymentSplit[] = [];
    for (const raw of splits) {
      const m = String((raw as { method?: unknown })?.method ?? '').trim();
      const minor = toMinorUnits(Number((raw as { amount?: unknown })?.amount ?? 0));
      if (m && minor > 0) {
        out.push({ method: m, amount: fromMinorUnits(minor) });
      }
    }
    if (out.length > 0) return out;
  }
  if (netMinorUnits > 0 && method) {
    return [{ method, amount: fromMinorUnits(netMinorUnits) }];
  }
  return [];
}

function normalizeSnapshotItemStatus(status: unknown): string {
  const s = typeof status === 'string' && status.trim() ? status.trim() : 'served';
  return s === 'paid' ? 'served' : s;
}

export function mergeCompletedOrdersSnapshots(
  prevRaw: unknown,
  incomingRaw: Array<Record<string, unknown>>,
  now: Date,
): Array<Record<string, unknown>> {
  const prevList: SnapshotOrderRecord[] = Array.isArray(prevRaw)
    ? (prevRaw as SnapshotOrderRecord[])
    : [];
  const mergedOrders: SnapshotOrderRecord[] = prevList.map((ord) => ({
    ...ord,
    items: Array.isArray(ord.items)
      ? ord.items.map((it) => ({
          ...it,
          status: normalizeSnapshotItemStatus(it.status),
        }))
      : [],
  }));

  const orderById = new Map<string, SnapshotOrderRecord>();
  for (const ord of mergedOrders) {
    if (typeof ord.id === 'string' && ord.id) {
      orderById.set(ord.id, ord);
    }
  }

  for (const incOrd of incomingRaw as SnapshotOrderRecord[]) {
    const ordId = typeof incOrd.id === 'string' ? incOrd.id : '';
    const incomingItems = Array.isArray(incOrd.items) ? incOrd.items : [];
    const targetOrd = ordId ? orderById.get(ordId) : undefined;

    if (!targetOrd) {
      const cloned: SnapshotOrderRecord = {
        ...incOrd,
        items: incomingItems.map((it) => ({
          ...it,
          status: normalizeSnapshotItemStatus(it.status),
        })),
      };
      mergedOrders.push(cloned);
      if (ordId) orderById.set(ordId, cloned);
      continue;
    }

    targetOrd.updatedAt = now.toISOString();
    if (!targetOrd.orderNumber && incOrd.orderNumber) {
      targetOrd.orderNumber = incOrd.orderNumber;
    }
    const targetItems = targetOrd.items ?? [];
    targetOrd.items = targetItems;

    for (const rawIt of incomingItems) {
      const normalizedStatus = normalizeSnapshotItemStatus(rawIt.status);
      const qty = Math.max(0, Math.floor(Number(rawIt.quantity) || 0));
      if (qty <= 0) continue;
      const unitMinor = toMinorUnits(Number(rawIt.price) || 0);
      const noteKey = typeof rawIt.note === 'string' ? rawIt.note.trim() : '';
      const isBillable = OrderStatusPolicy.isItemOnActiveBill(normalizedStatus);

      if (isBillable) {
        const match = targetItems.find((existingIt) => {
          const exStatus = normalizeSnapshotItemStatus(existingIt.status);
          if (!OrderStatusPolicy.isItemOnActiveBill(exStatus)) return false;
          if (rawIt.id && existingIt.id === rawIt.id) return true;
          const exNote = typeof existingIt.note === 'string' ? existingIt.note.trim() : '';
          return (
            existingIt.productId === rawIt.productId &&
            toMinorUnits(Number(existingIt.price) || 0) === unitMinor &&
            exNote === noteKey
          );
        });
        if (match) {
          match.quantity = Math.max(0, Math.floor(Number(match.quantity) || 0)) + qty;
          continue;
        }
      } else {
        const duplicateNonBillable = targetItems.some(
          (existingIt) =>
            Boolean(rawIt.id && existingIt.id === rawIt.id) &&
            normalizeSnapshotItemStatus(existingIt.status) === normalizedStatus,
        );
        if (duplicateNonBillable) continue;
      }

      targetItems.push({
        ...rawIt,
        price: fromMinorUnits(unitMinor),
        quantity: qty,
        status: normalizedStatus,
      });
    }
  }

  return mergedOrders;
}

function rowSharesAnyOrderId(
  row: CompletedOrderEntity,
  orderIdSet: Set<string>,
): boolean {
  if (orderIdSet.size === 0) return false;
  if (Array.isArray(row.ordersSnapshot)) {
    for (const snap of row.ordersSnapshot as Array<{ id?: unknown }>) {
      if (typeof snap?.id === 'string' && orderIdSet.has(snap.id)) return true;
    }
  }
  const paymentOrderIds = (row.paymentSnapshot as { orderIds?: unknown } | null)?.orderIds;
  if (Array.isArray(paymentOrderIds)) {
    for (const oid of paymentOrderIds) {
      if (typeof oid === 'string' && orderIdSet.has(oid)) return true;
    }
  }
  return false;
}

export async function findExistingSessionCompletedOrder(
  em: EntityManager,
  restaurantId: string,
  tableName: string,
  openedAt: Date,
  orderIds: string[],
): Promise<CompletedOrderEntity | null> {
  if (typeof em.find !== 'function') return null;
  const candidates = await em.find(CompletedOrderEntity, {
    where: { restaurantId, openedAt },
    order: { closedAt: 'ASC' },
    lock: { mode: 'pessimistic_write' },
  });
  if (!candidates.length) return null;
  const normalizedTable = normalizeStorageText(tableName || '');
  const orderIdSet = new Set(orderIds.filter(Boolean));
  return (
    candidates.find(
      (c) =>
        normalizeStorageText(c.tableName || '') === normalizedTable ||
        rowSharesAnyOrderId(c, orderIdSet),
    ) ?? null
  );
}

function mergeDiscountSnapshots(
  prevDiscount: unknown,
  prevDiscountMinor: number,
  currDiscount: DiscountSnapshot | undefined,
  currDiscountMinor: number,
  actorName: string,
): DiscountSnapshot | null {
  const totalDiscountMinor = prevDiscountMinor + currDiscountMinor;
  if (totalDiscountMinor <= 0) return null;
  const prevObj =
    prevDiscount && typeof prevDiscount === 'object'
      ? (prevDiscount as DiscountSnapshot)
      : undefined;
  if (prevDiscountMinor <= 0 && currDiscount) return currDiscount;
  if (currDiscountMinor <= 0 && prevObj) return prevObj;
  const reasons = [prevObj?.reason?.trim(), currDiscount?.reason?.trim()].filter(
    (r, idx, arr): r is string => Boolean(r) && arr.indexOf(r) === idx,
  );
  return {
    type: 'amount',
    value: fromMinorUnits(totalDiscountMinor),
    reason: reasons.join(' + ') || 'İndirim',
    appliedBy: currDiscount?.appliedBy || prevObj?.appliedBy || actorName,
  };
}

export function applyConsolidatedCompletedOrderUpdate(params: {
  existing: CompletedOrderEntity;
  tableId: string | null;
  tableName: string;
  section: string;
  waiterName: string;
  orderIdsToClose: string[];
  ordersSnapshot: Array<Record<string, unknown>>;
  settlement: CheckSettlementResult;
  method: string;
  actorName: string;
  ledgerCustomer: LedgerCustomerEntity | null;
  now: Date;
}): CompletedOrderEntity {
  const {
    existing,
    tableId,
    tableName,
    section,
    waiterName,
    orderIdsToClose,
    ordersSnapshot,
    settlement,
    method,
    actorName,
    ledgerCustomer,
    now,
  } = params;

  const prevRawMinor = toMinorUnits(existing.totalAmount);
  const prevDiscountMinor = toMinorUnits(existing.discountAmount);
  const prevNetMinor = toMinorUnits(existing.netAmount);
  const prevTipMinor = toMinorUnits(existing.paymentTip);

  const nextRawMinor = prevRawMinor + settlement.rawTotalMinorUnits;
  const nextDiscountMinor = prevDiscountMinor + settlement.discountMinorUnits;
  const nextNetMinor = prevNetMinor + settlement.netMinorUnits;
  const nextTipMinor = prevTipMinor + settlement.tipMinorUnits;

  const prevParts = extractPaymentParts(
    existing.paymentMethod,
    prevNetMinor,
    existing.paymentSplit,
  );
  const currParts = extractPaymentParts(
    method,
    settlement.netMinorUnits,
    settlement.normalizedSplits,
  );
  const combinedSplits = [...prevParts, ...currParts];
  const nextMethod =
    combinedSplits.length > 1 || existing.paymentMethod === 'split' || method === 'split'
      ? 'split'
      : method;
  const nextPaymentSplit = nextMethod === 'split' ? combinedSplits : null;
  const nextDiscount = mergeDiscountSnapshots(
    existing.paymentDiscount,
    prevDiscountMinor,
    settlement.discountSnapshot,
    settlement.discountMinorUnits,
    actorName,
  );
  const mergedOrders = mergeCompletedOrdersSnapshots(
    existing.ordersSnapshot,
    ordersSnapshot,
    now,
  );

  const prevPaySnap = (existing.paymentSnapshot ?? {}) as {
    id?: string;
    orderIds?: string[];
    ledgerCustomerId?: string;
    ledgerCustomerName?: string;
  };
  const combinedOrderIds = [
    ...new Set([
      ...(Array.isArray(prevPaySnap.orderIds) ? prevPaySnap.orderIds : []),
      ...orderIdsToClose,
    ]),
  ];
  const resolvedLedgerCustomer = ledgerCustomer
    ? { id: ledgerCustomer.id, name: ledgerCustomer.name }
    : prevPaySnap.ledgerCustomerId
      ? {
          id: prevPaySnap.ledgerCustomerId,
          name: prevPaySnap.ledgerCustomerName || '',
        }
      : null;

  const freshPaymentSnap = buildCompletedPaymentSnapshot({
    tableId: tableId ?? 'quick-sale',
    tableName,
    orderIds: combinedOrderIds,
    method: nextMethod,
    settlement: {
      ...settlement,
      rawTotalMinorUnits: nextRawMinor,
      discountMinorUnits: nextDiscountMinor,
      netMinorUnits: nextNetMinor,
      tipMinorUnits: nextTipMinor,
      normalizedSplits: nextPaymentSplit ?? undefined,
      discountSnapshot: nextDiscount ?? undefined,
    },
    processedBy: actorName,
    createdAt: now,
    ledgerCustomer: resolvedLedgerCustomer as LedgerCustomerEntity | null,
  });
  if (prevPaySnap.id) {
    freshPaymentSnap.id = prevPaySnap.id;
  }

  existing.tableName = tableName;
  existing.section = section;
  existing.waiter = waiterName || existing.waiter;
  existing.totalAmount = fromMinorUnits(nextRawMinor);
  existing.discountAmount = fromMinorUnits(nextDiscountMinor);
  existing.netAmount = fromMinorUnits(nextNetMinor);
  existing.closedBy = actorName;
  existing.closedAt = now;
  existing.paymentMethod = nextMethod;
  existing.paymentSplit = nextPaymentSplit;
  existing.paymentDiscount = nextDiscount;
  existing.paymentTip = fromMinorUnits(nextTipMinor);
  existing.ordersSnapshot = mergedOrders;
  existing.paymentSnapshot = freshPaymentSnap;
  return existing;
}

