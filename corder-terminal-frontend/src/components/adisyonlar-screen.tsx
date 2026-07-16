import { useState, useRef, useEffect } from "react"
import { ChevronLeft, ShoppingCart, ListOrdered, User, Clock, ArrowRightLeft, CornerUpRight } from "lucide-react"
import { useApp } from "@/lib/store"
import { formatCurrency } from "@/lib/services"
interface AdisyonlarScreenProps {
  tableId: string
  onBack: () => void
  onCartOpen: () => void
  onNewOrder: () => void
  onMoveItem?: (itemId: string, productName: string) => void
}

function getUserName(users: { id: string; name: string }[], userId: string): string {
  const user = users.find((u) => u.id === userId)
  return user ? user.name : "—"
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function AdisyonlarScreen({
  tableId,
  onBack,
  onCartOpen,
  onNewOrder,
  onMoveItem,
}: AdisyonlarScreenProps) {
  const { tables, users, getTableOrders } = useApp()
  const table = tables.find((t) => t.id === tableId)
  const tableOrders = getTableOrders(tableId)
  const [activeTab, setActiveTab] = useState(0)
  const tabsRef = useRef<HTMLDivElement>(null)
  const activeTabRef = useRef<HTMLButtonElement>(null)

  if (!table) return null
  const isCheckoutLocked = table.status === "checkout"

  // Safety: clamp activeTab to valid range
  const safeTab = Math.min(activeTab, Math.max(tableOrders.length - 1, 0))
  const activeOrder = tableOrders[safeTab]

  const allOrdersTotal = tableOrders.reduce(
    (sum, order) =>
      sum +
      order.items
        .filter((i) => i.status !== "cancelled")
        .reduce((s, i) => s + i.price * i.quantity, 0),
    0
  )

  // Scroll active tab into view
  useEffect(() => {
    if (activeTabRef.current && tabsRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      })
    }
  }, [activeTab])

  return (
    <div className="h-dvh flex flex-col bg-background">
      {/* Fixed iOS Navigation Bar */}
      <header className="bg-[#e63462] text-white flex items-center justify-between flex-shrink-0 safe-top relative h-[44px]">
        <button onClick={onBack} className="flex items-center gap-0.5 pl-3 pr-3 h-full active:opacity-60 z-10 touch-manipulation" aria-label="Geri">
          <ChevronLeft className="h-[22px] w-[22px]" />
          <span className="text-[17px]">Geri</span>
        </button>
        <h1 className="text-[17px] font-semibold absolute left-1/2 -translate-x-1/2">Adisyonlar</h1>
        <div className="flex items-center gap-1 pr-3 z-10">
          <button onClick={onCartOpen} className="p-2 active:opacity-60" aria-label="Sepet">
            <ShoppingCart className="h-[20px] w-[20px]" />
          </button>
          <button
            onClick={onNewOrder}
            disabled={isCheckoutLocked}
            className="p-2 active:opacity-60 disabled:opacity-40"
            aria-label="Yeni Siparis"
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
      </div>

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
                  key={order.id}
                  ref={idx === activeTab ? activeTabRef : undefined}
                  onClick={() => setActiveTab(idx)}
                  className={`flex-shrink-0 min-w-[44px] h-[36px] px-4 rounded-full text-[14px] font-semibold transition-all ${
                    activeTab === idx
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
                    {activeOrder.userName?.trim() || getUserName(users, activeOrder.userId)}
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
                    {activeOrder.mergedFrom} masasindan
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Scrollable Order Items */}
          <div className="flex-1 px-5 py-2 ios-scroll overflow-auto">
            {activeOrder?.items
              .filter((item) => item.status !== "cancelled")
              .map((item, idx, arr) => (
                <div key={item.id} className={`py-3.5 ${idx < arr.length - 1 ? "border-b border-border" : ""}`}>
                  <div className="flex items-start justify-between">
                    <span className="text-[15px] font-medium text-foreground">
                      {item.productName}
                    </span>
                    <span className="text-[15px] font-medium text-[#e63462] flex-shrink-0 ml-3">
                      {"₺"}{formatCurrency(item.price * item.quantity)}
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
                  {onMoveItem && !isCheckoutLocked && (
                    <button
                      type="button"
                      onClick={() => onMoveItem(item.id, item.productName)}
                      className="mt-2 text-[13px] font-medium text-[#007aff] inline-flex items-center gap-1 active:opacity-70"
                    >
                      <CornerUpRight className="h-3.5 w-3.5" />
                      Baska masaya
                    </button>
                  )}
                </div>
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
            <div className="flex items-center justify-end">
              <div className="text-right">
                <p className="text-[12px] font-bold text-[#e63462] uppercase tracking-wider">
                  TOPLAM
                </p>
                <p className="text-[22px] font-bold text-foreground tabular-nums">
                  {"₺"}{formatCurrency(allOrdersTotal)}
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
    </div>
  )
}
