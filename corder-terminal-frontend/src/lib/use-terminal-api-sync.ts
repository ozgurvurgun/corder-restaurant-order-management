import { useEffect, useRef } from "react"
import { io, type Socket } from "socket.io-client"
import { getBase, getToken } from "./api"
import {
  getTerminalNotificationPrefs,
  normalizeWaiterCallPayload,
  playTerminalWaiterChime,
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
}) {
  const {
    isLoggedIn,
    setIsOffline,
    refreshData,
    refreshLiveState,
    pullTables,
    onWaiterCalled,
  } = params

  const socketRef = useRef<Socket | null>(null)
  const onWaiterCalledRef = useRef(onWaiterCalled)

  useEffect(() => {
    onWaiterCalledRef.current = onWaiterCalled
  }, [onWaiterCalled])

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
    socket.on("order:created", syncLive)
    socket.on("orders:moved", syncLive)
    socket.on("orders:updated", syncLive)
    socket.on("tables:presence", () => void pullTables())

    socket.on("waiter:called", (payload: unknown) => {
      const call = normalizeWaiterCallPayload(payload)
      if (!call) return
      const prefs = getTerminalNotificationPrefs()
      if (!prefs.enabled) return

      if (prefs.soundEnabled) {
        playTerminalWaiterChime(prefs.volume)
      }

      const sectionLabel = call.sectionName || "Salon"
      const actionLabel =
        call.requestType === "bill" ? "Hesap İstiyor!" : "Garson Çağırıyor!"
      const title = `🔔 ${call.tableName} (${sectionLabel}) — ${actionLabel}`
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
