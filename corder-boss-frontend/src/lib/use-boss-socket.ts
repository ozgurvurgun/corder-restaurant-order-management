import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react"
import { io, type Socket } from "socket.io-client"
import { getApiBase, getBossToken, notifyUnauthorized } from "./api"
import { formatTitleCase } from "./format"
import {
  syncBossWebPushSubscription,
  triggerPlatformPushNotification,
} from "./fraud-notifier"
import type { BossPlatformNotificationDto, LiveTableDto } from "./types"

export function useBossSocket(params: {
  tokenVersion: number
  userId?: string
  effectiveBranchId?: string
  socketRef: MutableRefObject<Socket | null>
  liveRefreshTimerRef: MutableRefObject<number | null>
  effectiveBranchIdRef: MutableRefObject<string>
  selectedBranchIdRef: MutableRefObject<string>
  pushSoundEnabledRef: MutableRefObject<boolean>
  setTables: Dispatch<SetStateAction<LiveTableDto[]>>
  setPlatformNotifications: Dispatch<SetStateAction<BossPlatformNotificationDto[]>>
  refreshLiveOperations: (branchId: string, overviewBranchId: string) => Promise<void>
  fetchPlatformNotifsSilently: (branchId: string) => Promise<void>
  showToast: (text: string, type?: "success" | "error") => void
}) {
  const {
    tokenVersion,
    userId,
    effectiveBranchId,
    socketRef,
    liveRefreshTimerRef,
    effectiveBranchIdRef,
    selectedBranchIdRef,
    pushSoundEnabledRef,
    setTables,
    setPlatformNotifications,
    refreshLiveOperations,
    fetchPlatformNotifsSilently,
    showToast,
  } = params

  useEffect(() => {
    const token = getBossToken()
    if (!token || !userId) return
    const targetBranch = effectiveBranchId || effectiveBranchIdRef.current
    const socket = io(getApiBase() || undefined, {
      path: "/ws",
      auth: {
        token,
        ...(targetBranch ? { restaurantId: targetBranch } : {}),
      },
      transports: ["websocket", "polling"],
    })
    socketRef.current = socket

    const scheduleLiveRefresh = () => {
      if (liveRefreshTimerRef.current !== null) {
        window.clearTimeout(liveRefreshTimerRef.current)
      }
      liveRefreshTimerRef.current = window.setTimeout(() => {
        liveRefreshTimerRef.current = null
        if (effectiveBranchIdRef.current) {
          void refreshLiveOperations(
            effectiveBranchIdRef.current,
            selectedBranchIdRef.current
          )
        }
      }, 250)
    }

    const onTablesPresence = (
      presenceMap?: Record<string, { staffId: string; staffName: string }>
    ) => {
      if (!presenceMap || typeof presenceMap !== "object") return
      setTables((prev) =>
        prev.map((t) => ({
          ...t,
          sessionStaffId: presenceMap[t.id]?.staffId ?? null,
          sessionStaffName: presenceMap[t.id]?.staffName
            ? formatTitleCase(presenceMap[t.id]!.staffName)
            : null,
        }))
      )
    }

    const onAuthExpired = (payload?: { reason?: string }) => {
      notifyUnauthorized(payload?.reason)
    }

    const onSystemUpdate = (payload?: {
      id?: string
      title?: string
      message?: string
      sentAt?: string
    }) => {
      if (!payload?.id || typeof window === "undefined") return
      window.dispatchEvent(
        new CustomEvent("corder:system-update", { detail: payload })
      )
    }

    const onPlatformNotification = (payload?: BossPlatformNotificationDto) => {
      if (!payload || !payload.id) return
      if ((payload as { level?: string }).level === "system_update") {
        onSystemUpdate(payload)
      }
      if (Array.isArray(payload.targetApps) && !payload.targetApps.includes("boss")) {
        return
      }
      setPlatformNotifications((prev) =>
        prev.some((n) => n.id === payload.id)
          ? prev
          : [{ ...payload, read: false }, ...prev]
      )
      showToast(
        `📢 ${payload.title}: ${payload.message}`,
        payload.level === "urgent" ? "error" : "success"
      )
      if (pushSoundEnabledRef.current) {
        void triggerPlatformPushNotification(payload)
      }
    }

    const onNotificationsUpdated = () => {
      if (effectiveBranchIdRef.current) {
        void fetchPlatformNotifsSilently(effectiveBranchIdRef.current)
      }
    }

    socket.on("connect", () => {
      void syncBossWebPushSubscription(token)
    })
    socket.on("auth:expired", onAuthExpired)
    socket.on("platform:notification", onPlatformNotification)
    socket.on("platform:system_update", onSystemUpdate)
    socket.on("notifications:updated", onNotificationsUpdated)
    socket.on("order:created", scheduleLiveRefresh)
    socket.on("orders:moved", scheduleLiveRefresh)
    socket.on("orders:updated", scheduleLiveRefresh)
    socket.on("fraud:alert", scheduleLiveRefresh)
    socket.on("tables:presence", onTablesPresence)

    return () => {
      if (liveRefreshTimerRef.current !== null) {
        window.clearTimeout(liveRefreshTimerRef.current)
        liveRefreshTimerRef.current = null
      }
      socket.disconnect()
      if (socketRef.current === socket) socketRef.current = null
    }
  }, [
    tokenVersion,
    userId,
    effectiveBranchId,
    socketRef,
    liveRefreshTimerRef,
    effectiveBranchIdRef,
    selectedBranchIdRef,
    pushSoundEnabledRef,
    setTables,
    setPlatformNotifications,
    refreshLiveOperations,
    fetchPlatformNotifsSilently,
    showToast,
  ])
}

