export const getBase = () => (import.meta.env.VITE_API_URL as string) ?? ""
const WS_PATH = "/ws"

let authExpiredHandler: (() => void) | null = null

export function setAuthExpiredHandler(handler: (() => void) | null) {
  authExpiredHandler = handler
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("panel_token")
}

export function setToken(token: string) {
  localStorage.setItem("panel_token", token)
}

export type PanelSessionUser = { id: string; name: string; email: string; role: string }

const PANEL_SESSION_USER_KEY = "panel_session_user"

export function getSessionUser(): PanelSessionUser | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem(PANEL_SESSION_USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PanelSessionUser
  } catch {
    return null
  }
}

export function setSessionUser(user: PanelSessionUser) {
  localStorage.setItem(PANEL_SESSION_USER_KEY, JSON.stringify(user))
}

export function clearSessionUser() {
  localStorage.removeItem(PANEL_SESSION_USER_KEY)
}

export function clearToken() {
  localStorage.removeItem("panel_token")
  localStorage.removeItem("panel_restaurant")
  clearSessionUser()
}

export function getRestaurant(): { id: string; name: string; slug: string } | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem("panel_restaurant")
  if (!raw) return null
  try {
    return JSON.parse(raw) as { id: string; name: string; slug: string }
  } catch {
    return null
  }
}

export function setRestaurant(restaurant: { id: string; name: string; slug: string }) {
  localStorage.setItem("panel_restaurant", JSON.stringify(restaurant))
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token, ...init } = options
  const url = `${getBase()}${path}`
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  }
  if (!(init.body instanceof FormData)) headers["Content-Type"] = "application/json"
  if (token) headers["Authorization"] = `Bearer ${token}`
  const res = await fetch(url, { ...init, headers })
  if ((res.status === 401 || res.status === 403) && token) {
    authExpiredHandler?.()
  }
  if (!res.ok) {
    const body = await res.text()
    let message = body
    try {
      const j = JSON.parse(body)
      message = j.message ?? body
    } catch {}
    throw new Error(message || res.statusText)
  }
  if (res.status === 204 || res.headers.get("content-length") === "0") return undefined as T
  return res.json()
}

