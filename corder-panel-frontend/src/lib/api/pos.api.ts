import { request } from "./http-client"
import type { TableDto } from "./api-types"
import { tablesApi, ordersApi } from "./orders-tables.api"
import {
  shiftsApi,
  completedOrdersApi,
  ledgerCustomersApi,
  cashTransactionsApi,
  openAccountsApi,
} from "./billing.api"

export const posApi = {
  tables: tablesApi,
  orders: ordersApi,
  shifts: shiftsApi,
  completedOrders: completedOrdersApi,
  ledgerCustomers: ledgerCustomersApi,
  cashTransactions: cashTransactionsApi,
  openAccounts: openAccountsApi,
  printShiftReport: (token: string, shiftId: string) =>
    request<{ ok: boolean; jobId: string }>(
      `/restaurant/cash-register/shifts/${shiftId}/print-report`,
      { method: "POST", token },
    ),
  bulkCreateTables: (
    token: string,
    body: {
      section: string
      prefix: string
      startNumber: number
      count: number
      capacity?: number
    },
  ) =>
    request<TableDto[]>("/restaurant/tables/bulk", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }),
}

export {
  tablesApi,
  ordersApi,
  shiftsApi,
  completedOrdersApi,
  ledgerCustomersApi,
  cashTransactionsApi,
  openAccountsApi,
}
export type { TableDto }
