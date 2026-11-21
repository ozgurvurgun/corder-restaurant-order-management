import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown, Clock } from "lucide-react"

const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))
const MINUTES_STEP_5 = [
  "00",
  "05",
  "10",
  "15",
  "20",
  "25",
  "30",
  "35",
  "40",
  "45",
  "50",
  "55",
  "59",
]

function parseTime24(value?: string): { hour: string; minute: string } {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec((value || "").trim())
  if (!m) return { hour: "04", minute: "00" }
  return { hour: m[1], minute: m[2] }
}

function computeTimePopoverCoords(
  trigger: HTMLElement,
  estWidth: number,
  estHeight: number,
): { top: number; left: number } {
  const rect = trigger.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom
  const top =
    spaceBelow < estHeight + 12 && rect.top > estHeight
      ? Math.max(8, rect.top - estHeight - 6)
      : Math.min(window.innerHeight - estHeight - 8, rect.bottom + 6)
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - estWidth - 8))
  return { top, left }
}

export interface CustomTimePickerProps {
  value: string
  onValueChange: (nextTime: string) => void
  disabled?: boolean
  className?: string
}

export function CustomTimePicker({
  value,
  onValueChange,
  disabled = false,
  className,
}: CustomTimePickerProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)
  const [coords, setCoords] = useState({ top: 0, left: 0 })

  const { hour, minute } = parseTime24(value)
  const minuteChoices = MINUTES_STEP_5.includes(minute)
    ? MINUTES_STEP_5
    : [...MINUTES_STEP_5, minute].sort()

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
    const closeOnScroll = (e: Event) => {
      if (popRef.current && popRef.current.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", closeOnOutside)
    window.addEventListener("keydown", closeOnKey)
    window.addEventListener("resize", closeOnScroll)
    window.addEventListener("scroll", closeOnScroll, true)
    return () => {
      document.removeEventListener("mousedown", closeOnOutside)
      window.removeEventListener("keydown", closeOnKey)
      window.removeEventListener("resize", closeOnScroll)
      window.removeEventListener("scroll", closeOnScroll, true)
    }
  }, [open])

  const handleToggle = () => {
    if (disabled) return
    if (!open && triggerRef.current) {
      setCoords(computeTimePopoverCoords(triggerRef.current, 232, 276))
    }
    setOpen((v) => !v)
  }

  const selectHour = (nextHour: string) => {
    onValueChange(`${nextHour}:${minute}`)
  }

  const selectMinute = (nextMinute: string) => {
    onValueChange(`${hour}:${nextMinute}`)
    setOpen(false)
  }

  const baseCls =
    className ||
    "h-[30px] rounded-lg border border-[#d1d1d6] bg-[#f5f5f7] px-2.5 text-[11.5px] font-semibold text-[#1d1d1f]"

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`inline-flex items-center justify-between gap-2 select-none cursor-pointer outline-none transition-all disabled:opacity-50 ${baseCls} ${
          open
            ? "border-[#e63462] bg-white ring-2 ring-[#e63462]/15 text-[#e63462]"
            : "hover:bg-[#e8e8ed]"
        }`}
      >
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-[#e63462]" />
          <span>Özel Saat: {hour}:{minute}</span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-[#86868b] transition-transform ${
            open ? "rotate-180 text-[#e63462]" : ""
          }`}
        />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            style={{ top: coords.top, left: coords.left, width: 232 }}
            className="fixed z-[10050] rounded-2xl border border-[#e5e5ea] bg-white p-3 shadow-2xl select-none"
          >
            <div className="mb-2 flex items-center justify-between border-b border-[#f0f0f2] pb-2">
              <span className="text-[11px] font-semibold text-[#86868b]">
                24 Saat Formatı (İstanbul)
              </span>
              <span className="rounded-md bg-[#e63462]/10 px-2 py-0.5 text-[11.5px] font-bold text-[#e63462]">
                {hour}:{minute}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-[#86868b]">
                  Saat (00 - 23)
                </div>
                <div className="max-h-44 overflow-y-auto space-y-0.5 pr-1">
                  {HOURS_24.map((h) => {
                    const active = h === hour
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => selectHour(h)}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[12px] transition-colors ${
                          active
                            ? "bg-[#e63462] font-bold text-white"
                            : "font-medium text-[#1d1d1f] hover:bg-[#f5f5f7]"
                        }`}
                      >
                        <span>{h}</span>
                        {active && <Check className="h-3 w-3" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-[#86868b]">
                  Dakika
                </div>
                <div className="max-h-44 overflow-y-auto space-y-0.5 pr-1">
                  {minuteChoices.map((m) => {
                    const active = m === minute
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => selectMinute(m)}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[12px] transition-colors ${
                          active
                            ? "bg-[#e63462] font-bold text-white"
                            : "font-medium text-[#1d1d1f] hover:bg-[#f5f5f7]"
                        }`}
                      >
                        <span>:{m}</span>
                        {active && <Check className="h-3 w-3" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