export const api = {
  restaurant: {
    login: (email: string, password: string) =>
      request<{
        accessToken: string
        restaurant: { id: string; name: string; slug: string }
        user: { id: string; email: string; name: string; role: "root" | "terminal" }
      }>("/restaurant/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    getSettings: (token: string) =>
      request<RestaurantSettingsDto>("/restaurant/settings", { token }),
    updateSettings: (token: string, body: Partial<RestaurantSettingsDto>) =>
      request<RestaurantSettingsDto>("/restaurant/settings", {
        method: "PUT",
        token,
        body: JSON.stringify(body),
      }),
  },
  staff: {
    list: (token: string) =>
      request<{ id: string; name: string; email: string | null; role: string; phone?: string; isActive: boolean; createdAt: string }[]>(
        "/restaurant/staff",
        { token }
      ),
    create: (token: string, body: { name: string; pin: string; role: "mudur" | "kasiyer" | "garson"; phone?: string }) =>
      request<{ id: string; name: string; email: string | null; role: string; phone?: string; isActive: boolean; createdAt: string }>(
        "/restaurant/staff",
        { method: "POST", token, body: JSON.stringify(body) }
      ),
    update: (token: string, id: string, body: { name?: string; pin?: string; role?: "mudur" | "kasiyer" | "garson"; phone?: string; isActive?: boolean }) =>
      request<{ id: string; name: string; email: string | null; role: string; phone?: string; isActive: boolean; createdAt: string }>(
        `/restaurant/staff/${id}`,
        { method: "PUT", token, body: JSON.stringify(body) }
      ),
    delete: (token: string, id: string) =>
      request<void>(`/restaurant/staff/${id}`, { method: "DELETE", token }),
  },
  tables: {
    list: (token: string) =>
      request<{ id: string; name: string; section: string; status: string }[]>(
        "/restaurant/tables",
        { token }
      ),
    create: (token: string, body: { name: string; section: string }) =>
      request<{ id: string; name: string; section: string; status: string }>(
        "/restaurant/tables",
        { method: "POST", token, body: JSON.stringify(body) }
      ),
    update: (token: string, id: string, body: { name?: string; section?: string; status?: "empty" | "occupied" | "ordering" | "checkout" }) =>
      request<{ id: string; name: string; section: string; status: string }>(
        `/restaurant/tables/${id}`,
        { method: "PATCH", token, body: JSON.stringify(body) }
      ),
    delete: (token: string, id: string) =>
      request<void>(`/restaurant/tables/${id}`, { method: "DELETE", token }),
  },
  orders: {
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
        itemIds: string[]
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
    cancelItem: (token: string, body: { itemId: string; reason?: string }) =>
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
  },
  categories: {
    list: (token: string) =>
      request<CategoryDto[]>("/restaurant/categories", { token }),
    create: (
      token: string,
      body: { name: string; showInTerminal?: boolean; showInMenu?: boolean; parentId?: string | null },
    ) =>
      request<CategoryDto>("/restaurant/categories", { method: "POST", token, body: JSON.stringify(body) }),
    update: (
      token: string,
      id: string,
      body: { name?: string; showInTerminal?: boolean; showInMenu?: boolean; parentId?: string | null },
    ) =>
      request<CategoryDto>(`/restaurant/categories/${id}`, { method: "PUT", token, body: JSON.stringify(body) }),
    delete: (token: string, id: string) =>
      request<void>(`/restaurant/categories/${id}`, { method: "DELETE", token }),
    reorder: (token: string, body: { ids: string[]; parentId?: string | null }) =>
      request<CategoryDto[]>("/restaurant/categories/reorder", {
        method: "POST",
        token,
        body: JSON.stringify(body),
      }),
  },
  products: {
    list: (token: string) =>
      request<ProductDto[]>("/restaurant/products", { token }),
    create: (token: string, body: CreateProductBody) =>
      request<ProductDto>("/restaurant/products", { method: "POST", token, body: JSON.stringify(body) }),
    update: (token: string, id: string, body: UpdateProductBody) =>
      request<ProductDto>(`/restaurant/products/${id}`, { method: "PUT", token, body: JSON.stringify(body) }),
    delete: (token: string, id: string) =>
      request<void>(`/restaurant/products/${id}`, { method: "DELETE", token }),
    reorder: (token: string, ids: string[]) =>
      request<ProductDto[]>("/restaurant/products/reorder", {
        method: "POST",
        token,
        body: JSON.stringify({ ids }),
      }),
  },
  campaigns: {
    list: (token: string) =>
      request<CampaignDto[]>("/restaurant/campaigns", { token }),
    create: (token: string, body: { title: string; description?: string; imageUrl: string; discountPercent?: number; originalPrice?: number; discountedPrice?: number; validUntil?: string; isActive?: boolean }) =>
      request<CampaignDto>("/restaurant/campaigns", {
        method: "POST",
        token,
        body: JSON.stringify(body),
      }),
    update: (token: string, id: string, body: { title?: string; description?: string; imageUrl?: string; discountPercent?: number; originalPrice?: number; discountedPrice?: number; validUntil?: string; isActive?: boolean }) =>
      request<CampaignDto>(`/restaurant/campaigns/${id}`, {
        method: "PUT",
        token,
        body: JSON.stringify(body),
      }),
    delete: (token: string, id: string) =>
      request<void>(`/restaurant/campaigns/${id}`, {
        method: "DELETE",
        token,
      }),
    reorder: (token: string, ids: string[]) =>
      request<CampaignDto[]>("/restaurant/campaigns/reorder", {
        method: "POST",
        token,
        body: JSON.stringify({ ids }),
      }),
  },
  upload: (token: string, file: File) => {
    const form = new FormData()
    form.append("file", file)
    return request<{ url: string }>("/restaurant/upload", { method: "POST", token, body: form })
  },
  shifts: {
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
  },
  completedOrders: {
    list: (token: string, params?: { from?: string; to?: string; waiter?: string; tableName?: string; limit?: number; offset?: number }) => {
      const search = new URLSearchParams()
      if (params?.from) search.set("from", params.from)
      if (params?.to) search.set("to", params.to)
      if (params?.waiter) search.set("waiter", params.waiter)
      if (params?.tableName) search.set("tableName", params.tableName)
      if (params?.limit != null) search.set("limit", String(params.limit))
      if (params?.offset != null) search.set("offset", String(params.offset))
      const qs = search.toString()
      const path = qs ? `/restaurant/completed-orders?${qs}` : "/restaurant/completed-orders"
      return request<CompletedOrderDto[]>(path, { token })
    },
    update: (token: string, id: string, body: CompletedOrderUpdateBody) =>
      request<CompletedOrderDto>(`/restaurant/completed-orders/${encodeURIComponent(id)}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(body),
      }),
  },
  ledgerCustomers: {
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
    pay: (token: string, id: string, amount: number) =>
      request<LedgerCustomerDto>(`/restaurant/ledger-customers/${encodeURIComponent(id)}/payments`, {
        method: "POST",
        token,
        body: JSON.stringify({ amount }),
      }),
  },
  stock: {
    materials: {
      list: (token: string) =>
        request<StockMaterialDto[]>("/restaurant/stock/materials", { token }),
      create: (
        token: string,
        body: {
          name: string
          unit: string
          currentStock?: number
          minStock?: number
          costPerUnit: number
          supplierId?: string
          category?: string
        },
      ) =>
        request<StockMaterialDto>("/restaurant/stock/materials", {
          method: "POST",
          token,
          body: JSON.stringify(body),
        }),
      update: (
        token: string,
        id: string,
        body: {
          name?: string
          unit?: string
          currentStock?: number
          minStock?: number
          costPerUnit?: number
          supplierId?: string | null
          category?: string
        },
      ) =>
        request<StockMaterialDto>(`/restaurant/stock/materials/${id}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(body),
        }),
      delete: (token: string, id: string) =>
        request<void>(`/restaurant/stock/materials/${id}`, { method: "DELETE", token }),
    },
    suppliers: {
      list: (token: string) =>
        request<SupplierDto[]>("/restaurant/suppliers", { token }),
      create: (
        token: string,
        body: {
          name: string
          contactPerson?: string
          phone?: string
          email?: string
          address?: string
          notes?: string
        },
      ) =>
        request<SupplierDto>("/restaurant/suppliers", {
          method: "POST",
          token,
          body: JSON.stringify(body),
        }),
      update: (
        token: string,
        id: string,
        body: {
          name?: string
          contactPerson?: string
          phone?: string
          email?: string
          address?: string
          notes?: string
          active?: boolean
        },
      ) =>
        request<SupplierDto>(`/restaurant/suppliers/${id}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(body),
        }),
      delete: (token: string, id: string) =>
        request<void>(`/restaurant/suppliers/${id}`, { method: "DELETE", token }),
    },
    movements: {
      list: (token: string, limit?: number) => {
        const qs = limit != null ? `?limit=${limit}` : ""
        return request<StockMovementDto[]>(`/restaurant/stock/movements${qs}`, { token })
      },
      create: (
        token: string,
        body: {
          materialId: string
          materialName?: string
          type: "in" | "out" | "waste" | "count-adjustment"
          quantity: number
          unitCost?: number
          totalCost?: number
          supplierId?: string
          reason?: string
          createdBy?: string
        },
      ) =>
        request<StockMovementDto>("/restaurant/stock/movements", {
          method: "POST",
          token,
          body: JSON.stringify(body),
        }),
    },
    purchaseOrders: {
      list: (token: string) =>
        request<PurchaseOrderDto[]>("/restaurant/purchase-orders", { token }),
      create: (
        token: string,
        body: {
          supplierId: string
          supplierName: string
          items: { materialId: string; materialName: string; quantity: number; unitCost: number }[]
          notes?: string
          status?: "draft" | "ordered"
        },
      ) =>
        request<PurchaseOrderDto>("/restaurant/purchase-orders", {
          method: "POST",
          token,
          body: JSON.stringify(body),
        }),
      receive: (token: string, id: string) =>
        request<PurchaseOrderDto>(`/restaurant/purchase-orders/${id}/receive`, {
          method: "POST",
          token,
        }),
    },
    inventoryCounts: {
      list: (token: string) =>
        request<InventoryCountDto[]>("/restaurant/inventory-counts", { token }),
      start: (token: string) =>
        request<InventoryCountDto>("/restaurant/inventory-counts", {
          method: "POST",
          token,
        }),
      updateItem: (token: string, id: string, body: { materialId: string; actual: number }) =>
        request<InventoryCountDto>(`/restaurant/inventory-counts/${id}/items`, {
          method: "POST",
          token,
          body: JSON.stringify(body),
        }),
      complete: (token: string, id: string) =>
        request<InventoryCountDto>(`/restaurant/inventory-counts/${id}/complete`, {
          method: "POST",
          token,
        }),
    },
  },
  cashTransactions: {
    create: (token: string, body: { type: "expense" | "cash-in" | "cash-out" | "refund"; amount: number; description: string; reference?: string }) =>
      request<{ transaction: CashTransactionDto; shift: ShiftDto }>("/restaurant/cash-transactions", {
        method: "POST",
        token,
        body: JSON.stringify(body),
      }),
    list: (token: string, shiftId?: string) => {
      const qs = shiftId ? `?shiftId=${encodeURIComponent(shiftId)}` : ""
      return request<CashTransactionDto[]>(`/restaurant/cash-transactions${qs}`, { token })
    },
  },
  technical: {
    listPrinters: (token: string) =>
      request<PrinterConfigDto[]>('/restaurant/printers', { token }),
    createPrinter: (token: string, body: {
      name: string
      type: string
      connection: 'usb' | 'network' | 'bluetooth'
      ipAddress?: string
      port?: number
      department?: string
      paperWidth?: number
      autoCut?: boolean
    }) =>
      request<PrinterConfigDto>('/restaurant/printers', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      }),
    updatePrinter: (token: string, id: string, body: {
      name?: string
      type?: string
      connection?: 'usb' | 'network' | 'bluetooth'
      ipAddress?: string | null
      port?: number | null
      department?: string | null
      status?: 'online' | 'offline' | 'error'
      paperWidth?: number
      autoCut?: boolean
    }) =>
      request<PrinterConfigDto>(`/restaurant/printers/${id}`, {
        method: 'PUT',
        token,
        body: JSON.stringify(body),
      }),
    deletePrinter: (token: string, id: string) =>
      request<void>(`/restaurant/printers/${id}`, { method: 'DELETE', token }),
    listAuditLogs: (
      token: string,
      params?: { category?: string; limit?: number; from?: string; to?: string },
    ) => {
      const search = new URLSearchParams()
      if (params?.category) search.set('category', params.category)
      if (params?.limit != null) search.set('limit', String(params.limit))
      if (params?.from) search.set('from', params.from)
      if (params?.to) search.set('to', params.to)
      const qs = search.toString()
      const path = qs ? `/restaurant/audit-logs?${qs}` : '/restaurant/audit-logs'
      return request<AuditLogDto[]>(path, { token })
    },
    createAuditLog: (token: string, body: {
      action: string
      category: string
      details: string
      metadata?: Record<string, unknown>
    }) =>
      request<AuditLogDto>('/restaurant/audit-logs', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      }),
  },
  openAccounts: {
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
    pay: (token: string, id: string, amount: number) =>
      request<OpenAccountDto>(`/restaurant/open-accounts/${id}/pay`, {
        method: "POST",
        token,
        body: JSON.stringify({ amount }),
      }),
  },
}

export interface ShiftDto {
  id: string
  openedBy: string
  openedAt: string
  closedAt: string | null
  closedBy: string | null
  status: string
  openingBalance: number
  closingBalance: number | null
  notes: string | null
  cashIn: number
  cashOut: number
  totalRevenue: number
  totalNakit: number
  totalKart: number
  totalYemekKarti: number
  totalMultinet: number
  transactionCount: number
}

export function getWsUrl(): string {
  const base = getBase()
  if (!base) return ""
  const url = new URL(base)
  const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:"
  return `${wsProtocol}//${url.host}${WS_PATH}`
}

export interface OrderItemDto {
  id: string
  productId: string
  productName: string
  price: number
  quantity: number
  note?: string
  status: string
  createdAt: string
  cancelReason?: string
  cancelledBy?: string
  cancelledAt?: string
}

export interface OrderDto {
  id: string
  tableId: string
  userId: string | null
  /** Resolved display name when userId is not in the server staff list. */
  userName?: string | null
  status: string
  items: OrderItemDto[]
  createdAt: string
  updatedAt: string
  mergedFrom?: string | null
}

export interface CategoryDto {
  id: string
  restaurantId: string
  name: string
  slug: string
  parentId?: string | null
  showInTerminal: boolean
  showInMenu: boolean
  order: number
  createdAt: string
}

export interface ProductIngredientDto {
  materialId: string
  quantity: number
}

export interface ProductDto {
  id: string
  categoryId: string
  name: string
  description: string | null
  price: number
  imageUrl: string | null
  inStock: boolean
  order: number
  createdAt: string
  ingredients?: ProductIngredientDto[] | null
  category?: CategoryDto
}

export interface CreateProductBody {
  categoryId: string
  name: string
  description?: string
  price: number
  imageUrl?: string
  inStock?: boolean
  order?: number
  ingredients?: ProductIngredientDto[] | null
}

export interface UpdateProductBody {
  name?: string
  description?: string
  price?: number
  imageUrl?: string
  inStock?: boolean
  order?: number
  ingredients?: ProductIngredientDto[] | null
}

export interface CompletedOrderItemSnapshotDto {
  id: string
  productId: string
  productName: string
  price: number
  quantity: number
  note?: string
  status: string
  createdAt: string
  cancelReason?: string
  cancelledBy?: string
  cancelledAt?: string
}

export interface CompletedOrderSnapshotDto {
  id: string
  tableId: string
  userId: string
  /** Waiter who opened this check (staff name or API resolution). */
  userName?: string | null
  items: CompletedOrderItemSnapshotDto[]
  status: string
  createdAt: string
  updatedAt: string
  mergedFrom?: string
}

export interface CompletedPaymentSplitDto {
  method: string
  amount: number
}

export interface CompletedPaymentDiscountDto {
  type: "percent" | "amount"
  value: number
  reason: string
}

export interface CompletedPaymentSnapshotDto {
  id: string
  tableId: string
  tableName: string
  orderIds: string[]
  amount: number
  method: string
  splitDetails?: CompletedPaymentSplitDto[]
  discount?: CompletedPaymentDiscountDto
  tip?: number
  processedBy: string
  createdAt: string
  ledgerCustomerId?: string
  ledgerCustomerName?: string
}

export interface CompletedOrderDto {
  id: string
  tableName: string
  section: string
  waiter: string
  orders: CompletedOrderSnapshotDto[]
  payment: CompletedPaymentSnapshotDto
  totalAmount: number
  discountAmount: number
  netAmount: number
  closedBy: string
  openedAt: string
  closedAt: string
  paymentMethod: string
  paymentSplit?: CompletedPaymentSplitDto[]
  paymentDiscount?: CompletedPaymentDiscountDto
  paymentTip?: number
  createdAt: string
}

export interface CloseCheckBody {
  tableId?: string
  items?: { productId: string; quantity: number; note?: string }[]
  method: "nakit" | "kredi-karti" | "yemek-karti" | "multinet" | "coklu" | "cari"
  discount?: { type: "percent" | "amount"; value: number; reason?: string }
  splitDetails?: {
    method: "nakit" | "kredi-karti" | "yemek-karti" | "multinet" | "cari"
    amount: number
  }[]
  ledgerCustomerId?: string
  ledgerDebtAmount?: number
  tip?: number
}

export interface CloseCheckResponseDto {
  completedOrder: CompletedOrderDto
  shift: ShiftDto
  cashTransaction: CashTransactionDto | null
  stockMovements: StockMovementDto[]
}

export interface LedgerCustomerDto {
  id: string
  restaurantId: string
  name: string
  phone?: string | null
  notes?: string | null
  balance: number
  /** Debt − collections − credit in the selected range (ledger list date filter). */
  periodNet?: number
  createdAt: string
}

export interface LedgerEntryDto {
  id: string
  entryType: "debt" | "payment" | "credit"
  amount: number
  description: string
  tableId?: string | null
  tableName?: string | null
  completedOrderId?: string | null
  receivedBy?: string | null
  receivedByUserId?: string | null
  createdAt: string
}

/** PATCH /completed-orders/:id — totals are computed on the server. */
export type CompletedOrderUpdateBody = {
  orders: CompletedOrderSnapshotDto[]
  payment: CompletedPaymentSnapshotDto
}

export interface CampaignDto {
  id: string
  restaurantId: string
  title: string
  description?: string | null
  imageUrl: string
  discountPercent?: number | null
  originalPrice?: number | null
  discountedPrice?: number | null
  validUntil?: string | null
  isActive: boolean
  order: number
  createdAt: string
}

export interface CashTransactionDto {
  id: string
  restaurantId: string
  shiftId: string
  type: "sale" | "expense" | "cash-in" | "cash-out" | "refund"
  amount: number
  description: string
  reference?: string | null
  createdBy: string
  createdAt: string
}

export interface OpenAccountLineDto {
  id: string
  productId?: string | null
  productName: string
  quantity: number
  price: number
  note?: string | null
}

export interface OpenAccountPaymentDto {
  id: string
  amount: number
  receivedBy: string
  receivedByUserId?: string | null
  note?: string | null
  createdAt: string
}

export interface OpenAccountDto {
  id: string
  restaurantId: string
  customerName: string
  customerPhone?: string | null
  amount: number
  paidAmount: number
  status: "open" | "partial" | "paid"
  description: string
  createdBy: string
  createdAt: string
  paidAt?: string | null
  items?: OpenAccountLineDto[]
  payments?: OpenAccountPaymentDto[]
}

export interface RestaurantSettingsDto {
  name: string
  address?: string | null
  phone?: string | null
  taxId?: string | null
  whatsapp?: string | null
  instagram?: string | null
  facebook?: string | null
  website?: string | null
  workingHours?: string | null
}

export interface PrinterConfigDto {
  id: string
  restaurantId: string
  name: string
  type: string
  connection: 'usb' | 'network' | 'bluetooth'
  ipAddress: string | null
  port: number | null
  department: string | null
  status: 'online' | 'offline' | 'error'
  paperWidth: number
  autoCut: boolean
  createdAt: string
  updatedAt: string
}

export interface AuditLogDto {
  id: string
  restaurantId: string
  userId: string
  userName: string
  action: string
  category: string
  details: string
  metadata?: Record<string, unknown> | null
  createdAt: string
}

export interface StockMaterialDto {
  id: string
  restaurantId: string
  name: string
  unit: string
  currentStock: number
  minStock: number
  costPerUnit: number
  supplierId?: string | null
  category: string
  createdAt: string
  updatedAt: string
}

export interface SupplierDto {
  id: string
  restaurantId: string
  name: string
  contactPerson?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
  active: boolean
  createdAt: string
}

export interface StockMovementDto {
  id: string
  restaurantId: string
  materialId: string
  materialName: string
  type: "in" | "out" | "waste" | "count-adjustment"
  quantity: number
  previousStock: number
  newStock: number
  unitCost?: number | null
  totalCost?: number | null
  supplierId?: string | null
  reason?: string | null
  createdBy: string
  createdAt: string
}

export interface PurchaseOrderItemDto {
  materialId: string
  materialName: string
  quantity: number
  unitCost: number
}

export interface PurchaseOrderDto {
  id: string
  restaurantId: string
  supplierId: string
  supplierName: string
  items: PurchaseOrderItemDto[]
  totalAmount: number
  status: "draft" | "ordered" | "received" | "cancelled"
  notes?: string | null
  createdBy: string
  createdAt: string
  receivedAt?: string | null
}

export interface InventoryCountItemDto {
  materialId: string
  materialName: string
  expectedStock: number
  actualStock: number
  difference: number
}

export interface InventoryCountDto {
  id: string
  restaurantId: string
  date: string
  countedBy: string
  items: InventoryCountItemDto[]
  status: "in-progress" | "completed"
  notes?: string | null
  createdAt: string
}
