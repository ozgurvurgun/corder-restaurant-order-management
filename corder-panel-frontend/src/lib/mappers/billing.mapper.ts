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
import { formatTitleCaseTr } from "../format"

export function mapOpenAccountDtoToPanel(a: OpenAccountDto): OpenAccount {
  return {
    id: a.id,
    customerName: formatTitleCaseTr(a.customerName),
    customerPhone: a.customerPhone ?? undefined,
    amount: a.amount,
    paidAmount: a.paidAmount,
    status: a.status as OpenAccount["status"],
    description: a.description,
    createdBy: formatTitleCaseTr(a.createdBy),
    createdAt: new Date(a.createdAt),
    paidAt: a.paidAt ? new Date(a.paidAt) : undefined,
    items: (a.items ?? []).map((i) => ({
      id: i.id,
      productId: i.productId ?? undefined,
      productName: formatTitleCaseTr(i.productName),
      quantity: i.quantity,
      price: i.price,
      note: i.note ?? undefined,
    })),
    payments: (a.payments ?? []).map((p) => ({
      id: p.id,
      amount: p.amount,
      receivedBy: formatTitleCaseTr(p.receivedBy),
      receivedByUserId: p.receivedByUserId ?? undefined,
      note: p.note ?? undefined,
      createdAt: new Date(p.createdAt),
    })),
  }
}

export function mapShiftDtoToPanel(dto: ShiftDto): CashShift {
  return {
    id: dto.id,
    openedBy: formatTitleCaseTr(dto.openedBy),
    closedBy: dto.closedBy ? formatTitleCaseTr(dto.closedBy) : undefined,
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
  }
}

export function mapCompletedOrderDtoToClosedTable(
  dto: CompletedOrderDto,
): ClosedTable {
  const orders: PanelOrder[] = dto.orders.map((o) => ({
    id: o.id,
    tableId: o.tableId ?? "",
    userId: o.userId ?? "",
    userName: o.userName?.trim() ? formatTitleCaseTr(o.userName) : undefined,
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: formatTitleCaseTr(i.productName),
      price: i.price,
      quantity: i.quantity,
      note: i.note,
      status: i.status as PanelOrder["items"][0]["status"],
      createdAt: new Date(i.createdAt),
      cancelReason: i.cancelReason,
      cancelledBy: i.cancelledBy ? formatTitleCaseTr(i.cancelledBy) : undefined,
      cancelledAt: i.cancelledAt ? new Date(i.cancelledAt) : undefined,
    })),
    status: o.status as PanelOrder["status"],
    createdAt: new Date(o.createdAt),
    updatedAt: new Date(o.updatedAt),
    mergedFrom: o.mergedFrom,
  }))

  const payment: Payment = {
    id: dto.payment.id,
    tableId: dto.payment.tableId,
    tableName: dto.payment.tableName,
    orderIds: dto.payment.orderIds,
    amount: dto.payment.amount,
    method: dto.payment.method as Payment["method"],
    splitDetails: dto.payment.splitDetails,
    discount: dto.payment.discount
      ? {
          type: dto.payment.discount.type,
          value: dto.payment.discount.value,
          reason: dto.payment.discount.reason,
        }
      : undefined,
    tip: dto.payment.tip,
    processedBy: formatTitleCaseTr(dto.payment.processedBy),
    createdAt: new Date(dto.payment.createdAt),
    ...(dto.payment.ledgerCustomerId || dto.payment.ledgerCustomerName
      ? {
          ledgerCustomerId: dto.payment.ledgerCustomerId,
          ledgerCustomerName: dto.payment.ledgerCustomerName
            ? formatTitleCaseTr(dto.payment.ledgerCustomerName)
            : undefined,
        }
      : {}),
  }

  return {
    id: dto.id,
    tableName: dto.tableName,
    section: dto.section,
    waiter: formatTitleCaseTr(dto.waiter),
    orders,
    payment,
    totalAmount: dto.totalAmount,
    discountAmount: dto.discountAmount,
    netAmount: dto.netAmount,
    closedBy: formatTitleCaseTr(dto.closedBy),
    openedAt: new Date(dto.openedAt),
    closedAt: new Date(dto.closedAt),
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
    description: dto.description,
    reference: dto.reference ?? undefined,
    createdBy: formatTitleCaseTr(dto.createdBy),
    createdAt: new Date(dto.createdAt),
  }
}

export function mapLedgerCustomerDtoToPanel(
  c: LedgerCustomerDto,
): LedgerCustomer {
  return {
    id: c.id,
    name: formatTitleCaseTr(c.name),
    phone: c.phone ?? undefined,
    notes: c.notes ?? undefined,
    balance: Number(c.balance),
    periodNet: c.periodNet != null ? Number(c.periodNet) : undefined,
    createdAt: new Date(c.createdAt),
  }
}
