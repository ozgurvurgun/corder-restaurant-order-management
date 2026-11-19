import { useCallback } from "react"
import type {
  AuditLog, Branch, PanelNotification, PanelUser, PrinterConfig, PrinterDepartment, RestaurantSettings,
} from "../panel-types"
import { api } from "../api"
import { formatTitleCase } from "../format"
import { showPanelToast } from "@/components/panel/panel-toast"
import {
  genId, getDismissedNotifIds, getReadNotifIds, saveAppearanceSettings,
  saveDismissedNotifIds, saveNotifsClearedAt, saveReadNotifIds,
} from "./panel-local-storage"
import type { LogActivityFn } from "./panel-store-context"

type StateSetter<T> = (v: T | ((prev: T) => T)) => void

function mapStaffDtoToPanelUser(dto: {
  id: string; name: string; email?: string | null; phone?: string; role: string
  roleLabel?: string; roleColor?: string; hasPin?: boolean; hasPassword?: boolean
  canAccessPanel?: boolean; canAccessTerminal?: boolean; permissions?: string[]
  grantedPermissions?: string[]; revokedPermissions?: string[]
  maxDiscountPercentOverride?: number | null; maxDiscountAmountOverride?: number | null
  shiftRestrictionEnabled?: boolean; shiftStartTime?: string | null; shiftEndTime?: string | null
  shiftCutoffOffsetMinutes?: number; effectiveShiftEndTime?: string | null
  limits?: { maxDiscountPercent: number; maxDiscountAmount: number | null }
  isActive: boolean; createdAt?: string
}): PanelUser {
  return {
    id: dto.id, name: formatTitleCase(dto.name), email: dto.email ?? undefined, phone: dto.phone,
    role: dto.role, roleLabel: dto.roleLabel, roleColor: dto.roleColor,
    hasPin: dto.hasPin, hasPassword: dto.hasPassword,
    canAccessPanel: dto.canAccessPanel, canAccessTerminal: dto.canAccessTerminal,
    permissions: dto.permissions, grantedPermissions: dto.grantedPermissions ?? [],
    revokedPermissions: dto.revokedPermissions ?? [],
    maxDiscountPercentOverride: dto.maxDiscountPercentOverride ?? null,
    maxDiscountAmountOverride: dto.maxDiscountAmountOverride ?? null,
    shiftRestrictionEnabled: Boolean(dto.shiftRestrictionEnabled),
    shiftStartTime: dto.shiftStartTime ?? null, shiftEndTime: dto.shiftEndTime ?? null,
    shiftCutoffOffsetMinutes: Number(dto.shiftCutoffOffsetMinutes ?? 0),
    effectiveShiftEndTime: dto.effectiveShiftEndTime ?? null,
    limits: dto.limits, active: dto.isActive,
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
  switchBusiness?: (branchId: string) => Promise<void>
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
    switchBusiness,
  } = params

  const addAuditLog = useCallback(
    (log: Omit<AuditLog, "id" | "createdAt">) => {
      setAuditLogs((prev) => [{ ...log, id: genId("al"), createdAt: new Date() }, ...prev].slice(0, 1000))
      if (!token) return
      api.technical
        .createAuditLog(token, { action: log.action, category: log.category, details: log.details, metadata: log.metadata })
        .catch(() => {})
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
          ...(u.maxDiscountPercentOverride !== undefined ? { maxDiscountPercentOverride: u.maxDiscountPercentOverride } : {}),
          ...(u.maxDiscountAmountOverride !== undefined ? { maxDiscountAmountOverride: u.maxDiscountAmountOverride } : {}),
          ...(u.shiftRestrictionEnabled !== undefined ? { shiftRestrictionEnabled: u.shiftRestrictionEnabled } : {}),
          ...(u.shiftStartTime !== undefined ? { shiftStartTime: u.shiftStartTime } : {}),
          ...(u.shiftEndTime !== undefined ? { shiftEndTime: u.shiftEndTime } : {}),
          ...(u.shiftCutoffOffsetMinutes !== undefined ? { shiftCutoffOffsetMinutes: u.shiftCutoffOffsetMinutes } : {}),
        })
        .then((created) => {
          const mapped = mapStaffDtoToPanelUser(created)
          setUsers((prev) => [...prev, mapped])
          logActivity({
            action: "staff_created",
            category: "user",
            details: `Kullanıcı eklendi: ${mapped.name}`,
            metadata: { userId: created.id, role: created.role },
          })
          showPanelToast(`Kullanıcı eklendi: ${mapped.name}`, "success")
        })
        .catch((err) => showPanelToast(err instanceof Error ? err.message : "Kullanıcı eklenemedi", "error"))
    },
    [token, setUsers, logActivity],
  )

  const updateUser = useCallback(
    (id: string, data: Partial<PanelUser>) => {
      if (!token) return
      const payload: Record<string, unknown> = {}
      if (data.name != null) payload.name = data.name.trim()
      if (data.pin != null && data.pin.trim() !== "") payload.pin = data.pin.trim()
      if (data.role != null && data.role !== "root") payload.role = data.role
      if (data.phone !== undefined) payload.phone = data.phone.trim() || undefined
      if (data.email !== undefined) payload.email = data.email?.trim() || null
      if (data.password != null && data.password.trim() !== "") payload.password = data.password
      if (data.active !== undefined) payload.isActive = data.active
      if (data.canAccessPanel !== undefined) payload.canAccessPanel = data.canAccessPanel
      if (data.canAccessTerminal !== undefined) payload.canAccessTerminal = data.canAccessTerminal
      if (data.grantedPermissions !== undefined) {
        payload.grantedPermissions = data.grantedPermissions
      }
      if (data.revokedPermissions !== undefined) {
        payload.revokedPermissions = data.revokedPermissions
      }
      if (data.maxDiscountPercentOverride !== undefined) payload.maxDiscountPercentOverride = data.maxDiscountPercentOverride
      if (data.maxDiscountAmountOverride !== undefined) payload.maxDiscountAmountOverride = data.maxDiscountAmountOverride
      if (data.shiftRestrictionEnabled !== undefined) payload.shiftRestrictionEnabled = data.shiftRestrictionEnabled
      if (data.shiftStartTime !== undefined) payload.shiftStartTime = data.shiftStartTime
      if (data.shiftEndTime !== undefined) payload.shiftEndTime = data.shiftEndTime
      if (data.shiftCutoffOffsetMinutes !== undefined) payload.shiftCutoffOffsetMinutes = data.shiftCutoffOffsetMinutes

      api.staff
        .update(token, id, payload)
        .then((updated) => {
          setUsers((prev) =>
            prev.map((u) => (u.id === id ? { ...u, ...mapStaffDtoToPanelUser(updated), createdAt: u.createdAt } : u)),
          )
          logActivity({
            action: "staff_updated",
            category: "user",
            details: `Kullanıcı güncellendi: ${updated.name}`,
            metadata: { userId: id, fields: Object.keys(payload) },
          })
          const onlyTerminalToggled =
            Object.keys(payload).length === 1 &&
            payload.canAccessTerminal !== undefined
          if (onlyTerminalToggled) {
            showPanelToast(
              payload.canAccessTerminal
                ? `${updated.name} el terminali erişimi açıldı`
                : `${updated.name} el terminalinden anında düşürüldü ve girişi kapatıldı`,
              payload.canAccessTerminal ? "success" : "info",
            )
          } else {
            showPanelToast("Kullanıcı güncellendi", "success")
          }
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
          logActivity({ action: "staff_deleted", category: "user", details: `Kullanıcı silindi: ${id}`, metadata: { userId: id } })
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
      if (appearanceFields.some((k) => s[k] !== undefined)) {
        saveAppearanceSettings(s)
        if (s.fontSize !== undefined || s.tableCardSize !== undefined || s.showProductImages !== undefined || s.quickActionsEnabled !== undefined) {
          showPanelToast("Görünüm ayarları kaydedildi", "success")
        }
      }
      if (!token) return
      const serverFields = ["name", "logoUrl", "address", "phone", "taxId", "whatsapp", "instagram", "facebook", "website", "workingHours", "menuTemplate", "terminalLocationRestrictionEnabled", "locationLatitude", "locationLongitude", "locationRadiusMeters"] as const
      if (!serverFields.some((k) => s[k] !== undefined || k in s)) return
      api.restaurant
        .updateSettings(token, {
          ...(s.name?.trim() ? { name: s.name.trim() } : {}),
          ...(s.logoUrl !== undefined ? { logoUrl: s.logoUrl || null } : {}),
          ...("address" in s ? { address: s.address ?? null } : {}),
          ...("phone" in s ? { phone: s.phone ?? null } : {}),
          ...("taxId" in s ? { taxId: s.taxId ?? null } : {}),
          ...("whatsapp" in s ? { whatsapp: s.whatsapp ?? null } : {}),
          ...("instagram" in s ? { instagram: s.instagram ?? null } : {}),
          ...("facebook" in s ? { facebook: s.facebook ?? null } : {}),
          ...("website" in s ? { website: s.website ?? null } : {}),
          ...("workingHours" in s ? { workingHours: s.workingHours ?? null } : {}),
          ...(s.menuTemplate !== undefined ? { menuTemplate: s.menuTemplate } : {}),
          ...(s.terminalLocationRestrictionEnabled !== undefined ? { terminalLocationRestrictionEnabled: s.terminalLocationRestrictionEnabled } : {}),
          ...("locationLatitude" in s ? { locationLatitude: s.locationLatitude ?? null } : {}),
          ...("locationLongitude" in s ? { locationLongitude: s.locationLongitude ?? null } : {}),
          ...(s.locationRadiusMeters !== undefined ? { locationRadiusMeters: s.locationRadiusMeters } : {}),
        })
        .then(() => {
          logActivity({ action: "settings_updated", category: "settings", details: "Restoran ayarları güncellendi", metadata: { fields: Object.keys(s) } })
          const isTplOnly = s.menuTemplate !== undefined && Object.keys(s).length === 1
          showPanelToast(isTplOnly ? "QR menü tasarım şablonu güncellendi" : "Ayarlar kaydedildi", "success")
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
  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => {
      const readSet = getReadNotifIds()
      prev.forEach((n) => readSet.add(n.id))
      saveReadNotifIds(readSet)
      return prev.map((n) => ({ ...n, read: true }))
    })
  }, [setNotifications])
  const addNotification = useCallback(
    (n: Omit<PanelNotification, "id" | "createdAt" | "read">) =>
      setNotifications((prev) => [{ ...n, id: genId("n"), createdAt: new Date(), read: false }, ...prev]),
    [setNotifications],
  )
  const dismissNotification = useCallback(
    (id: string) => {
      const dismissed = getDismissedNotifIds()
      dismissed.add(id)
      saveDismissedNotifIds(dismissed)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      if (token) {
        void api.notifications.dismiss(token, [id]).catch(() => {})
      }
    },
    [token, setNotifications],
  )
  const clearAllNotifications = useCallback(() => {
    const nowIso = new Date().toISOString()
    saveNotifsClearedAt(nowIso)
    setNotifications((prev) => {
      const dismissed = getDismissedNotifIds()
      const ids = prev.map((n) => n.id)
      ids.forEach((id) => dismissed.add(id))
      saveDismissedNotifIds(dismissed)
      if (token && ids.length > 0) {
        void api.notifications.dismiss(token, ids).catch(() => {})
      }
      return []
    })
    if (token) {
      void api.notifications.clearAll(token).catch(() => {})
    }
  }, [token, setNotifications])

  const switchBranch = useCallback(
    (id: string) => {
      setBranches((prev) => prev.map((b) => ({ ...b, isCurrent: b.id === id })))
      if (switchBusiness) void switchBusiness(id)
      logActivity({ action: "branch_switched", category: "settings", details: `Şube değiştirildi: ${id}`, metadata: { branchId: id } })
    },
    [setBranches, switchBusiness, logActivity],
  )
  const addBranch = useCallback((_b: Omit<Branch, "id">) => {
    showPanelToast("Yeni şube açılışı yalnızca Platform Yönetimi üzerinden yapılır.", "info")
  }, [])
  const updateBranch = useCallback(
    (id: string, data: Partial<Branch>) => setBranches((prev) => prev.map((b) => (b.id === id ? { ...b, ...data } : b))),
    [setBranches],
  )

  const addPrinter = useCallback(
    (p: Omit<PrinterConfig, "id">) => {
      if (!token) return
      api.technical
        .createPrinter(token, {
          name: p.name.trim(),
          type: p.type,
          connection: p.connection,
          ipAddress: p.ipAddress?.trim() || undefined,
          port: p.port,
          department: p.department?.trim() || undefined,
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
            details: `Yazıcı eklendi: ${created.name}`,
            metadata: { printerId: created.id, type: created.type, connection: created.connection },
          })
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
          name: data.name,
          type: data.type,
          connection: data.connection,
          ipAddress: data.ipAddress !== undefined ? (data.ipAddress || null) : undefined,
          port: data.port !== undefined ? (data.port ?? null) : undefined,
          department: data.department !== undefined ? (data.department || null) : undefined,
          status: data.status,
          paperWidth: data.paperWidth,
          autoCut: data.autoCut,
        })
        .then((updated) => {
          setPrinters((prev) =>
            prev.map((p) =>
              p.id === id
                ? {
                    id: updated.id,
                    name: updated.name,
                    type: updated.type,
                    connection: updated.connection,
                    ipAddress: updated.ipAddress ?? undefined,
                    port: updated.port ?? undefined,
                    department: updated.department ?? undefined,
                    status: updated.status,
                    paperWidth: updated.paperWidth === 58 ? 58 : 80,
                    autoCut: updated.autoCut,
                  }
                : p,
            ),
          )
          logActivity({ action: "printer_updated", category: "settings", details: `Yazıcı güncellendi: ${updated.name}`, metadata: { printerId: id } })
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
      void api.orders
        .printReceipt(token, {
          tableName: "YAZICI TEST",
          waiterName: currentUser?.name || "Sistem",
          items: [{ productName: `${pr.name} Test Baskısı`, quantity: 1, price: 0 }],
          total: 0,
        })
        .then(() => {
          setPrinters((prev) => prev.map((p) => (p.id === id ? { ...p, status: "online" } : p)))
          void api.technical.updatePrinter(token, id, { status: "online" }).catch(() => {})
          logActivity({ action: "printer_tested", category: "settings", details: `Yazıcı test edildi: ${pr.name}`, metadata: { printerId: id } })
          showPanelToast(`${pr.name} test baskısı kuyruğa gönderildi`, "success")
        })
        .catch((err) => showPanelToast(err instanceof Error ? err.message : "Test baskısı gönderilemedi", "error"))
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
    addAuditLog,
    logActivity,
    addUser,
    updateUser,
    deleteUser,
    updateSettings,
    markNotificationRead,
    markAllNotificationsRead,
    addNotification,
    dismissNotification,
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
