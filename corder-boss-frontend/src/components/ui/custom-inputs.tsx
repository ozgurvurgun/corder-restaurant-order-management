import {
  Children,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { Calendar, Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"

export interface SelectOptionItem {
  value: string
  label: string
  disabled?: boolean
}

export interface SyntheticInputEvent {
  target: { value: string }
  currentTarget: { value: string }
}

function extractText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(extractText).join("")
  if (isValidElement(node)) {
    return extractText((node.props as { children?: ReactNode }).children)
  }
  return ""
}

function parseOptionChildren(children: ReactNode): SelectOptionItem[] {
  const out: SelectOptionItem[] = []
  const walk = (nodes: ReactNode) => {
    Children.forEach(nodes, (child) => {
      if (!isValidElement(child)) return
      const el = child as ReactElement<{
        value?: string | number
        disabled?: boolean
        children?: ReactNode
      }>
      if (el.type === "option") {
        const label = extractText(el.props.children)
        const value =
          el.props.value !== undefined ? String(el.props.value) : label
        out.push({ value, label, disabled: Boolean(el.props.disabled) })
      } else if (el.props?.children) {
        walk(el.props.children)
      }
    })
  }
  walk(children)
  return out
}

function computePopoverCoords(
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

export interface CustomSelectProps {
  value?: string | number
  onChange?: (e: SyntheticInputEvent) => void
  onValueChange?: (value: string) => void
  options?: SelectOptionItem[]
  children?: ReactNode
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  "aria-label"?: string
}

export function CustomSelect({
  value,
  onChange,
  onValueChange,
  options,
  children,
  placeholder = "Seçin...",
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 180 })

  const parsedOptions = useMemo(
    () => options ?? parseOptionChildren(children),
    [options, children]
  )
  const strVal = value !== undefined && value !== null ? String(value) : ""
  const selectedItem =
    parsedOptions.find((o) => o.value === strVal) ?? parsedOptions[0]

  useEffect(() => {
    if (!open) return
    const closeOnOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false)
      }
    }
    const closeOnKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    const closeOnScroll = (e: Event) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return
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
      const estH = Math.min(248, parsedOptions.length * 36 + 14)
      setCoords(computePopoverCoords(triggerRef.current, 180, estH))
    }
    setOpen((v) => !v)
  }

  const handleSelect = (nextVal: string) => {
    const evt = {
      target: { value: nextVal },
      currentTarget: { value: nextVal },
    }
    onChange?.(evt)
    onValueChange?.(nextVal)
    setOpen(false)
  }

  const baseCls =
    className ||
    "w-full h-10 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3.5 text-[13px] text-[#1d1d1f]"

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={handleToggle}
        className={`inline-flex items-center justify-between gap-2 text-left select-none cursor-pointer outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${baseCls} ${
          open ? "border-[#e63462] bg-white ring-2 ring-[#e63462]/15" : ""
        }`}
      >
        <span className="truncate flex-1">
          {selectedItem ? selectedItem.label : placeholder}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 flex-shrink-0 text-[#86868b] transition-transform ${
            open ? "rotate-180 text-[#e63462]" : ""
          }`}
        />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={{ top: coords.top, left: coords.left, width: coords.width }}
            className="fixed z-[9999] max-h-60 overflow-y-auto rounded-xl border border-[#e5e5ea] bg-white p-1.5 shadow-2xl"
          >
            {parsedOptions.map((opt) => {
              const isSelected = opt.value === (selectedItem?.value ?? strVal)
              return (
                <button
                  key={`${opt.value}-${opt.label}`}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => handleSelect(opt.value)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] transition-colors ${
                    isSelected
                      ? "bg-[#e63462]/10 font-semibold text-[#e63462]"
                      : "font-medium text-[#1d1d1f] hover:bg-[#f5f5f7]"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <Check className="h-3.5 w-3.5 flex-shrink-0 text-[#e63462]" />
                  )}
                </button>
              )
            })}
          </div>,
          document.body
        )}
    </>
  )
}

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

function getTodayIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function formatTurkishDateLabel(iso?: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ""
  const [y, m, d] = iso.split("-").map(Number)
  return `${d} ${TR_MONTHS_SHORT[(m || 1) - 1] ?? ""} ${y}`
}

export interface CustomDatePickerProps {
  value?: string
  onChange?: (e: SyntheticInputEvent) => void
  min?: string
  max?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
}

export function CustomDatePicker({
  value = "",
  onChange,
  min,
  max,
  placeholder = "Tarih seçin",
  disabled = false,
  required = false,
  className,
}: CustomDatePickerProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 268 })

  const todayIso = getTodayIso()
  const initialParts = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value.split("-").map(Number)
    : todayIso.split("-").map(Number)
  const [viewYear, setViewYear] = useState(initialParts[0] || 2026)
  const [viewMonth, setViewMonth] = useState((initialParts[1] || 1) - 1)

  useEffect(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m] = value.split("-").map(Number)
      setViewYear(y)
      setViewMonth(m - 1)
    }
  }, [value])

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

  const handleToggle = () => {
    if (disabled) return
    if (!open && triggerRef.current) {
      setCoords(computePopoverCoords(triggerRef.current, 268, 310))
    }
    setOpen((v) => !v)
  }

  const emitDate = (iso: string) => {
    onChange?.({ target: { value: iso }, currentTarget: { value: iso } })
    setOpen(false)
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDayOffset = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7
  const dayCells: Array<number | null> = [
    ...Array.from({ length: firstDayOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const stepMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
  }

  const baseCls =
    className ||
    "w-full h-10 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3.5 text-[13px] text-[#1d1d1f]"
  const displayLabel = formatTurkishDateLabel(value)

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
        <span className={`truncate ${displayLabel ? "font-medium text-[#1d1d1f]" : "text-[#86868b]"}`}>
          {displayLabel || placeholder}
        </span>
        <Calendar className="h-3.5 w-3.5 flex-shrink-0 text-[#e63462]" />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            style={{ top: coords.top, left: coords.left, width: 268 }}
            className="fixed z-[9999] rounded-2xl border border-[#e5e5ea] bg-white p-3.5 shadow-2xl select-none"
          >
            <div className="mb-2.5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => stepMonth(-1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-[13px] font-semibold text-[#1d1d1f]">
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

            <div className="grid grid-cols-7 gap-1 text-center text-[10.5px] font-semibold text-[#86868b] mb-1">
              {TR_WEEKDAYS.map((wd) => (
                <div key={wd} className="py-1">
                  {wd}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {dayCells.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} className="h-8" />
                const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                const isSelected = iso === value
                const isToday = iso === todayIso
                const isOut =
                  Boolean(min && iso < min) || Boolean(max && iso > max)
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={isOut}
                    onClick={() => emitDate(iso)}
                    className={`h-8 rounded-lg text-[12px] font-medium transition-colors ${
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

            <div className="mt-2.5 flex items-center justify-between border-t border-[#f0f0f2] pt-2">
              <button
                type="button"
                onClick={() => emitDate(max && todayIso > max ? max : todayIso)}
                className="text-[11.5px] font-semibold text-[#e63462] hover:underline"
              >
                Bugün
              </button>
              {!required && value && (
                <button
                  type="button"
                  onClick={() => emitDate("")}
                  className="text-[11.5px] font-medium text-[#86868b] hover:text-[#1d1d1f]"
                >
                  Temizle
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
