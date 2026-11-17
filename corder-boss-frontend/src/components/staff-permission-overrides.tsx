import { useState } from "react"
import type { PermissionCatalogResponse, RoleDefinition } from "@/lib/types"
import {
  getCategoryLabel,
  getOrderedCatalogCategories,
  getPermissionLabel,
} from "@/lib/permission-labels"
import { Check, RotateCcw, Search, Sliders } from "lucide-react"

interface StaffPermissionOverridesProps {
  catalog: PermissionCatalogResponse | null
  selectedRoleDef: RoleDefinition | undefined
  showCustomPerms: boolean
  grantedPermissions: string[]
  revokedPermissions: string[]
  maxDiscountPctOverride: string
  maxDiscountAmtOverride: string
  onToggleShow: () => void
  onChangeMaxPctOverride: (val: string) => void
  onChangeMaxAmtOverride: (val: string) => void
  onTogglePermissionException: (permKey: string) => void
  onResetOverrides: () => void
}

export function StaffPermissionOverrides({
  catalog,
  selectedRoleDef,
  showCustomPerms,
  grantedPermissions,
  revokedPermissions,
  maxDiscountPctOverride,
  maxDiscountAmtOverride,
  onToggleShow,
  onChangeMaxPctOverride,
  onChangeMaxAmtOverride,
  onTogglePermissionException,
  onResetOverrides,
}: StaffPermissionOverridesProps) {
  const [search, setSearch] = useState("")

  const isEffectivePermChecked = (permKey: string): boolean => {
    const inRole = selectedRoleDef?.permissions.includes(permKey) ?? false
    if (revokedPermissions.includes(permKey)) return false
    if (grantedPermissions.includes(permKey)) return true
    return inRole
  }

  const hasAnyOverride =
    grantedPermissions.length > 0 ||
    revokedPermissions.length > 0 ||
    maxDiscountPctOverride.trim() !== "" ||
    maxDiscountAmtOverride.trim() !== ""

  const orderedCategories = getOrderedCatalogCategories(catalog)

  return (
    <div className="rounded-2xl border border-[#e5e5ea] p-3.5">
      <button
        type="button"
        onClick={onToggleShow}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-[#e63462]" />
          <div>
            <p className="text-[13px] font-bold text-[#1d1d1f]">
              Bu Kullanıcıya Özel Yetki &amp; İskonto Limiti İstisnaları
            </p>
            <p className="text-[11px] text-[#86868b]">
              Rolünden farklı olarak ek yetki verin veya belirli yetkileri kısıtlayın
            </p>
          </div>
        </div>
        <span className="text-[12px] font-semibold text-[#e63462]">
          {showCustomPerms ? "Gizle" : "Özelleştir"}
        </span>
      </button>

      {showCustomPerms && (
        <div className="mt-3 space-y-3 border-t border-[#f0f0f0] pt-3">
          {hasAnyOverride && (
            <div className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
              <span>
                +{grantedPermissions.length} ek yetki, -{revokedPermissions.length} kısıtlama tanımlı
              </span>
              <button
                type="button"
                onClick={onResetOverrides}
                className="inline-flex items-center gap-1 font-bold text-[#e63462] hover:underline"
              >
                <RotateCcw className="h-3 w-3" /> Rol Varsayılanına Dön
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#1d1d1f]">
                Özel Maks. İskonto %
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={maxDiscountPctOverride}
                onChange={(e) => onChangeMaxPctOverride(e.target.value)}
                placeholder={`Rol varsayılanı: %${selectedRoleDef?.maxDiscountPercent ?? 0}`}
                className="h-9 w-full rounded-lg border border-[#d1d1d6] px-2.5 text-[12px]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#1d1d1f]">
                Özel Maks. İskonto Tutarı (₺)
              </label>
              <input
                type="number"
                min={0}
                value={maxDiscountAmtOverride}
                onChange={(e) => onChangeMaxAmtOverride(e.target.value)}
                placeholder={
                  selectedRoleDef?.maxDiscountAmount != null
                    ? `Rol varsayılanı: ${selectedRoleDef.maxDiscountAmount} ₺`
                    : "Rol varsayılanı: Limitsiz"
                }
                className="h-9 w-full rounded-lg border border-[#d1d1d6] px-2.5 text-[12px]"
              />
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#86868b]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Yetki ara..."
              className="h-9 w-full rounded-xl border border-[#d1d1d6] bg-[#f9f9fb] pl-8 pr-3 text-[12px] outline-none focus:border-[#e63462]"
            />
          </div>

          <div className="max-h-60 overflow-y-auto rounded-xl border border-[#e5e5ea] divide-y divide-[#f0f0f0]">
            {orderedCategories.map((catKey) => {
              const catMeta = getCategoryLabel(catKey, catalog?.categories?.[catKey])
              const items = (catalog?.permissions ?? []).filter((p) => {
                if (p.category !== catKey) return false
                if (!search.trim()) return true
                const q = search.toLowerCase()
                const loc = getPermissionLabel(p.key, p)
                return (
                  loc.title.toLowerCase().includes(q) ||
                  loc.description.toLowerCase().includes(q) ||
                  p.key.toLowerCase().includes(q)
                )
              })
              if (items.length === 0) return null
              return (
                <div key={catKey}>
                  <div className="bg-[#f5f5f7] px-3 py-1.5 text-[11px] font-bold text-[#86868b]">
                    {catMeta.title}
                  </div>
                  <div className="divide-y divide-[#f0f0f0]">
                    {items.map((p) => {
                      const checked = isEffectivePermChecked(p.key)
                      const isGrantedOverride = grantedPermissions.includes(p.key)
                      const isRevokedOverride = revokedPermissions.includes(p.key)
                      const localized = getPermissionLabel(p.key, p)
                      return (
                        <div
                          key={p.key}
                          onClick={() => onTogglePermissionException(p.key)}
                          className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-[#f9f9fb]"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="text-[12px] font-medium text-[#1d1d1f]">
                              {localized.title}
                            </span>
                            {isGrantedOverride && (
                              <span className="ml-1.5 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                                + Ek Yetki
                              </span>
                            )}
                            {isRevokedOverride && (
                              <span className="ml-1.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                                - Kısıtlandı
                              </span>
                            )}
                          </div>
                          <div
                            className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${
                              checked
                                ? "border-[#e63462] bg-[#e63462] text-white"
                                : "border-[#d1d1d6] bg-white"
                            }`}
                          >
                            {checked && <Check className="h-3.5 w-3.5" />}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
