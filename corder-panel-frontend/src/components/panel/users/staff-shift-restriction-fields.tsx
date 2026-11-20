import { Clock } from "lucide-react"
import { CustomTimePicker } from "@/components/ui/custom-time-picker"

function computeEffectiveEndPreview(
  endTime: string,
  offsetMinutes: number
): string | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(endTime.trim())
  if (!match) return null
  const baseMins = Number(match[1]) * 60 + Number(match[2])
  const effMins = ((baseMins + (Number(offsetMinutes) || 0)) % 1440 + 1440) % 1440
  const h = Math.floor(effMins / 60)
  const m = effMins % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export interface StaffShiftRestrictionFieldsProps {
  enabled: boolean
  startTime: string
  endTime: string
  cutoffOffsetMinutes: number
  onChangeEnabled: (enabled: boolean) => void
  onChangeStartTime: (val: string) => void
  onChangeEndTime: (val: string) => void
  onChangeCutoffOffsetMinutes: (val: number) => void
}

export function StaffShiftRestrictionFields({
  enabled,
  startTime,
  endTime,
  cutoffOffsetMinutes,
  onChangeEnabled,
  onChangeStartTime,
  onChangeEndTime,
  onChangeCutoffOffsetMinutes,
}: StaffShiftRestrictionFieldsProps) {
  const effectiveEnd = computeEffectiveEndPreview(endTime, cutoffOffsetMinutes)
  const mode: "before" | "exact" | "after" =
    cutoffOffsetMinutes < 0 ? "before" : cutoffOffsetMinutes > 0 ? "after" : "exact"
  const absMinutes = Math.abs(cutoffOffsetMinutes)

  const handleModeChange = (nextMode: "before" | "exact" | "after") => {
    if (nextMode === "exact") {
      onChangeCutoffOffsetMinutes(0)
    } else if (nextMode === "before") {
      onChangeCutoffOffsetMinutes(-(absMinutes || 30))
    } else {
      onChangeCutoffOffsetMinutes(absMinutes || 30)
    }
  }

  const handleAbsMinutesChange = (raw: string) => {
    const num = Math.max(0, Math.min(360, Math.round(Number(raw) || 0)))
    if (mode === "before") onChangeCutoffOffsetMinutes(-num)
    else if (mode === "after") onChangeCutoffOffsetMinutes(num)
    else onChangeCutoffOffsetMinutes(0)
  }

  return (
    <div className="sm:col-span-2 rounded-xl border border-[#e5e5ea] bg-[#f9f9fb] p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e63462]/10 text-[#e63462]">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#1d1d1f]">
              Mesai Saati &amp; Aşım Kısıtlaması (El Terminali)
            </p>
            <p className="text-[11px] text-[#86868b]">
              Açık olduğunda personel yalnızca çalışma saatleri içinde terminale girebilir; süre dolduğunda anında terminalden düşürülür.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChangeEnabled(!enabled)}
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
        <div className="space-y-3 pt-2 border-t border-[#e5e5ea]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#1d1d1f] mb-1">
                Mesai Başlangıç Saati
              </label>
              <CustomTimePicker
                value={startTime}
                onValueChange={onChangeStartTime}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#1d1d1f] mb-1">
                Mesai Bitiş Saati
              </label>
              <CustomTimePicker
                value={endTime}
                onValueChange={onChangeEndTime}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-semibold text-[#1d1d1f]">
              Bitiş Aşımı / Erişim Kesim Kuralı
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              {[
                { id: "before" as const, label: "Bitişten Önce Kes (Örn: 21:00 -> 20:30)" },
                { id: "exact" as const, label: "Tam Bitiş Saatinde Kes" },
                { id: "after" as const, label: "Bitişe Ek Süre Tanı (Örn: 21:00 -> 21:30)" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleModeChange(opt.id)}
                  className={`rounded-lg border px-2.5 py-2 text-[11px] font-semibold transition-all ${
                    mode === opt.id
                      ? "border-[#e63462] bg-[#e63462]/10 text-[#e63462]"
                      : "border-[#e5e5ea] bg-white text-[#636366] hover:bg-[#f5f5f7]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {mode !== "exact" && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[12px] text-[#636366]">
                  {mode === "before"
                    ? "Mesai bitişinden kaç dakika önce erişim sonlansın:"
                    : "Mesai bitişine kaç dakika ek tolerans eklensin:"}
                </span>
                <input
                  type="number"
                  min={1}
                  max={360}
                  value={absMinutes || 30}
                  onChange={(e) => handleAbsMinutesChange(e.target.value)}
                  className="w-20 h-8 rounded-lg border border-[#d1d1d6] bg-white px-2.5 text-[12px] font-semibold text-[#1d1d1f] text-center"
                />
                <span className="text-[12px] font-medium text-[#1d1d1f]">dakika</span>
              </div>
            )}
          </div>

          {startTime && effectiveEnd && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-[11.5px] font-medium text-emerald-900">
              Aktif Terminal Erişimi:{" "}
              <span className="font-bold">
                {startTime} - {effectiveEnd}
              </span>{" "}
              (Saat <span className="font-bold">{effectiveEnd}</span> olduğu anda terminalden otomatik düşürülür ve{" "}
              <span className="font-bold">{startTime}</span> saatine kadar giriş yapamaz)
            </div>
          )}
        </div>
      )}
    </div>
  )
}
