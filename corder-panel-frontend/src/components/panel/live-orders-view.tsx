import { useState, useMemo, useEffect } from "react"
import type { ClosedTable, PanelOrder, Payment } from "@/lib/panel-types"
import { itemCountsTowardBill, itemIsLedgerLike } from "@/lib/panel-types"
import { getSessionUser } from "@/lib/api"
import { usePanelStore } from "@/lib/panel-store"
import { EditCompletedOrderModal } from "./edit-completed-order-modal"
import { usePanelI18n } from "@/lib/panel-i18n"
import { usePanelToast } from "./panel-toast"
import { Clock, User, MapPin, Printer, CreditCard, Receipt, ChevronDown, ChevronUp, DoorOpen, DoorClosed, ChevronLeft, ChevronRight, Filter, Pencil } from "lucide-react"

function formatCurrency(n: number) { return n.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) }
function formatTime(d: Date) { return new Date(d).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) }
function formatDate(d: Date) { return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }) }
function formatDateTime(d: Date) { return `${formatDate(d)} ${formatTime(d)}` }
function formatDateForInput(d: Date) { return d.toISOString().split("T")[0] }

function orderWaiterLabel(
  order: PanelOrder,
  staff: { id: string; name: string }[],
  locale: string,
) {
  const name = order.userName?.trim() || staff.find((u) => u.id === order.userId)?.name
  return name || (locale === "tr" ? "Bilinmiyor" : "Unknown")
}

const ITEMS_PER_PAGE = 10

