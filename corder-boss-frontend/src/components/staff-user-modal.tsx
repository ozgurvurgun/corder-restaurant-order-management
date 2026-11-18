import { useEffect, useState } from "react"
import type { PermissionCatalogResponse, RoleDefinition, StaffMemberDto } from "@/lib/types"
import { getRoleDisplayName } from "@/lib/permission-labels"
import {
  buildCorderEmailDomain,
  extractCorderEmailLocalPart,
  formatCanonicalCorderEmail,
  sanitizeCorderEmailLocalPartInput,
} from "@/lib/corder-email"
import { StaffPermissionOverrides } from "./staff-permission-overrides"
import { CustomSelect } from "./ui/custom-inputs"
import { PasswordInputWithGenerator } from "./ui/password-input"
import { Monitor, KeyRound, AlertCircle, X } from "lucide-react"

interface StaffUserModalProps {
  branchName: string
  branchSlug?: string
  editingUser: StaffMemberDto | null
  roles: RoleDefinition[]
  catalog: PermissionCatalogResponse | null
  submitting: boolean
  onClose: () => void
  onSubmit: (payload: {
    name: string
    role: string
    phone?: string | null
    canAccessPanel: boolean
    canAccessTerminal: boolean
    email?: string | null
    password?: string
    pin?: string
    grantedPermissions: string[]
    revokedPermissions: string[]
    maxDiscountPercentOverride: number | null
    maxDiscountAmountOverride: number | null
  }) => Promise<void>
}

function deriveInitialOverrides(
  editingUser: StaffMemberDto | null
): { granted: string[]; revoked: string[] } {
  if (!editingUser) return { granted: [], revoked: [] }
  return {
    granted: editingUser.grantedPermissions ?? [],
    revoked: editingUser.revokedPermissions ?? [],
  }
}

