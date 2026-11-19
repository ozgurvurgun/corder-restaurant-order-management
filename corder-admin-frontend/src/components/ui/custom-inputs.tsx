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
import { Check, ChevronDown } from "lucide-react"

export {
  CustomDatePicker,
  CustomMonthPicker,
  type CustomDatePickerProps,
  type CustomMonthPickerProps,
} from "./custom-date-picker"
export {
  CustomDateTimePicker,
  type CustomDateTimePickerProps,
} from "./custom-datetime-picker"

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

export function computePopoverCoords(
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
