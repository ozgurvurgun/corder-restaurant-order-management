import { useState, useMemo, useEffect } from "react"
import type { ClosedTable } from "@/lib/panel-types"
import { itemCountsTowardBill } from "@/lib/panel-types"
import { usePanelStore } from "@/lib/panel-store"
import { EditCompletedOrderModal } from "./edit-completed-order-modal"
import { usePanelI18n } from "@/lib/panel-i18n"
import { usePanelToast } from "./panel-toast"
import { Filter } from "lucide-react"
import { CompletedOrdersList } from "./orders/completed-orders-list"
import { CustomDatePicker, CustomSelect } from "@/components/ui/custom-inputs"
import {
  computeDateFilterBounds,
  formatCurrency,
  fromMinorUnits,
  toMinorUnits,
} from "@/lib/format"

const ITEMS_PER_PAGE = 10

export default function CompletedOrdersView() {
  const {
    closedTables,
    reprintReceipt,
    users,
    ledgerCustomers,
    currentUser,
    hasPermission,
  } = usePanelStore()
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

  const isBoss = currentUser?.role === "root"
  const canViewFinancial = isBoss || hasPermission("reports.view_financial")
  const canEditCompletedOrder =
    isBoss || hasPermission("billing.edit_completed_order")
  const canPrintReceipt = isBoss || hasPermission("order.print_receipt")

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [filterWaiter, filterTable, filterDate, customStartDate, customEndDate])

  const dateBounds = useMemo(
    () => computeDateFilterBounds(filterDate, customStartDate, customEndDate),
    [filterDate, customStartDate, customEndDate],
  )

  const filteredTables = useMemo(() => {
    let list = [...closedTables]

    if (dateBounds) {
      list = list.filter((ct) => {
        const d = new Date(ct.closedAt)
        return d >= dateBounds.from && d <= dateBounds.to
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
  }, [closedTables, dateBounds, filterWaiter, filterTable])

  const totalPages = Math.ceil(filteredTables.length / ITEMS_PER_PAGE)
  const paginatedTables = filteredTables.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  )

  const waiters = [...new Set(closedTables.map((ct) => ct.waiter))]
  const tableNames = [
    ...new Set(closedTables.map((ct) => ct.tableName)),
  ].sort((a, b) => a.localeCompare(b, "tr"))
  const totalRevenue = fromMinorUnits(
    filteredTables.reduce((s, ct) => s + toMinorUnits(ct.netAmount), 0),
  )

  const handlePrintOrder = async (orderId: string) => {
    if (!canPrintReceipt) return
    const ok = await reprintReceipt({ orderId })
    if (ok) {
      showToast(
        locale === "tr"
          ? "Adisyon fişi yazıcıya gönderildi"
          : "Check receipt sent to printer",
        "success",
      )
    }
  }

  const handlePrint = async (closedTable: ClosedTable) => {
    if (!canPrintReceipt) return
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
    const lineSum = fromMinorUnits(
      items.reduce((s, i) => s + toMinorUnits(i.price) * i.quantity, 0),
    )
    const total = closedTable.netAmount > 0 ? closedTable.netAmount : lineSum
    const ok = await reprintReceipt({
      tableName: closedTable.tableName,
      waiterName: closedTable.waiter,
      items,
      total,
    })
    if (ok) {
      showToast(
        locale === "tr" ? "Fiş gönderildi" : "Receipt sent",
        "success",
      )
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 border-b border-[#d1d1d6]/60 bg-white/70 backdrop-blur-xl px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-[11px] text-[#86868b]">
            <Filter className="w-3 h-3" />
          </div>
          <CustomSelect
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="h-[30px] px-2.5 text-[12px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60"
          >
            <option value="today">{locale === "tr" ? "Bugün" : "Today"}</option>
            <option value="yesterday">
              {locale === "tr" ? "Dün" : "Yesterday"}
            </option>
            <option value="week">
              {locale === "tr" ? "Son 7 Gün" : "Last 7 Days"}
            </option>
            <option value="month">
              {locale === "tr" ? "Son 30 Gün" : "Last 30 Days"}
            </option>
            <option value="custom">
              {locale === "tr" ? "Özel Tarih" : "Custom Date"}
            </option>
            <option value="all">{locale === "tr" ? "Tümü" : "All"}</option>
          </CustomSelect>
          {filterDate === "custom" && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#86868b]">Başlangıç:</span>
                <CustomDatePicker
                  value={customStartDate.slice(0, 10)}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="h-[30px] px-2 text-[11px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#86868b]">Bitiş:</span>
                <CustomDatePicker
                  value={customEndDate.slice(0, 10)}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="h-[30px] px-2 text-[11px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60"
                />
              </div>
            </>
          )}
          <CustomSelect
            value={filterTable}
            onChange={(e) => setFilterTable(e.target.value)}
            className="h-[30px] px-2.5 text-[12px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60"
          >
            <option value="Tumu">
              {locale === "tr" ? "Tüm Masalar" : "All Tables"}
            </option>
            {tableNames.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </CustomSelect>
          <CustomSelect
            value={filterWaiter}
            onChange={(e) => setFilterWaiter(e.target.value)}
            className="h-[30px] px-2.5 text-[12px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60"
          >
            <option value="Tumu">
              {locale === "tr" ? "Tüm Garsonlar" : "All Waiters"}
            </option>
            {waiters.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </CustomSelect>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-[#86868b]">
          <span className="font-medium">
            {filteredTables.length}{" "}
            {locale === "tr" ? "sipariş" : "orders"}
          </span>
          {canViewFinancial && (
            <span className="text-[#e63462] font-semibold">
              {"₺"}
              {formatCurrency(totalRevenue)}
            </span>
          )}
        </div>
      </div>

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
          canEditCompletedOrder={canEditCompletedOrder}
          canPrintReceipt={canPrintReceipt}
          onEditClosed={setEditingClosed}
          onPrintTable={(ct) => void handlePrint(ct)}
          onPrintOrder={(id) => void handlePrintOrder(id)}
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
