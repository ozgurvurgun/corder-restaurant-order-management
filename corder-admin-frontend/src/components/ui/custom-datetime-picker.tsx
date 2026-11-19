import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Calendar, ChevronLeft, ChevronRight, Clock } from "lucide-react"
import { computePopoverCoords, type SyntheticInputEvent } from "./custom-inputs"

const TR_MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
]

const TR_MONTHS_SHORT = [
  "Oca",
  "Şub",
  "Mar",
  "Nis",
  "May",
  "Haz",
  "Tem",
  "Ağu",
  "Eyl",
  "Eki",
  "Kas",
  "Ara",
]

const TR_WEEKDAYS = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"]

const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"))

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

function getTodayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

function parseDateTimeValue(raw?: string): {
  dateIso: string
  hour: string
  minute: string
} {
  const now = new Date(Date.now() + 15 * 60 * 1000)
  const fallbackDate = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
  const fallbackHour = pad2(now.getHours())
  const fallbackMinute = pad2(now.getMinutes())

  if (!raw) {
    return { dateIso: fallbackDate, hour: fallbackHour, minute: fallbackMinute }
  }
  const match = /^(\d{4}-\d{2}-\d{2})[T\s](\d{2}):(\d{2})/.exec(raw.trim())
  if (!match) {
    return { dateIso: fallbackDate, hour: fallbackHour, minute: fallbackMinute }
  }
  return {
    dateIso: match[1],
    hour: match[2],
    minute: match[3],
  }
}

function formatTurkishDateTimeLabel(raw?: string): string {
  if (!raw) return ""
  const match = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/.exec(raw.trim())
  if (!match) return ""
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = match[4]
  const minute = match[5]
  return `${day} ${TR_MONTHS_SHORT[(month || 1) - 1] ?? ""} ${year}, ${hour}:${minute}`
}

