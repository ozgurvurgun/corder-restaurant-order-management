import { useState } from "react"
import {
  ChevronLeft,
  ShoppingCart,
  ListOrdered,
  Plus,
  Minus,
  Loader2,
} from "lucide-react"
import { useApp } from "@/lib/store"
import { formatCurrency } from "@/lib/format"
import { useToast } from "@/components/ios-toast"

interface CartScreenProps {
  tableId: string
  onBack: () => void
  onOrderSent: () => void
}

export function CartScreen({ tableId, onBack, onOrderSent }: CartScreenProps) {
  const { showToast } = useToast()
  const {
    cart,
    tables,
    updateCartQuantity,
    removeFromCart,
    updateCartNote,
    getCartTotal,
    sendOrder,
    getTableOrders,
  } = useApp()
  const [sending, setSending] = useState(false)
  const [showSentItems, setShowSentItems] = useState(false)
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteValue, setNoteValue] = useState("")

  const table = tables.find((t) => t.id === tableId)
  const isCheckoutLocked = table?.status === "checkout"
  const total = getCartTotal()
  const tableOrders = getTableOrders(tableId)
  const sentItems = tableOrders.flatMap((o) =>
    o.items
      .filter((i) => i.status !== "cancelled")
      .map((i) => ({ ...i, orderId: o.id }))
  )
  const sentTotal = sentItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const grandTotal = total + sentTotal

  const handleSend = async () => {
    if (isCheckoutLocked) {
      showToast("Masa hesap kesiminde. Siparis gonderilemez.", "error")
      return
    }
    if (cart.length === 0) return
    setSending(true)
    const success = await sendOrder(tableId)
    setSending(false)
    if (success) {
      showToast("Siparis mutfaga gonderildi!")
      onOrderSent()
    } else {
      showToast("Siparis gonderilemedi", "error")
    }
  }

  const handleSaveNote = (productId: string) => {
    updateCartNote(productId, noteValue)
    setEditingNote(null)
    setNoteValue("")
  }

  return (
    <div className="h-dvh flex flex-col" style={{ backgroundColor: "#f2f2f7" }}>
      {/* Fixed iOS Navigation Bar */}
      <header
        className="bg-[#e63462] text-white flex items-center justify-between flex-shrink-0 safe-top relative h-[44px]"
      >
        <button
          onClick={onBack}
          className="flex items-center gap-0.5 pl-3 pr-3 h-full active:opacity-60 z-10 touch-manipulation"
          aria-label="Geri"
        >
          <ChevronLeft className="h-[22px] w-[22px]" />
          <span className="text-[17px]">Geri</span>
        </button>
        <h1 className="text-[17px] font-semibold absolute left-1/2 -translate-x-1/2">
          Sepet
        </h1>
        <div className="flex items-center gap-1 pr-3 z-10">
          <button className="p-2 active:opacity-60 text-white" aria-label="Sepet">
            <ShoppingCart className="h-[20px] w-[20px]" />
          </button>
          <button
            onClick={() => setShowSentItems(!showSentItems)}
            className={`p-2 active:opacity-60 ${showSentItems ? "text-white/60" : "text-white"}`}
            aria-label="Gonderilen siparisler"
          >
            <ListOrdered className="h-[20px] w-[20px]" />
          </button>
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto ios-scroll">
        {/* Table Info */}
        <div className="px-4 pt-4 pb-1">
          <h2 className="text-[28px] font-bold tracking-tight" style={{ color: "#1c1c1e" }}>
            {table?.name}
          </h2>
          {isCheckoutLocked && (
            <p className="mt-1 text-[12px] font-medium" style={{ color: "#0a4f99" }}>
              Hesap Kes penceresi acik oldugu icin yeni siparis gonderimi kilitli.
            </p>
          )}
        </div>

        {/* Sent Items */}
        {showSentItems && sentItems.length > 0 && (
          <div className="mt-4 px-4">
            <p
              className="text-[13px] font-normal uppercase tracking-wide mb-1.5 px-4"
              style={{ color: "#8e8e93" }}
            >
              Gonderilen Siparisler
            </p>
            <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff" }}>
              {sentItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center px-4"
                  style={{
                    minHeight: 44,
                    borderBottom:
                      idx < sentItems.length - 1 ? "0.5px solid rgba(60,60,67,0.12)" : "none",
                  }}
                >
                  <div className="flex-1 min-w-0 py-2.5">
                    <p className="text-[17px]" style={{ color: "#1c1c1e" }}>
                      {item.productName}
                    </p>
                    <p className="text-[13px]" style={{ color: "#8e8e93" }}>
                      {item.quantity} Adet
                    </p>
                  </div>
                  <span className="text-[17px] flex-shrink-0" style={{ color: "#e63462" }}>
                    {"₺"}{formatCurrency(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center mt-2 px-4">
              <span className="text-[13px]" style={{ color: "#8e8e93" }}>
                Ara Toplam
              </span>
              <span className="text-[15px] font-semibold" style={{ color: "#1c1c1e" }}>
                {"₺"}{formatCurrency(sentTotal)}
              </span>
            </div>
          </div>
        )}

        {/* Cart Items */}
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div
              className="h-16 w-16 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: "rgba(142,142,147,0.08)" }}
            >
              <ShoppingCart className="h-7 w-7" style={{ color: "#c7c7cc" }} />
            </div>
            <p className="text-[17px] font-semibold" style={{ color: "#1c1c1e" }}>
              Sepet bos
            </p>
            <p className="text-[15px] mt-1" style={{ color: "#8e8e93" }}>
              Menudan urun ekleyin
            </p>
          </div>
        ) : (
          <div className="mt-4 px-4 pb-4">
            <p
              className="text-[13px] font-normal uppercase tracking-wide mb-1.5 px-4"
              style={{ color: "#8e8e93" }}
            >
              Yeni Siparis
            </p>
            <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff" }}>
              {cart.map((item, idx) => (
                <div
                  key={item.productId}
                  style={{
                    borderBottom:
                      idx < cart.length - 1 ? "0.5px solid rgba(60,60,67,0.12)" : "none",
                  }}
                >
                  <div className="flex items-center px-4" style={{ minHeight: 56 }}>
                    <button
                      onClick={() => removeFromCart(item.productId)}
                      className="mr-3 flex-shrink-0 active:opacity-60"
                      aria-label="Kaldir"
                    >
                      <div
                        className="h-[22px] w-[22px] rounded-full flex items-center justify-center"
                        style={{ backgroundColor: "#ff3b30" }}
                      >
                        <Minus className="h-3 w-3 text-white" strokeWidth={3} />
                      </div>
                    </button>

                    <div className="flex-1 min-w-0 py-2">
                      <p className="text-[17px]" style={{ color: "#1c1c1e" }}>
                        {item.productName}
                      </p>
                      {item.note && (
                        <p className="text-[13px]" style={{ color: "#e63462" }}>
                          {item.note}
                        </p>
                      )}
                    </div>

                    <span className="text-[17px] flex-shrink-0 ml-2" style={{ color: "#e63462" }}>
                      {"₺"}{formatCurrency(item.price * item.quantity)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-4 pb-2.5 pl-[52px]">
                    <button
                      onClick={() => {
                        if (editingNote === item.productId) {
                          setEditingNote(null)
                        } else {
                          setEditingNote(item.productId)
                          setNoteValue(item.note || "")
                        }
                      }}
                      className="text-[13px] active:opacity-60"
                      style={{ color: "#007aff" }}
                    >
                      {item.note ? "Notu Duzenle" : "Not Ekle"}
                    </button>

                    <div
                      className="flex items-center rounded-[8px] overflow-hidden"
                      style={{
                        border: "1px solid rgba(60,60,67,0.18)",
                        height: 32,
                      }}
                    >
                      <button
                        onClick={() => updateCartQuantity(item.productId, item.quantity - 1)}
                        className="flex items-center justify-center active:bg-black/5"
                        style={{
                          width: 40,
                          height: "100%",
                          color: item.quantity <= 1 ? "#c7c7cc" : "#007aff",
                          borderRight: "0.5px solid rgba(60,60,67,0.18)",
                        }}
                        disabled={item.quantity <= 1}
                        aria-label="Azalt"
                      >
                        <Minus className="h-[14px] w-[14px]" strokeWidth={2.5} />
                      </button>
                      <span
                        className="flex items-center justify-center text-[15px] font-medium tabular-nums"
                        style={{
                          width: 42,
                          height: "100%",
                          color: "#1c1c1e",
                        }}
                      >
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateCartQuantity(item.productId, item.quantity + 1)}
                        className="flex items-center justify-center active:bg-black/5"
                        style={{
                          width: 40,
                          height: "100%",
                          color: "#007aff",
                          borderLeft: "0.5px solid rgba(60,60,67,0.18)",
                        }}
                        aria-label="Arttir"
                      >
                        <Plus className="h-[14px] w-[14px]" strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>

                  {editingNote === item.productId && (
                    <div className="px-4 pb-3 pl-[52px] flex items-center gap-2">
                      <div
                        className="flex-1 min-w-0 flex items-center rounded-[8px] overflow-hidden"
                        style={{
                          backgroundColor: "rgba(118,118,128,0.12)",
                          height: 36,
                        }}
                      >
                        <input
                          type="text"
                          value={noteValue}
                          onChange={(e) => setNoteValue(e.target.value)}
                          placeholder="Ornegin: acisiz, az piskin..."
                          className="flex-1 min-w-0 bg-transparent px-3 text-[15px] focus:outline-none"
                          style={{ color: "#1c1c1e" }}
                          autoFocus
                          onKeyDown={(e) =>
                            e.key === "Enter" && handleSaveNote(item.productId)
                          }
                        />
                      </div>
                      <button
                        onClick={() => handleSaveNote(item.productId)}
                        className="flex-shrink-0 px-1 text-[15px] font-medium"
                        style={{ color: "#007aff" }}
                      >
                        Tamam
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Toolbar */}
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
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-[13px] uppercase font-medium" style={{ color: "#8e8e93" }}>
              Toplam
            </span>
            <span className="text-[28px] font-bold tabular-nums" style={{ color: "#1c1c1e" }}>
              {"₺"}{formatCurrency(grandTotal)}
            </span>
          </div>

          <button
            onClick={handleSend}
            disabled={cart.length === 0 || sending || isCheckoutLocked}
            className="w-full font-semibold text-[17px] text-white flex items-center justify-center gap-2 active:brightness-90 disabled:opacity-40 transition-opacity mb-3"
            style={{
              backgroundColor: "#34c759",
              height: 50,
              borderRadius: 12,
            }}
          >
            {sending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {"Gonderiliyor..."}
              </>
            ) : (
              "Siparisi Gonder"
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
