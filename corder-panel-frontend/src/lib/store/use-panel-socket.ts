import { useEffect, useRef, type MutableRefObject } from "react"
import { io, type Socket } from "socket.io-client"
import {
  itemCountsTowardBill,
  type PanelOrder,
  type PanelTable,
} from "../panel-types"
import { clearToken, getBase, type OrderDto } from "../api"
import { computeDiscountMinorUnits, fromMinorUnits, toMinorUnits } from "../format"
import { mapOrder } from "../mappers/orders-tables.mapper"

export function usePanelSocket(params: {
  token: string | null
  restaurantId?: string | null
  refreshPosRef: MutableRefObject<() => Promise<void>>
  setOrders: (v: PanelOrder[] | ((prev: PanelOrder[]) => PanelOrder[])) => void
  setTables: (v: PanelTable[] | ((prev: PanelTable[]) => PanelTable[])) => void
}) {
  const { token, restaurantId, refreshPosRef, setOrders, setTables } = params
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

    const handleAuthExpired = () => clearToken()

    socket.on("connect", handleConnect)
    socket.io.on("reconnect", handleReconnect)
    socket.on("auth:expired", handleAuthExpired)
    socket.on("order:created", handleOrderCreated)
    socket.on("orders:moved", handleOrdersMoved)
    socket.on("orders:updated", handleOrdersUpdated)
    socket.on("tables:presence", handleTablesPresence)

    return () => {
      socket.off("connect", handleConnect)
      socket.io.off("reconnect", handleReconnect)
      socket.off("auth:expired", handleAuthExpired)
      socket.off("order:created", handleOrderCreated)
      socket.off("orders:moved", handleOrdersMoved)
      socket.off("orders:updated", handleOrdersUpdated)
      socket.off("tables:presence", handleTablesPresence)
      socket.disconnect()
      socketRef.current = null
    }
  }, [token, restaurantId, refreshPosRef, setOrders, setTables])
}

