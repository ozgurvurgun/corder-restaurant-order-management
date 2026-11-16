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

function formatCurrency(n: number) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2 })
}
function formatTime(d: Date) {
  return new Date(d).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}
function formatFullDate(d: Date) {
  return new Date(d).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export interface ShiftTotalsSummary {
  totalRevenue: number
  totalCash: number
  totalCard: number
  totalMealCard: number
  totalMultinet: number
  totalLedger: number
}

export function ZReportSection(props: {
  settings: RestaurantSettings
  currentShift: CashShift | null
  shiftTotals: ShiftTotalsSummary
  todaysClosedCount: number
}) {
  const { settings, currentShift, shiftTotals, todaysClosedCount } = props
  const zReportRef = useRef<HTMLDivElement>(null)

  const handlePrintZReport = () => {
    if (!zReportRef.current) return
    const printContent = zReportRef.current.innerHTML
    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Z Raporu</title>
            <style>
              body { font-family: 'Courier New', monospace; padding: 20px; max-width: 300px; margin: 0 auto; }
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

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={handlePrintZReport}
          className="h-[34px] px-4 flex items-center gap-2 bg-[#1d1d1f] text-white rounded-lg text-[12px] font-medium hover:bg-[#3a3a3c] transition-colors"
        >
          <Printer className="w-3.5 h-3.5" /> Z Raporu Yazdır
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
          <p className="text-[11px] text-[#86868b] mt-1">{settings.address}</p>
          <p className="text-[11px] text-[#86868b]">VKN: {settings.taxId}</p>
          <div className="mt-3 h-px bg-[#d1d1d6]/40" />
          <p className="text-[14px] font-bold text-[#1d1d1f] mt-3">Z RAPORU</p>
          <p className="text-[12px] text-[#86868b]">
            {new Date().toLocaleDateString("tr-TR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
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
            <span className="text-[#86868b]">Kapanan Masa Sayısı</span>
            <span className="font-bold text-[#1d1d1f]">{todaysClosedCount}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-dashed border-[#d1d1d6]">
            <span className="text-[#86868b]">İşlem Sayısı</span>
            <span className="font-bold text-[#1d1d1f]">
              {currentShift?.transactionCount || 0}
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
              {formatCurrency(currentShift?.openingBalance || 0)}
            </span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-[#86868b]">Nakit Giriş</span>
            <span className="font-medium text-green-600">
              +{"\u20BA"}
              {formatCurrency(currentShift?.cashIn || 0)}
            </span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-[#86868b]">Nakit Çıkış</span>
            <span className="font-medium text-red-500">
              -{"\u20BA"}
              {formatCurrency(currentShift?.cashOut || 0)}
            </span>
          </div>
          <div className="flex justify-between py-1.5 border-t border-[#d1d1d6] font-bold">
            <span className="text-[#1d1d1f]">Kasada Beklenen</span>
            <span className="text-[#e63462]">
              {"\u20BA"}
              {formatCurrency(
                (currentShift?.openingBalance || 0) +
                  (currentShift?.cashIn || 0) -
                  (currentShift?.cashOut || 0),
              )}
            </span>
          </div>
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
                {formatCurrency(list.reduce((s, ct) => s + ct.netAmount, 0))}
              </span>
            </div>
            <div className="max-h-[200px] overflow-auto">
              {list.map((ct, idx) => (
                <div
                  key={ct.id}
                  className={`flex items-center justify-between px-4 py-2 text-[12px] ${
                    idx % 2 === 1 ? "bg-[#fafafa]" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[#1d1d1f] font-medium">
                      {ct.tableName}
                    </span>
                    <span className="text-[#86868b]">{ct.waiter}</span>
                    <span className="text-[#aeaeb2]">
                      {formatFullDate(ct.closedAt)} {formatTime(ct.closedAt)}
                    </span>
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
