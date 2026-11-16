import { useCallback } from "react"
import type {
  AuditLog,
  Branch,
  PanelNotification,
  PanelUser,
  PrinterConfig,
  PrinterDepartment,
  RestaurantSettings,
} from "../panel-types"
import { api } from "../api"
import { genId } from "./panel-local-storage"
import type { LogActivityFn } from "./panel-store-context"

type StateSetter<T> = (v: T | ((prev: T) => T)) => void

function mapStaffDtoToPanelUser(dto: {
  id: string
  name: string
  email?: string | null
  phone?: string
  role: string
  roleLabel?: string
  roleColor?: string
  canAccessPanel?: boolean
  canAccessTerminal?: boolean
  permissions?: string[]
  limits?: { maxDiscountPercent: number; maxDiscountAmount: number | null }
  isActive: boolean
  createdAt?: string
}): PanelUser {
  return {
    id: dto.id,
    name: dto.name,
    email: dto.email ?? undefined,
    phone: dto.phone,
    role: dto.role,
    roleLabel: dto.roleLabel,
    roleColor: dto.roleColor,
    canAccessPanel: dto.canAccessPanel,
    canAccessTerminal: dto.canAccessTerminal,
    permissions: dto.permissions,
    limits: dto.limits,
    active: dto.isActive,
    createdAt: dto.createdAt ? new Date(dto.createdAt) : new Date(),
  }
}

