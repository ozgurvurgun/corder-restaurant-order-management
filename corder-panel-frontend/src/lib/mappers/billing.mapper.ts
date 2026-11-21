import type {
  CashShift,
  CashTransaction,
  ClosedTable,
  LedgerCustomer,
  OpenAccount,
  PanelOrder,
  Payment,
} from "../panel-types"
import type {
  CashTransactionDto,
  CompletedOrderDto,
  LedgerCustomerDto,
  OpenAccountDto,
  ShiftDto,
} from "../api"
import { formatTitleCase } from "../format"

export function mapOpenAccountDtoToPanel(a: OpenAccountDto): OpenAccount {
  return {
    id: a.id,
    customerName: formatTitleCase(a.customerName),
    customerPhone: a.customerPhone ?? undefined,
    amount: a.amount,
    paidAmount: a.paidAmount,
    status: a.status as OpenAccount["status"],
    description: formatTitleCase(a.description, "tr"),
    createdBy: formatTitleCase(a.createdBy),
    createdAt: new Date(a.createdAt),
    paidAt: a.paidAt ? new Date(a.paidAt) : undefined,
    items: (a.items ?? []).map((i) => ({
      id: i.id,
      productId: i.productId ?? undefined,
      productName: formatTitleCase(i.productName),
      quantity: i.quantity,
      price: i.price,
      note: i.note ?? undefined,
    })),
    payments: (a.payments ?? []).map((p) => ({
      id: p.id,
      amount: p.amount,
      receivedBy: formatTitleCase(p.receivedBy),
      receivedByUserId: p.receivedByUserId ?? undefined,
      note: p.note ?? undefined,
      createdAt: new Date(p.createdAt),
    })),
  }
}

export function mapShiftDtoToPanel(dto: ShiftDto): CashShift {
  return {
    id: dto.id,
    openedBy: formatTitleCase(dto.openedBy),
    closedBy: dto.closedBy ? formatTitleCase(dto.closedBy) : undefined,
    openedAt: new Date(dto.openedAt),
    closedAt: dto.closedAt ? new Date(dto.closedAt) : undefined,
    openingBalance: dto.openingBalance,
    closingBalance: dto.closingBalance ?? undefined,
    status: dto.status === "closed" ? "closed" : "open",
    cashIn: dto.cashIn ?? 0,
    cashOut: dto.cashOut ?? 0,
    totalRevenue: dto.totalRevenue ?? 0,
    totalCash: dto.totalCash ?? 0,
    totalCard: dto.totalCard ?? 0,
    totalMealCard: dto.totalMealCard ?? 0,
    totalMultinet: dto.totalMultinet ?? 0,
    transactionCount: dto.transactionCount ?? 0,
    notes: dto.notes ?? undefined,
    isAutoClosed: Boolean(dto.isAutoClosed),
    carriedOverTablesCount: Number(dto.carriedOverTablesCount ?? 0),
    carriedOverTablesAmount: Number(dto.carriedOverTablesAmount ?? 0),
    carriedOverTablesSnapshot: Array.isArray(dto.carriedOverTablesSnapshot)
      ? dto.carriedOverTablesSnapshot.map((t) => ({
          ...t,
          tableName: formatTitleCase(t.tableName, "tr"),
          section: formatTitleCase(t.section, "tr"),
          openAmount: Number(t.openAmount || 0),
          itemCount: Number(t.itemCount || 0),
        }))
      : [],
  }
}

