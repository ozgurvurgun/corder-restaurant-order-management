import { useEffect, useState } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { Clock, ShieldCheck } from "lucide-react"

const CUTOFF_PRESETS = [
  { time: "02:00", label: "02:00" },
  { time: "03:00", label: "03:00" },
  { time: "04:00", label: "04:00 (Önerilen)" },
  { time: "05:00", label: "05:00" },
  { time: "06:00", label: "06:00" },
  { time: "23:59", label: "23:59 (Gece Yarısı)" },
]

export function AutoCloseShiftCard() {
  const { settings, updateSettings } = usePanelStore()
  const [enabled, setEnabled] = useState(
    settings.autoCloseShiftEnabled !== false,
  )
  const [cutoffTime, setCutoffTime] = useState(
    settings.autoCloseShiftTime || "04:00",
  )

  useEffect(() => {
    setEnabled(settings.autoCloseShiftEnabled !== false)
    setCutoffTime(settings.autoCloseShiftTime || "04:00")
  }, [settings.autoCloseShiftEnabled, settings.autoCloseShiftTime])

  const handleToggle = (nextEnabled: boolean) => {
    setEnabled(nextEnabled)
    updateSettings({
      autoCloseShiftEnabled: nextEnabled,
      autoCloseShiftTime: cutoffTime,
    })
  }

  const handleSelectTime = (nextTime: string) => {
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(nextTime)) return
    setCutoffTime(nextTime)
    updateSettings({
      autoCloseShiftEnabled: enabled,
      autoCloseShiftTime: nextTime,
    })
  }

  return (
    <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4 transition-all">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#e63462]/10 text-[#e63462]">
            <Clock className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[13.5px] font-semibold text-[#1d1d1f]">
                Otomatik Gün Sonu Kasa Kapanışı &amp; Açık Masa Devri (Rollover)
              </h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  enabled
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-[#f5f5f7] text-[#86868b]"
                }`}
              >
                {enabled ? `Aktif · Her Gün ${cutoffTime}` : "Kapalı"}
              </span>
            </div>
            <p className="text-[11px] text-[#86868b]">
              Kasa personel tarafından kapatılmazsa belirlenen gün sonu saatinde otomatik kapatılır; açık masalar zorla kapatılmaz ve yeni vardiyaya devredilir.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleToggle(!enabled)}
          className={`h-6 w-11 flex-shrink-0 rounded-full p-0.5 transition-colors ${
            enabled ? "bg-[#e63462]" : "bg-[#d1d1d6]"
          }`}
        >
          <div
            className={`h-5 w-5 rounded-full bg-white transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="mt-3.5 pt-3.5 border-t border-[#f0f0f0] flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-[#86868b]">
              Gün Sonu Otomatik Kapanış Saati (İstanbul Saati)
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {CUTOFF_PRESETS.map((p) => (
                <button
                  key={p.time}
                  type="button"
                  onClick={() => handleSelectTime(p.time)}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    cutoffTime === p.time
                      ? "border-[#e63462] bg-[#e63462]/10 text-[#e63462]"
                      : "border-[#e5e5ea] bg-[#f5f5f7] text-[#636366] hover:bg-[#e8e8ed]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <input
                type="time"
                value={cutoffTime}
                onChange={(e) => handleSelectTime(e.target.value)}
                className="h-[28px] rounded-lg border border-[#d1d1d6] bg-[#f5f5f7] px-2.5 text-[11.5px] font-semibold text-[#1d1d1f] outline-none focus:border-[#e63462] focus:bg-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50/70 border border-emerald-200/70 px-3 py-1.5 text-[11px] text-emerald-800">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span>
              Kapanış anında ödeme alınıyorsa sistem son işlemden 15 dk sonra kasayı güvenli şekilde kapatır.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
