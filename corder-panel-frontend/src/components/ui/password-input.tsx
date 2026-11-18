import { useState } from "react"
import { Eye, EyeOff, KeyRound } from "lucide-react"

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"
const LOWER = "abcdefghijkmnpqrstuvwxyz"
const DIGITS = "23456789"
const SYMBOLS = "!@#$%&*"
const ALL_CHARS = UPPER + LOWER + DIGITS + SYMBOLS

function randomIndex(max: number): number {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const arr = new Uint32Array(1)
    crypto.getRandomValues(arr)
    return arr[0]! % max
  }
  return Math.floor(Math.random() * max)
}

export function generateSecurePassword(length = 12): string {
  const targetLen = Math.max(8, length)
  const chars: string[] = [
    UPPER[randomIndex(UPPER.length)]!,
    LOWER[randomIndex(LOWER.length)]!,
    DIGITS[randomIndex(DIGITS.length)]!,
    SYMBOLS[randomIndex(SYMBOLS.length)]!,
  ]
  while (chars.length < targetLen) {
    chars.push(ALL_CHARS[randomIndex(ALL_CHARS.length)]!)
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1)
    const tmp = chars[i]!
    chars[i] = chars[j]!
    chars[j] = tmp
  }
  return chars.join("")
}

export interface PasswordInputProps {
  value: string
  onChange?: (e: {
    target: { value: string }
    currentTarget: { value: string }
  }) => void
  onValueChange?: (value: string) => void
  placeholder?: string
  minLength?: number
  required?: boolean
  disabled?: boolean
  autoComplete?: string
  className?: string
  generateLength?: number
}

export function PasswordInputWithGenerator({
  value,
  onChange,
  onValueChange,
  placeholder = "••••••••",
  minLength,
  required = false,
  disabled = false,
  autoComplete = "new-password",
  className,
  generateLength = 12,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  const emitValue = (next: string) => {
    onChange?.({ target: { value: next }, currentTarget: { value: next } })
    onValueChange?.(next)
  }

  const handleGenerate = () => {
    if (disabled) return
    const next = generateSecurePassword(
      Math.max(generateLength, minLength ?? 8)
    )
    emitValue(next)
    setVisible(true)
  }

  const baseCls =
    className ||
    "w-full h-10 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3.5 text-[13px] text-[#1d1d1f] outline-none focus:border-[#e63462] focus:bg-white transition-colors"

  return (
    <div className="relative flex items-center">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => emitValue(e.target.value)}
        placeholder={placeholder}
        minLength={minLength}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        className={`${baseCls} pr-20 ${visible ? "font-mono text-[12.5px]" : ""}`}
      />
      <div className="absolute right-1.5 inset-y-0 flex items-center gap-1">
        <button
          type="button"
          disabled={disabled}
          onClick={handleGenerate}
          title="Güvenli parola oluştur"
          aria-label="Güvenli parola oluştur"
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#e63462]/10 text-[#e63462] hover:bg-[#e63462] hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
        >
          <KeyRound className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setVisible((v) => !v)}
          title={visible ? "Parolayı gizle" : "Parolayı göster"}
          aria-label={visible ? "Parolayı gizle" : "Parolayı göster"}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#86868b] hover:bg-[#e8e8ed] hover:text-[#1d1d1f] transition-colors disabled:opacity-40 cursor-pointer"
        >
          {visible ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  )
}

