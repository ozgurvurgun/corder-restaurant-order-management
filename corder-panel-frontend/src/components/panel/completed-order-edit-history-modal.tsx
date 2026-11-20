import { useEffect } from "react"
import {
  ArrowRight,
  Clock,
  CreditCard,
  DoorClosed,
  FileText,
  History,
  RotateCcw,
  User,
  X,
  XCircle,
} from "lucide-react"
import type {
  ClosedTable,
  CompletedOrderEditChangeItem,
  CompletedOrderEditSplitPart,
} from "@/lib/panel-types"
import {
  formatCurrency,
  formatIstanbulDateTimeWithSeconds,
  fromMinorUnits,
  toMinorUnits,
} from "@/lib/format"

const METHOD_LABELS: Record<string, string> = {
  cash: "Nakit",
  "credit-card": "Kredi Kartı",
  "meal-card": "Yemek Kartı",
  multinet: "Multinet",
  split: "Çoklu Ödeme",
  ledger: "Cari",
}

function getMethodLabel(method?: string | null): string {
  if (!method) return "-"
  return METHOD_LABELS[method] || method
}

function formatSplitParts(parts?: CompletedOrderEditSplitPart[] | null): string {
  if (!Array.isArray(parts) || parts.length === 0) return "-"
  return parts
    .map((p) => `${getMethodLabel(p.method)}: ₺${formatCurrency(p.amount)}`)
    .join(" + ")
}

