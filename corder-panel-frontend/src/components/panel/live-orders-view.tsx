import { useState, useMemo, useEffect } from "react"
import type { ClosedTable } from "@/lib/panel-types"
import { itemCountsTowardBill } from "@/lib/panel-types"
import { usePanelStore } from "@/lib/panel-store"
import { EditCompletedOrderModal } from "./edit-completed-order-modal"
import { usePanelI18n } from "@/lib/panel-i18n"
import { usePanelToast } from "./panel-toast"
import { Filter } from "lucide-react"
import { CompletedOrdersList } from "./orders/completed-orders-list"

function formatCurrency(n: number) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2 })
}

const ITEMS_PER_PAGE = 10

export default function CompletedOrdersView() {
  const { closedTables, reprintReceipt, users, ledgerCustomers } =
    usePanelStore()
  const { locale } = usePanelI18n()
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

  useEffect(() => {
    setCurrentPage(1)
  }, [filterWaiter, filterTable, filterDate, customStartDate, customEndDate])

  const filteredTables = useMemo(() => {
    let list = [...closedTables]

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)
    const monthAgo = new Date(today)
    monthAgo.setDate(monthAgo.getDate() - 30)

    if (filterDate === "today") {
      list = list.filter((ct) => new Date(ct.closedAt) >= today)
    } else if (filterDate === "yesterday") {
      list = list.filter((ct) => {
        const d = new Date(ct.closedAt)
        return d >= yesterday && d < today
      })
    } else if (filterDate === "week") {
      list = list.filter((ct) => new Date(ct.closedAt) >= weekAgo)
    } else if (filterDate === "month") {
      list = list.filter((ct) => new Date(ct.closedAt) >= monthAgo)
    } else if (filterDate === "custom" && customStartDate) {
      const start = new Date(customStartDate)
      const end = customEndDate ? new Date(customEndDate) : new Date()
      list = list.filter((ct) => {
        const d = new Date(ct.closedAt)
        return d >= start && d <= end
      })
    }

    if (filterWaiter !== "Tumu") {
      list = list.filter((ct) => ct.waiter === filterWaiter)
    }

    if (filterTable !== "Tumu") {
      list = list.filter((ct) => ct.tableName === filterTable)
    }

    return list.sort(
      (a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime(),
    )
  }, [
    closedTables,
    filterWaiter,
    filterTable,
    filterDate,
    customStartDate,
    customEndDate,
  ])

  const totalPages = Math.ceil(filteredTables.length / ITEMS_PER_PAGE)
  const paginatedTables = filteredTables.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  )

  const waiters = [...new Set(closedTables.map((ct) => ct.waiter))]
  const tableNames = [
    ...new Set(closedTables.map((ct) => ct.tableName)),
  ].sort()
  const totalRevenue = filteredTables.reduce((s, ct) => s + ct.netAmount, 0)

  const handlePrintOrder = (orderId: string) => {
    void reprintReceipt({ orderId })
    showToast(
      locale === "tr"
        ? "Adisyon fisi yaziciya gonderildi"
        : "Check receipt sent to printer",
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
      locale === "tr" ? "Fis gonderildi" : "Receipt sent",
      "success",
    )
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
            <span className="font-medium">
              {filteredTables.length}{" "}
              {locale === "tr" ? "siparis" : "orders"}
            </span>
            <span className="text-[#e63462] font-semibold">
              {"₺"}
              {formatCurrency(totalRevenue)}
            </span>
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
          >
            <option value="today">{locale === "tr" ? "Bugun" : "Today"}</option>
            <option value="yesterday">
              {locale === "tr" ? "Dun" : "Yesterday"}
            </option>
            <option value="week">
              {locale === "tr" ? "Son 7 Gun" : "Last 7 Days"}
            </option>
            <option value="month">
              {locale === "tr" ? "Son 30 Gun" : "Last 30 Days"}
            </option>
            <option value="custom">
              {locale === "tr" ? "Ozel Tarih" : "Custom Date"}
            </option>
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
          >
            <option value="Tumu">
              {locale === "tr" ? "Tum Masalar" : "All Tables"}
            </option>
            {tableNames.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={filterWaiter}
            onChange={(e) => setFilterWaiter(e.target.value)}
            className="h-[30px] px-2.5 text-[12px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 appearance-none pr-7 cursor-pointer"
          >
            <option value="Tumu">
              {locale === "tr" ? "Tum Garsonlar" : "All Waiters"}
            </option>
            {waiters.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Order list */}
      <div className="flex-1 overflow-auto p-5">
        <CompletedOrdersList
          paginatedTables={paginatedTables}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          mounted={mounted}
          locale={locale}
          users={users}
          ledgerCustomers={ledgerCustomers}
          currentPage={currentPage}
          totalPages={totalPages}
          setCurrentPage={setCurrentPage}
          onEditClosed={setEditingClosed}
          onPrintTable={handlePrint}
          onPrintOrder={handlePrintOrder}
        />
      </div>
      {editingClosed && (
        <EditCompletedOrderModal
          closedTable={editingClosed}
          onClose={() => setEditingClosed(null)}
        />
      )}
    </div>
  )
}