export default function CompletedOrdersView() {
  const { closedTables, reprintReceipt, users, ledgerCustomers } = usePanelStore()
  const { locale, t } = usePanelI18n()
  const { showToast } = usePanelToast()
  const [filterWaiter, setFilterWaiter] = useState("Tumu")
  const [filterTable, setFilterTable] = useState("Tumu")
  const [filterDate, setFilterDate] = useState("today")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")
  const [mounted, setMounted] = useState(false)
  const [editingClosed, setEditingClosed] = useState<ClosedTable | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filterWaiter, filterTable, filterDate, customStartDate, customEndDate])

  const filteredTables = useMemo(() => {
    let list = [...closedTables]
    
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7)
    const monthAgo = new Date(today); monthAgo.setDate(monthAgo.getDate() - 30)
    
    if (filterDate === "today") {
      list = list.filter(ct => new Date(ct.closedAt) >= today)
    } else if (filterDate === "yesterday") {
      list = list.filter(ct => {
        const d = new Date(ct.closedAt)
        return d >= yesterday && d < today
      })
    } else if (filterDate === "week") {
      list = list.filter(ct => new Date(ct.closedAt) >= weekAgo)
    } else if (filterDate === "month") {
      list = list.filter(ct => new Date(ct.closedAt) >= monthAgo)
    } else if (filterDate === "custom" && customStartDate) {
      const start = new Date(customStartDate)
      const end = customEndDate ? new Date(customEndDate) : new Date()
      list = list.filter(ct => {
        const d = new Date(ct.closedAt)
        return d >= start && d <= end
      })
    }
    
    if (filterWaiter !== "Tumu") {
      list = list.filter(ct => ct.waiter === filterWaiter)
    }
    
    if (filterTable !== "Tumu") {
      list = list.filter(ct => ct.tableName === filterTable)
    }
    
    return list.sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime())
  }, [closedTables, filterWaiter, filterTable, filterDate, customStartDate, customEndDate])

  // Pagination
  const totalPages = Math.ceil(filteredTables.length / ITEMS_PER_PAGE)
  const paginatedTables = filteredTables.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const waiters = [...new Set(closedTables.map(ct => ct.waiter))]
  const tableNames = [...new Set(closedTables.map(ct => ct.tableName))].sort()
  const totalRevenue = filteredTables.reduce((s, ct) => s + ct.netAmount, 0)

  const handlePrintOrder = (orderId: string) => {
    void reprintReceipt({ orderId })
    showToast(
      locale === "tr" ? "Adisyon fisi yaziciya gonderildi" : "Check receipt sent to printer",
      "success",
    )
  }

  const handlePrint = (closedTable: ClosedTable) => {
    const items = closedTable.orders.flatMap((o) =>
      o.items
        .filter(itemCountsTowardBill)
        .map((i) => ({
          productName: i.productName,
          quantity: i.quantity,
          price: i.price,
          note: i.note,
        })),
    )
    const lineSum = items.reduce((s, i) => s + i.price * i.quantity, 0)
    const total = closedTable.netAmount > 0 ? closedTable.netAmount : lineSum
    void reprintReceipt({
      tableName: closedTable.tableName,
      waiterName: closedTable.waiter,
      items,
      total,
    })
    showToast(
      locale === "tr" ? "Fiş gönderildi" : "Receipt sent",
      "success",
    )
  }

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case "nakit": return locale === "tr" ? "Nakit" : "Cash"
      case "kredi-karti": return locale === "tr" ? "Kredi Karti" : "Credit Card"
      case "yemek-karti": return locale === "tr" ? "Yemek Karti" : "Meal Card"
      case "multinet": return "Multinet"
      case "coklu": return locale === "tr" ? "Coklu Odeme" : "Split Payment"
      case "cari": return locale === "tr" ? "Cari" : "On account"
      default: return method
    }
  }

  const getCariCustomerLabel = (p: Payment) => {
    if (p.method !== "cari") return null
    const fromSnap = p.ledgerCustomerName?.trim()
    const fromList =
      p.ledgerCustomerId != null
        ? ledgerCustomers.find((c) => c.id === p.ledgerCustomerId)?.name?.trim()
        : undefined
    return fromSnap || fromList || null
  }

  const formatPaymentDisplay = (p: Payment) => {
    const base = getPaymentMethodLabel(p.method)
    if (p.method !== "cari") return base
    const cust = getCariCustomerLabel(p)
    return cust ? `${base} — ${cust}` : base
  }

  const getDuration = (openedAt: Date, closedAt: Date) => {
    const diff = new Date(closedAt).getTime() - new Date(openedAt).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) return `${hours} saat ${mins} dk`
    return `${mins} dk`
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex-shrink-0 border-b border-[#d1d1d6]/60 bg-white/70 backdrop-blur-xl px-5 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold text-[#1d1d1f]">
            {locale === "tr" ? "Tamamlanan Siparisler" : "Completed Orders"}
          </h2>
          <div className="flex items-center gap-2 text-[12px] text-[#86868b]">
            <span className="font-medium">{filteredTables.length} {locale === "tr" ? "siparis" : "orders"}</span>
            <span className="text-[#e63462] font-semibold">{"₺"}{formatCurrency(totalRevenue)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-[11px] text-[#86868b]">
            <Filter className="w-3 h-3" />
          </div>
          <select 
            value={filterDate} 
            onChange={(e) => setFilterDate(e.target.value)}
            className="h-[30px] px-2.5 text-[12px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 appearance-none pr-7 cursor-pointer"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
          >
            <option value="today">{locale === "tr" ? "Bugun" : "Today"}</option>
            <option value="yesterday">{locale === "tr" ? "Dun" : "Yesterday"}</option>
            <option value="week">{locale === "tr" ? "Son 7 Gun" : "Last 7 Days"}</option>
            <option value="month">{locale === "tr" ? "Son 30 Gun" : "Last 30 Days"}</option>
            <option value="custom">{locale === "tr" ? "Ozel Tarih" : "Custom Date"}</option>
            <option value="all">{locale === "tr" ? "Tumu" : "All"}</option>
          </select>
          {filterDate === "custom" && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#86868b]">Baslangic:</span>
                <input 
                  type="datetime-local" 
                  value={customStartDate} 
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="h-[30px] px-2 text-[11px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#86868b]">Bitis:</span>
                <input 
                  type="datetime-local" 
                  value={customEndDate} 
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="h-[30px] px-2 text-[11px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
                />
              </div>
            </>
          )}
          <select 
            value={filterTable} 
            onChange={(e) => setFilterTable(e.target.value)}
            className="h-[30px] px-2.5 text-[12px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 appearance-none pr-7 cursor-pointer"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
          >
            <option value="Tumu">{locale === "tr" ? "Tum Masalar" : "All Tables"}</option>
            {tableNames.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select 
            value={filterWaiter} 
            onChange={(e) => setFilterWaiter(e.target.value)}
            className="h-[30px] px-2.5 text-[12px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 appearance-none pr-7 cursor-pointer"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
          >
            <option value="Tumu">{locale === "tr" ? "Tum Garsonlar" : "All Waiters"}</option>
            {waiters.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
      </div>

      {/* Order list */}
      <div className="flex-1 overflow-auto p-5">
        <div className="flex flex-col gap-4 max-w-5xl">
          {paginatedTables.map((closedTable) => {
            const isExpanded = expandedId === closedTable.id
            const allItems = closedTable.orders.flatMap(order => order.items)
            const activeItems = allItems.filter((i) => itemCountsTowardBill(i))
            const cancelledItems = allItems.filter((i) => i.status === "cancelled" && !itemIsLedgerLike(i))
            
            return (
              <div key={closedTable.id} className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden hover:shadow-sm transition-shadow">
                {/* Header */}
                <div 
                  className="flex items-center justify-between px-4 py-3 bg-[#f5f5f7]/50 border-b border-[#f0f0f0] cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : closedTable.id)}
                >
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

                {/* Opening / Closing Info Bar */}
                <div className="px-4 py-2.5 bg-[#fafafa] border-b border-[#f0f0f0] flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-1.5 text-green-600">
                      <DoorOpen className="w-3.5 h-3.5" />
                      <span className="font-medium">{locale === "tr" ? "Acilis" : "Opened"}:</span>
                      {mounted && <span>{formatDateTime(closedTable.openedAt)}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 text-red-600">
                      <DoorClosed className="w-3.5 h-3.5" />
                      <span className="font-medium">{locale === "tr" ? "Kapanis" : "Closed"}:</span>
                      {mounted && <span>{formatDateTime(closedTable.closedAt)}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 text-[#86868b]">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="font-medium">{locale === "tr" ? "Sure" : "Duration"}:</span>
                      {mounted && <span>{getDuration(closedTable.openedAt, closedTable.closedAt)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getSessionUser()?.role === "root" && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingClosed(closedTable)
                        }}
                        className="flex items-center gap-1.5 h-[26px] px-2.5 bg-white border border-[#d1d1d6]/60 hover:bg-[#f5f5f7] text-[#1d1d1f] rounded-lg text-[11px] font-medium transition-colors"
                      >
                        <Pencil className="w-3 h-3" /> {locale === "tr" ? "Duzenle" : "Edit"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePrint(closedTable)
                      }}
                      className="flex items-center gap-1.5 h-[26px] px-3 bg-[#1d1d1f] hover:bg-[#3a3a3c] text-white rounded-lg text-[11px] font-medium transition-colors"
                    >
                      <Printer className="w-3 h-3" /> {locale === "tr" ? "Fis Yazdir" : "Print Receipt"}
                    </button>
                  </div>
                </div>

                {/* Check - Order Details (Expanded) */}
                {isExpanded && (
                  <div className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3 mb-3 pb-3 border-b border-[#f0f0f0] text-[12px]">
                      <span className="flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-[#86868b]" />
                        <span className="text-[#86868b]">{locale === "tr" ? "Odeme" : "Payment"}:</span>
                        <span className="font-semibold text-[#1d1d1f]">{formatPaymentDisplay(closedTable.payment)}</span>
                      </span>
                      {cancelledItems.length > 0 && (
                        <span className="text-[11px] text-red-600">
                          {locale === "tr" ? "Iptal satiri" : "Cancelled lines"}: {cancelledItems.length}
                        </span>
                      )}
                    </div>
                    {/* Orders grouped */}
                    {closedTable.orders.map((order, orderIdx) => {
                      const orderHasPrintableLines = order.items.some((i) => itemCountsTowardBill(i))
                      return (
                      <div key={order.id} className="mb-4 last:mb-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                              {locale === "tr" ? "Adisyon" : "Order"} #{orderIdx + 1}
                            </span>
                            {mounted && (
                              <span className="text-[10px] text-[#aeaeb2]">
                                {formatTime(order.createdAt)}
                              </span>
                            )}
                            {order.mergedFrom && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                                {locale === "tr"
                                  ? `${order.mergedFrom} masasindan`
                                  : `From ${order.mergedFrom}`}
                              </span>
                            )}
                          </div>
                          {orderHasPrintableLines && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handlePrintOrder(order.id)
                              }}
                              className="flex-shrink-0 flex items-center gap-1 h-[26px] px-2.5 bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#d1d1d6]/60 rounded-lg text-[10px] font-medium text-[#1d1d1f] transition-colors"
                            >
                              <Printer className="w-3 h-3" />
                              {locale === "tr" ? "Adisyon fisi" : "Print check"}
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-[#636366] mb-2">
                          <User className="w-3 h-3 flex-shrink-0" />
                          <span>
                            {locale === "tr" ? "Garson:" : "Waiter:"}{" "}
                            <span className="font-medium text-[#1d1d1f]">
                              {orderWaiterLabel(order, users, locale)}
                            </span>
                          </span>
                        </div>
                        <div className="bg-[#f9f9f9] rounded-lg border border-[#e8e8ed] overflow-hidden">
                          <table className="w-full text-[12px]">
                            <thead>
                              <tr className="bg-[#f0f0f0] text-[#636366]">
                                <th className="text-left px-3 py-2 font-medium">{locale === "tr" ? "Urun" : "Product"}</th>
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
                                        {ledgerLike && (
                                          <span className="ml-1.5 text-[10px] text-amber-800 not-italic font-medium">
                                            [{locale === "tr" ? "Cari" : "Ledger"}]
                                          </span>
                                        )}
                                        {voidLine && (
                                          <span className="ml-1.5 text-[10px] text-red-500 not-italic">
                                            [{locale === "tr" ? "Iptal" : "Cancelled"}]
                                          </span>
                                        )}
                                      </span>
                                      {item.note && (
                                        <span className={`text-[10px] text-[#86868b] italic ${voidLine ? "line-through" : ""}`}>
                                          ({item.note})
                                        </span>
                                      )}
                                      {ledgerLike && (
                                        <div className="text-[10px] text-amber-800 not-italic">
                                          {locale === "tr" ? "Cariye yazildi" : "Posted to ledger"}
                                        </div>
                                      )}
                                      {voidLine && (
                                        <div className="text-[10px] text-red-600 not-italic leading-snug space-y-0.5">
                                          {item.cancelledBy && (
                                            <div>
                                              {locale === "tr" ? "Iptal eden:" : "Cancelled by:"}{" "}
                                              <span className="font-medium">{item.cancelledBy}</span>
                                            </div>
                                          )}
                                          {item.cancelReason && (
                                            <div>
                                              {locale === "tr" ? "Sebep:" : "Reason:"}{" "}
                                              <span className="font-medium">{item.cancelReason}</span>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className={`text-center px-2 py-2 ${voidLine ? "line-through text-[#86868b]" : "text-[#1d1d1f]"}`}>
                                    {item.quantity}
                                  </td>
                                  <td className={`text-right px-2 py-2 ${voidLine ? "line-through text-[#86868b]" : "text-[#636366]"}`}>
                                    {"₺"}{formatCurrency(item.price)}
                                  </td>
                                  <td className={`text-right px-3 py-2 font-medium ${voidLine ? "line-through text-[#86868b]" : ledgerLike ? "text-amber-950" : "text-[#1d1d1f]"}`}>
                                    {"₺"}{formatCurrency(item.price * item.quantity)}
                                  </td>
                                </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                    })}

                    {/* Summary */}
                    <div className="mt-4 pt-3 border-t border-[#e8e8ed]">
                      <div className="flex justify-between text-[12px] mb-1.5">
                        <span className="text-[#86868b]">{locale === "tr" ? "Ara Toplam" : "Subtotal"} ({activeItems.length} {locale === "tr" ? "urun" : "items"})</span>
                        <span className="text-[#1d1d1f]">{"₺"}{formatCurrency(closedTable.totalAmount)}</span>
                      </div>
                      {closedTable.discountAmount > 0 && (
                        <div className="flex justify-between text-[12px] mb-1.5 text-amber-600">
                          <span>{locale === "tr" ? "Indirim" : "Discount"}</span>
                          <span>-{"₺"}{formatCurrency(closedTable.discountAmount)}</span>
                        </div>
                      )}
                      {closedTable.payment.tip && closedTable.payment.tip > 0 && (
                        <div className="flex justify-between text-[12px] mb-1.5 text-green-600">
                          <span>{locale === "tr" ? "Bahsis" : "Tip"}</span>
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

                {/* Collapsed summary - Payment info */}
                {!isExpanded && (
                  <div className="px-4 py-2.5 flex items-center justify-between text-[11px] text-[#86868b]">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <CreditCard className="w-3 h-3" />
                        {formatPaymentDisplay(closedTable.payment)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Receipt className="w-3 h-3" />
                        {closedTable.orders.reduce((s, o) => s + o.items.filter((i) => itemCountsTowardBill(i)).length, 0)} {locale === "tr" ? "urun" : "items"}
                      </span>
                      {closedTable.discountAmount > 0 && (
                        <span className="text-amber-600">
                          {locale === "tr" ? "Indirim" : "Discount"}: {"₺"}{formatCurrency(closedTable.discountAmount)}
                        </span>
                      )}
                    </div>
                    <span>
                      {locale === "tr" ? "Kapatan" : "Closed by"}: <span className="font-medium text-[#1d1d1f]">{closedTable.closedBy}</span>
                    </span>
                  </div>
                )}
              </div>
            )
          })}
          {paginatedTables.length === 0 && (
            <div className="text-center py-20 text-[#86868b] text-[14px]">
              {locale === "tr" ? "Tamamlanan siparis bulunmuyor" : "No completed orders found"}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6 pb-4">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-white border border-[#d1d1d6]/60 hover:bg-[#f5f5f7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-[#1d1d1f]" />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-[12px] font-medium transition-colors ${
                        currentPage === pageNum 
                          ? "bg-[#e63462] text-white" 
                          : "bg-white border border-[#d1d1d6]/60 hover:bg-[#f5f5f7] text-[#1d1d1f]"
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-white border border-[#d1d1d6]/60 hover:bg-[#f5f5f7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-[#1d1d1f]" />
              </button>
              <span className="ml-2 text-[11px] text-[#86868b]">
                {locale === "tr" ? `Sayfa ${currentPage} / ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
              </span>
            </div>
          )}
        </div>
      </div>
      {editingClosed && (
        <EditCompletedOrderModal closedTable={editingClosed} onClose={() => setEditingClosed(null)} />
      )}
    </div>
  )
}
