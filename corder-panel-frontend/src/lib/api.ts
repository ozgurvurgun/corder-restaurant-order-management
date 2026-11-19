export {
  getBase,
  setAuthExpiredHandler,
  notifyAuthExpired,
  getToken,
  setToken,
  getSessionUser,
  setSessionUser,
  clearSessionUser,
  getStoredBranches,
  setStoredBranches,
  clearToken,
  getRestaurant,
  setRestaurant,
  getWsUrl,
  type PanelSessionUser,
} from "./api/http-client"

export * from "./api/api-types"

import { tablesApi, ordersApi } from "./api/orders-tables.api"
import {
  shiftsApi,
  completedOrdersApi,
  ledgerCustomersApi,
  cashTransactionsApi,
  openAccountsApi,
} from "./api/billing.api"
import {
  categoriesApi,
  productsApi,
  campaignsApi,
  uploadFile,
} from "./api/catalog.api"
import { stockApi } from "./api/inventory.api"
import {
  restaurantApi,
  rolesApi,
  staffApi,
  technicalApi,
  notificationsApi,
  securityApi,
} from "./api/system.api"

export const api = {
  restaurant: restaurantApi,
  staff: staffApi,
  roles: rolesApi,
  tables: tablesApi,
  orders: ordersApi,
  categories: categoriesApi,
  products: productsApi,
  campaigns: campaignsApi,
  upload: uploadFile,
  shifts: shiftsApi,
  completedOrders: completedOrdersApi,
  ledgerCustomers: ledgerCustomersApi,
  stock: stockApi,
  cashTransactions: cashTransactionsApi,
  technical: technicalApi,
  printers: {
    list: technicalApi.listPrinters,
  },
  notifications: notificationsApi,
  security: securityApi,
  openAccounts: openAccountsApi,
}
