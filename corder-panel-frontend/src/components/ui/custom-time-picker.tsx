import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Clock } from "lucide-react"

const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"))
const QUICK_TIMES = ["08:00", "09:00", "12:00", "17:00", "18:00", "21:00", "22:00", "00:00"]

function parseTime(raw?: string): { hour: string; minute: string } {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec((raw ?? "").trim())
  if (!match) return { hour: "09", minute: "00" }
  return {
    hour: String(Number(match[1])).padStart(2, "0"),
    minute: match[2],
  }
}

function computeTimePopoverCoords(
  trigger: HTMLElement,
  estWidth: number,
  estHeight: number
): { top: number; left: number; width: number } {
  const rect = trigger.getBoundingClientRect()
  const width = Math.max(rect.width, estWidth)
  const spaceBelow = window.innerHeight - rect.bottom
  const top =
    spaceBelow < estHeight + 12 && rect.top > estHeight
      ? Math.max(8, rect.top - estHeight - 6)
      : Math.min(window.innerHeight - estHeight - 8, rect.bottom + 6)
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
  return { top, left, width }
}

export interface CustomTimePickerProps {
  value?: string
  onValueChange?: (val: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function CustomTimePicker({
  value = "09:00",
  onValueChange,
  placeholder = "Saat seçin",
  disabled = false,
  className,
}: CustomTimePickerProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)
  const hourListRef = useRef<HTMLDivElement | null>(null)
  const minuteListRef = useRef<HTMLDivElement | null>(null)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 236 })

  const parsed = parseTime(value)

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
      setCoords(computeTimePopoverCoords(triggerRef.current, 236, 290))
    }
    setOpen((v) => !v)
  }

  const emitTime = (nextHour: string, nextMinute: string) => {
    onValueChange?.(`${nextHour}:${nextMinute}`)
  }

  const baseCls =
    className ||
    "w-full h-9 rounded-lg border border-[#d1d1d6] bg-white px-3 text-[13px] font-medium text-[#1d1d1f]"

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
        <span className="font-semibold text-[#1d1d1f]">
          {value ? `${parsed.hour}:${parsed.minute}` : placeholder}
        </span>
        <Clock className="h-3.5 w-3.5 flex-shrink-0 text-[#e63462]" />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            style={{ top: coords.top, left: coords.left, width: 236 }}
            className="fixed z-[9999] rounded-2xl border border-[#e5e5ea] bg-white p-3 shadow-2xl select-none"
          >
            <div className="mb-1.5 grid grid-cols-2 gap-1.5 text-center text-[11px] font-semibold text-[#86868b]">
              <span>Saat (24s)</span>
              <span>Dakika</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <div
                ref={hourListRef}
                className="h-44 overflow-y-auto rounded-xl border border-[#f0f0f2] bg-[#f9f9fb] p-1 space-y-0.5"
              >
                {HOURS_24.map((h) => {
                  const active = h === parsed.hour
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => emitTime(h, parsed.minute)}
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
                className="h-44 overflow-y-auto rounded-xl border border-[#f0f0f2] bg-[#f9f9fb] p-1 space-y-0.5"
              >
                {MINUTES_60.map((m) => {
                  const active = m === parsed.minute
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => emitTime(parsed.hour, m)}
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

            <div className="mt-2 flex flex-wrap gap-1 border-t border-[#f0f0f2] pt-2">
              {QUICK_TIMES.map((qt) => {
                const isCur = `${parsed.hour}:${parsed.minute}` === qt
                return (
                  <button
                    key={qt}
                    type="button"
                    onClick={() => {
                      onValueChange?.(qt)
                      setOpen(false)
                    }}
                    className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold transition-colors ${
                      isCur
                        ? "bg-[#e63462] text-white"
                        : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]"
                    }`}
                  >
                    {qt}
                  </button>
                )
              })}
            </div>

            <div className="mt-2 flex justify-end">
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
