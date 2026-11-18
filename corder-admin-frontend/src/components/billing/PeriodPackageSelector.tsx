import { formatPeriodLong, formatPeriodShort } from "@/lib/money"
import { AlertCircle, Calendar, Check, CheckCircle2 } from "lucide-react"
import { CustomDatePicker, CustomMonthPicker } from "@/components/ui/custom-inputs"
import type { PackagePreset } from "./use-payment-form"

interface PeriodPackageSelectorProps {
  preset: PackagePreset
  onSelectPreset: (p: PackagePreset) => void
  startPeriod: string
  onStartPeriodChange: (p: string) => void
  defaultStartPeriod: string
  paidAtDate: string
  onPaidAtDateChange: (d: string) => void
  customPeriods: string[]
  customPickerRange: string[]
  alreadyPaidSet: Set<string>
  overdueList: string[]
  onToggleCustomPeriod: (per: string) => void
  selectedPeriods: string[]
  overlappingPeriods: string[]
  inputCls: string
}

export function PeriodPackageSelector({
  preset,
  onSelectPreset,
  startPeriod,
  onStartPeriodChange,
  defaultStartPeriod,
  paidAtDate,
  onPaidAtDateChange,
  customPeriods,
  customPickerRange,
  alreadyPaidSet,
  overdueList,
  onToggleCustomPeriod,
  selectedPeriods,
  overlappingPeriods,
  inputCls,
}: PeriodPackageSelectorProps) {
  return (
    <>
      <div>
        <label className="mb-1.5 block text-[12px] font-semibold text-[#1d1d1f]">
          1. Ödeme Kapsamı / Dönem Paketi Seçin
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
          {(
            [
              { id: 1, label: "1 Aylık" },
              { id: 3, label: "3 Aylık" },
              { id: 6, label: "6 Aylık" },
              { id: 12, label: "12 Aylık" },
              { id: "custom", label: "Özel Seçim" },
            ] as const
          ).map((opt) => {
            const active = preset === opt.id
            return (
              <button
                key={String(opt.id)}
                type="button"
                onClick={() => onSelectPreset(opt.id)}
                className={`h-9 rounded-xl border text-[12px] font-semibold transition-all ${
                  active
                    ? "border-[#e63462] bg-[#e63462] text-white shadow-xs"
                    : "border-[#e5e5ea] bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#ebebf0]"
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {preset !== "custom" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
              Başlangıç Dönemi (Ay / Yıl) *
            </label>
            <CustomMonthPicker
              value={startPeriod}
              onChange={(e) => {
                if (e.target.value) onStartPeriodChange(e.target.value)
              }}
              className={inputCls}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
              Tahsilatın Alındığı Tarih *
            </label>
            <CustomDatePicker
              value={paidAtDate}
              onChange={(e) => onPaidAtDateChange(e.target.value)}
              className={inputCls}
              required
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12px] font-medium text-[#1d1d1f]">
                Kapsanacak Ayları Tek Tek Seçin ({customPeriods.length} ay seçili)
              </label>
              <span className="text-[11px] text-[#86868b]">
                Yeşil aylar daha önce ödenmiştir
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 rounded-xl border border-[#e5e5ea] bg-[#f9f9fb] p-2.5 max-h-48 overflow-y-auto">
              {customPickerRange.map((per) => {
                const isPaidAlready = alreadyPaidSet.has(per)
                const isSelected = customPeriods.includes(per)
                const isOverdue = overdueList.includes(per)
                return (
                  <button
                    key={per}
                    type="button"
                    disabled={isPaidAlready}
                    onClick={() => onToggleCustomPeriod(per)}
                    className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-all flex items-center justify-center gap-1 ${
                      isPaidAlready
                        ? "bg-emerald-50 text-emerald-600/70 border border-emerald-200/60 cursor-not-allowed"
                        : isSelected
                          ? "bg-[#e63462] text-white border border-[#e63462]"
                          : isOverdue
                            ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                            : "bg-white text-[#1d1d1f] border border-[#e5e5ea] hover:border-[#86868b]"
                    }`}
                  >
                    {isPaidAlready && <Check className="h-3 w-3 shrink-0" />}
                    <span>{formatPeriodShort(per)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#1d1d1f]">
              Tahsilatın Alındığı Tarih *
            </label>
            <CustomDatePicker
              value={paidAtDate}
              onChange={(e) => onPaidAtDateChange(e.target.value)}
              className={inputCls}
              required
            />
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[#e5e5ea] bg-[#f9f9fb] p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#636366]">
            <Calendar className="h-3.5 w-3.5 text-[#e63462]" />
            Bu Ödemenin Kapsayacağı Dönemler ({selectedPeriods.length} Ay)
          </span>
          {overlappingPeriods.length > 0 && defaultStartPeriod !== startPeriod && (
            <button
              type="button"
              onClick={() => onStartPeriodChange(defaultStartPeriod)}
              className="text-[11px] font-semibold text-[#e63462] hover:underline"
            >
              İlk Açık Döneme Al ({formatPeriodShort(defaultStartPeriod)})
            </button>
          )}
        </div>
        {selectedPeriods.length === 0 ? (
          <p className="text-[12px] text-[#86868b]">Henüz dönem seçilmedi.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {selectedPeriods.map((per) => {
              const conflict = alreadyPaidSet.has(per)
              return (
                <span
                  key={per}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                    conflict
                      ? "bg-red-100 text-red-700 border border-red-300"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  }`}
                >
                  {conflict ? (
                    <AlertCircle className="h-3 w-3" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3" />
                  )}
                  {formatPeriodLong(per)}
                  {conflict ? " (Zaten Ödendi)" : ""}
                </span>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

