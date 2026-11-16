import { request } from "./http-client"
import type {
  AuditLogDto,
  PrinterConfigDto,
  RestaurantSettingsDto,
} from "./api-types"
import type { PanelUserRole } from "../panel-types"

export const restaurantApi = {
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
}

export const staffApi = {
  list: (token: string) =>
    request<
      {
        id: string
        name: string
        email: string | null
        role: string
        phone?: string
        isActive: boolean
        createdAt: string
      }[]
    >("/restaurant/staff", { token }),
  create: (
    token: string,
    body: { name: string; pin: string; role: PanelUserRole; phone?: string },
  ) =>
    request<{
      id: string
      name: string
      email: string | null
      role: string
      phone?: string
      isActive: boolean
      createdAt: string
    }>("/restaurant/staff", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }),
  update: (
    token: string,
    id: string,
    body: {
      name?: string
      pin?: string
      role?: PanelUserRole
      phone?: string
      isActive?: boolean
    },
  ) =>
    request<{
      id: string
      name: string
      email: string | null
      role: string
      phone?: string
      isActive: boolean
      createdAt: string
    }>(`/restaurant/staff/${id}`, {
      method: "PUT",
      token,
      body: JSON.stringify(body),
    }),
  delete: (token: string, id: string) =>
    request<void>(`/restaurant/staff/${id}`, { method: "DELETE", token }),
}

export const technicalApi = {
  listPrinters: (token: string) =>
    request<PrinterConfigDto[]>("/restaurant/printers", { token }),
  createPrinter: (
    token: string,
    body: {
      name: string
      type: string
      connection: "usb" | "network" | "bluetooth"
      ipAddress?: string
      port?: number
      department?: string
      paperWidth?: number
      autoCut?: boolean
    },
  ) =>
    request<PrinterConfigDto>("/restaurant/printers", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }),
  updatePrinter: (
    token: string,
    id: string,
    body: {
      name?: string
      type?: string
      connection?: "usb" | "network" | "bluetooth"
      ipAddress?: string | null
      port?: number | null
      department?: string | null
      status?: "online" | "offline" | "error"
      paperWidth?: number
      autoCut?: boolean
    },
  ) =>
    request<PrinterConfigDto>(`/restaurant/printers/${id}`, {
      method: "PUT",
      token,
      body: JSON.stringify(body),
    }),
  deletePrinter: (token: string, id: string) =>
    request<void>(`/restaurant/printers/${id}`, { method: "DELETE", token }),
  listAuditLogs: (
    token: string,
    params?: { category?: string; limit?: number; from?: string; to?: string },
  ) => {
    const search = new URLSearchParams()
    if (params?.category) search.set("category", params.category)
    if (params?.limit != null) search.set("limit", String(params.limit))
    if (params?.from) search.set("from", params.from)
    if (params?.to) search.set("to", params.to)
    const qs = search.toString()
    const path = qs ? `/restaurant/audit-logs?${qs}` : "/restaurant/audit-logs"
    return request<AuditLogDto[]>(path, { token })
  },
  createAuditLog: (
    token: string,
    body: {
      action: string
      category: string
      details: string
      metadata?: Record<string, unknown>
    },
  ) =>
    request<AuditLogDto>("/restaurant/audit-logs", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }),
}
