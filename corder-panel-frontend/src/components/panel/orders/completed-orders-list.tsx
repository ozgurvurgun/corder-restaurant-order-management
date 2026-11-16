import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, CreditCard, DoorClosed, DoorOpen, MapPin, Pencil, Printer, Receipt, User } from "lucide-react"
import { getSessionUser } from "@/lib/api"
import { itemCountsTowardBill, itemIsLedgerLike, type ClosedTable, type LedgerCustomer, type PanelOrder, type PanelUser, type Payment } from "@/lib/panel-types"

function formatCurrency(n: number) { return n.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) }
function formatTime(d: Date) { return new Date(d).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) }
function formatDate(d: Date) { return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }) }
function formatDateTime(d: Date) { return `${formatDate(d)} ${formatTime(d)}` }

function orderWaiterLabel(order: PanelOrder, staff: { id: string; name: string }[], locale: string) {
  const name = order.userName?.trim() || staff.find((u) => u.id === order.userId)?.name
  return name || (locale === "tr" ? "Bilinmiyor" : "Unknown")
}

function getDuration(openedAt: Date, closedAt: Date) {
  const diff = new Date(closedAt).getTime() - new Date(openedAt).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours > 0 ? `${hours} saat ${mins} dk` : `${mins} dk`
}

export function CompletedOrdersList(props: {
  paginatedTables: ClosedTable[]
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  mounted: boolean
  locale: string
  users: PanelUser[]
  ledgerCustomers: LedgerCustomer[]
  currentPage: number
  totalPages: number
  setCurrentPage: (v: number | ((p: number) => number)) => void
  onEditClosed: (ct: ClosedTable) => void
  onPrintTable: (ct: ClosedTable) => void
  onPrintOrder: (orderId: string) => void
}) {
  const {
    paginatedTables, expandedId, setExpandedId, mounted, locale, users,
    ledgerCustomers, currentPage, totalPages, setCurrentPage,
    onEditClosed, onPrintTable, onPrintOrder,
  } = props

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case "cash": return locale === "tr" ? "Nakit" : "Cash"
      case "credit-card": return locale === "tr" ? "Kredi Kartı" : "Credit Card"
      case "meal-card": return locale === "tr" ? "Yemek Kartı" : "Meal Card"
      case "multinet": return "Multinet"
      case "split": return locale === "tr" ? "Çoklu Ödeme" : "Split Payment"
      case "ledger": return locale === "tr" ? "Cari" : "On account"
      default: return method
    }
  }

  const getLedgerCustomerLabel = (p: Payment) => {
    if (p.method !== "ledger") return null
    const fromSnap = p.ledgerCustomerName?.trim()
    const fromList = p.ledgerCustomerId != null ? ledgerCustomers.find((c) => c.id === p.ledgerCustomerId)?.name?.trim() : undefined
    return fromSnap || fromList || null
  }

  const formatPaymentDisplay = (p: Payment) => {
    const base = getPaymentMethodLabel(p.method)
    if (p.method !== "ledger") return base
    const cust = getLedgerCustomerLabel(p)
    return cust ? `${base} — ${cust}` : base
  }

  return (
    <div className="flex flex-col gap-4 max-w-5xl">
      {paginatedTables.map((closedTable) => {
        const isExpanded = expandedId === closedTable.id
        const allItems = closedTable.orders.flatMap((order) => order.items)
        const activeItems = allItems.filter((i) => itemCountsTowardBill(i))
        const cancelledItems = allItems.filter((i) => i.status === "cancelled" && !itemIsLedgerLike(i))

        return (
          <div key={closedTable.id} className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between px-4 py-3 bg-[#f5f5f7]/50 border-b border-[#f0f0f0] cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : closedTable.id)}>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#e63462]" />
                  <span className="font-semibold text-[14px] text-[#1d1d1f]">{closedTable.tableName}</span>
                  <span className="text-[11px] px-2 py-0.5 bg-[#e8e8ed] rounded text-[#636366]">{closedTable.section}</span>
                </div>
                <div className="flex items-center gap-1 text-[12px] text-[#86868b]">
                  <User className="w-3 h-3" /> {closedTable.waiter}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isExpanded ? <ChevronUp className="w-4 h-4 text-[#86868b]" /> : <ChevronDown className="w-4 h-4 text-[#86868b]" />}
                <span className="text-[16px] font-bold text-[#e63462]">{"₺"}{formatCurrency(closedTable.netAmount)}</span>
              </div>
            </div>

            <div className="px-4 py-2.5 bg-[#fafafa] border-b border-[#f0f0f0] flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-1.5 text-green-600">
                  <DoorOpen className="w-3.5 h-3.5" />
                  <span className="font-medium">{locale === "tr" ? "Açılış" : "Opened"}:</span>
                  {mounted && <span>{formatDateTime(closedTable.openedAt)}</span>}
                </div>
                <div className="flex items-center gap-1.5 text-red-600">
                  <DoorClosed className="w-3.5 h-3.5" />
                  <span className="font-medium">{locale === "tr" ? "Kapanış" : "Closed"}:</span>
                  {mounted && <span>{formatDateTime(closedTable.closedAt)}</span>}
                </div>
                <div className="flex items-center gap-1.5 text-[#86868b]">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="font-medium">{locale === "tr" ? "Süre" : "Duration"}:</span>
                  {mounted && <span>{getDuration(closedTable.openedAt, closedTable.closedAt)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getSessionUser()?.role === "root" && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); onEditClosed(closedTable) }} className="flex items-center gap-1.5 h-[26px] px-2.5 bg-white border border-[#d1d1d6]/60 hover:bg-[#f5f5f7] text-[#1d1d1f] rounded-lg text-[11px] font-medium transition-colors">
                    <Pencil className="w-3 h-3" /> {locale === "tr" ? "Düzenle" : "Edit"}
                  </button>
                )}
                <button type="button" onClick={(e) => { e.stopPropagation(); onPrintTable(closedTable) }} className="flex items-center gap-1.5 h-[26px] px-3 bg-[#1d1d1f] hover:bg-[#3a3a3c] text-white rounded-lg text-[11px] font-medium transition-colors">
                  <Printer className="w-3 h-3" /> {locale === "tr" ? "Fiş Yazdır" : "Print Receipt"}
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-3 mb-3 pb-3 border-b border-[#f0f0f0] text-[12px]">
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-[#86868b]" />
                    <span className="text-[#86868b]">{locale === "tr" ? "Ödeme" : "Payment"}:</span>
                    <span className="font-semibold text-[#1d1d1f]">{formatPaymentDisplay(closedTable.payment)}</span>
                  </span>
                  {cancelledItems.length > 0 && (
                    <span className="text-[11px] text-red-600">{locale === "tr" ? "İptal satırı" : "Cancelled lines"}: {cancelledItems.length}</span>
                  )}
                </div>

                {closedTable.orders.map((order, orderIdx) => {
                  const orderHasPrintableLines = order.items.some((i) => itemCountsTowardBill(i))
                  return (
                    <div key={order.id} className="mb-4 last:mb-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">{locale === "tr" ? "Adisyon" : "Order"} #{orderIdx + 1}</span>
                          {mounted && <span className="text-[10px] text-[#aeaeb2]">{formatTime(order.createdAt)}</span>}
                          {order.mergedFrom && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                              {locale === "tr" ? `${order.mergedFrom} masasından` : `From ${order.mergedFrom}`}
                            </span>
                          )}
                        </div>
                        {orderHasPrintableLines && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); onPrintOrder(order.id) }} className="flex-shrink-0 flex items-center gap-1 h-[26px] px-2.5 bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#d1d1d6]/60 rounded-lg text-[10px] font-medium text-[#1d1d1f] transition-colors">
                            <Printer className="w-3 h-3" /> {locale === "tr" ? "Adisyon fişi" : "Print check"}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-[#636366] mb-2">
                        <User className="w-3 h-3 flex-shrink-0" />
                        <span>{locale === "tr" ? "Garson:" : "Waiter:"} <span className="font-medium text-[#1d1d1f]">{orderWaiterLabel(order, users, locale)}</span></span>
                      </div>
                      <div className="bg-[#f9f9f9] rounded-lg border border-[#e8e8ed] overflow-hidden">
                        <table className="w-full text-[12px]">
                          <thead>
                            <tr className="bg-[#f0f0f0] text-[#636366]">
                              <th className="text-left px-3 py-2 font-medium">{locale === "tr" ? "Ürün" : "Product"}</th>
                              <th className="text-center px-2 py-2 font-medium w-[60px]">{locale === "tr" ? "Adet" : "Qty"}</th>
                              <th className="text-right px-2 py-2 font-medium w-[80px]">{locale === "tr" ? "Birim" : "Unit"}</th>
                              <th className="text-right px-3 py-2 font-medium w-[90px]">{locale === "tr" ? "Toplam" : "Total"}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.map((item, idx) => {
                              const ledgerLike = itemIsLedgerLike(item)
                              const voidLine = item.status === "cancelled" && !ledgerLike
                              const rowBg = voidLine ? "bg-red-50" : ledgerLike ? "bg-amber-50/90" : idx % 2 === 1 ? "bg-white" : ""
                              return (
                                <tr key={item.id} className={`border-t border-[#e8e8ed] ${rowBg}`}>
                                  <td className={`px-3 py-2 align-top ${voidLine ? "text-red-700" : ledgerLike ? "text-amber-950" : "text-[#1d1d1f]"}`}>
                                    <div className="flex flex-col gap-0.5">
                                      <span className={voidLine ? "line-through text-[#86868b]" : ""}>
                                        {item.productName}
                                        {ledgerLike && <span className="ml-1.5 text-[10px] text-amber-800 not-italic font-medium">[{locale === "tr" ? "Cari" : "Ledger"}]</span>}
                                        {voidLine && <span className="ml-1.5 text-[10px] text-red-500 not-italic">[{locale === "tr" ? "İptal" : "Cancelled"}]</span>}
                                      </span>
                                      {item.note && <span className={`text-[10px] text-[#86868b] italic ${voidLine ? "line-through" : ""}`}>({item.note})</span>}
                                      {ledgerLike && <div className="text-[10px] text-amber-800 not-italic">{locale === "tr" ? "Cariye yazıldı" : "Posted to ledger"}</div>}
                                      {voidLine && (
                                        <div className="text-[10px] text-red-600 not-italic leading-snug space-y-0.5">
                                          {item.cancelledBy && <div>{locale === "tr" ? "İptal eden:" : "Cancelled by:"} <span className="font-medium">{item.cancelledBy}</span></div>}
                                          {item.cancelReason && <div>{locale === "tr" ? "Sebep:" : "Reason:"} <span className="font-medium">{item.cancelReason}</span></div>}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className={`text-center px-2 py-2 ${voidLine ? "line-through text-[#86868b]" : "text-[#1d1d1f]"}`}>{item.quantity}</td>
                                  <td className={`text-right px-2 py-2 ${voidLine ? "line-through text-[#86868b]" : "text-[#636366]"}`}>{"₺"}{formatCurrency(item.price)}</td>
                                  <td className={`text-right px-3 py-2 font-medium ${voidLine ? "line-through text-[#86868b]" : ledgerLike ? "text-amber-950" : "text-[#1d1d1f]"}`}>{"₺"}{formatCurrency(item.price * item.quantity)}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}

                <div className="mt-4 pt-3 border-t border-[#e8e8ed]">
                  <div className="flex justify-between text-[12px] mb-1.5">
                    <span className="text-[#86868b]">{locale === "tr" ? "Ara Toplam" : "Subtotal"} ({activeItems.length} {locale === "tr" ? "ürün" : "items"})</span>
                    <span className="text-[#1d1d1f]">{"₺"}{formatCurrency(closedTable.totalAmount)}</span>
                  </div>
                  {closedTable.discountAmount > 0 && (
                    <div className="flex justify-between text-[12px] mb-1.5 text-amber-600">
                      <span>{locale === "tr" ? "İndirim" : "Discount"}</span>
                      <span>-{"₺"}{formatCurrency(closedTable.discountAmount)}</span>
                    </div>
                  )}
                  {closedTable.payment.tip && closedTable.payment.tip > 0 && (
                    <div className="flex justify-between text-[12px] mb-1.5 text-green-600">
                      <span>{locale === "tr" ? "Bahşiş" : "Tip"}</span>
                      <span>+{"₺"}{formatCurrency(closedTable.payment.tip)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[14px] font-bold mt-2 pt-2 border-t border-[#e8e8ed]">
                    <span className="text-[#1d1d1f]">{locale === "tr" ? "Genel Toplam" : "Grand Total"}</span>
                    <span className="text-[#e63462]">{"₺"}{formatCurrency(closedTable.netAmount + (closedTable.payment.tip || 0))}</span>
                  </div>
                </div>
              </div>
            )}

            {!isExpanded && (
              <div className="px-4 py-2.5 flex items-center justify-between text-[11px] text-[#86868b]">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" /> {formatPaymentDisplay(closedTable.payment)}</span>
                  <span className="flex items-center gap-1"><Receipt className="w-3 h-3" /> {closedTable.orders.reduce((s, o) => s + o.items.filter((i) => itemCountsTowardBill(i)).length, 0)} {locale === "tr" ? "ürün" : "items"}</span>
                  {closedTable.discountAmount > 0 && <span className="text-amber-600">{locale === "tr" ? "İndirim" : "Discount"}: {"₺"}{formatCurrency(closedTable.discountAmount)}</span>}
                </div>
                <span>{locale === "tr" ? "Kapatan" : "Closed by"}: <span className="font-medium text-[#1d1d1f]">{closedTable.closedBy}</span></span>
              </div>
            )}
          </div>
        )
      })}

      {paginatedTables.length === 0 && (
        <div className="text-center py-20 text-[#86868b] text-[14px]">
          {locale === "tr" ? "Tamamlanan sipariş bulunmuyor" : "No completed orders found"}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6 pb-4">
          <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="w-8 h-8 rounded-lg flex items-center justify-center bg-white border border-[#d1d1d6]/60 hover:bg-[#f5f5f7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <ChevronLeft className="w-4 h-4 text-[#1d1d1f]" />
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = totalPages <= 5 ? i + 1 : currentPage <= 3 ? i + 1 : currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i
              return (
                <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`w-8 h-8 rounded-lg text-[12px] font-medium transition-colors ${currentPage === pageNum ? "bg-[#e63462] text-white" : "bg-white border border-[#d1d1d6]/60 hover:bg-[#f5f5f7] text-[#1d1d1f]"}`}>
                  {pageNum}
                </button>
              )
            })}
          </div>
          <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="w-8 h-8 rounded-lg flex items-center justify-center bg-white border border-[#d1d1d6]/60 hover:bg-[#f5f5f7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <ChevronRight className="w-4 h-4 text-[#1d1d1f]" />
          </button>
          <span className="ml-2 text-[11px] text-[#86868b]">
            {locale === "tr" ? `Sayfa ${currentPage} / ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
          </span>
        </div>
      )}
    </div>
  )
}
