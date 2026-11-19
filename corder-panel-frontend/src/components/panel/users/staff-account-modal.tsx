import { useEffect, useMemo, useState } from "react"
import type { PanelPermissionCatalogDto, PanelRoleDefinitionDto } from "@/lib/api/system.api"
import { getCategoryLabel, getPermissionLabel, getRoleDisplayName } from "@/lib/permission-labels"
import {
  buildCorderEmailDomain,
  extractCorderEmailLocalPart,
  formatCanonicalCorderEmail,
  sanitizeCorderEmailLocalPartInput,
} from "@/lib/corder-email"
import { usePanelAuth } from "@/lib/panel-auth"
import { usePanelStore } from "@/lib/panel-store"
import type { PanelUser, PanelUserRole } from "@/lib/panel-types"
import { CustomSelect } from "@/components/ui/custom-inputs"
import { PasswordInputWithGenerator } from "@/components/ui/password-input"
import { StaffShiftRestrictionFields } from "./staff-shift-restriction-fields"
import { usePanelToast } from "../panel-toast"
import { Sliders, X } from "lucide-react"

const DEFAULT_ROLE_OPTIONS: Array<{ value: PanelUserRole; label: string }> = [
  { value: "branch_manager", label: "Şube Müdürü" },
  { value: "shift_supervisor", label: "Vardiya Amiri / Şef" },
  { value: "cashier", label: "Kasiyer" },
  { value: "head_waiter", label: "Şef Garson" },
  { value: "waiter", label: "Garson" },
  { value: "runner", label: "Komi / Stajyer" },
  { value: "inventory_manager", label: "Depo & Stok Sorumlusu" },
  { value: "accountant", label: "Muhasebe & Finans" },
]

export interface StaffAccountModalProps {
  editingUser: PanelUser | null
  roles: PanelRoleDefinitionDto[]
  catalog: PanelPermissionCatalogDto | null
  onClose: () => void
  onAddUser: (user: Omit<PanelUser, "id" | "createdAt">) => void
  onUpdateUser: (id: string, updates: Partial<PanelUser>) => void
}

