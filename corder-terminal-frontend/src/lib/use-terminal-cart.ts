import { useCallback, useEffect, useMemo, useState } from "react"
import type { TerminalOrderItem, TerminalProduct } from "./types"
import { calculateOrderItemsTotal, upsertCartItem } from "./terminal-mappers"
import { CARTS_STORAGE_KEY, loadStoredCarts, saveStoredCarts } from "./use-terminal-lifecycle"

export function useTerminalCart(selectedTableId: string | null) {
  const [cartsByTableId, setCartsByTableId] = useState<
    Record<string, TerminalOrderItem[]>
  >(() => loadStoredCarts())

  useEffect(() => {
    saveStoredCarts(cartsByTableId)
  }, [cartsByTableId])

  const cart = useMemo(
    () => (selectedTableId ? cartsByTableId[selectedTableId] ?? [] : []),
    [cartsByTableId, selectedTableId]
  )

  const updateActiveTableCart = useCallback(
    (
      updater: (prev: TerminalOrderItem[]) => TerminalOrderItem[],
      explicitTableId?: string
    ) => {
      const tid = explicitTableId ?? selectedTableId
      if (!tid) return
      setCartsByTableId((prev) => {
        const current = prev[tid] ?? []
        const next = updater(current)
        if (next.length === 0) {
          const copy = { ...prev }
          delete copy[tid]
          return copy
        }
        return { ...prev, [tid]: next }
      })
    },
    [selectedTableId]
  )

  const addToCart = useCallback(
    (product: TerminalProduct, quantity = 1, note?: string) => {
      updateActiveTableCart((prev) => upsertCartItem(prev, product, quantity, note))
    },
    [updateActiveTableCart]
  )

  const removeFromCart = useCallback(
    (id: string) => {
      updateActiveTableCart((prev) =>
        prev.filter((i) => i.id !== id && i.product.id !== id)
      )
    },
    [updateActiveTableCart]
  )

  const updateCartQuantity = useCallback(
    (id: string, quantity: number) => {
      updateActiveTableCart((prev) =>
        quantity <= 0
          ? prev.filter((i) => i.id !== id && i.product.id !== id)
          : prev.map((i) =>
              i.id === id || i.product.id === id ? { ...i, quantity } : i
            )
      )
    },
    [updateActiveTableCart]
  )

  const updateCartNote = useCallback(
    (id: string, note: string) => {
      const cleaned = note.trim()
      updateActiveTableCart((prev) =>
        prev.map((i) =>
          i.id === id || i.product.id === id
            ? { ...i, note: cleaned || undefined }
            : i
        )
      )
    },
    [updateActiveTableCart]
  )

  const splitCartItem = useCallback(
    (itemId: string): string | null => {
      let createdId: string | null = null
      updateActiveTableCart((prev) => {
        const idx = prev.findIndex((i) => i.id === itemId)
        if (idx === -1 || prev[idx].quantity <= 1) return prev
        const target = prev[idx]
        const newId = `cart-${target.product.id}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 6)}`
        createdId = newId
        const next = [...prev]
        next[idx] = { ...target, quantity: target.quantity - 1 }
        next.splice(idx + 1, 0, {
          id: newId,
          product: target.product,
          quantity: 1,
          note: undefined,
          status: "pending",
        })
        return next
      })
      return createdId
    },
    [updateActiveTableCart]
  )

  const clearCart = useCallback(
    (explicitTableId?: string) => {
      updateActiveTableCart(() => [], explicitTableId)
    },
    [updateActiveTableCart]
  )

  const resetAllCarts = useCallback(() => {
    setCartsByTableId({})
    sessionStorage.removeItem(CARTS_STORAGE_KEY)
  }, [])

  const getCartTotal = useCallback(() => calculateOrderItemsTotal(cart), [cart])
  const getCartItemCount = useCallback(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  )

  return {
    cart,
    cartsByTableId,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    updateCartNote,
    splitCartItem,
    clearCart,
    resetAllCarts,
    getCartTotal,
    getCartItemCount,
  }
}

