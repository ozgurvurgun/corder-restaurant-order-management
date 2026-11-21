import { useEffect } from "react"
import type { PanelPaymentMethod } from "../panel-types"
import { isEditableElement } from "./shortcut-catalog.policy"

const SELECT_TABLE_EVENT = "corder:shortcut-select-table"

export interface SelectTableShortcutDetail {
  tableId: string
}

export function emitSelectTableCommand(tableId: string): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<SelectTableShortcutDetail>(SELECT_TABLE_EVENT, {
      detail: { tableId },
    }),
  )
}

export function useSelectTableCommandListener(
  onSelectTable: (tableId: string) => void,
): void {
  useEffect(() => {
    const handler = (ev: Event) => {
      const custom = ev as CustomEvent<SelectTableShortcutDetail>
      if (custom.detail?.tableId) {
        onSelectTable(custom.detail.tableId)
      }
    }
    window.addEventListener(SELECT_TABLE_EVENT, handler)
    return () => window.removeEventListener(SELECT_TABLE_EVENT, handler)
  }, [onSelectTable])
}

export interface TableDetailShortcutHandlers {
  disabled: boolean
  onAddOrder: () => void
  onCheckout: () => void
  onSplitBill: () => void
  onDiscount: () => void
  onPrintTable: () => void
  onMoveTable: () => void
  onClosePanel: () => void
}

export function useTableDetailShortcuts(
  handlers: TableDetailShortcutHandlers,
): void {
  const {
    disabled,
    onAddOrder,
    onCheckout,
    onSplitBill,
    onDiscount,
    onPrintTable,
    onMoveTable,
    onClosePanel,
  } = handlers

  useEffect(() => {
    if (disabled) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (isEditableElement(e.target)) return

      const key = e.key.toLowerCase()
      if (e.key === "Escape") {
        e.preventDefault()
        onClosePanel()
        return
      }
      if (key === "n") {
        e.preventDefault()
        onAddOrder()
      } else if (key === "h") {
        e.preventDefault()
        onCheckout()
      } else if (key === "b") {
        e.preventDefault()
        onSplitBill()
      } else if (key === "i" || key === "ı") {
        e.preventDefault()
        onDiscount()
      } else if (key === "p") {
        e.preventDefault()
        onPrintTable()
      } else if (key === "t") {
        e.preventDefault()
        onMoveTable()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [
    disabled,
    onAddOrder,
    onCheckout,
    onSplitBill,
    onDiscount,
    onPrintTable,
    onMoveTable,
    onClosePanel,
  ])
}

const FKEY_TO_METHOD: Record<string, PanelPaymentMethod> = {
  F1: "cash",
  F2: "credit-card",
  F3: "meal-card",
  F4: "multinet",
  F5: "split",
  F6: "ledger",
}

export const PAYMENT_METHOD_SHORTCUT_KEYS: Record<PanelPaymentMethod, string> = {
  cash: "F1",
  "credit-card": "F2",
  "meal-card": "F3",
  multinet: "F4",
  split: "F5",
  ledger: "F6",
}

export function usePaymentModalShortcuts(params: {
  disabled: boolean
  allowedMethods: PanelPaymentMethod[]
  onSelectMethod: (method: PanelPaymentMethod) => void
  onFillExactCash?: () => void
  onConfirm: () => void
}): void {
  const {
    disabled,
    allowedMethods,
    onSelectMethod,
    onFillExactCash,
    onConfirm,
  } = params

  useEffect(() => {
    if (disabled) return
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault()
        onConfirm()
        return
      }
      const mapped = FKEY_TO_METHOD[e.key]
      if (mapped && allowedMethods.includes(mapped)) {
        e.preventDefault()
        onSelectMethod(mapped)
        if (mapped === "cash") {
          onFillExactCash?.()
        }
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [disabled, allowedMethods, onSelectMethod, onFillExactCash, onConfirm])
}
