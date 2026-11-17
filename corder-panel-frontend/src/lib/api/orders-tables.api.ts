import { request } from "./http-client"
import type {
  CloseCheckBody,
  CloseCheckResponseDto,
  OrderDto,
  RawTableDto,
} from "./api-types"
import type { PanelDiscountType, PanelTable } from "../panel-types"

export const tablesApi = {
  list: (token: string) =>
    request<RawTableDto[]>(
      "/restaurant/tables",
      { token },
    ),
  create: (token: string, body: { name: string; section: string }) =>
    request<RawTableDto>(
      "/restaurant/tables",
      { method: "POST", token, body: JSON.stringify(body) },
    ),
  update: (
    token: string,
    id: string,
    body: {
      name?: string
      section?: string
      status?: "empty" | "occupied" | "ordering" | "checkout"
      discount?: { type: PanelDiscountType; value: number; reason: string } | null
      splitInfo?: PanelTable["splitInfo"] | null
    },
  ) =>
    request<RawTableDto>(
      `/restaurant/tables/${id}`,
      { method: "PATCH", token, body: JSON.stringify(body) },
    ),
  delete: (token: string, id: string) =>
    request<void>(`/restaurant/tables/${id}`, { method: "DELETE", token }),
}

export const ordersApi = {
  list: (token: string, tableId?: string) => {
    const q = tableId ? `?tableId=${encodeURIComponent(tableId)}` : ""
    return request<OrderDto[]>(`/restaurant/orders${q}`, { token })
  },
  create: (
    token: string,
    body: {
      tableId: string
      items: { productId: string; quantity: number; note?: string }[]
    },
  ) =>
    request<OrderDto>("/restaurant/orders", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }),
  move: (token: string, fromTableId: string, toTableId: string) =>
    request<{ moved: number }>("/restaurant/orders/move", {
      method: "PATCH",
      token,
      body: JSON.stringify({ fromTableId, toTableId }),
    }),
  moveItems: (
    token: string,
    body: {
      fromTableId: string
      toTableId: string
      items: Array<{ itemId: string; quantity?: number }>
    },
  ) =>
    request<OrderDto>("/restaurant/orders/move-items", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }),
  closeCheck: (token: string, body: CloseCheckBody) =>
    request<CloseCheckResponseDto>("/restaurant/orders/close-check", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }),
  cancelItem: (token: string, body: { itemId: string; reason?: string; quantity?: number }) =>
    request<{ ok: true }>("/restaurant/orders/cancel-item", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }),
  assignToLedger: (
    token: string,
    body: { lines: { itemId: string; quantity?: number }[]; ledgerCustomerId: string },
  ) =>
    request<{ ok: true; amount: number }>("/restaurant/orders/assign-to-ledger", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }),
  revertLedgerItem: (token: string, body: { itemId: string }) =>
    request<{ ok: true; amount: number }>("/restaurant/orders/revert-ledger-item", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }),
  printReceipt: (
    token: string,
    body:
      | { tableId: string }
      | { orderId: string }
      | {
          tableName: string
          waiterName?: string
          items: {
            productName: string
            quantity: number
            price: number
            note?: string
            productId?: string
            categoryId?: string
          }[]
          total: number
        },
  ) =>
    request<{ ok: true; jobId: string }>("/restaurant/orders/print-receipt", {
      method: "POST",
      token,
      body: JSON.stringify({ ...body, receiptMode: "consolidated" as const }),
    }),
}
