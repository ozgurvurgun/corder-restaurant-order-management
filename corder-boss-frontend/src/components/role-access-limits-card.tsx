import type { RoleDefinition } from "@/lib/types"
import { getRoleDisplayDescription, getRoleDisplayName } from "@/lib/permission-labels"
import { Monitor, Percent, RotateCcw, Save, Smartphone, Trash2 } from "lucide-react"

interface RoleAccessLimitsCardProps {
  selectedRole: RoleDefinition
  draftPanel: boolean
  draftTerminal: boolean
  draftMaxPct: number
  draftMaxAmt: string
  saving: boolean
  onTogglePanel: () => void
  onToggleTerminal: () => void
  onChangeMaxPct: (pct: number) => void
  onChangeMaxAmt: (amt: string) => void
  onResetDefault: () => void
  onDeleteCustomRole: () => void
  onSaveRole: () => void
}

export function RoleAccessLimitsCard({
  selectedRole,
  draftPanel,
  draftTerminal,
  draftMaxPct,
  draftMaxAmt,
  saving,
  onTogglePanel,
  onToggleTerminal,
  onChangeMaxPct,
  onChangeMaxAmt,
  onResetDefault,
  onDeleteCustomRole,
  onSaveRole,
}: RoleAccessLimitsCardProps) {
  const displayName = getRoleDisplayName(selectedRole.key, selectedRole.name)
  const displayDesc = getRoleDisplayDescription(selectedRole.key, selectedRole.description)

  return (
    <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f0f0f0] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[16px] font-bold text-[#1d1d1f]">{displayName}</h3>
            <span className="rounded-md bg-[#f5f5f7] px-2 py-0.5 font-mono text-[11px] text-[#86868b]">
              {selectedRole.key}
            </span>
          </div>
          <p className="text-[12px] text-[#86868b] mt-0.5">{displayDesc}</p>
        </div>

        <div className="flex items-center gap-2">
          {selectedRole.isSystem ? (
            <button
              type="button"
              onClick={onResetDefault}
              disabled={saving}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#d1d1d6] px-3 text-[12px] font-medium text-[#86868b] hover:bg-[#f5f5f7]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Varsayılana Sıfırla
            </button>
          ) : (
            <button
              type="button"
              onClick={onDeleteCustomRole}
              disabled={saving}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-[12px] font-medium text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Rolü Sil
            </button>
          )}
          <button
            type="button"
            onClick={onSaveRole}
            disabled={saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#e63462] px-4 text-[12px] font-semibold text-white shadow-sm hover:bg-[#d42d56] disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Kaydediliyor…" : "Yetkileri Kaydet"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onTogglePanel}
          className={`flex items-center justify-between rounded-2xl border p-3.5 text-left transition-all ${
            draftPanel ? "border-[#e63462] bg-[#e63462]/5" : "border-[#e5e5ea] bg-[#f9f9fb]"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                draftPanel ? "bg-[#e63462] text-white" : "bg-[#e5e5ea] text-[#86868b]"
              }`}
            >
              <Monitor className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-[#1d1d1f]">
                Merchant Panel Girişi (Web / Kasa PC)
              </p>
              <p className="text-[11px] text-[#86868b]">
                E-posta ve parola ile yönetim/kasa paneline giriş
              </p>
            </div>
          </div>
          <div
            className={`h-6 w-11 rounded-full p-0.5 transition-colors ${
              draftPanel ? "bg-[#e63462]" : "bg-[#d1d1d6]"
            }`}
          >
            <div
              className={`h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                draftPanel ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </div>
        </button>

        <button
          type="button"
          onClick={onToggleTerminal}
          className={`flex items-center justify-between rounded-2xl border p-3.5 text-left transition-all ${
            draftTerminal ? "border-[#e63462] bg-[#e63462]/5" : "border-[#e5e5ea] bg-[#f9f9fb]"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                draftTerminal ? "bg-[#e63462] text-white" : "bg-[#e5e5ea] text-[#86868b]"
              }`}
            >
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-[#1d1d1f]">
                POS / Garson Terminali Girişi (PIN)
              </p>
              <p className="text-[11px] text-[#86868b]">
                4-8 haneli PIN kodu ile el terminalinde işlem yapma
              </p>
            </div>
          </div>
          <div
            className={`h-6 w-11 rounded-full p-0.5 transition-colors ${
              draftTerminal ? "bg-[#e63462]" : "bg-[#d1d1d6]"
            }`}
          >
            <div
              className={`h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                draftTerminal ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </div>
        </button>
      </div>

      <div className="rounded-2xl border border-[#e5e5ea] bg-[#f9f9fb] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Percent className="h-4 w-4 text-[#e63462]" />
          <h4 className="text-[13px] font-bold text-[#1d1d1f]">
            İskonto &amp; Fiyat Müdahale Üst Limitleri
          </h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between text-[12px] mb-1.5">
              <span className="font-medium text-[#1d1d1f]">
                Maksimum Yüzdesel İskonto Oranı (%)
              </span>
              <span className="rounded-md bg-[#e63462]/10 px-2 py-0.5 font-bold text-[#e63462]">
                %{draftMaxPct}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={draftMaxPct}
              onChange={(e) => onChangeMaxPct(Number(e.target.value))}
              className="w-full accent-[#e63462]"
            />
            <div className="flex justify-between text-[10px] text-[#86868b] mt-1">
              <span>%0 (Yetkisiz)</span>
              <span>%10</span>
              <span>%25</span>
              <span>%50</span>
              <span>%100</span>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#1d1d1f] mb-1.5">
              Maksimum Tutar İskonto Limiti (₺)
            </label>
            <input
              type="number"
              min={0}
              value={draftMaxAmt}
              onChange={(e) => onChangeMaxAmt(e.target.value)}
              placeholder="Örn: 250 (Boş = Limitsiz)"
              className="h-10 w-full rounded-xl border border-[#d1d1d6] bg-white px-3 text-[13px] text-[#1d1d1f] outline-none focus:border-[#e63462]"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

