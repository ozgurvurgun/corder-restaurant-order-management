import { useEffect, useRef, type MutableRefObject } from "react"
import { io, type Socket } from "socket.io-client"
import {
  itemCountsTowardBill,
  type PanelNotification,
  type PanelOrder,
  type PanelTable,
} from "../panel-types"
import { notifyAuthExpired, getBase, type OrderDto } from "../api"
import { computeDiscountMinorUnits, fromMinorUnits, toMinorUnits } from "../format"
import { mapOrder } from "../mappers/orders-tables.mapper"
import {
  getNotificationPrefs,
  showBrowserNotification,
} from "../notification-sound"
import { showPanelToast } from "@/components/panel/panel-toast"

export function usePanelSocket(params: {
  token: string | null
  restaurantId?: string | null
  refreshPosRef: MutableRefObject<() => Promise<void>>
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
      void refreshPosRef.current?.()
    }

    const handleOrdersMoved = () => void refreshPosRef.current?.()
    const handleOrdersUpdated = () => void refreshPosRef.current?.()
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
            lockedByStaffName: hit?.staffName,
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
      const tableName = payload.tableName || "Masa"
      const sectionName = payload.sectionName || "Salon"
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
      showBrowserNotification(title, message, notifId)
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

    const handlePlatformNotification = (payload: {
      id?: string
      title?: string
      message?: string
      level?: string
      targetApps?: string[]
      sentAt?: string
      createdAt?: string
    }) => {
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

    socket.on("connect", handleConnect)
    socket.io.on("reconnect", handleReconnect)
    socket.on("auth:expired", handleAuthExpired)
    socket.on("order:created", handleOrderCreated)
    socket.on("orders:moved", handleOrdersMoved)
    socket.on("orders:updated", handleOrdersUpdated)
    socket.on("tables:presence", handleTablesPresence)
    socket.on("waiter:called", handleWaiterCalled)
    socket.on("fraud:alert", handleFraudAlert)
    socket.on("platform:notification", handlePlatformNotification)

    return () => {
      socket.off("connect", handleConnect)
      socket.io.off("reconnect", handleReconnect)
      socket.off("auth:expired", handleAuthExpired)
      socket.off("order:created", handleOrderCreated)
      socket.off("orders:moved", handleOrdersMoved)
      socket.off("orders:updated", handleOrdersUpdated)
      socket.off("tables:presence", handleTablesPresence)
      socket.off("waiter:called", handleWaiterCalled)
      socket.off("fraud:alert", handleFraudAlert)
      socket.off("platform:notification", handlePlatformNotification)
      socket.disconnect()
      socketRef.current = null
    }
  }, [token, restaurantId, refreshPosRef, setOrders, setTables, setNotifications])
}