export function useSystemActions(params: {
  token: string | null
  currentUser: PanelUser | null
  printers: PrinterConfig[]
  setUsers: StateSetter<PanelUser[]>
  setSettings: StateSetter<RestaurantSettings>
  setNotifications: StateSetter<PanelNotification[]>
  setAuditLogs: StateSetter<AuditLog[]>
  setBranches: StateSetter<Branch[]>
  setPrinters: StateSetter<PrinterConfig[]>
  setPrinterDepartments: StateSetter<PrinterDepartment[]>
}) {
  const {
    token,
    currentUser,
    printers,
    setUsers,
    setSettings,
    setNotifications,
    setAuditLogs,
    setBranches,
    setPrinters,
    setPrinterDepartments,
  } = params

  const addAuditLog = useCallback(
    (log: Omit<AuditLog, "id" | "createdAt">) => {
      setAuditLogs((prev) =>
        [{ ...log, id: genId("al"), createdAt: new Date() }, ...prev].slice(0, 1000),
      )
      if (!token) return
      api.technical
        .createAuditLog(token, {
          action: log.action,
          category: log.category,
          details: log.details,
          metadata: log.metadata,
        })
        .catch(console.error)
    },
    [token, setAuditLogs],
  )

  const logActivity: LogActivityFn = useCallback(
    (entry) => {
      addAuditLog({
        userId: currentUser?.id || "system",
        userName: currentUser?.name || "Sistem",
        action: entry.action,
        category: entry.category,
        details: entry.details,
        metadata: entry.metadata,
      })
    },
    [addAuditLog, currentUser?.id, currentUser?.name],
  )

  const addUser = useCallback(
    (u: Omit<PanelUser, "id" | "createdAt">) => {
      if (!token) return
      const role = u.role === "root" ? "branch_manager" : u.role
      const pin = (u.pin ?? "").trim()
      api.staff
        .create(token, {
          name: u.name,
          ...(pin ? { pin } : {}),
          role,
          phone: u.phone,
          email: u.email,
          password: u.password,
          canAccessPanel: u.canAccessPanel,
          canAccessTerminal: u.canAccessTerminal,
        })
        .then((created) => {
          setUsers((prev) => [...prev, mapStaffDtoToPanelUser(created)])
          logActivity({
            action: "staff_created",
            category: "user",
            details: `Kullanici eklendi: ${created.name}`,
            metadata: { userId: created.id, role: created.role },
          })
        })
        .catch(console.error)
    },
    [token, setUsers, logActivity],
  )

  const updateUser = useCallback(
    (id: string, data: Partial<PanelUser>) => {
      if (!token) return
      const payload: {
        name?: string
        pin?: string
        role?: string
        phone?: string
        email?: string | null
        password?: string
        isActive?: boolean
        canAccessPanel?: boolean
        canAccessTerminal?: boolean
      } = {}
      if (data.name != null) payload.name = data.name
      if (data.pin != null && data.pin !== "") payload.pin = data.pin
      if (data.role != null && data.role !== "root") payload.role = data.role
      if (data.phone !== undefined) payload.phone = data.phone
      if (data.email !== undefined) payload.email = data.email || null
      if (data.password != null && data.password !== "") payload.password = data.password
      if (data.active !== undefined) payload.isActive = data.active
      if (data.canAccessPanel !== undefined) payload.canAccessPanel = data.canAccessPanel
      if (data.canAccessTerminal !== undefined) payload.canAccessTerminal = data.canAccessTerminal
      api.staff
        .update(token, id, payload)
        .then((updated) => {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === id ? { ...u, ...mapStaffDtoToPanelUser(updated), createdAt: u.createdAt } : u,
            ),
          )
          logActivity({
            action: "staff_updated",
            category: "user",
            details: `Kullanici guncellendi: ${updated.name}`,
            metadata: { userId: id, fields: Object.keys(payload) },
          })
        })
        .catch(console.error)
    },
    [token, setUsers, logActivity],
  )

  const deleteUser = useCallback(
    (id: string) => {
      if (!token) return
      api.staff
        .delete(token, id)
        .then(() => {
          setUsers((prev) => prev.filter((u) => u.id !== id))
          logActivity({
            action: "staff_deleted",
            category: "user",
            details: `Kullanici silindi: ${id}`,
            metadata: { userId: id },
          })
        })
        .catch(console.error)
    },
    [token, setUsers, logActivity],
  )

  const updateSettings = useCallback(
    (s: Partial<RestaurantSettings>) => {
      setSettings((prev) => ({ ...prev, ...s }))
      if (!token) return
      api.restaurant
        .updateSettings(token, {
          name: s.name,
          address: s.address,
          phone: s.phone,
          taxId: s.taxId,
          whatsapp: s.whatsapp,
          instagram: s.instagram,
          facebook: s.facebook,
          website: s.website,
          workingHours: s.workingHours,
        })
        .then(() => {
          logActivity({
            action: "settings_updated",
            category: "settings",
            details: "Restoran ayarlari guncellendi",
            metadata: { fields: Object.keys(s) },
          })
        })
        .catch(console.error)
    },
    [token, setSettings, logActivity],
  )

  const markNotificationRead = useCallback(
    (id: string) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    },
    [setNotifications],
  )
  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [setNotifications])
  const addNotification = useCallback(
    (n: Omit<PanelNotification, "id" | "createdAt" | "read">) => {
      setNotifications((prev) => [
        { ...n, id: genId("n"), createdAt: new Date(), read: false },
        ...prev,
      ])
    },
    [setNotifications],
  )
  const clearAllNotifications = useCallback(() => {
    setNotifications([])
  }, [setNotifications])

  const switchBranch = useCallback(
    (id: string) => {
      setBranches((prev) => prev.map((b) => ({ ...b, isCurrent: b.id === id })))
      logActivity({
        action: "branch_switched",
        category: "settings",
        details: `Sube degistirildi: ${id}`,
        metadata: { branchId: id },
      })
    },
    [setBranches, logActivity],
  )
  const addBranch = useCallback(
    (b: Omit<Branch, "id">) => {
      setBranches((prev) => [...prev, { ...b, id: genId("br") }])
      logActivity({
        action: "branch_created",
        category: "settings",
        details: `Sube eklendi: ${b.name}`,
      })
    },
    [setBranches, logActivity],
  )
  const updateBranch = useCallback(
    (id: string, data: Partial<Branch>) => {
      setBranches((prev) => prev.map((b) => (b.id === id ? { ...b, ...data } : b)))
      logActivity({
        action: "branch_updated",
        category: "settings",
        details: `Sube guncellendi: ${id}`,
        metadata: { branchId: id, fields: Object.keys(data) },
      })
    },
    [setBranches, logActivity],
  )

  const addPrinter = useCallback(
    (p: Omit<PrinterConfig, "id">) => {
      if (!token) return
      api.technical
        .createPrinter(token, {
          name: p.name,
          type: p.type,
          connection: p.connection,
          ipAddress: p.ipAddress,
          port: p.port,
          department: p.department,
          paperWidth: p.paperWidth,
          autoCut: p.autoCut,
        })
        .then((created) => {
          setPrinters((prev) => [
            ...prev,
            {
              id: created.id,
              name: created.name,
              type: created.type,
              connection: created.connection,
              ipAddress: created.ipAddress ?? undefined,
              port: created.port ?? undefined,
              department: created.department ?? undefined,
              status: created.status,
              paperWidth: created.paperWidth === 58 ? 58 : 80,
              autoCut: created.autoCut,
            },
          ])
          logActivity({
            action: "printer_created",
            category: "settings",
            details: `Yazici eklendi: ${created.name}`,
            metadata: {
              printerId: created.id,
              type: created.type,
              connection: created.connection,
            },
          })
        })
        .catch(console.error)
    },
    [token, setPrinters, logActivity],
  )

  const updatePrinter = useCallback(
    (id: string, data: Partial<PrinterConfig>) => {
      setPrinters((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)))
      logActivity({
        action: "printer_updated",
        category: "settings",
        details: `Yazici guncellendi: ${id}`,
        metadata: { printerId: id, fields: Object.keys(data) },
      })
      if (!token) return
      api.technical
        .updatePrinter(token, id, {
          name: data.name,
          type: data.type,
          connection: data.connection,
          ipAddress: data.ipAddress ?? null,
          port: data.port ?? null,
          department: data.department ?? null,
          status: data.status,
          paperWidth: data.paperWidth,
          autoCut: data.autoCut,
        })
        .catch(console.error)
    },
    [token, setPrinters, logActivity],
  )

  const deletePrinter = useCallback(
    (id: string) => {
      setPrinters((prev) => prev.filter((p) => p.id !== id))
      logActivity({
        action: "printer_deleted",
        category: "settings",
        details: `Yazici silindi: ${id}`,
        metadata: { printerId: id },
      })
      if (!token) return
      api.technical.deletePrinter(token, id).catch(console.error)
    },
    [token, setPrinters, logActivity],
  )

  const testPrinter = useCallback(
    (id: string) => {
      const pr = printers.find((p) => p.id === id)
      if (!pr || !token) return
      setPrinters((prev) => prev.map((p) => (p.id === id ? { ...p, status: "online" } : p)))
      logActivity({
        action: "printer_tested",
        category: "settings",
        details: `Yazici test edildi: ${pr.name}`,
        metadata: { printerId: id },
      })
    },
    [printers, token, setPrinters, logActivity],
  )

  const addPrinterDepartment = useCallback(
    (pd: Omit<PrinterDepartment, "id">) => {
      setPrinterDepartments((prev) => [...prev, { ...pd, id: genId("pd") }])
    },
    [setPrinterDepartments],
  )
  const updatePrinterDepartment = useCallback(
    (id: string, data: Partial<PrinterDepartment>) => {
      setPrinterDepartments((prev) =>
        prev.map((pd) => (pd.id === id ? { ...pd, ...data } : pd)),
      )
    },
    [setPrinterDepartments],
  )
  const deletePrinterDepartment = useCallback(
    (id: string) => {
      setPrinterDepartments((prev) => prev.filter((pd) => pd.id !== id))
    },
    [setPrinterDepartments],
  )

  return {
    addAuditLog,
    logActivity,
    addUser,
    updateUser,
    deleteUser,
    updateSettings,
    markNotificationRead,
    markAllNotificationsRead,
    addNotification,
    clearAllNotifications,
    switchBranch,
    addBranch,
    updateBranch,
    addPrinter,
    updatePrinter,
    deletePrinter,
    testPrinter,
    addPrinterDepartment,
    updatePrinterDepartment,
    deletePrinterDepartment,
  }
}
