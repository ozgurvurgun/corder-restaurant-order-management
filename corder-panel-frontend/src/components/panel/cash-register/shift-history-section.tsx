import { useState, useMemo, useEffect } from "react"
import { Banknote, BookUser, CreditCard, History, Loader2, Printer, Receipt, UtensilsCrossed } from "lucide-react"
import { api } from "@/lib/api"
import { usePanelAuth } from "@/lib/panel-auth"
import { showPanelToast } from "@/components/panel/panel-toast"
import { mapCashTransactionDtoToPanel, mapCompletedOrderDtoToClosedTable } from "@/lib/mappers/billing.mapper"
import type { CashShift, CashTransaction, ClosedTable, RestaurantSettings } from "@/lib/panel-types"
import { formatCurrency, formatIstanbulDate, formatIstanbulDateTime, formatIstanbulTime, fromMinorUnits, toMinorUnits } from "@/lib/format"
import { CustomSelect } from "@/components/ui/custom-inputs"
import { PaginationBar } from "@/components/ui/pagination-bar"
import { ShiftFullDetailPanel } from "./shift-detail-panel"

export interface ShiftTotalsSummary {
  totalRevenue: number
  totalCash: number
  totalCard: number
  totalMealCard: number
  totalMultinet: number
  totalLedger: number
}

const SPLIT_METHOD_LABELS: Record<string, string> = {
  cash: "Nakit",
  "credit-card": "Kredi Kartı",
  "meal-card": "Yemek Kartı",
  multinet: "Multinet",
  ledger: "Cari",
}

