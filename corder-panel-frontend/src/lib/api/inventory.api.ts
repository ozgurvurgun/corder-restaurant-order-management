import { request } from "./http-client"
import type {
  InventoryCountDto,
  PurchaseOrderDto,
  StockMaterialDto,
  StockMovementDto,
  SupplierDto,
} from "./api-types"

export const stockApi = {
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
      request<void>(`/restaurant/stock/materials/${id}`, {
        method: "DELETE",
        token,
      }),
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
      request<void>(`/restaurant/suppliers/${id}`, {
        method: "DELETE",
        token,
      }),
  },
  movements: {
    list: (token: string, limit?: number) => {
      const qs = limit != null ? `?limit=${limit}` : ""
      return request<StockMovementDto[]>(`/restaurant/stock/movements${qs}`, {
        token,
      })
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
        items: {
          materialId: string
          materialName: string
          quantity: number
          unitCost: number
        }[]
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
    updateItem: (
      token: string,
      id: string,
      body: { materialId: string; actual: number },
    ) =>
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
}
