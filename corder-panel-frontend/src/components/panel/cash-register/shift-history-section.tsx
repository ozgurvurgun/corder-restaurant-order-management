import { useRef } from "react"
import {
  Banknote,
  BookUser,
  CreditCard,
  Printer,
  Receipt,
  UtensilsCrossed,
} from "lucide-react"
import type {
  CashShift,
  ClosedTable,
  RestaurantSettings,
} from "@/lib/panel-types"
import {
  formatCurrency,
  formatIstanbulDate,
  formatIstanbulDateTime,
  formatIstanbulTime,
  fromMinorUnits,
  toMinorUnits,
} from "@/lib/format"

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
  shiftClosedCount: number
}) {
  const {
    settings,
    selectedShift,
    allShifts,
    onSelectShift,
    shiftTotals,
    shiftClosedCount,
  } = props
  const zReportRef = useRef<HTMLDivElement>(null)
  const isOpenShift = selectedShift?.status === "open"
  const reportTitle = isOpenShift
    ? "X RAPORU (ANLIK VARDİYA ÖZETİ)"
    : "Z RAPORU (VARDİYA KAPANIŞ RAPORU)"

  const handlePrintZReport = () => {
    if (!zReportRef.current) return
    const printContent = zReportRef.current.innerHTML
    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${isOpenShift ? "X Raporu" : "Z Raporu"}</title>
            <style>
              body { font-family: 'Courier New', monospace; padding: 20px; max-width: 320px; margin: 0 auto; }
              .text-center { text-align: center; }
              .font-bold { font-weight: bold; }
              .border-b { border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
              .flex { display: flex; justify-content: space-between; padding: 4px 0; }
              .text-sm { font-size: 12px; }
              .text-lg { font-size: 16px; }
              .mt-2 { margin-top: 8px; }
              .mb-2 { margin-bottom: 8px; }
              @media print { body { margin: 0; padding: 10px; } }
            </style>
          </head>
          <body>${printContent}</body>
        </html>
      `)
      printWindow.document.close()
      printWindow.print()
    }
  }

  if (!selectedShift) {
    return (
      <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-10 text-center text-[13px] text-[#86868b]">
        Henüz görüntülenebilecek açık veya kapalı vardiya kaydı bulunmuyor.
      </div>
    )
  }

  const expectedMinorUnits =
    toMinorUnits(selectedShift.openingBalance || 0) +
    toMinorUnits(selectedShift.cashIn || 0) -
    toMinorUnits(selectedShift.cashOut || 0)
  const expectedCash = fromMinorUnits(expectedMinorUnits)
  const hasClosingBalance =
    selectedShift.status === "closed" && selectedShift.closingBalance != null
  const closingDiffMinorUnits = hasClosingBalance
    ? toMinorUnits(selectedShift.closingBalance || 0) - expectedMinorUnits
    : 0

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-[#86868b]">Vardiya:</span>
          <select
            value={selectedShift.id}
            onChange={(e) => onSelectShift(e.target.value)}
            className="h-[34px] px-3 text-[12px] bg-white rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
          >
            {allShifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.status === "open"
                  ? `Açık Vardiya — ${s.openedBy} (${formatIstanbulDateTime(s.openedAt)})`
                  : `Kapalı — ${s.openedBy} (${formatIstanbulDateTime(s.openedAt)} - ${s.closedAt ? formatIstanbulTime(s.closedAt) : "-"})`}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handlePrintZReport}
          className="h-[34px] px-4 flex items-center gap-2 bg-[#1d1d1f] text-white rounded-lg text-[12px] font-medium hover:bg-[#3a3a3c] transition-colors"
        >
          <Printer className="w-3.5 h-3.5" />{" "}
          {isOpenShift ? "X Raporu Yazdır" : "Z Raporu Yazdır"}
        </button>
      </div>

      <div
        ref={zReportRef}
        className="bg-white rounded-xl border border-[#d1d1d6]/60 p-6"
      >
        <div className="text-center mb-6">
          <h3 className="text-[18px] font-bold text-[#1d1d1f]">
            {settings.name}
          </h3>
          {settings.address && (
            <p className="text-[11px] text-[#86868b] mt-1">{settings.address}</p>
          )}
          {settings.taxId && (
            <p className="text-[11px] text-[#86868b]">VKN: {settings.taxId}</p>
          )}
          <div className="mt-3 h-px bg-[#d1d1d6]/40" />
          <p className="text-[14px] font-bold text-[#1d1d1f] mt-3">
            {reportTitle}
          </p>
          <p className="text-[11px] text-[#86868b] mt-1">
            Açılış: {formatIstanbulDateTime(selectedShift.openedAt)} (
            {selectedShift.openedBy})
          </p>
          {selectedShift.closedAt && (
            <p className="text-[11px] text-[#86868b]">
              Kapanış: {formatIstanbulDateTime(selectedShift.closedAt)} (
              {selectedShift.closedBy || "-"})
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 text-[13px]">
          <div className="flex justify-between py-1.5 border-b border-dashed border-[#d1d1d6]">
            <span className="text-[#86868b]">Toplam Satış</span>
            <span className="font-bold text-[#1d1d1f]">
              {"\u20BA"}
              {formatCurrency(shiftTotals.totalRevenue || 0)}
            </span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-dashed border-[#d1d1d6]">
            <span className="text-[#86868b]">Kapanan Adisyon Sayısı</span>
            <span className="font-bold text-[#1d1d1f]">{shiftClosedCount}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-dashed border-[#d1d1d6]">
            <span className="text-[#86868b]">Kasa İşlem Sayısı</span>
            <span className="font-bold text-[#1d1d1f]">
              {selectedShift.transactionCount || 0}
            </span>
          </div>

          <div className="mt-2 mb-1">
            <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
              Ödeme Dağılımı
            </span>
          </div>
          {[
            { label: "Nakit", value: shiftTotals.totalCash || 0 },
            { label: "Kredi Kartı", value: shiftTotals.totalCard || 0 },
            { label: "Yemek Kartı", value: shiftTotals.totalMealCard || 0 },
            { label: "Multinet", value: shiftTotals.totalMultinet || 0 },
            { label: "Cariye Atılan", value: shiftTotals.totalLedger || 0 },
          ].map((row) => (
            <div key={row.label} className="flex justify-between py-1">
              <span className="text-[#86868b]">{row.label}</span>
              <span className="font-medium text-[#1d1d1f]">
                {"\u20BA"}
                {formatCurrency(row.value)}
              </span>
            </div>
          ))}

          <div className="mt-2 h-px bg-[#d1d1d6]/40" />
          <div className="mt-2 mb-1">
            <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
              Kasa Hareketi
            </span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-[#86868b]">Açılış Bakiye</span>
            <span className="font-medium text-[#1d1d1f]">
              {"\u20BA"}
              {formatCurrency(selectedShift.openingBalance || 0)}
            </span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-[#86868b]">Nakit Giriş</span>
            <span className="font-medium text-green-600">
              +{"\u20BA"}
              {formatCurrency(selectedShift.cashIn || 0)}
            </span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-[#86868b]">Nakit Çıkış</span>
            <span className="font-medium text-red-500">
              -{"\u20BA"}
              {formatCurrency(selectedShift.cashOut || 0)}
            </span>
          </div>
          <div className="flex justify-between py-1.5 border-t border-[#d1d1d6] font-bold">
            <span className="text-[#1d1d1f]">Kasada Beklenen</span>
            <span className="text-[#e63462]">
              {"\u20BA"}
              {formatCurrency(expectedCash)}
            </span>
          </div>
          {hasClosingBalance && (
            <>
              <div className="flex justify-between py-1 font-semibold">
                <span className="text-[#1d1d1f]">Sayılan Kasa (Kapanış)</span>
                <span className="text-[#1d1d1f]">
                  {"\u20BA"}
                  {formatCurrency(selectedShift.closingBalance || 0)}
                </span>
              </div>
              <div className="flex justify-between py-1 font-semibold">
                <span className="text-[#86868b]">Kasa Farkı</span>
                <span
                  className={
                    closingDiffMinorUnits === 0
                      ? "text-green-600"
                      : closingDiffMinorUnits > 0
                        ? "text-blue-600"
                        : "text-red-600"
                  }
                >
                  {closingDiffMinorUnits === 0
                    ? `Tam (\u20BA0,00)`
                    : closingDiffMinorUnits > 0
                      ? `+\u20BA${formatCurrency(fromMinorUnits(closingDiffMinorUnits))} (Fazla)`
                      : `-\u20BA${formatCurrency(fromMinorUnits(Math.abs(closingDiffMinorUnits)))} (Açık)`}
                </span>
              </div>
            </>
          )}
          {selectedShift.notes && (
            <div className="mt-2 pt-2 border-t border-dashed border-[#d1d1d6] text-[12px] text-[#86868b]">
              Not: {selectedShift.notes}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export function DetailReportSection(props: {
  filteredClosedTables: ClosedTable[]
}) {
  const { filteredClosedTables } = props

  const groups: Record<string, ClosedTable[]> = {
    cash: [],
    "credit-card": [],
    "meal-card": [],
    multinet: [],
    split: [],
    ledger: [],
  }
  filteredClosedTables.forEach((ct) => {
    if (groups[ct.payment.method]) {
      groups[ct.payment.method].push(ct)
    }
  })

  const methodBlocks = [
    {
      key: "cash",
      label: "Nakit",
      icon: Banknote,
      headerBg: "bg-green-50",
      iconText: "text-green-600",
      titleText: "text-green-700",
    },
    {
      key: "credit-card",
      label: "Kredi Kartı",
      icon: CreditCard,
      headerBg: "bg-blue-50",
      iconText: "text-blue-600",
      titleText: "text-blue-700",
    },
    {
      key: "meal-card",
      label: "Yemek Kartı",
      icon: UtensilsCrossed,
      headerBg: "bg-purple-50",
      iconText: "text-purple-600",
      titleText: "text-purple-700",
    },
    {
      key: "multinet",
      label: "Multinet",
      icon: CreditCard,
      headerBg: "bg-amber-50",
      iconText: "text-amber-600",
      titleText: "text-amber-700",
    },
    {
      key: "split",
      label: "Çoklu Ödeme",
      icon: Receipt,
      headerBg: "bg-gray-100",
      iconText: "text-gray-600",
      titleText: "text-gray-700",
    },
    {
      key: "ledger",
      label: "Cari",
      icon: BookUser,
      headerBg: "bg-rose-50",
      iconText: "text-rose-600",
      titleText: "text-rose-800",
    },
  ]

  return (
    <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
      <div className="px-4 py-3 bg-[#f9f9f9] border-b border-[#f0f0f0]">
        <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
          Detay Raporu - Ödeme Yöntemine Göre
        </h3>
        <p className="text-[11px] text-[#86868b] mt-0.5">
          {filteredClosedTables.length} sipariş listeleniyor
        </p>
      </div>

      {methodBlocks.map((block) => {
        const list = groups[block.key] ?? []
        if (list.length === 0) return null
        const Icon = block.icon
        const blockTotal = fromMinorUnits(
          list.reduce((s, ct) => s + toMinorUnits(ct.netAmount), 0),
        )
        return (
          <div key={block.key} className="border-b border-[#f0f0f0]">
            <div
              className={`px-4 py-2.5 ${block.headerBg} flex items-center justify-between`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${block.iconText}`} />
                <span className={`text-[13px] font-semibold ${block.titleText}`}>
                  {block.label}
                </span>
                <span className={`text-[11px] ${block.iconText}`}>
                  ({list.length} sipariş)
                </span>
              </div>
              <span className={`text-[14px] font-bold ${block.titleText}`}>
                {"\u20BA"}
                {formatCurrency(blockTotal)}
              </span>
            </div>
            <div className="max-h-[220px] overflow-auto">
              {list.map((ct, idx) => (
                <div
                  key={ct.id}
                  className={`flex items-center justify-between px-4 py-2 text-[12px] ${
                    idx % 2 === 1 ? "bg-[#fafafa]" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[#1d1d1f] font-medium">
                      {ct.tableName}
                    </span>
                    <span className="text-[#86868b]">{ct.waiter}</span>
                    <span className="text-[#aeaeb2]">
                      {formatIstanbulDate(ct.closedAt)}{" "}
                      {formatIstanbulTime(ct.closedAt)}
                    </span>
                    {ct.payment.method === "split" &&
                      ct.payment.splitDetails &&
                      ct.payment.splitDetails.length > 0 && (
                        <span className="text-[11px] text-[#86868b]">
                          (
                          {ct.payment.splitDetails
                            .map(
                              (sd) =>
                                `${SPLIT_METHOD_LABELS[sd.method] || sd.method}: \u20BA${formatCurrency(sd.amount)}`,
                            )
                            .join(" + ")}
                          )
                        </span>
                      )}
                  </div>
                  <span className="font-semibold text-[#1d1d1f]">
                    {"\u20BA"}
                    {formatCurrency(ct.netAmount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {filteredClosedTables.length === 0 && (
        <div className="py-10 text-center text-[13px] text-[#86868b]">
          Seçilen tarihte sipariş bulunmuyor
        </div>
      )}
    </div>
  )
}