export function StaffAccountModal({
  editingUser,
  roles,
  catalog,
  onClose,
  onAddUser,
  onUpdateUser,
}: StaffAccountModalProps) {
  const { showToast } = usePanelToast()
  const { currentBusiness } = usePanelAuth()
  const { settings } = usePanelStore()
  const mailTenant = currentBusiness?.slug || currentBusiness?.name || settings.name
  const mailDomain = buildCorderEmailDomain(mailTenant)

  const [formName, setFormName] = useState("")
  const [formRole, setFormRole] = useState<PanelUserRole | string>("waiter")
  const [formPhone, setFormPhone] = useState("")
  const [formPin, setFormPin] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formPassword, setFormPassword] = useState("")
  const [formCanAccessPanel, setFormCanAccessPanel] = useState(false)
  const [formCanAccessTerminal, setFormCanAccessTerminal] = useState(true)
  const [showStaffPermOverrides, setShowStaffPermOverrides] = useState(false)
  const [formGrantedPerms, setFormGrantedPerms] = useState<string[]>([])
  const [formRevokedPerms, setFormRevokedPerms] = useState<string[]>([])
  const [formMaxPctOverride, setFormMaxPctOverride] = useState<string>("")
  const [formMaxAmtOverride, setFormMaxAmtOverride] = useState<string>("")
  const [formShiftRestrictionEnabled, setFormShiftRestrictionEnabled] = useState(false)
  const [formShiftStartTime, setFormShiftStartTime] = useState("09:00")
  const [formShiftEndTime, setFormShiftEndTime] = useState("21:00")
  const [formShiftCutoffOffset, setFormShiftCutoffOffset] = useState<number>(-30)

  useEffect(() => {
    if (!editingUser) {
      setFormName(""); setFormRole("waiter"); setFormPhone(""); setFormPin("")
      setFormEmail(""); setFormPassword(""); setFormCanAccessPanel(false)
      setFormCanAccessTerminal(true); setShowStaffPermOverrides(false)
      setFormGrantedPerms([]); setFormRevokedPerms([])
      setFormMaxPctOverride(""); setFormMaxAmtOverride("")
      setFormShiftRestrictionEnabled(false)
      setFormShiftStartTime("09:00"); setFormShiftEndTime("21:00"); setFormShiftCutoffOffset(-30)
      return
    }
    setFormName(editingUser.name)
    setFormRole(editingUser.role === "root" ? "branch_manager" : editingUser.role)
    setFormPhone(editingUser.phone || "")
    setFormEmail(extractCorderEmailLocalPart(editingUser.email))
    setFormPassword(""); setFormPin("")
    setFormCanAccessPanel(Boolean(editingUser.canAccessPanel || editingUser.email))
    setFormCanAccessTerminal(editingUser.canAccessTerminal ?? true)
    setFormGrantedPerms(editingUser.grantedPermissions ?? [])
    setFormRevokedPerms(editingUser.revokedPermissions ?? [])
    setFormMaxPctOverride(
      editingUser.maxDiscountPercentOverride != null ? String(editingUser.maxDiscountPercentOverride) : ""
    )
    setFormMaxAmtOverride(
      editingUser.maxDiscountAmountOverride != null ? String(editingUser.maxDiscountAmountOverride) : ""
    )
    setFormShiftRestrictionEnabled(Boolean(editingUser.shiftRestrictionEnabled))
    setFormShiftStartTime(editingUser.shiftStartTime || "09:00")
    setFormShiftEndTime(editingUser.shiftEndTime || "21:00")
    setFormShiftCutoffOffset(Number(editingUser.shiftCutoffOffsetMinutes ?? -30))
    setShowStaffPermOverrides(
      (editingUser.grantedPermissions?.length ?? 0) > 0 ||
        (editingUser.revokedPermissions?.length ?? 0) > 0 ||
        editingUser.maxDiscountPercentOverride != null ||
        editingUser.maxDiscountAmountOverride != null
    )
  }, [editingUser])

  const roleOptions = useMemo(
    () =>
      roles.length === 0
        ? DEFAULT_ROLE_OPTIONS
        : roles.map((r) => ({ value: r.key, label: getRoleDisplayName(r.key, r.name) })),
    [roles]
  )

  const currentFormRoleDef = useMemo(
    () => roles.find((r) => r.key === formRole) ?? null,
    [roles, formRole]
  )

  const categoriesList = useMemo(() => (catalog ? Object.keys(catalog.categories) : []), [catalog])

  const toggleStaffPermissionOverride = (permKey: string) => {
    const roleHasIt = currentFormRoleDef?.permissions.includes(permKey) ?? false
    const isGranted = formGrantedPerms.includes(permKey)
    const isRevoked = formRevokedPerms.includes(permKey)
    const effective = (roleHasIt && !isRevoked) || isGranted

    if (effective) {
      setFormGrantedPerms((prev) => prev.filter((k) => k !== permKey))
      if (roleHasIt) setFormRevokedPerms((prev) => Array.from(new Set([...prev, permKey])))
    } else {
      setFormRevokedPerms((prev) => prev.filter((k) => k !== permKey))
      if (!roleHasIt) setFormGrantedPerms((prev) => Array.from(new Set([...prev, permKey])))
    }
  }

  const handleSubmit = () => {
    const pin = formPin.replace(/\D/g, "").slice(0, 8)
    if (!formName.trim()) {
      showToast("Lütfen personel adını girin.", "error")
      return
    }
    const maxDiscountPercentOverride =
      formMaxPctOverride.trim() !== "" ? Number(formMaxPctOverride) : null
    const maxDiscountAmountOverride =
      formMaxAmtOverride.trim() !== "" ? Number(formMaxAmtOverride) : null

    if (!formCanAccessPanel && !formCanAccessTerminal) {
      showToast("En az bir giriş kanalı (Panel veya Terminal) seçilmelidir.", "error")
      return
    }
    if (formCanAccessTerminal && !editingUser?.hasPin && pin.length < 4) {
      showToast("Terminal girişi için 4-8 haneli PIN girin.", "error")
      return
    }
    const canonicalEmail = formatCanonicalCorderEmail(formEmail, mailTenant)
    if (formCanAccessPanel && !canonicalEmail) {
      showToast("Panel girişi için @ öncesi e-posta kullanıcı adını girin.", "error")
      return
    }
    if (formCanAccessPanel && !editingUser?.hasPassword && formPassword.length < 6) {
      showToast("Panel girişi için en az 6 karakterli parola girin.", "error")
      return
    }

    if (editingUser) {
      onUpdateUser(editingUser.id, {
        name: formName.trim(),
        role: formRole,
        phone: formPhone.trim() || undefined,
        email: canonicalEmail || undefined,
        ...(formPassword.length >= 6 ? { password: formPassword } : {}),
        ...(pin.length >= 4 ? { pin } : {}),
        canAccessPanel: formCanAccessPanel,
        canAccessTerminal: formCanAccessTerminal,
        grantedPermissions: formGrantedPerms,
        revokedPermissions: formRevokedPerms,
        maxDiscountPercentOverride,
        maxDiscountAmountOverride,
        shiftRestrictionEnabled: formShiftRestrictionEnabled,
        shiftStartTime: formShiftRestrictionEnabled ? formShiftStartTime : null,
        shiftEndTime: formShiftRestrictionEnabled ? formShiftEndTime : null,
        shiftCutoffOffsetMinutes: formShiftRestrictionEnabled ? formShiftCutoffOffset : 0,
      })
      onClose()
      return
    }

    onAddUser({
      name: formName.trim(),
      role: formRole,
      phone: formPhone.trim() || undefined,
      ...(pin.length >= 4 ? { pin } : {}),
      ...(canonicalEmail ? { email: canonicalEmail } : {}),
      ...(formPassword ? { password: formPassword } : {}),
      canAccessPanel: formCanAccessPanel,
      canAccessTerminal: formCanAccessTerminal,
      grantedPermissions: formGrantedPerms,
      revokedPermissions: formRevokedPerms,
      maxDiscountPercentOverride,
      maxDiscountAmountOverride,
      shiftRestrictionEnabled: formShiftRestrictionEnabled,
      shiftStartTime: formShiftRestrictionEnabled ? formShiftStartTime : null,
      shiftEndTime: formShiftRestrictionEnabled ? formShiftEndTime : null,
      shiftCutoffOffsetMinutes: formShiftRestrictionEnabled ? formShiftCutoffOffset : 0,
      active: true,
    })
    onClose()
  }

  const inputClass =
    "w-full h-[38px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]"

  return (
    <div className="bg-white rounded-2xl border border-[#d1d1d6]/80 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 border-b border-[#f0f0f0] pb-3">
        <div>
          <h4 className="text-[14px] font-bold text-[#1d1d1f]">
            {editingUser
              ? "Kullanıcı Bilgilerini & Yetkilerini Düzenle"
              : "Şube İçin Yeni Kullanıcı / Personel Oluştur"}
          </h4>
          <p className="text-[11px] text-[#86868b]">
            Bu mekan için yeni personel oluşturabilir, Panel/Terminal giriş bilgilerini ve 48 granüler yetkisini özelleştirebilirsiniz.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]"
        >
          <X className="w-3.5 h-3.5 text-[#86868b]" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-[#86868b] mb-1">Ad Soyad *</label>
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Örn: Ali Yılmaz"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#86868b] mb-1">Temel Rolü *</label>
          <CustomSelect
            value={formRole}
            onChange={(e) => {
              const nextRole = e.target.value
              setFormRole(nextRole)
              const rDef = roles.find((r) => r.key === nextRole)
              if (rDef && !editingUser) {
                setFormCanAccessPanel(rDef.canAccessPanel)
                setFormCanAccessTerminal(rDef.canAccessTerminal)
              }
            }}
            className={inputClass}
          >
            {roleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </CustomSelect>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#86868b] mb-1">Telefon Numarası</label>
          <input
            type="tel"
            value={formPhone}
            onChange={(e) => setFormPhone(e.target.value)}
            placeholder="05XX XXX XX XX"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#86868b] mb-1">
            El Terminali PIN Kodu (4-8 Haneli Rakam)
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={formPin}
            onChange={(e) => setFormPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder={
              editingUser ? "Değiştirmek için yeni 4-8 haneli PIN girin" : "Terminal PIN Kodu (4-8 rakam)"
            }
            className={`${inputClass} font-mono tracking-widest`}
          />
        </div>

        <div className="col-span-2 flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[#f0f0f0]">
          <div className="flex flex-wrap items-center gap-5">
            <label className="flex items-center gap-2 text-[12px] font-semibold text-[#1d1d1f] cursor-pointer">
              <input
                type="checkbox"
                checked={formCanAccessPanel}
                onChange={(e) => setFormCanAccessPanel(e.target.checked)}
                className="accent-[#e63462]"
              />
              Merchant Paneline Giriş Yapabilsin (E-posta &amp; Parola)
            </label>
            <label className="flex items-center gap-2 text-[12px] font-semibold text-[#1d1d1f] cursor-pointer">
              <input
                type="checkbox"
                checked={formCanAccessTerminal}
                onChange={(e) => setFormCanAccessTerminal(e.target.checked)}
                className="accent-[#e63462]"
              />
              El Terminaline Giriş Yapabilsin (PIN)
            </label>
          </div>

          <button
            type="button"
            onClick={() => setShowStaffPermOverrides((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#e63462]/30 bg-[#fef3f5] px-3 py-1.5 text-[12px] font-semibold text-[#e63462] hover:bg-[#e63462]/15"
          >
            <Sliders className="w-3.5 h-3.5" />
            {showStaffPermOverrides
              ? "Kişiye Özel Yetki Matrisini Gizle"
              : "Kişiye Özel Yetki & İskonto Limiti Özelleştir"}
          </button>
        </div>

        {formCanAccessPanel && (
          <>
            <div>
              <label className="block text-[11px] font-semibold text-[#86868b] mb-1">
                Merchant Panel Giriş E-postası *
              </label>
              <div className="flex h-[38px] w-full items-stretch overflow-hidden rounded-lg border border-[#d1d1d6]/60 bg-[#f5f5f7] focus-within:border-[#e63462] focus-within:bg-white transition-all">
                <input
                  type="text"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={formEmail}
                  onChange={(e) => setFormEmail(sanitizeCorderEmailLocalPartInput(e.target.value))}
                  placeholder="personel"
                  className="min-w-0 flex-1 bg-transparent px-3 text-[13px] font-medium text-[#1d1d1f] outline-none placeholder:font-normal placeholder:text-[#86868b]"
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
              <label className="block text-[11px] font-semibold text-[#86868b] mb-1">
                Merchant Panel Parolası *
              </label>
              <PasswordInputWithGenerator
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                minLength={6}
                placeholder={
                  editingUser ? "Yeni parola (değiştirmek istemiyorsanız boş bırakın)" : "En az 6 karakter"
                }
                className={inputClass}
              />
            </div>
          </>
        )}
        {formCanAccessTerminal && (
          <StaffShiftRestrictionFields
            enabled={formShiftRestrictionEnabled}
            startTime={formShiftStartTime}
            endTime={formShiftEndTime}
            cutoffOffsetMinutes={formShiftCutoffOffset}
            onChangeEnabled={setFormShiftRestrictionEnabled}
            onChangeStartTime={setFormShiftStartTime}
            onChangeEndTime={setFormShiftEndTime}
            onChangeCutoffOffsetMinutes={setFormShiftCutoffOffset}
          />
        )}
      </div>

      {showStaffPermOverrides && catalog && (
        <div className="mt-4 pt-4 border-t border-[#e5e5ea] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f9f9fb] p-3.5 rounded-xl border border-[#e5e5ea]">
            <div>
              <h5 className="text-[13px] font-bold text-[#1d1d1f]">
                Bu Personel İçin Özel Yetki &amp; İskonto Limitleri
              </h5>
              <p className="text-[11px] text-[#86868b]">
                Seçili rolün standart yetkilerine ek olarak bu personele özel yetki verebilir (+) veya mevcut bir yetkisini kısıtlayabilirsiniz (-).
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-[#86868b]">Özel Maks İskonto (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={formMaxPctOverride}
                  onChange={(e) => setFormMaxPctOverride(e.target.value)}
                  placeholder={`Rol: %${currentFormRoleDef?.maxDiscountPercent ?? 0}`}
                  className="w-28 h-[32px] px-2.5 text-[12px] bg-white rounded-lg border border-[#d1d1d6]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#86868b]">Özel Maks İskonto (₺)</label>
                <input
                  type="number"
                  min={0}
                  value={formMaxAmtOverride}
                  onChange={(e) => setFormMaxAmtOverride(e.target.value)}
                  placeholder={
                    currentFormRoleDef?.maxDiscountAmount != null
                      ? `Rol: ${currentFormRoleDef.maxDiscountAmount}₺`
                      : "Limitsiz"
                  }
                  className="w-28 h-[32px] px-2.5 text-[12px] bg-white rounded-lg border border-[#d1d1d6]"
                />
              </div>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
            {categoriesList.map((catKey) => {
              const catMeta = getCategoryLabel(catKey, catalog.categories[catKey])
              const catPerms = catalog.permissions.filter((p) => p.category === catKey)
              return (
                <div key={catKey} className="rounded-xl border border-[#e5e5ea] bg-[#fafafa] p-3">
                  <p className="text-[12px] font-bold text-[#1d1d1f] mb-2">{catMeta.title}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {catPerms.map((perm) => {
                      const roleHas = currentFormRoleDef?.permissions.includes(perm.key) ?? false
                      const isGranted = formGrantedPerms.includes(perm.key)
                      const isRevoked = formRevokedPerms.includes(perm.key)
                      const effective = (roleHas && !isRevoked) || isGranted
                      const label = getPermissionLabel(perm.key, perm)
                      const stateText = isGranted ? "+ Özel Verildi" : isRevoked ? "- Kısıtlandı" : effective ? "✓ Açık" : "Kapalı"
                      const stateStyle = effective
                        ? isGranted
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-[#e63462]/40 bg-white text-[#1d1d1f]"
                        : isRevoked
                          ? "border-red-300 bg-red-50/70 text-red-700 line-through"
                          : "border-[#e5e5ea] bg-[#f5f5f7] text-[#86868b]"

                      return (
                        <button
                          key={perm.key}
                          type="button"
                          onClick={() => toggleStaffPermissionOverride(perm.key)}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-[12px] transition-all ${stateStyle}`}
                        >
                          <span className="font-medium pr-2">{label.title}</span>
                          <span className="text-[10px] font-bold flex-shrink-0">{stateText}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-[#f0f0f0]">
        <button
          type="button"
          onClick={onClose}
          className="h-[36px] px-4 text-[12px] font-medium text-[#86868b] rounded-lg border border-[#d1d1d6]/60 hover:bg-[#f5f5f7]"
        >
          İptal
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="h-[36px] px-5 text-[12px] font-semibold text-white bg-[#e63462] rounded-lg hover:bg-[#d42d56]"
        >
          {editingUser ? "Değişiklikleri Kaydet" : "Kullanıcıyı Oluştur"}
        </button>
      </div>
    </div>
  )
}
