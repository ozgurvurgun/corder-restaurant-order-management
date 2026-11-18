import { useEffect } from "react"
import type {
  AuditLog,
  PanelOrder,
  PanelTable,
  PanelUser,
  PrinterConfig,
  RestaurantSettings,
} from "../panel-types"
import {
  api,
  getSessionUser,
  type AuditLogDto,
  type PrinterConfigDto,
} from "../api"
import { resolveStaffNameForTable } from "../mappers/orders-tables.mapper"
import { DEFAULT_SETTINGS } from "./panel-local-storage"

export { usePanelApiSync } from "./use-panel-api-sync"

export function usePanelHydration(params: {
  token: string | null
  restaurantId?: string | null
  orders: PanelOrder[]
  users: PanelUser[]
  setCurrentUser: (u: PanelUser | null) => void
  setSettings: (
    v: RestaurantSettings | ((prev: RestaurantSettings) => RestaurantSettings),
  ) => void
  setTables: (v: PanelTable[] | ((prev: PanelTable[]) => PanelTable[])) => void
  setAuditLogs: (v: AuditLog[]) => void
  setPrinters: (v: PrinterConfig[]) => void
}) {
  const {
    token,
    restaurantId,
    orders,
    users,
    setCurrentUser,
    setSettings,
    setTables,
    setAuditLogs,
    setPrinters,
  } = params

  useEffect(() => {
    if (!token) {
      setCurrentUser(null)
      return
    }
    const su = getSessionUser()
    if (su) {
      setCurrentUser({
        id: su.id,
        name: su.name,
        email: su.email,
        role: su.role as PanelUser["role"],
        active: true,
        createdAt: new Date(0),
      })
    }
  }, [token, restaurantId, setCurrentUser])

  useEffect(() => {
    if (!token) return
    setTables((prev) =>
      prev.map((t) => ({
        ...t,
        waiter:
          resolveStaffNameForTable(t.id, orders, users) ||
          (t.orderCount > 0 ? t.lockedByStaffName : undefined),
      })),
    )
  }, [token, orders, users, setTables])

  useEffect(() => {
    if (!token) {
      setSettings(DEFAULT_SETTINGS)
      return
    }
    api.restaurant
      .getSettings(token)
      .then((s) => {
        setSettings((prev) => ({
          ...prev,
          name: s.name ?? prev.name,
          logoUrl: s.logoUrl !== undefined ? s.logoUrl : prev.logoUrl,
          address: s.address ?? undefined,
          phone: s.phone ?? undefined,
          taxId: s.taxId ?? undefined,
          whatsapp: s.whatsapp ?? undefined,
          instagram: s.instagram ?? undefined,
          facebook: s.facebook ?? undefined,
          website: s.website ?? undefined,
          workingHours: s.workingHours ?? undefined,
        }))
      })
      .catch(console.error)
  }, [token, restaurantId, setSettings])

  useEffect(() => {
    if (!token) return
    void Promise.all([
      api.technical
        .listAuditLogs(token, { limit: 1000 })
        .catch(() => [] as AuditLogDto[]),
      api.technical.listPrinters(token).catch(() => [] as PrinterConfigDto[]),
    ])
      .then(([logs, prs]) => {
        setAuditLogs(
          logs.map((l) => ({
            id: l.id,
            userId: l.userId,
            userName: l.userName,
            action: l.action,
            category: l.category as AuditLog["category"],
            details: l.details,
            metadata: l.metadata ?? undefined,
            createdAt: new Date(l.createdAt),
          })),
        )
        setPrinters(
          prs.map((p) => ({
            id: p.id,
            name: p.name,
            type: p.type,
            connection: p.connection,
            ipAddress: p.ipAddress ?? undefined,
            port: p.port ?? undefined,
            department: p.department ?? undefined,
            status: p.status,
            paperWidth: p.paperWidth === 58 ? 58 : 80,
            autoCut: p.autoCut,
          })),
        )
      })
      .catch(console.error)
  }, [token, restaurantId, setAuditLogs, setPrinters])
}
