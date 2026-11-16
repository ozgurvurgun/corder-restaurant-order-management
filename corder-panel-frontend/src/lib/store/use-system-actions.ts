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
import { showPanelToast } from "@/components/panel/panel-toast"
import { genId, getReadNotifIds, saveAppearanceSettings, saveReadNotifIds } from "./panel-local-storage"
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
  grantedPermissions?: string[]
  revokedPermissions?: string[]
  maxDiscountPercentOverride?: number | null
  maxDiscountAmountOverride?: number | null
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
    grantedPermissions: dto.grantedPermissions ?? [],
    revokedPermissions: dto.revokedPermissions ?? [],
    maxDiscountPercentOverride: dto.maxDiscountPercentOverride ?? null,
    maxDiscountAmountOverride: dto.maxDiscountAmountOverride ?? null,
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
    token, currentUser, printers,
    setUsers, setSettings, setNotifications, setAuditLogs,
    setBranches, setPrinters, setPrinterDepartments,
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
        .catch(() => { })
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
      const phone = u.phone?.trim()
      const email = u.email?.trim()
      const password = u.password?.trim()
      api.staff
        .create(token, {
          name: u.name.trim(),
          ...(pin ? { pin } : {}),
          role,
          ...(phone ? { phone } : {}),
          ...(email ? { email } : {}),
          ...(password ? { password } : {}),
          canAccessPanel: u.canAccessPanel,
          canAccessTerminal: u.canAccessTerminal,
          ...(u.grantedPermissions !== undefined ? { grantedPermissions: u.grantedPermissions } : {}),
          ...(u.revokedPermissions !== undefined ? { revokedPermissions: u.revokedPermissions } : {}),
          ...(u.maxDiscountPercentOverride !== undefined
            ? { maxDiscountPercentOverride: u.maxDiscountPercentOverride }
            : {}),
          ...(u.maxDiscountAmountOverride !== undefined
            ? { maxDiscountAmountOverride: u.maxDiscountAmountOverride }
            : {}),
        })
        .then((created) => {
          setUsers((prev) => [...prev, mapStaffDtoToPanelUser(created)])
          logActivity({
            action: "staff_created",
            category: "user",
            details: `Kullanıcı eklendi: ${created.name}`,
            metadata: { userId: created.id, role: created.role },
          })
          showPanelToast(`Kullanıcı eklendi: ${created.name}`, "success")
        })
        .catch((err) => showPanelToast(err instanceof Error ? err.message : "Kullanıcı eklenemedi", "error"))
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
        grantedPermissions?: string[]
        revokedPermissions?: string[]
        maxDiscountPercentOverride?: number | null
        maxDiscountAmountOverride?: number | null
      } = {}
      if (data.name != null) payload.name = data.name.trim()
      if (data.pin != null && data.pin.trim() !== "") payload.pin = data.pin.trim()
      if (data.role != null && data.role !== "root") payload.role = data.role
      if (data.phone !== undefined) payload.phone = data.phone.trim() || undefined
      if (data.email !== undefined) payload.email = data.email?.trim() || null
      if (data.password != null && data.password.trim() !== "") payload.password = data.password
      if (data.active !== undefined) payload.isActive = data.active
      if (data.canAccessPanel !== undefined) payload.canAccessPanel = data.canAccessPanel
      if (data.canAccessTerminal !== undefined) payload.canAccessTerminal = data.canAccessTerminal
      if (data.grantedPermissions !== undefined) payload.grantedPermissions = data.grantedPermissions
      if (data.revokedPermissions !== undefined) payload.revokedPermissions = data.revokedPermissions
      if (data.maxDiscountPercentOverride !== undefined) {
        payload.maxDiscountPercentOverride = data.maxDiscountPercentOverride
      }
      if (data.maxDiscountAmountOverride !== undefined) {
        payload.maxDiscountAmountOverride = data.maxDiscountAmountOverride
      }
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
            details: `Kullanıcı güncellendi: ${updated.name}`,
            metadata: { userId: id, fields: Object.keys(payload) },
          })
          showPanelToast("Kullanıcı güncellendi", "success")
        })
        .catch((err) => showPanelToast(err instanceof Error ? err.message : "Kullanıcı güncellenemedi", "error"))
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
            details: `Kullanıcı silindi: ${id}`,
            metadata: { userId: id },
          })
          showPanelToast("Kullanıcı silindi", "info")
        })
        .catch((err) => showPanelToast(err instanceof Error ? err.message : "Kullanıcı silinemedi", "error"))
    },
    [token, setUsers, logActivity],
  )

  const updateSettings = useCallback(
    (s: Partial<RestaurantSettings>) => {
      setSettings((prev) => ({ ...prev, ...s }))
      const appearanceFields = ["fontSize", "tableCardSize", "showProductImages", "quickActionsEnabled", "sidebarCollapsed"] as const
      const hasAppearanceField = appearanceFields.some((k) => s[k] !== undefined)
      if (hasAppearanceField) {
        saveAppearanceSettings(s)
        if (s.fontSize !== undefined || s.tableCardSize !== undefined || s.showProductImages !== undefined || s.quickActionsEnabled !== undefined) {
          showPanelToast("Görünüm ayarları kaydedildi", "success")
        }
      }
      if (!token) return
      const serverFields = ["name", "address", "phone", "taxId", "whatsapp", "instagram", "facebook", "website", "workingHours"] as const
      const hasServerField = serverFields.some((k) => s[k] !== undefined)
      if (!hasServerField) return
      api.restaurant
        .updateSettings(token, {
          ...(s.name?.trim() ? { name: s.name.trim() } : {}),
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
            details: "Restoran ayarları güncellendi",
            metadata: { fields: Object.keys(s) },
          })
          showPanelToast("Ayarlar kaydedildi", "success")
        })
        .catch((err) => showPanelToast(err instanceof Error ? err.message : "Ayarlar güncellenemedi", "error"))
    },
    [token, setSettings, logActivity],
  )

  const markNotificationRead = useCallback(
    (id: string) => {
      const readSet = getReadNotifIds()
      readSet.add(id)
      saveReadNotifIds(readSet)
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    },
    [setNotifications],
  )
  const markAllNotificationsRead = useCallback(
    () => {
      setNotifications((prev) => {
        const readSet = getReadNotifIds()
        prev.forEach((n) => readSet.add(n.id))
        saveReadNotifIds(readSet)
        return prev.map((n) => ({ ...n, read: true }))
      })
    },
    [setNotifications],
  )
  const addNotification = useCallback(
    (n: Omit<PanelNotification, "id" | "createdAt" | "read">) =>
      setNotifications((prev) => [{ ...n, id: genId("n"), createdAt: new Date(), read: false }, ...prev]),
    [setNotifications],
  )
  const clearAllNotifications = useCallback(() => setNotifications([]), [setNotifications])

  const switchBranch = useCallback(
    (id: string) => {
      setBranches((prev) => prev.map((b) => ({ ...b, isCurrent: b.id === id })))
      logActivity({ action: "branch_switched", category: "settings", details: `Şube değiştirildi: ${id}`, metadata: { branchId: id } })
    },
    [setBranches, logActivity],
  )
  const addBranch = useCallback(
    (b: Omit<Branch, "id">) => {
      setBranches((prev) => [...prev, { ...b, id: genId("br") }])
      logActivity({ action: "branch_created", category: "settings", details: `Şube eklendi: ${b.name}` })
    },
    [setBranches, logActivity],
  )
  const updateBranch = useCallback(
    (id: string, data: Partial<Branch>) => {
      setBranches((prev) => prev.map((b) => (b.id === id ? { ...b, ...data } : b)))
      logActivity({ action: "branch_updated", category: "settings", details: `Şube güncellendi: ${id}`, metadata: { branchId: id, fields: Object.keys(data) } })
    },
    [setBranches, logActivity],
  )

  const addPrinter = useCallback(
    (p: Omit<PrinterConfig, "id">) => {
      if (!token) return
      api.technical
        .createPrinter(token, {
          name: p.name, type: p.type, connection: p.connection,
          ipAddress: p.ipAddress, port: p.port, department: p.department,
          paperWidth: p.paperWidth, autoCut: p.autoCut,
        })
        .then((created) => {
          setPrinters((prev) => [
            ...prev,
            {
              id: created.id, name: created.name, type: created.type, connection: created.connection,
              ipAddress: created.ipAddress ?? undefined, port: created.port ?? undefined,
              department: created.department ?? undefined, status: created.status,
              paperWidth: created.paperWidth === 58 ? 58 : 80, autoCut: created.autoCut,
            },
          ])
          logActivity({ action: "printer_created", category: "settings", details: `Yazıcı eklendi: ${created.name}`, metadata: { printerId: created.id, type: created.type, connection: created.connection } })
          showPanelToast(`Yazıcı eklendi: ${created.name}`, "success")
        })
        .catch((err) => showPanelToast(err instanceof Error ? err.message : "Yazıcı eklenemedi", "error"))
    },
    [token, setPrinters, logActivity],
  )

  const updatePrinter = useCallback(
    (id: string, data: Partial<PrinterConfig>) => {
      if (!token) return
      api.technical
        .updatePrinter(token, id, {
          name: data.name, type: data.type, connection: data.connection,
          ipAddress: data.ipAddress ?? null, port: data.port ?? null,
          department: data.department ?? null, status: data.status,
          paperWidth: data.paperWidth, autoCut: data.autoCut,
        })
        .then(() => {
          setPrinters((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)))
          logActivity({ action: "printer_updated", category: "settings", details: `Yazıcı güncellendi: ${id}`, metadata: { printerId: id, fields: Object.keys(data) } })
          showPanelToast("Yazıcı güncellendi", "success")
        })
        .catch((err) => showPanelToast(err instanceof Error ? err.message : "Yazıcı güncellenemedi", "error"))
    },
    [token, setPrinters, logActivity],
  )

  const deletePrinter = useCallback(
    (id: string) => {
      if (!token) return
      api.technical
        .deletePrinter(token, id)
        .then(() => {
          setPrinters((prev) => prev.filter((p) => p.id !== id))
          logActivity({ action: "printer_deleted", category: "settings", details: `Yazıcı silindi: ${id}`, metadata: { printerId: id } })
          showPanelToast("Yazıcı silindi", "info")
        })
        .catch((err) => showPanelToast(err instanceof Error ? err.message : "Yazıcı silinemedi", "error"))
    },
    [token, setPrinters, logActivity],
  )

  const testPrinter = useCallback(
    (id: string) => {
      const pr = printers.find((p) => p.id === id)
      if (!pr || !token) return
      setPrinters((prev) => prev.map((p) => (p.id === id ? { ...p, status: "online" } : p)))
      void api.technical.updatePrinter(token, id, { status: "online" }).catch(() => { })
      void api.orders
        .printReceipt(token, {
          tableName: "YAZICI TEST",
          waiterName: currentUser?.name || "Sistem",
          items: [{ productName: `${pr.name} Test Baskısı`, quantity: 1, price: 0 }],
          total: 0,
        })
        .catch(() => { })
      logActivity({ action: "printer_tested", category: "settings", details: `Yazıcı test edildi: ${pr.name}`, metadata: { printerId: id } })
      showPanelToast(`${pr.name} test bağlantısı başarılı`, "success")
    },
    [printers, token, currentUser?.name, setPrinters, logActivity],
  )

  const addPrinterDepartment = useCallback(
    (pd: Omit<PrinterDepartment, "id">) => setPrinterDepartments((prev) => [...prev, { ...pd, id: genId("pd") }]),
    [setPrinterDepartments],
  )
  const updatePrinterDepartment = useCallback(
    (id: string, data: Partial<PrinterDepartment>) =>
      setPrinterDepartments((prev) => prev.map((pd) => (pd.id === id ? { ...pd, ...data } : pd))),
    [setPrinterDepartments],
  )
  const deletePrinterDepartment = useCallback(
    (id: string) => setPrinterDepartments((prev) => prev.filter((pd) => pd.id !== id)),
    [setPrinterDepartments],
  )

  return {
    addAuditLog, logActivity, addUser, updateUser, deleteUser, updateSettings,
    markNotificationRead, markAllNotificationsRead, addNotification, clearAllNotifications,
    switchBranch, addBranch, updateBranch, addPrinter, updatePrinter, deletePrinter,
    testPrinter, addPrinterDepartment, updatePrinterDepartment, deletePrinterDepartment,
  }
}