export function ZReportSection(props: {
  settings: RestaurantSettings
  selectedShift: CashShift | null
  allShifts: CashShift[]
  onSelectShift: (shiftId: string) => void
  shiftTotals: ShiftTotalsSummary
  shiftTransactions?: CashTransaction[]
  shiftClosedTables?: ClosedTable[]
}) {
  const { settings, selectedShift, allShifts, onSelectShift, shiftTotals, shiftTransactions = [], shiftClosedTables = [] } = props
  const { token } = usePanelAuth()
  const [printingId, setPrintingId] = useState<string | null>(null)
  const [archivePage, setArchivePage] = useState(1)
  const [fetchedShiftTxs, setFetchedShiftTxs] = useState<CashTransaction[] | null>(null)
  const [fetchedShiftTables, setFetchedShiftTables] = useState<ClosedTable[] | null>(null)
  const [loadingShiftDetails, setLoadingShiftDetails] = useState(false)
  const archivePageSize = 8

  useEffect(() => {
    if (!token || !selectedShift) {
      setFetchedShiftTxs(null)
      setFetchedShiftTables(null)
      return
    }
    let cancelled = false
    setLoadingShiftDetails(true)
    const fromIso = new Date(selectedShift.openedAt).toISOString()
    const toIso = (selectedShift.closedAt ? new Date(selectedShift.closedAt) : new Date()).toISOString()

    void Promise.all([
      api.cashTransactions.list(token, selectedShift.id).catch(() => null),
      api.completedOrders.list(token, { from: fromIso, to: toIso, limit: 500 }).catch(() => null),
    ])
      .then(([txDtos, orderDtos]) => {
        if (cancelled) return
        if (txDtos) setFetchedShiftTxs(txDtos.map(mapCashTransactionDtoToPanel))
        if (orderDtos) setFetchedShiftTables(orderDtos.map(mapCompletedOrderDtoToClosedTable))
      })
      .finally(() => {
        if (!cancelled) setLoadingShiftDetails(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, selectedShift?.id, selectedShift?.status])

  const effectiveShiftTxs = useMemo(() => {
    const map = new Map<string, CashTransaction>()
    for (const tx of shiftTransactions) map.set(tx.id, tx)
    for (const tx of fetchedShiftTxs ?? []) map.set(tx.id, tx)
    return Array.from(map.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [shiftTransactions, fetchedShiftTxs])

  const effectiveShiftClosedTables = useMemo(() => {
    const map = new Map<string, ClosedTable>()
    for (const ct of shiftClosedTables) map.set(ct.id, ct)
    for (const ct of fetchedShiftTables ?? []) map.set(ct.id, ct)
    return Array.from(map.values()).sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime())
  }, [shiftClosedTables, fetchedShiftTables])

  const isOpenShift = selectedShift?.status === "open"
  const closedShifts = useMemo(() => allShifts.filter((s) => s.status === "closed"), [allShifts])
  const paginatedClosedShifts = useMemo(
    () => closedShifts.slice((archivePage - 1) * archivePageSize, archivePage * archivePageSize),
    [closedShifts, archivePage],
  )

  const handlePrintFromCashPrinter = async (shift: CashShift) => {
    if (!token || printingId) return
    const isX = shift.status === "open"
    setPrintingId(shift.id)
    try {
      await api.shifts.printReport(token, shift.id)
      showPanelToast(isX ? "X Raporu kasa yazıcısına gönderildi" : "Z Raporu kasa yazıcısına gönderildi", "success")
    } catch (err) {
      showPanelToast(err instanceof Error ? err.message : "Rapor kasa yazıcısına gönderilemedi", "error")
    } finally {
      setPrintingId(null)
    }
  }

  if (!selectedShift) {
    return (
      <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-10 text-center text-[13px] text-[#86868b]">
        Henüz görüntülenebilecek açık veya kapalı vardiya kaydı bulunmuyor.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
        <div className="px-4 py-3 bg-[#f9f9f9] border-b border-[#f0f0f0] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#e63462]" />
            <div>
              <h3 className="text-[13px] font-semibold text-[#1d1d1f]">Geçmiş Kapanmış Kasalar (Vardiya Arşivi)</h3>
              <p className="text-[11px] text-[#86868b]">
                Herhangi bir kapanmış kasaya tıklayarak o vardiyanın tüm gelir/giderlerini, kapanan masalarını ve Z raporunu inceleyebilirsiniz.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-[#86868b]">{closedShifts.length} kapanmış vardiya</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="bg-[#f9f9f9] border-b border-[#f0f0f0]">
                <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase">Açılış / Kapanış</th>
                <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase">Kasiyer</th>
                <th className="text-right px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase">Nakit Giriş / Çıkış</th>
                <th className="text-right px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase">Beklenen Kasa</th>
                <th className="text-right px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase">Sayılan Kapanış</th>
                <th className="text-right px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase">Kasa Farkı</th>
                <th className="text-right px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase">Toplam Ciro</th>
                <th className="text-right px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {paginatedClosedShifts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[12px] text-[#86868b]">
                    Henüz kapanmış kasa vardiyası bulunmuyor.
                  </td>
                </tr>
              ) : (
                paginatedClosedShifts.map((s, idx) => {
                  const expMinor = toMinorUnits(s.openingBalance || 0) + toMinorUnits(s.cashIn || 0) - toMinorUnits(s.cashOut || 0)
                  const diffMinor = s.closingBalance != null ? toMinorUnits(s.closingBalance) - expMinor : 0
                  const isSelected = selectedShift.id === s.id
                  return (
                    <tr
                      key={s.id}
                      onClick={() => onSelectShift(s.id)}
                      className={`border-b border-[#f0f0f0] cursor-pointer transition-colors ${
                        isSelected ? "bg-[#e63462]/[0.07]" : idx % 2 === 1 ? "bg-[#fafafa] hover:bg-[#f5f5f7]" : "hover:bg-[#f5f5f7]"
                      }`}
                    >
                      <td className="px-4 py-2.5 text-[12px] text-[#1d1d1f]">
                        <div className="font-medium">{formatIstanbulDateTime(s.openedAt)}</div>
                        <div className="text-[11px] text-[#86868b]">Kapanış: {s.closedAt ? formatIstanbulDateTime(s.closedAt) : "-"}</div>
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-[#1d1d1f]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span>{s.openedBy}</span>
                          {s.isAutoClosed && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-semibold">
                              Otomatik Gün Sonu
                            </span>
                          )}
                          {(s.carriedOverTablesCount ?? 0) > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold">
                              Devir: {s.carriedOverTablesCount} Masa
                            </span>
                          )}
                        </div>
                        {s.closedBy && <div className="text-[11px] text-[#86868b]">Kapatan: {s.closedBy}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-[11px] text-right">
                        <div className="text-green-600 font-medium">+{"\u20BA"}{formatCurrency(s.cashIn || 0)}</div>
                        <div className="text-red-500 font-medium">-{"\u20BA"}{formatCurrency(s.cashOut || 0)}</div>
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-right font-medium text-[#1d1d1f]">
                        {"\u20BA"}{formatCurrency(fromMinorUnits(expMinor))}
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-right font-semibold text-[#1d1d1f]">
                        {s.closingBalance != null ? `\u20BA${formatCurrency(s.closingBalance)}` : "-"}
                      </td>
                      <td className={`px-4 py-2.5 text-[12px] text-right font-semibold ${diffMinor === 0 ? "text-green-600" : diffMinor > 0 ? "text-blue-600" : "text-red-600"}`}>
                        {diffMinor === 0 ? "Tam" : diffMinor > 0 ? `+\u20BA${formatCurrency(fromMinorUnits(diffMinor))}` : `-\u20BA${formatCurrency(fromMinorUnits(Math.abs(diffMinor)))}`}
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-right font-bold text-[#e63462]">
                        {"\u20BA"}{formatCurrency(s.totalRevenue || 0)}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectShift(s.id)}
                            className={`h-[28px] px-2.5 rounded-lg text-[11px] font-semibold transition-colors ${
                              isSelected ? "bg-[#e63462] text-white" : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e5e5ea]"
                            }`}
                          >
                            {isSelected ? "İnceleniyor" : "Detayları Gör"}
                          </button>
                          <button
                            type="button"
                            disabled={printingId === s.id}
                            onClick={() => void handlePrintFromCashPrinter(s)}
                            className="h-[28px] px-2.5 inline-flex items-center gap-1 rounded-lg bg-[#1d1d1f] text-white text-[11px] font-medium hover:bg-[#3a3a3c] disabled:opacity-50"
                          >
                            {printingId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Printer className="w-3 h-3" />}
                            Z Raporu Bas
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-3">
          <PaginationBar currentPage={archivePage} totalItems={closedShifts.length} pageSize={archivePageSize} onPageChange={setArchivePage} itemLabel="kapanmış vardiya" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-[12px] font-semibold text-[#1d1d1f] flex-shrink-0">İncelenen Kasa Vardiyası:</span>
          <CustomSelect
            value={selectedShift.id}
            onChange={(e) => onSelectShift(e.target.value)}
            className="h-[34px] px-3 text-[12px] bg-white rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 max-w-full"
          >
            {allShifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.status === "open"
                  ? `Açık Vardiya - ${s.openedBy} (${formatIstanbulDateTime(s.openedAt)})`
                  : `Kapalı - ${s.openedBy} (${formatIstanbulDateTime(s.openedAt)} - ${s.closedAt ? formatIstanbulTime(s.closedAt) : "-"})`}
              </option>
            ))}
          </CustomSelect>
        </div>

        <button
          type="button"
          disabled={printingId === selectedShift.id}
          onClick={() => void handlePrintFromCashPrinter(selectedShift)}
          className="h-[34px] px-4 flex items-center gap-2 bg-[#1d1d1f] text-white rounded-lg text-[12px] font-medium hover:bg-[#3a3a3c] disabled:opacity-50 transition-colors"
        >
          {printingId === selectedShift.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
          {isOpenShift ? "X Raporu Yazdır" : "Z Raporu Yazdır"}
        </button>
      </div>

      <ShiftFullDetailPanel
        settings={settings}
        selectedShift={selectedShift}
        shiftTotals={shiftTotals}
        shiftTransactions={effectiveShiftTxs}
        shiftClosedTables={effectiveShiftClosedTables}
        loadingDetails={loadingShiftDetails}
      />
    </div>
  )
}

export function DetailReportSection(props: { filteredClosedTables: ClosedTable[] }) {
  const { filteredClosedTables } = props
  const [pagesByMethod, setPagesByMethod] = useState<Record<string, number>>({})
  const pageSize = 10

  const groups: Record<string, ClosedTable[]> = {
    cash: [], "credit-card": [], "meal-card": [], multinet: [], split: [], ledger: [],
  }
  filteredClosedTables.forEach((ct) => {
    if (groups[ct.payment.method]) groups[ct.payment.method].push(ct)
  })

  const methodBlocks = [
    { key: "cash", label: "Nakit", icon: Banknote, headerBg: "bg-green-50", iconText: "text-green-600", titleText: "text-green-700" },
    { key: "credit-card", label: "Kredi Kartı", icon: CreditCard, headerBg: "bg-blue-50", iconText: "text-blue-600", titleText: "text-blue-700" },
    { key: "meal-card", label: "Yemek Kartı", icon: UtensilsCrossed, headerBg: "bg-purple-50", iconText: "text-purple-600", titleText: "text-purple-700" },
    { key: "multinet", label: "Multinet", icon: CreditCard, headerBg: "bg-amber-50", iconText: "text-amber-600", titleText: "text-amber-700" },
    { key: "split", label: "Çoklu Ödeme", icon: Receipt, headerBg: "bg-gray-100", iconText: "text-gray-600", titleText: "text-gray-700" },
    { key: "ledger", label: "Cari", icon: BookUser, headerBg: "bg-rose-50", iconText: "text-rose-600", titleText: "text-rose-800" },
  ]

  return (
    <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
      <div className="px-4 py-3 bg-[#f9f9f9] border-b border-[#f0f0f0]">
        <h3 className="text-[14px] font-semibold text-[#1d1d1f]">Detay Raporu - Ödeme Yöntemine Göre</h3>
        <p className="text-[11px] text-[#86868b] mt-0.5">{filteredClosedTables.length} sipariş listeleniyor</p>
      </div>

      {methodBlocks.map((block) => {
        const list = groups[block.key] ?? []
        if (list.length === 0) return null
        const Icon = block.icon
        const blockTotal = fromMinorUnits(list.reduce((s, ct) => s + toMinorUnits(ct.netAmount), 0))
        const currPage = pagesByMethod[block.key] || 1
        const pagedList = list.slice((currPage - 1) * pageSize, currPage * pageSize)
        return (
          <div key={block.key} className="border-b border-[#f0f0f0]">
            <div className={`px-4 py-2.5 ${block.headerBg} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${block.iconText}`} />
                <span className={`text-[13px] font-semibold ${block.titleText}`}>{block.label}</span>
                <span className={`text-[11px] ${block.iconText}`}>({list.length} sipariş)</span>
              </div>
              <span className={`text-[14px] font-bold ${block.titleText}`}>{"\u20BA"}{formatCurrency(blockTotal)}</span>
            </div>
            <div>
              {pagedList.map((ct, idx) => (
                <div key={ct.id} className={`flex items-center justify-between px-4 py-2 text-[12px] ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[#1d1d1f] font-medium">{ct.tableName}</span>
                    <span className="text-[#86868b]">{ct.waiter}</span>
                    <span className="text-[#aeaeb2]">{formatIstanbulDate(ct.closedAt)} {formatIstanbulTime(ct.closedAt)}</span>
                    {ct.payment.method === "split" && ct.payment.splitDetails && ct.payment.splitDetails.length > 0 && (
                      <span className="text-[11px] text-[#86868b]">
                        ({ct.payment.splitDetails.map((sd) => `${SPLIT_METHOD_LABELS[sd.method] || sd.method}: \u20BA${formatCurrency(sd.amount)}`).join(" + ")})
                      </span>
                    )}
                  </div>
                  <span className="font-semibold text-[#1d1d1f]">{"\u20BA"}{formatCurrency(ct.netAmount)}</span>
                </div>
              ))}
            </div>
            {list.length > pageSize && (
              <div className="px-4 pb-2.5">
                <PaginationBar
                  currentPage={currPage}
                  totalItems={list.length}
                  pageSize={pageSize}
                  onPageChange={(p) => setPagesByMethod((prev) => ({ ...prev, [block.key]: p }))}
                  itemLabel="sipariş"
                />
              </div>
            )}
          </div>
        )
      })}

      {filteredClosedTables.length === 0 && (
        <div className="py-10 text-center text-[13px] text-[#86868b]">Seçilen tarihte sipariş bulunmuyor</div>
      )}
    </div>
  )
}
