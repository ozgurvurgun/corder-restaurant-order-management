import { useState, useRef, useEffect } from "react"
import {
  ChevronLeft,
  ShoppingCart,
  ListOrdered,
  User,
  Clock,
  ArrowRightLeft,
  CornerUpRight,
  Trash2,
  Printer,
  X,
  Minus,
  Plus,
} from "lucide-react"
import { useApp } from "@/lib/store"
import { formatCurrency, fromMinorUnits, toMinorUnits, translateApiError } from "@/lib/format"
import { isItemOnActiveBill } from "@/lib/terminal-mappers"
import { useToast } from "@/components/ios-toast"
import type { TerminalOrderItem } from "@/lib/types"

const CANCEL_REASONS = [
  "Müşteri vazgeçti",
  "Yanlış sipariş girildi",
  "Ürün mutfakta kalmadı",
  "Gecikme / Kalite sorunu",
]

interface OpenOrdersScreenProps {
  tableId: string
  onBack: () => void
  onCartOpen: () => void
  onNewOrder: () => void
  onMoveItem?: (itemId: string, productName: string, maxQuantity: number) => void
}

function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function OpenOrdersScreen({
  tableId,
  onBack,
  onCartOpen,
  onNewOrder,
  onMoveItem,
}: OpenOrdersScreenProps) {
  const {
    tables,
    error,
    getTableOrders,
    getTableTotal,
    printReceipt,
    hasPermission,
    cancelOrderItemOnServer,
  } = useApp()
  const { showToast } = useToast()
  const table = tables.find((t) => t.id === tableId)
  const tableOrders = getTableOrders(tableId)
  const [activeTab, setActiveTab] = useState(0)
  const [cancelTarget, setCancelTarget] = useState<{
    orderId: string
    itemId: string
    productName: string
    maxQuantity: number
  } | null>(null)
  const [cancelQuantity, setCancelQuantity] = useState(1)
  const [cancelReason, setCancelReason] = useState(CANCEL_REASONS[0])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPrintingOrder, setIsPrintingOrder] = useState(false)

  const tabsRef = useRef<HTMLDivElement>(null)
  const activeTabRef = useRef<HTMLButtonElement>(null)

  const canMoveItems = hasPermission("order.move_items")
  const canCancelItem = hasPermission("order.cancel_item")
  const canCreateOrder = hasPermission("order.create")
  const canPrintReceipt = hasPermission("order.print_receipt")

  useEffect(() => {
    if (activeTabRef.current && tabsRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      })
    }
  }, [activeTab])

  useEffect(() => {
    if (!cancelTarget) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) setCancelTarget(null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [cancelTarget, isSubmitting])

  if (!table) return null
  const isBillRequested = table.status === "bill-requested"

  const safeTab = Math.min(activeTab, Math.max(tableOrders.length - 1, 0))
  const activeOrder = tableOrders[safeTab]
  const netTableTotal = getTableTotal(tableId)
  const visibleItems = (activeOrder?.items ?? []).filter((item) => isItemOnActiveBill(item.status))

  const handlePrintActiveCheck = async () => {
    if (!activeOrder || isPrintingOrder || !canPrintReceipt) return
    setIsPrintingOrder(true)
    try {
      await printReceipt(tableId, activeOrder.id)
      showToast("Adisyon yazıcıya gönderildi")
    } catch (e) {
      showToast(translateApiError(e, "Yazdırılamadı"), "error")
    } finally {
      setIsPrintingOrder(false)
    }
  }

  const handleConfirmCancelItem = async () => {
    if (isSubmitting || !cancelTarget || !cancelReason.trim()) return
    if (!canCancelItem) {
      showToast("Ürün iptal etme yetkiniz bulunmuyor", "error")
      return
    }
    const qty = Math.min(Math.max(1, cancelQuantity), cancelTarget.maxQuantity)
    setIsSubmitting(true)
    try {
      const ok = await cancelOrderItemOnServer(
        cancelTarget.orderId,
        cancelTarget.itemId,
        cancelReason,
        qty
      )
      if (ok) {
        showToast(
          qty < cancelTarget.maxQuantity
            ? `${cancelTarget.productName} - ${qty} adet iptal edildi`
            : `${cancelTarget.productName} iptal edildi`
        )
        setCancelTarget(null)
      } else {
        showToast("Ürün iptal edilemedi (açık kasa vardiyasını veya yetkinizi kontrol edin)", "error")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="h-dvh flex flex-col bg-background">
      {/* Fixed iOS Navigation Bar */}
      <header className="bg-[#e63462] text-white flex items-center justify-between flex-shrink-0 safe-top relative h-[44px]">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-0.5 pl-3 pr-3 h-full active:opacity-60 z-10 touch-manipulation"
          aria-label="Geri"
        >
          <ChevronLeft className="h-[22px] w-[22px]" />
          <span className="text-[17px]">Geri</span>
        </button>
        <h1 className="text-[17px] font-semibold absolute left-1/2 -translate-x-1/2">Adisyonlar</h1>
        <div className="flex items-center gap-1 pr-3 z-10">
          <button type="button" onClick={onCartOpen} className="p-2 active:opacity-60" aria-label="Sepet">
            <ShoppingCart className="h-[20px] w-[20px]" />
          </button>
          <button
            type="button"
            onClick={onNewOrder}
            disabled={isBillRequested || !canCreateOrder}
            className="p-2 active:opacity-60 disabled:opacity-40"
            aria-label="Yeni Sipariş"
          >
            <ListOrdered className="h-[20px] w-[20px]" />
          </button>
        </div>
      </header>

      {/* Fixed Table Info */}
      <div className="flex items-center justify-between px-5 pt-5 pb-2 flex-shrink-0 bg-background">
        <h2 className="text-[22px] font-bold text-foreground">
          {table.name.replace(" ", " - ")}
        </h2>
        {activeOrder && canPrintReceipt && (
          <button
            type="button"
            disabled={isPrintingOrder}
            onClick={() => void handlePrintActiveCheck()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-muted px-3 py-1.5 text-[12px] font-semibold text-foreground active:opacity-70 disabled:opacity-50"
          >
            <Printer className="h-3.5 w-3.5 text-[#e63462]" />
            {isPrintingOrder ? "Yazdırılıyor..." : `Adisyon #${safeTab + 1} Yazdır`}
          </button>
        )}
      </div>

      {error && (
        <div className="mx-5 mb-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700 font-medium">
          {error}
        </div>
      )}

      {/* Horizontally Scrollable Check Tabs */}
      {tableOrders.length > 0 ? (
        <>
          <div className="flex-shrink-0 bg-background px-5 pb-2">
            <div
              ref={tabsRef}
              className="flex gap-2 overflow-x-auto ios-scroll pb-1"
              style={{ scrollbarWidth: "none" }}
            >
              {tableOrders.map((order, idx) => (
                <button
                  type="button"
                  key={order.id}
                  ref={idx === safeTab ? activeTabRef : undefined}
                  onClick={() => setActiveTab(idx)}
                  className={`flex-shrink-0 min-w-[44px] h-[36px] px-4 rounded-full text-[14px] font-semibold transition-all ${
                    safeTab === idx
                      ? "bg-[#e63462] text-white shadow-sm"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Active Order Waiter & Time Info */}
          {activeOrder && (
            <div className="flex-shrink-0 bg-background px-5 pb-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  <span className="text-[13px] font-medium capitalize">
                    {activeOrder.waiterName?.trim() || "-"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-[13px] font-medium">
                    {formatTime(activeOrder.createdAt)}
                  </span>
                </div>
              </div>
              {activeOrder.mergedFrom && (
                <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                  <ArrowRightLeft className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                  <span className="text-[12px] font-medium text-amber-700">
                    {activeOrder.mergedFrom} masasından
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Scrollable Order Items */}
          <div className="flex-1 px-5 py-2 ios-scroll overflow-auto">
            {visibleItems.map((item, idx) => (
              <OrderItemRow
                key={item.id}
                item={item}
                hasBottomBorder={idx < visibleItems.length - 1}
                canMove={!isBillRequested && canMoveItems && Boolean(onMoveItem)}
                onMove={
                  onMoveItem && canMoveItems
                    ? () => onMoveItem(item.id, item.product.name, item.quantity)
                    : undefined
                }
                canCancel={!isBillRequested && canCancelItem && Boolean(activeOrder)}
                onCancel={
                  activeOrder && canCancelItem
                    ? () => {
                        setCancelQuantity(item.quantity)
                        setCancelTarget({
                          orderId: activeOrder.id,
                          itemId: item.id,
                          productName: item.product.name,
                          maxQuantity: item.quantity,
                        })
                      }
                    : undefined
                }
              />
            ))}
          </div>

          {/* Fixed Total Footer */}
          <div
            className="flex-shrink-0 px-5 py-4 safe-bottom"
            style={{
              backgroundColor: "rgba(249,249,249,0.94)",
              backdropFilter: "saturate(180%) blur(20px)",
              WebkitBackdropFilter: "saturate(180%) blur(20px)",
              borderTop: "0.5px solid rgba(60,60,67,0.12)",
            }}
          >
            <div className="flex items-center justify-between">
              {tableOrders.length > 1 && activeOrder ? (
                <div className="text-left">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase">
                    Adisyon #{safeTab + 1}
                  </p>
                  <p className="text-[16px] font-bold text-foreground tabular-nums">
                    {"₺"}{formatCurrency(activeOrder.totalAmount)}
                  </p>
                </div>
              ) : <div />}
              <div className="text-right">
                <p className="text-[12px] font-bold text-[#e63462] uppercase tracking-wider">
                  MASA TOPLAMI
                </p>
                <p className="text-[22px] font-bold text-foreground tabular-nums">
                  {"₺"}{formatCurrency(netTableTotal)}
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center px-5">
          <p className="text-[15px] text-muted-foreground text-center">
            Bu masada aktif adisyon bulunmuyor.
          </p>
        </div>
      )}

      {/* Cancel Order Item Modal */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 safe-bottom shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-[16px] font-bold text-foreground">
                Ürün İptali - {cancelTarget.productName}
              </h3>
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                aria-label="Kapat"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-muted"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            {cancelTarget.maxQuantity > 1 && (
              <div className="mt-3">
                <p className="text-[12px] font-semibold uppercase text-muted-foreground">
                  İptal Adedi
                </p>
                <div className="mt-2 flex items-center justify-between rounded-xl border border-border px-3 py-2">
                  <button
                    type="button"
                    disabled={isSubmitting || cancelQuantity <= 1}
                    onClick={() => setCancelQuantity((q) => Math.max(1, q - 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-muted disabled:opacity-40"
                    aria-label="Azalt"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <div className="text-center">
                    <p className="text-[22px] font-bold tabular-nums text-foreground">{cancelQuantity}</p>
                    <p className="text-[11px] text-muted-foreground">/ {cancelTarget.maxQuantity} adet</p>
                  </div>
                  <button
                    type="button"
                    disabled={isSubmitting || cancelQuantity >= cancelTarget.maxQuantity}
                    onClick={() =>
                      setCancelQuantity((q) => Math.min(cancelTarget.maxQuantity, q + 1))
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-muted disabled:opacity-40"
                    aria-label="Artır"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
            <p className="mt-3 text-[12px] font-semibold uppercase text-muted-foreground">
              İptal Sebebi Seçin
            </p>
            <div className="mt-2 space-y-2">
              {CANCEL_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setCancelReason(r)}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-left text-[14px] font-medium transition-colors ${
                    cancelReason === r
                      ? "border-[#e63462] bg-[#e63462]/10 text-[#e63462]"
                      : "border-border text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="flex-1 rounded-xl border border-border py-3 text-[14px] font-semibold text-muted-foreground"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleConfirmCancelItem()}
                className="flex-1 rounded-xl bg-red-600 py-3 text-[14px] font-bold text-white disabled:opacity-50"
              >
                {isSubmitting
                  ? "İptal Ediliyor…"
                  : cancelTarget.maxQuantity > 1
                    ? `${cancelQuantity} Adet İptal Et`
                    : "Ürünü İptal Et"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function OrderItemRow({
  item,
  hasBottomBorder,
  canMove,
  onMove,
  canCancel,
  onCancel,
}: {
  item: TerminalOrderItem
  hasBottomBorder: boolean
  canMove: boolean
  onMove?: () => void
  canCancel?: boolean
  onCancel?: () => void
}) {
  const lineTotal = fromMinorUnits(toMinorUnits(item.product.price) * item.quantity)
  return (
    <div className={`py-3.5 ${hasBottomBorder ? "border-b border-border" : ""}`}>
      <div className="flex items-start justify-between">
        <span className="text-[15px] font-medium text-foreground">
          {item.product.name}
        </span>
        <span className="text-[15px] font-medium text-[#e63462] flex-shrink-0 ml-3">
          {"₺"}{formatCurrency(lineTotal)}
        </span>
      </div>
      {item.note && (
        <p className="text-[13px] text-muted-foreground mt-0.5 italic">
          {"* "}{item.note}
        </p>
      )}
      <div className="text-right mt-0.5">
        <span className="text-[14px] font-semibold text-foreground">
          {item.quantity} Adet
        </span>
      </div>
      {(canMove || canCancel) && (
        <div className="mt-2 flex items-center gap-4">
          {canMove && onMove && (
            <button
              type="button"
              onClick={onMove}
              className="text-[13px] font-medium text-[#007aff] inline-flex items-center gap-1 py-1 active:opacity-70"
            >
              <CornerUpRight className="h-3.5 w-3.5" />
              Başka masaya taşı
            </button>
          )}
          {canCancel && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-[13px] font-medium text-red-600 inline-flex items-center gap-1 py-1 active:opacity-70"
            >
              <Trash2 className="h-3.5 w-3.5" />
              İptal Et
            </button>
          )}
        </div>
      )}
    </div>
  )
}