export interface CustomDateTimePickerProps {
  value?: string
  onChange?: (e: SyntheticInputEvent) => void
  onValueChange?: (val: string) => void
  min?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function CustomDateTimePicker({
  value = "",
  onChange,
  onValueChange,
  min,
  placeholder = "Tarih ve saat seçin",
  disabled = false,
  className,
}: CustomDateTimePickerProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)
  const hourListRef = useRef<HTMLDivElement | null>(null)
  const minuteListRef = useRef<HTMLDivElement | null>(null)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 396 })

  const parsed = parseDateTimeValue(value)
  const todayIso = getTodayIso()
  const initialDateParts = parsed.dateIso.split("-").map(Number)
  const [viewYear, setViewYear] = useState(initialDateParts[0] || 2026)
  const [viewMonth, setViewMonth] = useState((initialDateParts[1] || 1) - 1)

  useEffect(() => {
    const [y, m] = parsed.dateIso.split("-").map(Number)
    if (y && m) {
      setViewYear(y)
      setViewMonth(m - 1)
    }
  }, [parsed.dateIso])

  useEffect(() => {
    if (!open) return
    const closeOnOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        !triggerRef.current?.contains(target) &&
        !popRef.current?.contains(target)
      ) {
        setOpen(false)
      }
    }
    const closeOnKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", closeOnOutside)
    window.addEventListener("keydown", closeOnKey)
    return () => {
      document.removeEventListener("mousedown", closeOnOutside)
      window.removeEventListener("keydown", closeOnKey)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const hIdx = Number(parsed.hour) || 0
    const mIdx = Number(parsed.minute) || 0
    if (hourListRef.current) {
      hourListRef.current.scrollTop = Math.max(0, hIdx * 30 - 60)
    }
    if (minuteListRef.current) {
      minuteListRef.current.scrollTop = Math.max(0, mIdx * 30 - 60)
    }
  }, [open])

  const handleToggle = () => {
    if (disabled) return
    if (!open && triggerRef.current) {
      setCoords(computePopoverCoords(triggerRef.current, 396, 336))
    }
    setOpen((v) => !v)
  }

  const emitDateTime = (nextDateIso: string, nextHour: string, nextMinute: string) => {
    const combined = `${nextDateIso}T${nextHour}:${nextMinute}`
    const evt = { target: { value: combined }, currentTarget: { value: combined } }
    onChange?.(evt)
    onValueChange?.(combined)
  }

  const stepMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDayOffset = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7
  const dayCells: Array<number | null> = [
    ...Array.from({ length: firstDayOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const minDateIso = min ? min.slice(0, 10) : undefined
  const displayLabel = formatTurkishDateTimeLabel(value)
  const baseCls =
    className ||
    "w-full h-10 rounded-xl border border-[#d1d1d6] bg-white px-3.5 text-[13px] text-[#1d1d1f]"

  const setQuickOffset = (minutesFromNow: number) => {
    const d = new Date(Date.now() + minutesFromNow * 60 * 1000)
    const dIso = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    emitDateTime(dIso, pad2(d.getHours()), pad2(d.getMinutes()))
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`inline-flex items-center justify-between gap-2 text-left select-none cursor-pointer outline-none transition-all disabled:opacity-50 ${baseCls} ${
          open ? "border-[#e63462] bg-white ring-2 ring-[#e63462]/15" : ""
        }`}
      >
        <span className="inline-flex items-center gap-2 truncate">
          <Calendar className="h-3.5 w-3.5 flex-shrink-0 text-[#e63462]" />
          <span
            className={`truncate ${
              displayLabel ? "font-semibold text-[#1d1d1f]" : "text-[#86868b]"
            }`}
          >
            {displayLabel || placeholder}
          </span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-md bg-[#e63462]/10 px-2 py-0.5 text-[11px] font-semibold text-[#e63462]">
          <Clock className="h-3 w-3" />
          {parsed.hour}:{parsed.minute}
        </span>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            style={{
              top: coords.top,
              left: coords.left,
              width: Math.min(396, window.innerWidth - 16),
            }}
            className="fixed z-[9999] rounded-2xl border border-[#e5e5ea] bg-white p-3.5 shadow-2xl select-none"
          >
            <div className="grid grid-cols-12 gap-3">
              {/* Sol: Takvim */}
              <div className="col-span-7 pr-2 border-r border-[#f0f0f2]">
                <div className="mb-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => stepMonth(-1)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-[12.5px] font-semibold text-[#1d1d1f]">
                    {TR_MONTHS[viewMonth]} {viewYear}
                  </span>
                  <button
                    type="button"
                    onClick={() => stepMonth(1)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-[#86868b] mb-1">
                  {TR_WEEKDAYS.map((wd) => (
                    <div key={wd} className="py-0.5">
                      {wd}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-0.5">
                  {dayCells.map((day, idx) => {
                    if (!day) return <div key={`empty-${idx}`} className="h-7" />
                    const iso = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`
                    const isSelected = iso === parsed.dateIso
                    const isToday = iso === todayIso
                    const isOut = Boolean(minDateIso && iso < minDateIso)
                    return (
                      <button
                        key={iso}
                        type="button"
                        disabled={isOut}
                        onClick={() => emitDateTime(iso, parsed.hour, parsed.minute)}
                        className={`h-7 rounded-lg text-[11.5px] font-medium transition-colors ${
                          isSelected
                            ? "bg-[#e63462] font-bold text-white shadow-xs"
                            : isToday
                              ? "border border-[#e63462]/50 font-semibold text-[#e63462] hover:bg-[#fef3f5]"
                              : "text-[#1d1d1f] hover:bg-[#f5f5f7]"
                        } disabled:opacity-30 disabled:cursor-not-allowed`}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Sağ: 24 Saat & Dakika Seçici */}
              <div className="col-span-5 flex flex-col">
                <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-[#86868b] px-1">
                  <span>Saat</span>
                  <span>Dakika</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 flex-1">
                  <div
                    ref={hourListRef}
                    className="h-48 overflow-y-auto rounded-xl border border-[#f0f0f2] bg-[#f9f9fb] p-1 space-y-0.5"
                  >
                    {HOURS_24.map((h) => {
                      const active = h === parsed.hour
                      return (
                        <button
                          key={h}
                          type="button"
                          onClick={() => emitDateTime(parsed.dateIso, h, parsed.minute)}
                          className={`w-full h-7 rounded-lg text-[12px] font-semibold transition-colors ${
                            active
                              ? "bg-[#e63462] text-white shadow-xs"
                              : "text-[#1d1d1f] hover:bg-[#e8e8ed]/70"
                          }`}
                        >
                          {h}
                        </button>
                      )
                    })}
                  </div>

                  <div
                    ref={minuteListRef}
                    className="h-48 overflow-y-auto rounded-xl border border-[#f0f0f2] bg-[#f9f9fb] p-1 space-y-0.5"
                  >
                    {MINUTES_60.map((m) => {
                      const active = m === parsed.minute
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => emitDateTime(parsed.dateIso, parsed.hour, m)}
                          className={`w-full h-7 rounded-lg text-[12px] font-semibold transition-colors ${
                            active
                              ? "bg-[#e63462] text-white shadow-xs"
                              : "text-[#1d1d1f] hover:bg-[#e8e8ed]/70"
                          }`}
                        >
                          {m}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-[#f0f0f2] pt-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuickOffset(15)}
                  className="text-[11px] font-semibold text-[#e63462] hover:underline"
                >
                  +15 dk
                </button>
                <span className="text-[#d1d1d6]">•</span>
                <button
                  type="button"
                  onClick={() => setQuickOffset(60)}
                  className="text-[11px] font-semibold text-[#e63462] hover:underline"
                >
                  +1 Saat
                </button>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-[#e63462] px-3 py-1 text-[11.5px] font-semibold text-white hover:bg-[#d42d56]"
              >
                Tamam
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

