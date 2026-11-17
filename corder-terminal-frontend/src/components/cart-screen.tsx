import { useState } from "react"
import { ChevronLeft, ShoppingCart, ListOrdered, Plus, Minus, Loader2, Trash2 } from "lucide-react"
import { useApp } from "@/lib/store"
import { formatCurrency, fromMinorUnits, toMinorUnits } from "@/lib/format"
import { isItemOnActiveBill } from "@/lib/terminal-mappers"
import { useToast } from "@/components/ios-toast"
import { ConfirmDialog } from "./confirm-dialog"
import type { TerminalOrderItem } from "@/lib/types"

interface CartScreenProps {
  tableId: string
  onBack: () => void
  onOrderSent: () => void
}

export function CartScreen({ tableId, onBack, onOrderSent }: CartScreenProps) {
  const { showToast } = useToast()
  const {
    cart, tables, isOffline, error, updateCartQuantity, removeFromCart, updateCartNote,
    splitCartItem, clearCart, getCartTotal, submitOrder, getTableOrders, hasPermission,
  } = useApp()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSentItems, setShowSentItems] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteValue, setNoteValue] = useState("")
  const [confirmClearCart, setConfirmClearCart] = useState(false)

  const table = tables.find((t) => t.id === tableId)
  const isBillRequested = table?.status === "bill-requested"
  const canCreateOrder = hasPermission("order.create")
  const canAddNote = hasPermission("order.add_note")
  const cartTotal = getCartTotal()
  const tableOrders = getTableOrders(tableId)
  const sentItems = tableOrders.flatMap((o) => o.items.filter((i) => isItemOnActiveBill(i.status)))
  const sentTotal = fromMinorUnits(
    sentItems.reduce((sum, item) => sum + toMinorUnits(item.product.price) * item.quantity, 0)
  )
  const grandTotal = fromMinorUnits(toMinorUnits(cartTotal) + toMinorUnits(sentTotal))

  const handleSaveNote = (itemId: string) => {
    updateCartNote(itemId, noteValue)
    setEditingNoteId(null)
    setNoteValue("")
  }

  const handleSend = async () => {
    if (isSubmitting || cart.length === 0) return
    if (!canCreateOrder) {
      showToast("Sipariş oluşturma yetkiniz bulunmuyor.", "error")
      return
    }
    if (isOffline) {
      showToast("İnternet bağlantısı yok. Bağlantı sağlandığında gönderin.", "error")
      return
    }
    if (isBillRequested) {
      showToast("Masa hesap kesiminde. Sipariş gönderilemez.", "error")
      return
    }
    let noteOverrides: Record<string, string> | undefined
    if (editingNoteId) {
      updateCartNote(editingNoteId, noteValue)
      noteOverrides = { [editingNoteId]: noteValue }
      setEditingNoteId(null)
      setNoteValue("")
    }
    setIsSubmitting(true)
    try {
      const success = await submitOrder(tableId, noteOverrides)
      if (success) {
        showToast("Sipariş mutfağa gönderildi!")
        onOrderSent()
      } else {
        showToast("Sipariş gönderilemedi. Lütfen uyarıyı kontrol edin.", "error")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="h-dvh flex flex-col" style={{ backgroundColor: "#f2f2f7" }}>
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
        <h1 className="text-[17px] font-semibold absolute left-1/2 -translate-x-1/2">Sepet</h1>
        <div className="flex items-center gap-1 pr-3 z-10">
          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmClearCart(true)}
              className="p-2 active:opacity-60 text-white"
              aria-label="Sepeti Temizle"
            >
              <Trash2 className="h-[19px] w-[19px]" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowSentItems(!showSentItems)}
            className={`p-2 active:opacity-60 ${showSentItems ? "text-white/60" : "text-white"}`}
            aria-label="Gönderilen siparişler"
          >
            <ListOrdered className="h-[20px] w-[20px]" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto ios-scroll">
        <div className="px-4 pt-4 pb-1">
          <h2 className="text-[28px] font-bold tracking-tight" style={{ color: "#1c1c1e" }}>
            {table?.name}
          </h2>
          {isBillRequested && (
            <p className="mt-1 text-[12px] font-medium" style={{ color: "#0a4f99" }}>
              Hesap Kes penceresi açık olduğu için yeni sipariş gönderimi kilitli.
            </p>
          )}
          {error && (
            <div className="mt-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-[13px] text-red-700 font-medium">
              {error}
            </div>
          )}
        </div>

        {showSentItems && sentItems.length > 0 && (
          <SentItemsSection sentItems={sentItems} sentTotal={sentTotal} />
        )}

        {cart.length === 0 ? (
          <EmptyCartState />
        ) : (
          <div className="mt-4 px-4 pb-4">
            <p className="text-[13px] font-normal uppercase tracking-wide mb-1.5 px-4" style={{ color: "#8e8e93" }}>
              Yeni Sipariş
            </p>
            <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff" }}>
              {cart.map((item, idx) => (
                <CartItemRow
                  key={item.id}
                  item={item}
                  hasBottomBorder={idx < cart.length - 1}
                  canAddNote={canAddNote}
                  isEditingNote={editingNoteId === item.id}
                  noteValue={noteValue}
                  onNoteValueChange={setNoteValue}
                  onToggleEditNote={() => {
                    if (!canAddNote) {
                      showToast("Sipariş notu ekleme yetkiniz bulunmuyor", "error")
                      return
                    }
                    if (editingNoteId === item.id) {
                      handleSaveNote(item.id)
                    } else {
                      if (editingNoteId) {
                        updateCartNote(editingNoteId, noteValue)
                      }
                      setEditingNoteId(item.id)
                      setNoteValue(item.note || "")
                    }
                  }}
                  onSaveNote={() => handleSaveNote(item.id)}
                  onSplitForNote={() => {
                    if (!canAddNote) {
                      showToast("Sipariş notu ekleme yetkiniz bulunmuyor", "error")
                      return
                    }
                    if (editingNoteId) {
                      updateCartNote(editingNoteId, noteValue)
                    }
                    const newId = splitCartItem(item.id)
                    if (newId) {
                      setEditingNoteId(newId)
                      setNoteValue("")
                    }
                  }}
                  onRemove={() => removeFromCart(item.id)}
                  onUpdateQuantity={(qty) => updateCartQuantity(item.id, qty)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div
        className="flex-shrink-0 safe-bottom"
        style={{
          backgroundColor: "rgba(249,249,249,0.94)",
          backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
          borderTop: "0.5px solid rgba(60,60,67,0.12)",
        }}
      >
        <div className="px-4 pt-3">
          {sentTotal > 0 && cartTotal > 0 && (
            <div className="flex items-center justify-between text-[13px] mb-1" style={{ color: "#8e8e93" }}>
              <span>Yeni Sipariş Tutarı</span>
              <span className="font-semibold" style={{ color: "#1c1c1e" }}>
                {"₺"}{formatCurrency(cartTotal)}
              </span>
            </div>
          )}
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-[13px] uppercase font-medium" style={{ color: "#8e8e93" }}>Toplam</span>
            <span className="text-[28px] font-bold tabular-nums" style={{ color: "#1c1c1e" }}>
              {"₺"}{formatCurrency(grandTotal)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={cart.length === 0 || isSubmitting || isBillRequested || !canCreateOrder || isOffline}
            className="w-full font-semibold text-[17px] text-white flex items-center justify-center gap-2 active:brightness-90 disabled:opacity-40 transition-opacity mb-3"
            style={{ backgroundColor: "#34c759", height: 50, borderRadius: 12 }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Gönderiliyor...
              </>
            ) : isOffline ? (
              "Bağlantı Bekleniyor..."
            ) : (
              "Siparişi Gönder"
            )}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClearCart}
        title="Sepeti Temizle"
        message="Sepetteki tüm ürünleri silmek istediğinize emin misiniz?"
        confirmText="Sepeti Temizle"
        cancelText="Vazgeç"
        destructive
        onConfirm={() => {
          clearCart(tableId)
          setConfirmClearCart(false)
          showToast("Sepet temizlendi")
        }}
        onCancel={() => setConfirmClearCart(false)}
      />
    </div>
  )
}

function SentItemsSection({ sentItems, sentTotal }: { sentItems: TerminalOrderItem[]; sentTotal: number }) {
  return (
    <div className="mt-4 px-4">
      <p className="text-[13px] font-normal uppercase tracking-wide mb-1.5 px-4" style={{ color: "#8e8e93" }}>
        Gönderilen Siparişler
      </p>
      <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff" }}>
        {sentItems.map((item, idx) => (
          <div
            key={item.id}
            className="flex items-center px-4"
            style={{
              minHeight: 44,
              borderBottom: idx < sentItems.length - 1 ? "0.5px solid rgba(60,60,67,0.12)" : "none",
            }}
          >
            <div className="flex-1 min-w-0 py-2.5">
              <p className="text-[17px]" style={{ color: "#1c1c1e" }}>{item.product.name}</p>
              <p className="text-[13px]" style={{ color: "#8e8e93" }}>{item.quantity} Adet</p>
            </div>
            <span className="text-[17px] flex-shrink-0" style={{ color: "#e63462" }}>
              {"₺"}{formatCurrency(fromMinorUnits(toMinorUnits(item.product.price) * item.quantity))}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center mt-2 px-4">
        <span className="text-[13px]" style={{ color: "#8e8e93" }}>Ara Toplam</span>
        <span className="text-[15px] font-semibold" style={{ color: "#1c1c1e" }}>
          {"₺"}{formatCurrency(sentTotal)}
        </span>
      </div>
    </div>
  )
}

function EmptyCartState() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div
        className="h-16 w-16 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: "rgba(142,142,147,0.08)" }}
      >
        <ShoppingCart className="h-7 w-7" style={{ color: "#c7c7cc" }} />
      </div>
      <p className="text-[17px] font-semibold" style={{ color: "#1c1c1e" }}>Sepet boş</p>
      <p className="text-[15px] mt-1" style={{ color: "#8e8e93" }}>Menüden ürün ekleyin</p>
    </div>
  )
}

function CartItemRow({
  item, hasBottomBorder, canAddNote, isEditingNote, noteValue, onNoteValueChange,
  onToggleEditNote, onSaveNote, onSplitForNote, onRemove, onUpdateQuantity,
}: {
  item: TerminalOrderItem
  hasBottomBorder: boolean
  canAddNote: boolean
  isEditingNote: boolean
  noteValue: string
  onNoteValueChange: (val: string) => void
  onToggleEditNote: () => void
  onSaveNote: () => void
  onSplitForNote: () => void
  onRemove: () => void
  onUpdateQuantity: (quantity: number) => void
}) {
  const lineTotal = fromMinorUnits(toMinorUnits(item.product.price) * item.quantity)
  return (
    <div style={{ borderBottom: hasBottomBorder ? "0.5px solid rgba(60,60,67,0.12)" : "none" }}>
      <div className="flex items-center px-4" style={{ minHeight: 56 }}>
        <button
          type="button"
          onClick={onRemove}
          className="mr-3 p-1 -ml-1 flex-shrink-0 active:opacity-60"
          aria-label="Kaldır"
        >
          <div
            className="h-[24px] w-[24px] rounded-full flex items-center justify-center"
            style={{ backgroundColor: "#ff3b30" }}
          >
            <Minus className="h-3.5 w-3.5 text-white" strokeWidth={3} />
          </div>
        </button>
        <div className="flex-1 min-w-0 py-2">
          <p className="text-[17px]" style={{ color: "#1c1c1e" }}>{item.product.name}</p>
          {item.note && <p className="text-[13px]" style={{ color: "#e63462" }}>{item.note}</p>}
        </div>
        <span className="text-[17px] flex-shrink-0 ml-2" style={{ color: "#e63462" }}>
          {"₺"}{formatCurrency(lineTotal)}
        </span>
      </div>

      <div className="flex items-center justify-between px-4 pb-2.5 pl-[52px]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleEditNote}
            className={`text-[13px] py-1 active:opacity-60 ${canAddNote ? "" : "opacity-50"}`}
            style={{ color: "#007aff" }}
          >
            {item.note ? "Notu Düzenle" : "Not Ekle"}
          </button>
          {item.quantity > 1 && canAddNote && (
            <button
              type="button"
              onClick={onSplitForNote}
              className="text-[12px] py-1 active:opacity-60 font-medium"
              style={{ color: "#e63462" }}
            >
              Ayrı Not İçin Ayır
            </button>
          )}
        </div>
        <div
          className="flex items-center rounded-[8px] overflow-hidden"
          style={{ border: "1px solid rgba(60,60,67,0.18)", height: 34 }}
        >
          <button
            type="button"
            onClick={() => onUpdateQuantity(item.quantity - 1)}
            className="flex items-center justify-center active:bg-black/5"
            style={{
              width: 42, height: "100%",
              color: "#007aff",
              borderRight: "0.5px solid rgba(60,60,67,0.18)",
            }}
            aria-label="Azalt"
          >
            <Minus className="h-[14px] w-[14px]" strokeWidth={2.5} />
          </button>
          <span
            className="flex items-center justify-center text-[15px] font-medium tabular-nums"
            style={{ width: 42, height: "100%", color: "#1c1c1e" }}
          >
            {item.quantity}
          </span>
          <button
            type="button"
            onClick={() => onUpdateQuantity(item.quantity + 1)}
            className="flex items-center justify-center active:bg-black/5"
            style={{ width: 42, height: "100%", color: "#007aff", borderLeft: "0.5px solid rgba(60,60,67,0.18)" }}
            aria-label="Arttır"
          >
            <Plus className="h-[14px] w-[14px]" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {isEditingNote && (
        <div className="px-4 pb-3 pl-[52px] flex items-center gap-2">
          <div
            className="flex-1 min-w-0 flex items-center rounded-[8px] overflow-hidden"
            style={{ backgroundColor: "rgba(118,118,128,0.12)", height: 36 }}
          >
            <input
              type="text"
              value={noteValue}
              maxLength={500}
              onChange={(e) => onNoteValueChange(e.target.value)}
              placeholder="Örneğin: acısız, az pişmiş..."
              className="flex-1 min-w-0 bg-transparent px-3 text-[15px] focus:outline-none"
              style={{ color: "#1c1c1e" }}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && onSaveNote()}
            />
          </div>
          <button
            type="button"
            onClick={onSaveNote}
            className="flex-shrink-0 px-2 py-1 text-[15px] font-medium"
            style={{ color: "#007aff" }}
          >
            Tamam
          </button>
        </div>
      )}
    </div>
  )
}
