import { useState } from "react"
import { Check, Copy } from "lucide-react"
import {
  buildCorderEmailDomain,
  sanitizeCorderEmailLocalPartInput,
  toCorderEmailTenantSlug,
} from "@/lib/corder-email"

interface CorderEmailInputProps {
  value: string
  onChange: (localPart: string) => void
  tenantSlugOrName?: string | null
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
}

export function CorderEmailInput({
  value,
  onChange,
  tenantSlugOrName,
  placeholder = "kullanici",
  disabled = false,
  required = false,
  className = "h-10",
}: CorderEmailInputProps) {
  const [copied, setCopied] = useState(false)
  const localVal = sanitizeCorderEmailLocalPartInput(value)
  const hasTenant = Boolean(toCorderEmailTenantSlug(tenantSlugOrName))
  const domain = hasTenant
    ? buildCorderEmailDomain(tenantSlugOrName)
    : "restoran.corder.app"
  const fullEmail = `${localVal || placeholder}@${domain}`

  const handleCopy = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return
    void navigator.clipboard.writeText(fullEmail).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <div
      className={`flex w-full items-stretch overflow-hidden rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] focus-within:border-[#e63462] focus-within:bg-white transition-all ${className}`}
    >
      <input
        type="text"
        inputMode="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={localVal}
        onChange={(e) => onChange(sanitizeCorderEmailLocalPartInput(e.target.value))}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className="min-w-0 flex-1 bg-transparent px-3 text-[13px] font-medium text-[#1d1d1f] outline-none placeholder:font-normal placeholder:text-[#86868b] disabled:opacity-50"
      />
      <span
        className={`inline-flex items-center border-l border-[#e5e5ea] bg-[#ededf2] px-2.5 font-mono text-[11.5px] font-semibold select-none whitespace-nowrap ${
          hasTenant ? "text-[#1d1d1f]" : "text-[#86868b]"
        }`}
        title={`@${domain}`}
      >
        @{domain}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        title={`Tam e-postayı kopyala (${fullEmail})`}
        className="inline-flex items-center justify-center border-l border-[#e5e5ea] bg-[#ededf2] hover:bg-[#e2e2e9] px-2.5 text-[#636366] hover:text-[#1d1d1f] transition-colors cursor-pointer"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  )
}

export function CopyEmailInlineButton({ email }: { email?: string | null }) {
  const [copied, setCopied] = useState(false)
  const clean = (email ?? "").trim()
  if (!clean || clean === "-") return null

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (typeof navigator === "undefined" || !navigator.clipboard) return
    void navigator.clipboard.writeText(clean).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`E-postayı kopyala (${clean})`}
      className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[#86868b] hover:bg-[#e8e8ed] hover:text-[#1d1d1f] transition-colors cursor-pointer flex-shrink-0"
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-600" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  )
}
