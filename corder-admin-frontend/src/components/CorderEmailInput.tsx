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
  const localVal = sanitizeCorderEmailLocalPartInput(value)
  const hasTenant = Boolean(toCorderEmailTenantSlug(tenantSlugOrName))
  const domain = hasTenant
    ? buildCorderEmailDomain(tenantSlugOrName)
    : "restoran.corder.app"

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
    </div>
  )
}

