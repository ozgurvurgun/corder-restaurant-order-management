import { request } from "./http-client"
import type {
  CashTransactionDto,
  CompletedOrderDto,
  CompletedOrderUpdateBody,
  LedgerCustomerDto,
  LedgerEntryDto,
  OpenAccountDto,
  ShiftDto,
} from "./api-types"

export const shiftsApi = {
  getCurrent: (token: string) =>
    request<ShiftDto | null>("/restaurant/shifts/current", { token }),
  list: (token: string, limit?: number) => {
    const q = limit != null ? `?limit=${limit}` : ""
    return request<ShiftDto[]>(`/restaurant/shifts${q}`, { token })
  },
  open: (token: string, openingBalance?: number) =>
    request<ShiftDto>("/restaurant/shifts", {
      method: "POST",
      token,
      body: JSON.stringify({ openingBalance: openingBalance ?? 0 }),
    }),
  close: (token: string, id: string, closingBalance: number, notes?: string) =>
    request<ShiftDto>(`/restaurant/shifts/${id}/close`, {
      method: "PUT",
      token,
      body: JSON.stringify({ closingBalance, notes }),
    }),
}

export const completedOrdersApi = {
  list: (
    token: string,
    params?: {
      from?: string
      to?: string
      waiter?: string
      tableName?: string
      limit?: number
      offset?: number
    },
  ) => {
    const search = new URLSearchParams()
    if (params?.from) search.set("from", params.from)
    if (params?.to) search.set("to", params.to)
    if (params?.waiter) search.set("waiter", params.waiter)
    if (params?.tableName) search.set("tableName", params.tableName)
    if (params?.limit != null) search.set("limit", String(params.limit))
    if (params?.offset != null) search.set("offset", String(params.offset))
    const qs = search.toString()
    const path = qs
      ? `/restaurant/completed-orders?${qs}`
      : "/restaurant/completed-orders"
    return request<CompletedOrderDto[]>(path, { token })
  },
  update: (token: string, id: string, body: CompletedOrderUpdateBody) =>
    request<CompletedOrderDto>(
      `/restaurant/completed-orders/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        token,
        body: JSON.stringify(body),
      },
    ),
}

export const ledgerCustomersApi = {
  list: (token: string, params?: { from: string; to: string }) => {
    const qs = params
      ? `?from=${encodeURIComponent(params.from)}&to=${encodeURIComponent(params.to)}`
      : ""
    return request<LedgerCustomerDto[]>(`/restaurant/ledger-customers${qs}`, { token })
  },
  create: (token: string, body: { name: string; phone?: string; notes?: string }) =>
    request<LedgerCustomerDto>("/restaurant/ledger-customers", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }),
  entries: (token: string, id: string, params?: { from: string; to: string }) => {
    const qs = params
      ? `?from=${encodeURIComponent(params.from)}&to=${encodeURIComponent(params.to)}`
      : ""
    return request<LedgerEntryDto[]>(
      `/restaurant/ledger-customers/${encodeURIComponent(id)}/entries${qs}`,
      { token },
    )
  },
  pay: (
    token: string,
    id: string,
    amount: number,
    paymentMethod?: "cash" | "credit-card" | "meal-card" | "multinet",
  ) =>
    request<LedgerCustomerDto>(
      `/restaurant/ledger-customers/${encodeURIComponent(id)}/payments`,
      {
        method: "POST",
        token,
        body: JSON.stringify({
          amount,
          ...(paymentMethod ? { paymentMethod } : {}),
        }),
      },
    ),
}

export const cashTransactionsApi = {
  create: (
    token: string,
    body: {
      type: "expense" | "cash-in" | "cash-out" | "refund"
      amount: number
      description: string
      reference?: string
    },
  ) =>
    request<{ transaction: CashTransactionDto; shift: ShiftDto }>(
      "/restaurant/cash-transactions",
      {
        method: "POST",
        token,
        body: JSON.stringify(body),
      },
    ),
  list: (token: string, shiftId?: string) => {
    const qs = shiftId ? `?shiftId=${encodeURIComponent(shiftId)}` : ""
    return request<CashTransactionDto[]>(`/restaurant/cash-transactions${qs}`, {
      token,
    })
  },
}

export const openAccountsApi = {
  list: (token: string) =>
    request<OpenAccountDto[]>("/restaurant/open-accounts", { token }),
  create: (
    token: string,
    body: {
      customerName: string
      customerPhone?: string
      amount?: number
      description?: string
      createdBy?: string
      items?: Array<{
        productName: string
        quantity: number
        price: number
        productId?: string
        note?: string
      }>
    },
  ) =>
    request<OpenAccountDto>("/restaurant/open-accounts", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }),
  pay: (
    token: string,
    id: string,
    amount: number,
    paymentMethod?: "cash" | "credit-card" | "meal-card" | "multinet",
  ) =>
    request<OpenAccountDto>(`/restaurant/open-accounts/${id}/pay`, {
      method: "POST",
      token,
      body: JSON.stringify({
        amount,
        ...(paymentMethod ? { paymentMethod } : {}),
      }),
    }),
}
