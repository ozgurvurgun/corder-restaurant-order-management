import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import type {
  CancelledItem,
  ClosedTable,
  LedgerCustomer,
} from "@/lib/panel-types"
import {
  formatCurrency,
  formatIstanbulDateTime,
  fromMinorUnits,
  toMinorUnits,
} from "@/lib/format"

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Nakit",
  "credit-card": "Kredi Kartı",
  "meal-card": "Yemek Kartı",
  multinet: "Multinet",
  split: "Çoklu Ödeme",
  ledger: "Cari",
}

export function HistoryTab(props: {
  closedTables: ClosedTable[]
  cancelledItems: CancelledItem[]
  ledgerCustomers: LedgerCustomer[]
}) {
  const { closedTables, cancelledItems, ledgerCustomers } = props
  const [showClosedDetail, setShowClosedDetail] = useState(false)
  const [showCancelledDetail, setShowCancelledDetail] = useState(false)

  const formatPaymentLabel = (ct: ClosedTable) => {
    if (ct.payment.method === "ledger") {
      const n =
        ct.payment.ledgerCustomerName?.trim() ||
        ledgerCustomers
          .find((c) => c.id === ct.payment.ledgerCustomerId)
          ?.name?.trim()
      return n ? `Cari (${n})` : "Cari"
    }
    return PAYMENT_METHOD_LABELS[ct.payment.method] || ct.payment.method
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
        <button
          onClick={() => setShowClosedDetail(!showClosedDetail)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#f9f9fb] transition-colors"
        >
          <h3 className="text-[13px] font-semibold text-[#1d1d1f]">
            Kapanmış Masalar ({closedTables.length})
          </h3>
          {showClosedDetail ? (
            <ChevronUp className="w-4 h-4 text-[#86868b]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#86868b]" />
          )}
        </button>
        {showClosedDetail && (
          <table className="w-full">
            <thead>
              <tr className="border-t border-b border-[#f0f0f0] bg-[#f9f9f9]">
                <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                  Masa
                </th>
                <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                  Garson
                </th>
                <th className="text-right px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                  Tutar
                </th>
                <th className="text-right px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                  İndirim
                </th>
                <th className="text-right px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                  Net
                </th>
                <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                  Ödeme
                </th>
                <th className="text-right px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                  Saat
                </th>
              </tr>
            </thead>
            <tbody>
              {closedTables.map((ct, idx) => (
                <tr
                  key={ct.id}
                  className={`border-b border-[#f0f0f0] ${
                    idx % 2 === 1 ? "bg-[#fafafa]" : ""
                  }`}
                >
                  <td className="px-4 py-2 text-[12px] font-medium text-[#1d1d1f]">
                    {ct.tableName}
                  </td>
                  <td className="px-4 py-2 text-[12px] text-[#86868b]">
                    {ct.waiter}
                  </td>
                  <td className="px-4 py-2 text-[12px] text-right text-[#1d1d1f]">
                    {"\u20BA"}
                    {formatCurrency(ct.totalAmount)}
                  </td>
                  <td className="px-4 py-2 text-[12px] text-right text-red-500">
                    {ct.discountAmount > 0
                      ? `-\u20BA${formatCurrency(ct.discountAmount)}`
                      : "-"}
                  </td>
                  <td className="px-4 py-2 text-[12px] text-right font-semibold text-[#e63462]">
                    {"\u20BA"}
                    {formatCurrency(ct.netAmount)}
                  </td>
                  <td className="px-4 py-2 text-[12px] text-[#86868b]">
                    {formatPaymentLabel(ct)}
                  </td>
                  <td className="px-4 py-2 text-[12px] text-right text-[#86868b]">
                    {formatIstanbulDateTime(ct.closedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
        <button
          onClick={() => setShowCancelledDetail(!showCancelledDetail)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#f9f9fb] transition-colors"
        >
          <h3 className="text-[13px] font-semibold text-[#1d1d1f]">
            İptal Edilen Ürünler ({cancelledItems.length})
          </h3>
          {showCancelledDetail ? (
            <ChevronUp className="w-4 h-4 text-[#86868b]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#86868b]" />
          )}
        </button>
        {showCancelledDetail && (
          <table className="w-full">
            <thead>
              <tr className="border-t border-b border-[#f0f0f0] bg-[#f9f9f9]">
                <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                  Ürün
                </th>
                <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                  Masa
                </th>
                <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                  Sebep
                </th>
                <th className="text-left px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                  İptal Eden
                </th>
                <th className="text-right px-4 py-2 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                  Tutar
                </th>
              </tr>
            </thead>
            <tbody>
              {cancelledItems.map((ci, idx) => (
                <tr
                  key={ci.id}
                  className={`border-b border-[#f0f0f0] ${
                    idx % 2 === 1 ? "bg-[#fafafa]" : ""
                  }`}
                >
                  <td className="px-4 py-2 text-[12px] font-medium text-[#1d1d1f]">
                    {ci.orderItem.productName} x{ci.orderItem.quantity}
                  </td>
                  <td className="px-4 py-2 text-[12px] text-[#86868b]">
                    {ci.tableName}
                  </td>
                  <td className="px-4 py-2 text-[12px] text-[#86868b]">
                    {ci.reason}
                  </td>
                  <td className="px-4 py-2 text-[12px] text-[#86868b]">
                    {ci.cancelledBy}
                  </td>
                  <td className="px-4 py-2 text-[12px] text-right text-red-500">
                    {"\u20BA"}
                    {formatCurrency(
                      fromMinorUnits(
                        toMinorUnits(ci.orderItem.price) * ci.orderItem.quantity,
                      ),
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