function renderChangeRow(change: CompletedOrderEditChangeItem, idx: number) {
  const adisyonBadge =
    change.orderIndex != null
      ? `Adisyon #${change.orderIndex}${change.orderNumber ? ` (${change.orderNumber})` : ""}`
      : change.orderNumber
        ? `Sipariş No: ${change.orderNumber}`
        : null

  switch (change.type) {
    case "item_cancelled":
      return (
        <div
          key={idx}
          className="rounded-xl border border-red-200/90 bg-red-50/70 px-3 py-2.5 text-[12px]"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <XCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
              <span className="font-semibold text-red-900">Ürün İptal Edildi:</span>
              <span className="font-bold text-[#1d1d1f]">{change.productName}</span>
              {adisyonBadge && (
                <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-semibold">
                  {adisyonBadge}
                </span>
              )}
            </div>
            {change.lineTotal != null && (
              <span className="font-bold text-red-700 whitespace-nowrap">
                -₺{formatCurrency(change.lineTotal)}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-red-800">
            {change.quantity != null && change.unitPrice != null && (
              <span>
                Adet/Birim: <strong>{change.quantity} Adet</strong> × ₺{formatCurrency(change.unitPrice)}
              </span>
            )}
            {change.cancelReason && (
              <span>
                İptal Nedeni: <strong className="underline decoration-red-300">&ldquo;{change.cancelReason}&rdquo;</strong>
              </span>
            )}
          </div>
        </div>
      )

    case "item_restored":
      return (
        <div
          key={idx}
          className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 text-[12px]"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <RotateCcw className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span className="font-semibold text-emerald-900">İptal Geri Alındı:</span>
              <span className="font-bold text-[#1d1d1f]">{change.productName}</span>
              {adisyonBadge && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                  {adisyonBadge}
                </span>
              )}
            </div>
            {change.lineTotal != null && (
              <span className="font-bold text-emerald-700 whitespace-nowrap">
                +₺{formatCurrency(change.lineTotal)}
              </span>
            )}
          </div>
        </div>
      )

    case "item_quantity_changed": {
      const prevTotal = change.previousLineTotal ?? 0
      const nextTotal = change.nextLineTotal ?? 0
      const deltaMinor = toMinorUnits(nextTotal) - toMinorUnits(prevTotal)
      return (
        <div
          key={idx}
          className="rounded-xl border border-blue-200/90 bg-blue-50/60 px-3 py-2.5 text-[12px]"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <FileText className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
              <span className="font-semibold text-blue-900">Ürün Adedi Değiştirildi:</span>
              <span className="font-bold text-[#1d1d1f]">{change.productName}</span>
              {adisyonBadge && (
                <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-semibold">
                  {adisyonBadge}
                </span>
              )}
            </div>
            <span
              className={`font-bold whitespace-nowrap ${
                deltaMinor >= 0 ? "text-blue-700" : "text-amber-700"
              }`}
            >
              {deltaMinor >= 0 ? "+" : "-"}₺{formatCurrency(fromMinorUnits(Math.abs(deltaMinor)))}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-blue-900">
            <span className="inline-flex items-center gap-1 font-semibold">
              <span>{change.previousQuantity} Adet</span>
              <ArrowRight className="w-3 h-3 text-blue-500" />
              <span>{change.nextQuantity} Adet</span>
            </span>
            {change.unitPrice != null && (
              <span className="text-blue-700/80">
                (Birim: ₺{formatCurrency(change.unitPrice)} • Satır: ₺{formatCurrency(prevTotal)} → ₺{formatCurrency(nextTotal)})
              </span>
            )}
          </div>
        </div>
      )
    }

    case "item_cancel_reason_changed":
      return (
        <div
          key={idx}
          className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-[12px] text-amber-900"
        >
          <span className="font-semibold">{change.productName}</span> iptal nedeni güncellendi:{" "}
          <span className="line-through opacity-75">{change.previousCancelReason || "-"}</span>{" "}
          → <strong>{change.cancelReason || "-"}</strong>
        </div>
      )

    case "payment_method_changed":
      if (change.previousMethod === change.nextMethod) return null
      return (
        <div
          key={idx}
          className="rounded-xl border border-purple-200/90 bg-purple-50/60 px-3 py-2.5 text-[12px]"
        >
          <div className="flex items-center gap-1.5 flex-wrap text-purple-950">
            <CreditCard className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
            <span className="font-semibold">Ödeme Yöntemi Değiştirildi:</span>
            <span className="px-2 py-0.5 rounded bg-white border border-purple-200 font-semibold">
              {getMethodLabel(change.previousMethod)}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-purple-500" />
            <span className="px-2 py-0.5 rounded bg-purple-600 text-white font-semibold">
              {getMethodLabel(change.nextMethod)}
            </span>
          </div>
        </div>
      )

    case "payment_split_changed":
      return (
        <div
          key={idx}
          className="rounded-xl border border-indigo-200/90 bg-indigo-50/60 px-3 py-2.5 text-[12px] text-indigo-950 space-y-1"
        >
          <div className="flex items-center gap-1.5 font-semibold text-indigo-900">
            <CreditCard className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
            <span>Çoklu Ödeme Dağılımı Güncellendi</span>
          </div>
          {change.previousSplit && change.previousSplit.length > 0 && (
            <p className="text-[11px] text-indigo-800/80">
              Önceki Dağılım: <span className="font-medium">{formatSplitParts(change.previousSplit)}</span>
            </p>
          )}
          <p className="text-[11px] text-indigo-950">
            Yeni Dağılım: <strong className="font-semibold">{formatSplitParts(change.nextSplit)}</strong>
          </p>
        </div>
      )

    case "ledger_customer_changed":
      return (
        <div
          key={idx}
          className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-[12px] text-amber-950"
        >
          <span className="font-semibold">Cari Müşteri Güncellendi:</span>{" "}
          <span>{change.previousCustomerName || "Seçili Değil"}</span>
          <ArrowRight className="inline w-3 h-3 mx-1 text-amber-600" />
          <strong>{change.nextCustomerName || "Kaldırıldı"}</strong>
        </div>
      )

    case "discount_changed":
      return (
        <div
          key={idx}
          className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-[12px] text-amber-950"
        >
          <span className="font-semibold">İndirim Tutarı Değişti:</span>{" "}
          ₺{formatCurrency(change.previousDiscountAmount ?? 0)} →{" "}
          <strong>₺{formatCurrency(change.nextDiscountAmount ?? 0)}</strong>
        </div>
      )

    case "net_amount_changed":
      return (
        <div
          key={idx}
          className="rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] px-3 py-2 text-[11.5px] text-[#1d1d1f] flex flex-wrap items-center justify-between gap-2"
        >
          <span className="text-[#636366] font-medium">Hesap Tutarı Güncellemesi:</span>
          <span className="font-semibold">
            ₺{formatCurrency(change.previousNetAmount ?? 0)}{" "}
            <ArrowRight className="inline w-3 h-3 mx-1 text-[#86868b]" />
            <span className="text-[#e63462] font-bold">
              ₺{formatCurrency(change.nextNetAmount ?? 0)}
            </span>
          </span>
        </div>
      )

    default:
      return null
  }
}

export function CompletedOrderEditHistoryModal(props: {
  closedTable: ClosedTable
  onClose: () => void
}) {
  const { closedTable, onClose } = props
  const history = closedTable.editHistory ?? []

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[88vh] overflow-hidden flex flex-col bg-white rounded-2xl shadow-2xl border border-[#d1d1d6]/70"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e8e8ed] bg-[#fafafa]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-[#1d1d1f]">
                {closedTable.tableName} - Kapanış Sonrası Düzenleme Geçmişi (Log)
              </h3>
              <p className="text-[11px] text-[#86868b]">
                Kapanış: {formatIstanbulDateTimeWithSeconds(closedTable.closedAt)} • Kapatan:{" "}
                <span className="font-medium text-[#1d1d1f]">{closedTable.closedBy}</span> •{" "}
                <span className="font-semibold text-amber-700">{history.length} Düzenleme</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#e8e8ed]/70 text-[#86868b]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {history.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-[#86868b]">
              Bu hesap kapandıktan sonra herhangi bir düzenleme yapılmamış.
            </div>
          ) : (
            <div className="relative pl-5 border-l-2 border-amber-300 space-y-5">
              {history.map((entry, idx) => {
                const netDeltaMinor =
                  toMinorUnits(entry.nextNetAmount) - toMinorUnits(entry.previousNetAmount)
                return (
                  <div
                    key={entry.id || idx}
                    className="relative rounded-2xl border border-[#e5e5ea] bg-white shadow-2xs overflow-hidden"
                  >
                    <span className="absolute -left-[27px] top-4 w-3.5 h-3.5 rounded-full bg-amber-500 ring-4 ring-amber-100" />

                    <div className="px-4 py-3 bg-[#f9f9fb] border-b border-[#ececf0] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-bold uppercase tracking-wide">
                          #{idx + 1}. Düzenleme
                        </span>
                        <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#1d1d1f]">
                          <User className="w-3.5 h-3.5 text-[#e63462]" />
                          {entry.editedBy || "Yönetici"}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#636366] bg-white px-2.5 py-1 rounded-lg border border-[#e5e5ea]">
                        <Clock className="w-3 h-3 text-amber-600" />
                        {formatIstanbulDateTimeWithSeconds(entry.editedAt)}
                      </span>
                    </div>

                    <div className="p-4 space-y-2.5">
                      {entry.changes && entry.changes.length > 0 ? (
                        entry.changes.map((ch, ci) => renderChangeRow(ch, ci))
                      ) : (
                        <div className="rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] px-3 py-2 text-[12px] text-[#636366]">
                          Ödeme/Hesap kaydı güncellendi ({getMethodLabel(entry.previousMethod)} →{" "}
                          {getMethodLabel(entry.nextMethod)})
                        </div>
                      )}

                      <div className="pt-2.5 mt-2 border-t border-[#f0f0f0] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#636366]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <DoorClosed className="w-3.5 h-3.5 text-[#86868b]" />
                          <span>Ödeme:</span>
                          {entry.previousMethod !== entry.nextMethod ? (
                            <>
                              <strong className="text-[#1d1d1f]">
                                {getMethodLabel(entry.previousMethod)}
                              </strong>
                              <ArrowRight className="w-3 h-3 text-[#86868b]" />
                              <strong className="text-[#1d1d1f]">
                                {getMethodLabel(entry.nextMethod)}
                              </strong>
                            </>
                          ) : (
                            <strong className="text-[#1d1d1f]">
                              {getMethodLabel(entry.nextMethod)}
                            </strong>
                          )}
                          {entry.nextSplit && entry.nextSplit.length > 0 && (
                            <span className="text-[#86868b]">
                              ({formatSplitParts(entry.nextSplit)})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span>Net Tutar:</span>
                          <strong className="text-[#1d1d1f]">
                            ₺{formatCurrency(entry.previousNetAmount)}
                          </strong>
                          <ArrowRight className="w-3 h-3 text-[#86868b]" />
                          <strong className="text-[#e63462]">
                            ₺{formatCurrency(entry.nextNetAmount)}
                          </strong>
                          {netDeltaMinor !== 0 && (
                            <span
                              className={`px-1.5 py-0.5 rounded font-semibold ${
                                netDeltaMinor > 0
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-red-50 text-red-700"
                              }`}
                            >
                              {netDeltaMinor > 0 ? "+" : "-"}₺
                              {formatCurrency(fromMinorUnits(Math.abs(netDeltaMinor)))}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[#e8e8ed] bg-[#fafafa] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-5 rounded-xl bg-[#1d1d1f] text-white text-[12.5px] font-semibold hover:bg-[#3a3a3c] transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  )
}

