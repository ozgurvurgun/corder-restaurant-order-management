import { useCallback, useEffect, useRef } from "react"
import { io, type Socket } from "socket.io-client"
import { api, getBase, getStaffSession, getToken, notifyAuthExpired } from "./api"
import {
  getTerminalNotificationPrefs,
  normalizeWaiterCallPayload,
  syncTerminalWebPushSubscription,
  triggerTerminalPushNotification,
  type ActiveWaiterCall,
} from "./terminal-notifications"

export function useWaiterNotificationCallbacks() {
  const seenWaiterCallIdsRef = useRef<Set<string>>(new Set())
  const initialWaiterSyncDoneRef = useRef(false)

  const handleWaiterCalled = useCallback((call: ActiveWaiterCall) => {
    if (seenWaiterCallIdsRef.current.has(call.id)) return
    seenWaiterCallIdsRef.current.add(call.id)
    const prefs = getTerminalNotificationPrefs()
    if (prefs.enabled && prefs.browserPushEnabled) {
      const sectionLabel = call.sectionName || "Salon"
      const actionLabel =
        call.requestType === "bill" ? "Hesap İstiyor!" : "Garson Çağırıyor!"
      const title = `🔔 ${call.tableName} (${sectionLabel}) - ${actionLabel}`
      const body = call.note
        ? `Not: ${call.note}`
        : `${call.tableName} masası çağrı gönderdi.`
      triggerTerminalPushNotification(title, body, `waiter-call-${call.id}`)
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("corder:waiter-called", { detail: call }))
    }
  }, [])

  const syncNotifications = useCallback(async () => {
    const token = getToken()
    const staffSession = getStaffSession()
    if (!token || !staffSession?.staffToken) return
    try {
      const state = await api.notifications.getState(token)
      if (state.latestSystemUpdate?.id && typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("corder:system-update", { detail: state.latestSystemUpdate })
        )
      }
      const normalizedCalls = (state.waiterCalls ?? [])
        .map((c) => normalizeWaiterCallPayload(c))
        .filter((c): c is ActiveWaiterCall => Boolean(c))

      if (!initialWaiterSyncDoneRef.current) {
        initialWaiterSyncDoneRef.current = true
        for (const call of normalizedCalls) {
          seenWaiterCallIdsRef.current.add(call.id)
        }
        return
      }

      for (const call of normalizedCalls) {
        if (!seenWaiterCallIdsRef.current.has(call.id)) {
          handleWaiterCalled(call)
        }
      }
    } catch {
      /* ignore background notification sync errors */
    }
  }, [handleWaiterCalled])

  return { handleWaiterCalled, syncNotifications }
}

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

    const checkLatestSystemUpdate = async () => {
      const currentToken = getToken()
      if (!currentToken) return
      try {
        const res = await api.notifications.getSystemUpdate(currentToken)
        if (res?.latestSystemUpdate?.id) {
          handleSystemUpdate(res.latestSystemUpdate)
        }
      } catch {
        // ignore background system update check errors
      }
    }

    void checkLatestSystemUpdate()
    void syncTerminalWebPushSubscription(token)

    socket.on("auth:expired", handleAuthExpired)
    socket.on("platform:system_update", handleSystemUpdate)
    socket.on(
      "platform:notification",
      (payload?: {
        id?: string
        level?: string
        title?: string
        message?: string
        targetApps?: string[]
        sentAt?: string
      }) => {
        if (payload?.level === "system_update") {
          handleSystemUpdate(payload)
          return
        }
        if (
          Array.isArray(payload?.targetApps) &&
          !payload.targetApps.includes("terminal")
        ) {
          return
        }
        const prefs = getTerminalNotificationPrefs()
        if (prefs.enabled && prefs.browserPushEnabled) {
          triggerTerminalPushNotification(
            `📢 ${payload?.title || "Corder Bildirimi"}`,
            payload?.message || "",
            `corder-platform-${payload?.id || Date.now()}`
          )
        }
      }
    )
    socket.on("order:created", syncLive)
    socket.on("orders:moved", syncLive)
    socket.on("orders:updated", syncLive)
    socket.on("tables:presence", () => void pullTables())
    socket.on("staff:session-updated", () => void refreshData())
    socket.on("notifications:updated", () => {
      void checkLatestSystemUpdate()
      if (onNotificationsUpdatedRef.current) {
        void onNotificationsUpdatedRef.current()
      } else {
        void refreshLiveState()
      }
    })

    socket.on("waiter:called", (payload: unknown) => {
      const call = normalizeWaiterCallPayload(payload)
      if (!call) return
      onWaiterCalledRef.current?.(call)
    })

    socket.on("connect", () => {
      setIsOffline(false)
      void refreshLiveState()
      void checkLatestSystemUpdate()
      void syncTerminalWebPushSubscription(token)
    })
    socket.io.on("reconnect", () => {
      void refreshData()
      void checkLatestSystemUpdate()
    })

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkLatestSystemUpdate()
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [isLoggedIn, refreshData, refreshLiveState, pullTables, setIsOffline])
}