export function mapCompletedOrderDtoToClosedTable(
  dto: CompletedOrderDto,
): ClosedTable {
  const orders: PanelOrder[] = dto.orders.map((o) => ({
    id: o.id,
    ...(o.orderNumber ? { orderNumber: o.orderNumber } : {}),
    tableId: o.tableId ?? "",
    userId: o.userId ?? "",
    userName: o.userName?.trim() ? formatTitleCase(o.userName) : undefined,
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: formatTitleCase(i.productName),
      price: i.price,
      quantity: i.quantity,
      note: i.note,
      status: i.status as PanelOrder["items"][0]["status"],
      createdAt: new Date(i.createdAt),
      cancelReason: i.cancelReason,
      cancelledBy: i.cancelledBy ? formatTitleCase(i.cancelledBy) : undefined,
      cancelledAt: i.cancelledAt ? new Date(i.cancelledAt) : undefined,
    })),
    status: o.status as PanelOrder["status"],
    createdAt: new Date(o.createdAt),
    updatedAt: new Date(o.updatedAt),
    mergedFrom: o.mergedFrom ? formatTitleCase(o.mergedFrom) : undefined,
  }))

  const payment: Payment = {
    id: dto.payment.id,
    tableId: dto.payment.tableId,
    tableName: formatTitleCase(dto.payment.tableName),
    orderIds: dto.payment.orderIds,
    amount: dto.payment.amount,
    method: dto.payment.method as Payment["method"],
    splitDetails: dto.payment.splitDetails,
    discount: dto.payment.discount
      ? {
          type: dto.payment.discount.type,
          value: dto.payment.discount.value,
          reason: dto.payment.discount.reason,
          ...(dto.payment.discount.appliedBy
            ? { appliedBy: formatTitleCase(dto.payment.discount.appliedBy) }
            : {}),
        }
      : undefined,
    tip: dto.payment.tip,
    processedBy: formatTitleCase(dto.payment.processedBy),
    createdAt: new Date(dto.payment.createdAt),
    ...(dto.payment.ledgerCustomerId || dto.payment.ledgerCustomerName
      ? {
          ledgerCustomerId: dto.payment.ledgerCustomerId,
          ledgerCustomerName: dto.payment.ledgerCustomerName
            ? formatTitleCase(dto.payment.ledgerCustomerName)
            : undefined,
        }
      : {}),
  }

  const editHistory = Array.isArray(dto.editHistory)
    ? dto.editHistory.map((entry) => ({
        ...entry,
        editedBy: formatTitleCase(entry.editedBy) || "Yönetici",
        previousLedgerCustomerName: entry.previousLedgerCustomerName
          ? formatTitleCase(entry.previousLedgerCustomerName)
          : null,
        nextLedgerCustomerName: entry.nextLedgerCustomerName
          ? formatTitleCase(entry.nextLedgerCustomerName)
          : null,
        changes: Array.isArray(entry.changes)
          ? entry.changes.map((ch) => ({
              ...ch,
              ...(ch.productName
                ? { productName: formatTitleCase(ch.productName) }
                : {}),
              ...(ch.previousCustomerName
                ? { previousCustomerName: formatTitleCase(ch.previousCustomerName) }
                : {}),
              ...(ch.nextCustomerName
                ? { nextCustomerName: formatTitleCase(ch.nextCustomerName) }
                : {}),
            }))
          : [],
      }))
    : []

  const rawTableLower = (dto.tableName || "").trim().toLowerCase()
  const resolvedTableName =
    rawTableLower === "walk-in sale" ? "Hızlı Satış" : formatTitleCase(dto.tableName)
  const rawSectionLower = (dto.section || "").trim().toLowerCase()
  const resolvedSection =
    rawSectionLower === "register" ? "Kasa" : formatTitleCase(dto.section)

  return {
    id: dto.id,
    tableName: resolvedTableName,
    section: resolvedSection,
    waiter: formatTitleCase(dto.waiter),
    orders,
    payment: {
      ...payment,
      tableName: resolvedTableName,
    },
    totalAmount: dto.totalAmount,
    discountAmount: dto.discountAmount,
    netAmount: dto.netAmount,
    closedBy: formatTitleCase(dto.closedBy),
    openedAt: new Date(dto.openedAt),
    closedAt: new Date(dto.closedAt),
    editHistory,
  }
}

export function mapCashTransactionDtoToPanel(
  dto: CashTransactionDto,
): CashTransaction {
  return {
    id: dto.id,
    shiftId: dto.shiftId,
    type: dto.type,
    amount: Number(dto.amount),
    description: formatTitleCase(dto.description, "tr"),
    reference: dto.reference ?? undefined,
    createdBy: formatTitleCase(dto.createdBy),
    createdAt: new Date(dto.createdAt),
  }
}

export function mapLedgerCustomerDtoToPanel(
  c: LedgerCustomerDto,
): LedgerCustomer {
  return {
    id: c.id,
    name: formatTitleCase(c.name),
    phone: c.phone ?? undefined,
    notes: c.notes ?? undefined,
    balance: Number(c.balance),
    periodNet: c.periodNet != null ? Number(c.periodNet) : undefined,
    createdAt: new Date(c.createdAt),
  }
}
