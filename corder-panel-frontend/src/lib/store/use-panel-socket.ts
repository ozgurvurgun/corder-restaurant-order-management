import { useEffect, useRef, type MutableRefObject } from "react"
import { io, type Socket } from "socket.io-client"
import {
  itemCountsTowardBill,
  type PanelNotification,
  type PanelOrder,
  type PanelTable,
} from "../panel-types"
import { api, notifyAuthExpired, getBase, setSessionUser, type OrderDto } from "../api"
import { computeDiscountMinorUnits, formatTitleCase, fromMinorUnits, toMinorUnits } from "../format"
import { mapOrder } from "../mappers/orders-tables.mapper"
import {
  getNotificationPrefs,
  showBrowserNotification,
  syncPanelWebPushSubscription,
} from "../notification-sound"
import {
  getDismissedNotifIds,
  getNotifsClearedAt,
  getReadNotifIds,
  saveDismissedNotifIds,
  saveNotifsClearedAt,
} from "./panel-local-storage"
import { showPanelToast } from "@/components/panel/panel-toast"

export function usePanelSocket(params: {
  token: string | null
  restaurantId?: string | null
  refreshPosRef: MutableRefObject<() => Promise<void>>
  refreshActivePosRef?: MutableRefObject<() => Promise<void>>
  setOrders: (v: PanelOrder[] | ((prev: PanelOrder[]) => PanelOrder[])) => void
  setTables: (v: PanelTable[] | ((prev: PanelTable[]) => PanelTable[])) => void
  setNotifications?: (
    v: PanelNotification[] | ((prev: PanelNotification[]) => PanelNotification[]),
  ) => void
}) {
  const {
    token,
    restaurantId,
    refreshPosRef,
    refreshActivePosRef,
    setOrders,
    setTables,
    setNotifications,
  } = params
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect()
      socketRef.current = null
      return
    }
    const baseUrl = getBase()
    const socket = io(baseUrl || undefined, {
      path: "/ws",
      auth: { token, ...(restaurantId ? { restaurantId } : {}) },
      transports: ["websocket", "polling"],
      reconnectionAttempts: Infinity,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    })
    socketRef.current = socket
    let connectedOnce = false

    const handleConnect = () => {
      if (connectedOnce) void refreshPosRef.current?.()
      connectedOnce = true
      void syncPanelWebPushSubscription(token)
    }
    const handleReconnect = () => void refreshPosRef.current?.()

    const handleOrderCreated = (payload: OrderDto) => {
      const mapped = mapOrder(payload)
      const lineMinorUnits = mapped.items
        .filter(itemCountsTowardBill)
        .reduce((s, i) => s + toMinorUnits(i.price) * i.quantity, 0)
      setOrders((prev) => (prev.some((o) => o.id === mapped.id) ? prev : [mapped, ...prev]))
      setTables((pt) =>
        pt.map((t) => {
          if (t.id !== mapped.tableId || t.activeOrderId === mapped.id) return t
          const rawMinorUnits =
            toMinorUnits(t.totalAmount || 0) +
            toMinorUnits(t.discount?.amount || 0) +
            lineMinorUnits
          const discountMinorUnits = computeDiscountMinorUnits(rawMinorUnits, t.discount)
          const nextTotal = fromMinorUnits(Math.max(0, rawMinorUnits - discountMinorUnits))
          return {
            ...t,
            status: t.status === "checkout" ? "checkout" : "occupied",
            totalAmount: nextTotal,
            ...(t.discount
              ? {
                  discount: {
                    ...t.discount,
                    amount: fromMinorUnits(discountMinorUnits),
                  },
                }
              : {}),
            orderCount: t.orderCount + 1,
            lastUpdated: mapped.updatedAt,
            activeOrderId: mapped.id,
            waiter: mapped.userName || t.waiter,
          }
        }),
      )
    }

    const handleOrdersMoved = () => void (refreshActivePosRef?.current ?? refreshPosRef.current)?.()
    const handleOrdersUpdated = () => void refreshPosRef.current?.()
    const handlePrintersUpdated = () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("corder:printers-updated"))
      }
    }
    const handleTablesPresence = (
      presenceMap: Record<string, { staffId: string; staffName: string }>,
    ) => {
      if (!presenceMap || typeof presenceMap !== "object") return
      setTables((prev) =>
        prev.map((t) => {
          const hit = presenceMap[t.id]
          return {
            ...t,
            lockedByStaffId: hit?.staffId,
            lockedByStaffName: hit?.staffName ? formatTitleCase(hit.staffName) : undefined,
          }
        }),
      )
    }

    const handleAuthExpired = (payload?: { reason?: string }) =>
      notifyAuthExpired(payload?.reason)

    const handleWaiterCalled = (payload: {
      id?: string
      tableId?: string
      tableName?: string
      sectionName?: string
      requestType?: string
      note?: string
      createdAt?: string
    }) => {
      const prefs = getNotificationPrefs()
      if (!prefs.waiterCallEnabled) return
      const tableName = payload.tableName ? formatTitleCase(payload.tableName) : "Masa"
      const sectionName = payload.sectionName ? formatTitleCase(payload.sectionName) : "Salon"
      const isBill = payload.requestType === "bill"
      const title = `🔔 ${tableName} (${sectionName}) - ${isBill ? "Hesap İstiyor!" : "Garson Çağırıyor!"}`
      const message = payload.note
        ? `Not: ${payload.note}`
        : `${tableName} masasından ${isBill ? "hesap talebi" : "garson çağrısı"} geldi.`
      const notifId = payload.id || `waiter-call-${Date.now()}`
      setNotifications?.((prev) => {
        if (prev.some((n) => n.id === notifId)) return prev
        return [
          {
            id: notifId,
            type: "waiter-call",
            title,
            message,
            read: false,
            createdAt: payload.createdAt ? new Date(payload.createdAt) : new Date(),
          },
          ...prev,
        ]
      })
      showPanelToast(title, "info")
      showBrowserNotification(title, message, `waiter-call-${notifId}`)
    }

    const handleVoiceSettingsUpdated = (payload: {
      voiceAnnouncementEnabled?: boolean
    }) => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("corder:voice-settings-updated", { detail: payload }),
        )
      }
    }

    const handleFraudAlert = (payload: {
      id?: string
      title?: string
      description?: string
      severity?: string
      createdAt?: string
    }) => {
      const title = `🚨 Güvenlik Uyarısı: ${payload.title || "Şüpheli İşlem Tespit Edildi"}`
      const message =
        payload.description || "Güvenlik ve suistimal tespit merkezi yeni bir uyarı kaydetti."
      const notifId = payload.id ? `fraud-${payload.id}` : `fraud-${Date.now()}`
      setNotifications?.((prev) => {
        if (prev.some((n) => n.id === notifId)) return prev
        return [
          {
            id: notifId,
            type: "fraud-alert",
            title,
            message,
            read: false,
            createdAt: payload.createdAt ? new Date(payload.createdAt) : new Date(),
          },
          ...prev,
        ]
      })
      showPanelToast(title, "error")
      showBrowserNotification(title, message, notifId)
    }

    const handleSystemUpdate = (payload: {
      id?: string
      title?: string
      message?: string
      sentAt?: string
    }) => {
      if (!payload?.id || typeof window === "undefined") return
      window.dispatchEvent(new CustomEvent("corder:system-update", { detail: payload }))
    }

    const handlePlatformNotification = (payload: {
      id?: string
      title?: string
      message?: string
      level?: string
      targetApps?: string[]
      sentAt?: string
      createdAt?: string
    }) => {
      if (payload.level === "system_update") {
        handleSystemUpdate(payload)
      }
      if (
        Array.isArray(payload.targetApps) &&
        !payload.targetApps.includes("merchant")
      ) {
        return
      }
      const title = `📢 ${payload.title || "Platform Bildirimi"}`
      const message = payload.message || ""
      const notifId = payload.id ? `platform:${payload.id}` : `platform:${Date.now()}`
      setNotifications?.((prev) => {
        if (prev.some((n) => n.id === notifId || n.id === payload.id)) return prev
        return [
          {
            id: notifId,
            type: "system",
            title,
            message,
            read: false,
            createdAt: payload.sentAt
              ? new Date(payload.sentAt)
              : payload.createdAt
                ? new Date(payload.createdAt)
                : new Date(),
          },
          ...prev,
        ]
      })
      const toastType =
        payload.level === "urgent"
          ? "error"
          : payload.level === "success"
            ? "success"
            : "info"
      showPanelToast(`${title} - ${message}`, toastType)
      showBrowserNotification(title, message, notifId)
    }

    const handleStaffSessionUpdated = () => {
      if (!token) return
      void api.restaurant
        .me(token)
        .then((meRes) => {
          if (meRes.user.role !== "root" && meRes.user.role !== "staff") {
            notifyAuthExpired("Yönetim paneli erişim yetkiniz kaldırıldı.")
            return
          }
          const normalizedUser = {
            ...meRes.user,
            name: formatTitleCase(meRes.user.name),
          }
          setSessionUser(normalizedUser)
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("corder:staff-session-updated", {
                detail: normalizedUser,
              }),
            )
          }
        })
        .catch(() => {})
      void refreshPosRef.current?.()
    }

    const handleNotificationsUpdated = () => {
      if (!token) return
      void api.notifications
        .getState(token)
        .then((state) => {
          if (!state) return
          if (Array.isArray(state.dismissedIds) && state.dismissedIds.length > 0) {
            const merged = getDismissedNotifIds(restaurantId)
            state.dismissedIds.forEach((id) => merged.add(id))
            saveDismissedNotifIds(merged, restaurantId)
          }
          if (state.clearedAt) {
            const localCleared = getNotifsClearedAt(restaurantId)
            if (
              !localCleared ||
              new Date(state.clearedAt).getTime() > new Date(localCleared).getTime()
            ) {
              saveNotifsClearedAt(state.clearedAt, restaurantId)
            }
          }
          const latestUpdate = (
            state as {
              latestSystemUpdate?: {
                id?: string
                title?: string
                message?: string
                sentAt?: string
              } | null
            }
          ).latestSystemUpdate
          if (latestUpdate?.id) {
            handleSystemUpdate(latestUpdate)
          }
          const readIds = getReadNotifIds(restaurantId)
          const dismissedIds = getDismissedNotifIds(restaurantId)
          const clearedIso = getNotifsClearedAt(restaurantId)
          const clearedMs = clearedIso ? new Date(clearedIso).getTime() : 0
          const activeWaiterIds = new Set((state.waiterCalls ?? []).map((wc) => wc.id))
          const waiterNotifs: PanelNotification[] = (state.waiterCalls ?? []).map((wc) => {
            const isBill = wc.requestType === "bill"
            const tName = formatTitleCase(wc.tableName) || "Masa"
            const section = wc.sectionName ? formatTitleCase(wc.sectionName) : "Salon"
            return {
              id: wc.id,
              type: "waiter-call" as const,
              title: `🔔 ${tName} (${section}) - ${isBill ? "Hesap İstiyor!" : "Garson Çağırıyor!"}`,
              message: wc.note
                ? `Not: ${wc.note}`
                : `${tName} masasından ${isBill ? "hesap talebi" : "garson çağrısı"} geldi.`,
              read: readIds.has(wc.id),
              createdAt: new Date(wc.createdAt),
            }
          })
          const platformNotifs: PanelNotification[] = (state.platformNotifications ?? [])
            .filter((pn) => !Array.isArray(pn.targetApps) || pn.targetApps.includes("merchant"))
            .map((pn) => {
              const notifId = `platform:${pn.id}`
              return {
                id: notifId,
                type: "system" as const,
                title: `📢 ${pn.title}`,
                message: pn.message,
                read: readIds.has(notifId) || readIds.has(pn.id),
                createdAt: new Date(pn.sentAt || pn.createdAt),
              }
            })
          setNotifications?.((prev) => {
            const kept = prev.filter((n) => {
              if (dismissedIds.has(n.id)) return false
              const ts = new Date(n.createdAt).getTime()
              if (clearedMs > 0 && Number.isFinite(ts) && ts <= clearedMs) return false
              if (n.type === "waiter-call" && !activeWaiterIds.has(n.id)) return false
              return true
            })
            const existingIds = new Set(kept.map((n) => n.id))
            const added = [...platformNotifs, ...waiterNotifs].filter(
              (wn) => !existingIds.has(wn.id) && !dismissedIds.has(wn.id),
            )
            return [...added, ...kept].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            )
          })
        })
        .catch(() => {})
    }

    socket.on("connect", handleConnect)
    socket.io.on("reconnect", handleReconnect)
    socket.on("auth:expired", handleAuthExpired)
    socket.on("order:created", handleOrderCreated)
    socket.on("orders:moved", handleOrdersMoved)
    socket.on("orders:updated", handleOrdersUpdated)
    socket.on("printers:updated", handlePrintersUpdated)
    socket.on("tables:presence", handleTablesPresence)
    socket.on("waiter:called", handleWaiterCalled)
    socket.on("waiter:voice-settings-updated", handleVoiceSettingsUpdated)
    socket.on("fraud:alert", handleFraudAlert)
    socket.on("platform:notification", handlePlatformNotification)
    socket.on("platform:system_update", handleSystemUpdate)
    socket.on("staff:session-updated", handleStaffSessionUpdated)
    socket.on("notifications:updated", handleNotificationsUpdated)

    return () => {
      socket.off("connect", handleConnect)
      socket.io.off("reconnect", handleReconnect)
      socket.off("auth:expired", handleAuthExpired)
      socket.off("order:created", handleOrderCreated)
      socket.off("orders:moved", handleOrdersMoved)
      socket.off("orders:updated", handleOrdersUpdated)
      socket.off("printers:updated", handlePrintersUpdated)
      socket.off("tables:presence", handleTablesPresence)
      socket.off("waiter:called", handleWaiterCalled)
      socket.off("waiter:voice-settings-updated", handleVoiceSettingsUpdated)
      socket.off("fraud:alert", handleFraudAlert)
      socket.off("platform:notification", handlePlatformNotification)
      socket.off("platform:system_update", handleSystemUpdate)
      socket.off("staff:session-updated", handleStaffSessionUpdated)
      socket.off("notifications:updated", handleNotificationsUpdated)
      socket.disconnect()
      socketRef.current = null
    }
  }, [token, restaurantId, refreshPosRef, setOrders, setTables, setNotifications])
}

