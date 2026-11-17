import { request } from "./http-client"
import type {
  AuditLogDto,
  PrinterConfigDto,
  RestaurantSettingsDto,
} from "./api-types"
import type { PanelUserRole } from "../panel-types"

export interface PanelAuthLoginUserDto {
  id: string
  email: string
  name: string
  role: "root" | "staff" | "terminal"
  staffRole?: string
  roleLabel?: string
  isBoss?: boolean
  bossTier?: string
  brandName?: string | null
  permissions?: string[]
  limits?: {
    maxDiscountPercent: number
    maxDiscountAmount: number | null
  }
}

export interface MerchantBillingInfoDto {
  restaurantId: string
  restaurantName: string
  slug: string
  brandName: string | null
  branchType: string
  monthlyFee: number
  billingStatus: "paid" | "pending" | "overdue" | "suspended" | string
  isAccessSuspended: boolean
  suspensionReason: string | null
  lastPaymentDate: string | null
  lastPaidPeriod: string | null
  billingNotes: string | null
  paymentHistory: Array<{
    id: string
    period: string
    amount: number
    paidAt: string
    note?: string | null
    recordedBy?: string | null
  }>
  paymentAccount: {
    receiverName: string
    iban: string
    bankName: string
    collectionStartDay: number
    collectionEndDay: number
    supportPhone: string | null
    supportEmail: string | null
    paymentInstructions: string | null
    suggestedTransferNote: string
  }
}

export const restaurantApi = {
  login: (email: string, password: string) =>
    request<{
      accessToken: string
      restaurant: { id: string; name: string; slug: string }
      restaurants?: Array<{ id: string; name: string; slug: string }>
      user: PanelAuthLoginUserDto
    }>("/restaurant/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: (token: string) =>
    request<{
      restaurant: { id: string; name: string; slug: string }
      restaurants: Array<{ id: string; name: string; slug: string }>
      user: PanelAuthLoginUserDto
    }>("/restaurant/auth/me", { token }),
  switchBranch: (token: string, restaurantId: string) =>
    request<{
      accessToken: string
      restaurant: { id: string; name: string; slug: string }
      restaurants: Array<{ id: string; name: string; slug: string }>
    }>("/restaurant/auth/switch-branch", {
      method: "POST",
      token,
      body: JSON.stringify({ restaurantId }),
    }),
  getSettings: (token: string) =>
    request<RestaurantSettingsDto>("/restaurant/settings", { token }),
  getBillingInfo: (token: string) =>
    request<MerchantBillingInfoDto>("/restaurant/settings/billing", { token }),
  updateSettings: (token: string, body: Partial<RestaurantSettingsDto>) =>
    request<RestaurantSettingsDto>("/restaurant/settings", {
      method: "PUT",
      token,
      body: JSON.stringify(body),
    }),
}

export interface StaffApiItemDto {
  id: string
  name: string
  email: string | null
  role: string
  roleLabel?: string
  roleColor?: string
  phone?: string
  isActive: boolean
  canAccessPanel?: boolean
  canAccessTerminal?: boolean
  hasPin?: boolean
  hasPassword?: boolean
  permissions?: string[]
  grantedPermissions?: string[]
  revokedPermissions?: string[]
  maxDiscountPercentOverride?: number | null
  maxDiscountAmountOverride?: number | null
  limits?: {
    maxDiscountPercent: number
    maxDiscountAmount: number | null
  }
  createdAt: string
}

export const staffApi = {
  list: (token: string) =>
    request<StaffApiItemDto[]>("/restaurant/staff", { token }),
  create: (
    token: string,
    body: {
      name: string
      pin?: string
      role: PanelUserRole | string
      phone?: string
      email?: string
      password?: string
      canAccessPanel?: boolean
      canAccessTerminal?: boolean
      permissionsOverride?: string[] | null
      grantedPermissions?: string[]
      revokedPermissions?: string[]
      maxDiscountPercentOverride?: number | null
      maxDiscountAmountOverride?: number | null
    },
  ) =>
    request<StaffApiItemDto>("/restaurant/staff", {
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
      role?: PanelUserRole | string
      phone?: string
      email?: string | null
      password?: string
      isActive?: boolean
      canAccessPanel?: boolean
      canAccessTerminal?: boolean
      permissionsOverride?: string[] | null
      grantedPermissions?: string[]
      revokedPermissions?: string[]
      maxDiscountPercentOverride?: number | null
      maxDiscountAmountOverride?: number | null
    },
  ) =>
    request<StaffApiItemDto>(`/restaurant/staff/${id}`, {
      method: "PUT",
      token,
      body: JSON.stringify(body),
    }),
  delete: (token: string, id: string) =>
    request<void>(`/restaurant/staff/${id}`, { method: "DELETE", token }),
}

export interface PanelRoleDefinitionDto {
  id: string
  restaurantId: string
  key: string
  name: string
  description: string | null
  color: string
  isSystem: boolean
  canAccessPanel: boolean
  canAccessTerminal: boolean
  permissions: string[]
  maxDiscountPercent: number
  maxDiscountAmount: number | null
  updatedAt: string
}

export interface PanelPermissionCatalogDto {
  categories: Record<string, { title: string; description: string }>
  permissions: Array<{
    key: string
    category: string
    title: string
    description: string
    scope: "terminal" | "panel" | "both"
    isCritical?: boolean
  }>
}

export const rolesApi = {
  catalog: (token: string) =>
    request<PanelPermissionCatalogDto>("/restaurant/roles/catalog", { token }),
  list: (token: string) =>
    request<PanelRoleDefinitionDto[]>("/restaurant/roles", { token }),
  create: (
    token: string,
    body: {
      name: string
      description?: string
      color?: string
      canAccessPanel?: boolean
      canAccessTerminal?: boolean
      permissions: string[]
      maxDiscountPercent?: number
      maxDiscountAmount?: number | null
    },
  ) =>
    request<PanelRoleDefinitionDto>("/restaurant/roles", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }),
  update: (
    token: string,
    idOrKey: string,
    body: {
      name?: string
      description?: string
      color?: string
      canAccessPanel?: boolean
      canAccessTerminal?: boolean
      permissions?: string[]
      maxDiscountPercent?: number
      maxDiscountAmount?: number | null
    },
  ) =>
    request<PanelRoleDefinitionDto>(`/restaurant/roles/${idOrKey}`, {
      method: "PUT",
      token,
      body: JSON.stringify(body),
    }),
  reset: (token: string, idOrKey: string) =>
    request<PanelRoleDefinitionDto>(`/restaurant/roles/${idOrKey}/reset`, {
      method: "POST",
      token,
    }),
  delete: (token: string, idOrKey: string) =>
    request<void>(`/restaurant/roles/${idOrKey}`, {
      method: "DELETE",
      token,
    }),
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
