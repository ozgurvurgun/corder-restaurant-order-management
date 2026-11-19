import { useEffect } from "react"
import type { LiveOrderDto, LiveTableDto } from "@/lib/types"
import {
  computeTableTotals,
  formatIstanbulTime,
  formatMoney,
  fromMinorUnits,
  getWaiterDisplayName,
  toMinorUnits,
} from "@/lib/format"
import { Percent, User, X } from "lucide-react"

interface LiveTableDetailSheetProps {
  table: LiveTableDto
  orders: LiveOrderDto[]
  onClose: () => void
}

export function LiveTableDetailSheet({
  table,
  orders,
  onClose,
}: LiveTableDetailSheetProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  const totals = computeTableTotals(orders, table.discount)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#e5e5ea]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#f0f0f0] pb-3">
          <div>
            <h3 className="text-[15px] font-semibold text-[#1d1d1f]">
              {table.name} - Canlı Adisyon Detayı
            </h3>
            <p className="text-[11px] text-[#86868b]">
              {totals.discountAmount > 0 ? (
                <>
                  Ara Toplam: ₺{formatMoney(totals.subtotal)} • İndirim: -₺
                  {formatMoney(totals.discountAmount)} •{" "}
                  <strong className="text-[#1d1d1f]">
                    Net: ₺{formatMoney(totals.netTotal)}
                  </strong>
                </>
              ) : (
                <>Toplam: ₺{formatMoney(totals.netTotal)}</>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f5f7]"
          >
            <X className="h-4 w-4 text-[#86868b]" />
          </button>
        </div>

        {table.discount && totals.discountAmount > 0 && (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
            <span className="flex items-center gap-1.5 font-semibold">
              <Percent className="h-3.5 w-3.5 text-amber-600" />
              {table.discount.type === "complimentary"
                ? "Tam İkram (%100)"
                : table.discount.type === "percent"
                  ? `%${table.discount.value} İskonto Tanımlı`
                  : `₺${formatMoney(table.discount.value)} Tutar İskontosu`}
            </span>
            <span className="font-bold">-₺{formatMoney(totals.discountAmount)}</span>
          </div>
        )}

        <div className="mt-3 max-h-[55vh] overflow-y-auto space-y-3">
          {orders.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[#86868b]">
              Bu masada açık adisyon bulunmuyor.
            </p>
          ) : (
            orders.map((ord, idx) => {
              const waiter = getWaiterDisplayName(ord) || "Personel"
              return (
                <div
                  key={ord.id}
                  className="rounded-2xl border border-[#e5e5ea] bg-[#f9f9fb] p-3"
                >
                  <div className="flex items-center justify-between text-[11px] text-[#86868b] mb-2">
                    <span className="flex items-center gap-1 font-semibold text-[#1d1d1f]">
                      <User className="h-3 w-3" /> Adisyon #{idx + 1} ({waiter})
                    </span>
                    <span>{formatIstanbulTime(ord.createdAt)}</span>
                  </div>
                  <div className="divide-y divide-[#e5e5ea]">
                    {ord.items.filter((item) => item.status !== "paid").map((item) => {
                      const lineTotal = fromMinorUnits(
                        toMinorUnits(item.price) * Number(item.quantity || 0)
                      )
                      const isCancelled = item.status === "cancelled"
                      const isLedger = item.status === "ledger"
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between py-1.5 text-[12px] gap-2"
                        >
                          <div className="min-w-0">
                            <span
                              className={
                                isCancelled
                                  ? "line-through text-red-400"
                                  : isLedger
                                    ? "line-through text-purple-500"
                                    : "font-medium text-[#1d1d1f]"
                              }
                            >
                              {item.quantity}x {item.productName}
                            </span>
                            {isCancelled && (
                              <span className="ml-1.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                                İptal
                              </span>
                            )}
                            {isLedger && (
                              <span className="ml-1.5 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">
                                Cariye Aktarıldı
                              </span>
                            )}
                            {item.note && (
                              <p className="text-[10px] text-[#86868b] italic">
                                Not: {item.note}
                              </p>
                            )}
                          </div>
                          <span
                            className={`flex-shrink-0 font-semibold tabular-nums ${
                              isCancelled || isLedger
                                ? "text-[#86868b] line-through"
                                : "text-[#1d1d1f]"
                            }`}
                          >
                            ₺{formatMoney(lineTotal)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