export function StaffUserModal({
  branchName,
  branchSlug,
  editingUser,
  roles,
  catalog,
  submitting,
  onClose,
  onSubmit,
}: StaffUserModalProps) {
  const defaultRole = roles.find((r) => r.key === "branch_manager") ?? roles[0]
  const initialRoleKey = editingUser?.role ?? defaultRole?.key ?? "waiter"
  const initialOverrides = deriveInitialOverrides(editingUser)
  const mailTenant = branchSlug || branchName
  const mailDomain = buildCorderEmailDomain(mailTenant)

  const [name, setName] = useState(editingUser?.name ?? "")
  const [role, setRole] = useState(initialRoleKey)
  const [phone, setPhone] = useState(editingUser?.phone ?? "")
  const [canAccessPanel, setCanAccessPanel] = useState(
    editingUser ? editingUser.canAccessPanel : (defaultRole?.canAccessPanel ?? true)
  )
  const [canAccessTerminal, setCanAccessTerminal] = useState(
    editingUser ? editingUser.canAccessTerminal : (defaultRole?.canAccessTerminal ?? true)
  )
  const [email, setEmail] = useState(extractCorderEmailLocalPart(editingUser?.email))
  const [password, setPassword] = useState("")
  const [pin, setPin] = useState("")
  const [grantedPermissions, setGrantedPermissions] = useState<string[]>(
    initialOverrides.granted
  )
  const [revokedPermissions, setRevokedPermissions] = useState<string[]>(
    initialOverrides.revoked
  )
  const [maxDiscountPctOverride, setMaxDiscountPctOverride] = useState<string>(
    editingUser?.maxDiscountPercentOverride != null ? String(editingUser.maxDiscountPercentOverride) : ""
  )
  const [maxDiscountAmtOverride, setMaxDiscountAmtOverride] = useState<string>(
    editingUser?.maxDiscountAmountOverride != null ? String(editingUser.maxDiscountAmountOverride) : ""
  )
  const [showCustomPerms, setShowCustomPerms] = useState(
    Boolean(
      editingUser &&
        (initialOverrides.granted.length > 0 ||
          initialOverrides.revoked.length > 0 ||
          editingUser.maxDiscountPercentOverride != null ||
          editingUser.maxDiscountAmountOverride != null)
    )
  )
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose, submitting])

  const selectedRoleDef = roles.find((r) => r.key === role)

  const handleRoleChange = (nextRoleKey: string) => {
    setRole(nextRoleKey)
    setFormError(null)
    const r = roles.find((x) => x.key === nextRoleKey)
    if (r) {
      if (!editingUser) {
        setCanAccessPanel(r.canAccessPanel)
        setCanAccessTerminal(r.canAccessTerminal)
      }
      const nextRolePerms = new Set(r.permissions)
      setGrantedPermissions((prev) => prev.filter((k) => !nextRolePerms.has(k)))
      setRevokedPermissions((prev) => prev.filter((k) => nextRolePerms.has(k)))
    }
  }

  const toggleUserPermissionException = (permKey: string) => {
    const inRole = selectedRoleDef?.permissions.includes(permKey) ?? false
    if (inRole) {
      setRevokedPermissions((prev) =>
        prev.includes(permKey) ? prev.filter((k) => k !== permKey) : [...prev, permKey]
      )
      setGrantedPermissions((prev) => prev.filter((k) => k !== permKey))
    } else {
      setGrantedPermissions((prev) =>
        prev.includes(permKey) ? prev.filter((k) => k !== permKey) : [...prev, permKey]
      )
      setRevokedPermissions((prev) => prev.filter((k) => k !== permKey))
    }
  }

  const handleResetOverrides = () => {
    setGrantedPermissions([])
    setRevokedPermissions([])
    setMaxDiscountPctOverride("")
    setMaxDiscountAmtOverride("")
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setFormError(null)

    const trimmedName = name.trim()
    const canonicalEmail = formatCanonicalCorderEmail(email, mailTenant)
    const trimmedPassword = password.trim()
    const trimmedPin = pin.trim()
    const trimmedPhone = phone.trim()

    if (trimmedName.length < 2) {
      setFormError("Lütfen en az 2 karakterli bir ad soyad girin.")
      return
    }

    if (canAccessPanel) {
      if (!canonicalEmail) {
        setFormError("Merchant Panel giriş yetkisi için @ öncesi e-posta kullanıcı adını girin.")
        return
      }
      if ((!editingUser || !editingUser.hasPassword) && trimmedPassword.length < 6) {
        setFormError("Merchant Panel giriş yetkisi için en az 6 karakterli bir parola girin.")
        return
      }
      if (trimmedPassword.length > 0 && trimmedPassword.length < 6) {
        setFormError("Parola en az 6 karakter olmalıdır.")
        return
      }
    }

    if (canAccessTerminal && !editingUser?.hasPin && !/^\d{4,8}$/.test(trimmedPin)) {
      setFormError("El Terminali (POS) girişi açık olduğu için 4 ile 8 haneli rakamlardan oluşan bir PIN kodu girin.")
      return
    }

    if (trimmedPin.length > 0 && !/^\d{4,8}$/.test(trimmedPin)) {
      setFormError("PIN kodu 4 ile 8 haneli rakamlardan oluşmalıdır.")
      return
    }

    await onSubmit({
      name: trimmedName,
      role,
      phone: trimmedPhone || (editingUser ? null : undefined),
      canAccessPanel,
      canAccessTerminal,
      email: canonicalEmail || (editingUser ? null : undefined),
      ...(trimmedPassword ? { password: trimmedPassword } : {}),
      ...(trimmedPin ? { pin: trimmedPin } : {}),
      grantedPermissions,
      revokedPermissions,
      maxDiscountPercentOverride:
        maxDiscountPctOverride.trim() !== "" ? Number(maxDiscountPctOverride) : null,
      maxDiscountAmountOverride:
        maxDiscountAmtOverride.trim() !== "" ? Number(maxDiscountAmtOverride) : null,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-[#e5e5ea]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#f0f0f0] pb-3.5">
          <div>
            <h3 className="text-[15px] font-semibold text-[#1d1d1f]">
              {editingUser ? `${editingUser.name} — Düzenle` : "Yeni Kullanıcı / Personel Oluştur"}
            </h3>
            <p className="text-[11px] text-[#86868b]">Şube: {branchName}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f5f5f7] hover:bg-[#e8e8ed]">
            <X className="h-4 w-4 text-[#86868b]" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-[#1d1d1f]">Ad Soyad *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: Ayşe Demir"
                className="h-11 w-full rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3.5 text-[13px] text-[#1d1d1f] outline-none focus:border-[#e63462]"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-[#1d1d1f]">Rolü *</label>
              <CustomSelect
                value={role}
                onChange={(e) => handleRoleChange(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3.5 text-[13px] font-semibold text-[#1d1d1f]"
              >
                {roles.map((r) => (
                  <option key={r.key} value={r.key}>
                    {getRoleDisplayName(r.key, r.name)} ({r.permissions.length} yetki)
                  </option>
                ))}
              </CustomSelect>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-semibold text-[#1d1d1f]">Telefon</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05XX XXX XX XX"
              className="h-11 w-full rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3.5 text-[13px] text-[#1d1d1f] outline-none focus:border-[#e63462]"
            />
          </div>

          <div className="rounded-2xl border border-[#e5e5ea] bg-[#f9f9fb] p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Monitor className="h-4 w-4 text-[#e63462]" />
                <div>
                  <p className="text-[13px] font-semibold text-[#1d1d1f]">Merchant Panel Giriş Yetkisi (Web / Kasa PC)</p>
                  <p className="text-[11px] text-[#86868b]">Açıldığında bu kullanıcı e-posta ve parolasıyla Merchant Paneline giriş yapabilir.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCanAccessPanel((v) => !v)}
                className={`h-6 w-11 flex-shrink-0 rounded-full p-0.5 transition-colors ${canAccessPanel ? "bg-[#e63462]" : "bg-[#d1d1d6]"}`}
              >
                <div className={`h-5 w-5 rounded-full bg-white transition-transform ${canAccessPanel ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>

            {canAccessPanel && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#1d1d1f]">Giriş E-postası *</label>
                  <div className="flex h-10 w-full items-stretch overflow-hidden rounded-xl border border-[#d1d1d6] bg-white focus-within:border-[#e63462] transition-all">
                    <input
                      type="text"
                      inputMode="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      value={email}
                      onChange={(e) => setEmail(sanitizeCorderEmailLocalPartInput(e.target.value))}
                      placeholder="sehmus"
                      className="min-w-0 flex-1 bg-transparent px-3 text-[13px] font-medium text-[#1d1d1f] outline-none placeholder:font-normal placeholder:text-[#86868b]"
                      required={canAccessPanel}
                    />
                    <span
                      className="inline-flex items-center border-l border-[#e5e5ea] bg-[#ededf2] px-2.5 font-mono text-[11.5px] font-semibold text-[#1d1d1f] select-none whitespace-nowrap"
                      title={`@${mailDomain}`}
                    >
                      @{mailDomain}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#1d1d1f]">
                    {editingUser?.hasPassword ? "Yeni Parola (boş = değişmez)" : "Giriş Parolası (en az 6 krk) *"}
                  </label>
                  <PasswordInputWithGenerator
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    className="h-10 w-full rounded-xl border border-[#d1d1d6] bg-white px-3 text-[13px] text-[#1d1d1f]"
                    required={canAccessPanel && !editingUser?.hasPassword}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#e5e5ea] bg-[#f9f9fb] p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <KeyRound className="h-4 w-4 text-[#e63462]" />
                <div>
                  <p className="text-[13px] font-semibold text-[#1d1d1f]">El Terminali (POS) PIN Giriş Yetkisi</p>
                  <p className="text-[11px] text-[#86868b]">Garson ve saha ekranında PIN kodu ile işlem yapabilsin.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCanAccessTerminal((v) => !v)}
                className={`h-6 w-11 flex-shrink-0 rounded-full p-0.5 transition-colors ${canAccessTerminal ? "bg-[#e63462]" : "bg-[#d1d1d6]"}`}
              >
                <div className={`h-5 w-5 rounded-full bg-white transition-transform ${canAccessTerminal ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>

            {canAccessTerminal && (
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#1d1d1f]">
                  {editingUser?.hasPin ? "Yeni PIN Kodu (değiştirmek için 4-8 rakam girin)" : "4-8 Haneli PIN Kodu *"}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="Örn: 1453"
                  className="h-10 w-full rounded-xl border border-[#d1d1d6] bg-white px-3 font-mono tracking-widest text-[14px] text-[#1d1d1f]"
                  required={canAccessTerminal && !editingUser?.hasPin}
                />
              </div>
            )}
          </div>

          <StaffPermissionOverrides
            catalog={catalog}
            selectedRoleDef={selectedRoleDef}
            showCustomPerms={showCustomPerms}
            grantedPermissions={grantedPermissions}
            revokedPermissions={revokedPermissions}
            maxDiscountPctOverride={maxDiscountPctOverride}
            maxDiscountAmtOverride={maxDiscountAmtOverride}
            onToggleShow={() => setShowCustomPerms((v) => !v)}
            onChangeMaxPctOverride={setMaxDiscountPctOverride}
            onChangeMaxAmtOverride={setMaxDiscountAmtOverride}
            onTogglePermissionException={toggleUserPermissionException}
            onResetOverrides={handleResetOverrides}
          />

          {formError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12px] font-medium text-red-600">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2.5 border-t border-[#f0f0f0] pt-4">
            <button type="button" onClick={onClose} className="h-10 rounded-xl border border-[#d1d1d6] px-4 text-[13px] font-medium text-[#86868b] hover:bg-[#f5f5f7]">
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-10 rounded-xl bg-[#e63462] px-5 text-[13px] font-semibold text-white shadow-sm hover:bg-[#d42d56] disabled:opacity-50"
            >
              {submitting ? "Kaydediliyor…" : editingUser ? "Kullanıcıyı Güncelle" : "Kullanıcıyı Oluştur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
