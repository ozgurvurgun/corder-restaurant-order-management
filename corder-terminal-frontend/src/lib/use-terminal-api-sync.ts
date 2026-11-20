import { useEffect, useRef } from "react"
import { io, type Socket } from "socket.io-client"
import { getBase, getToken, notifyAuthExpired } from "./api"
import {
  getTerminalNotificationPrefs,
  normalizeWaiterCallPayload,
  triggerTerminalPushNotification,
  type ActiveWaiterCall,
} from "./terminal-notifications"

export function useTerminalApiSync(params: {
  isLoggedIn: boolean
  setIsOffline: (offline: boolean) => void
  refreshData: () => Promise<void>
  refreshLiveState: () => Promise<void>
  pullTables: () => Promise<void>
  onWaiterCalled?: (call: ActiveWaiterCall) => void
  onNotificationsUpdated?: () => Promise<void> | void
}) {
  const {
    isLoggedIn,
    setIsOffline,
    refreshData,
    refreshLiveState,
    pullTables,
    onWaiterCalled,
    onNotificationsUpdated,
  } = params

  const socketRef = useRef<Socket | null>(null)
  const onWaiterCalledRef = useRef(onWaiterCalled)
  const onNotificationsUpdatedRef = useRef(onNotificationsUpdated)

  useEffect(() => {
    onWaiterCalledRef.current = onWaiterCalled
  }, [onWaiterCalled])

  useEffect(() => {
    onNotificationsUpdatedRef.current = onNotificationsUpdated
  }, [onNotificationsUpdated])

  useEffect(() => {
    if (!isLoggedIn) return
    const token = getToken()
    if (!token) return
    const socketUrl = getBase() || (typeof window !== "undefined" ? window.location.origin : "")
    if (!socketUrl) return

    const socket = io(socketUrl, {
      path: "/ws",
      auth: { token },
      transports: ["websocket", "polling"],
      reconnectionAttempts: Infinity,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    })
    socketRef.current = socket

    const syncLive = () => void refreshLiveState()
    const handleAuthExpired = (payload?: { reason?: string }) =>
      notifyAuthExpired(payload?.reason)

    const handleSystemUpdate = (payload?: {
      id?: string
      title?: string
      message?: string
      level?: string
      sentAt?: string
    }) => {
      if (!payload?.id || typeof window === "undefined") return
      window.dispatchEvent(new CustomEvent("corder:system-update", { detail: payload }))
    }

    socket.on("auth:expired", handleAuthExpired)
    socket.on("platform:system_update", handleSystemUpdate)
    socket.on("platform:notification", (payload?: { id?: string; level?: string; title?: string; message?: string; sentAt?: string }) => {
      if (payload?.level === "system_update") {
        handleSystemUpdate(payload)
      }
    })
    socket.on("order:created", syncLive)
    socket.on("orders:moved", syncLive)
    socket.on("orders:updated", syncLive)
    socket.on("tables:presence", () => void pullTables())
    socket.on("staff:session-updated", () => void refreshData())
    socket.on("notifications:updated", () => {
      if (onNotificationsUpdatedRef.current) {
        void onNotificationsUpdatedRef.current()
      } else {
        void refreshLiveState()
      }
    })

    socket.on("waiter:called", (payload: unknown) => {
      const call = normalizeWaiterCallPayload(payload)
      if (!call) return
      const prefs = getTerminalNotificationPrefs()
      if (!prefs.enabled) return

      const sectionLabel = call.sectionName || "Salon"
      const actionLabel =
        call.requestType === "bill" ? "Hesap İstiyor!" : "Garson Çağırıyor!"
      const title = `🔔 ${call.tableName} (${sectionLabel}) - ${actionLabel}`
      const body = call.note ? `Not: ${call.note}` : `${call.tableName} masası çağrı gönderdi.`

      if (prefs.browserPushEnabled) {
        triggerTerminalPushNotification(title, body, `waiter-call-${call.tableId}`)
      }

      onWaiterCalledRef.current?.(call)
    })

    socket.on("connect", () => {
      setIsOffline(false)
      void refreshLiveState()
    })
    socket.io.on("reconnect", () => void refreshData())

    return () => {
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [isLoggedIn, refreshData, refreshLiveState, pullTables, setIsOffline])
}
