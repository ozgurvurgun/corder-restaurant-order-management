import { useEffect, useMemo, useState } from "react"
import { api } from "@/lib/api"
import type { PanelPermissionCatalogDto, PanelRoleDefinitionDto } from "@/lib/api/system.api"
import { getCategoryLabel, getPermissionLabel, getRoleDisplayName } from "@/lib/permission-labels"
import { usePanelToast } from "../panel-toast"
import { Check, Plus, RotateCcw, Save, Shield, Trash2 } from "lucide-react"

export interface RolePermissionsMatrixProps {
  token: string | null
  catalog: PanelPermissionCatalogDto | null
  roles: PanelRoleDefinitionDto[]
  onReloadRoles: () => Promise<void>
}

export function RolePermissionsMatrix({
  token,
  catalog,
  roles,
  onReloadRoles,
}: RolePermissionsMatrixProps) {
  const { showToast } = usePanelToast()

  const [selectedRoleKey, setSelectedRoleKey] = useState<string>("branch_manager")
  const [draftRolePerms, setDraftRolePerms] = useState<string[]>([])
  const [draftRolePanel, setDraftRolePanel] = useState(false)
  const [draftRoleTerminal, setDraftRoleTerminal] = useState(true)
  const [draftRoleMaxPct, setDraftRoleMaxPct] = useState(0)
  const [draftRoleMaxAmt, setDraftRoleMaxAmt] = useState("")
  const [roleSaving, setRoleSaving] = useState(false)
  const [newRoleName, setNewRoleName] = useState("")
  const [showNewRoleInput, setShowNewRoleInput] = useState(false)
  const [confirmAction, setConfirmAction] = useState<"reset" | "delete" | null>(null)

  const selectedRoleObj = useMemo(
    () => roles.find((r) => r.key === selectedRoleKey) ?? roles[0] ?? null,
    [roles, selectedRoleKey]
  )

  useEffect(() => {
    if (!selectedRoleObj) return
    setSelectedRoleKey(selectedRoleObj.key)
    setDraftRolePerms(selectedRoleObj.permissions)
    setDraftRolePanel(selectedRoleObj.canAccessPanel)
    setDraftRoleTerminal(selectedRoleObj.canAccessTerminal)
    setDraftRoleMaxPct(selectedRoleObj.maxDiscountPercent)
    setDraftRoleMaxAmt(
      selectedRoleObj.maxDiscountAmount != null ? String(selectedRoleObj.maxDiscountAmount) : ""
    )
  }, [selectedRoleObj])

  const categoriesList = useMemo(() => (catalog ? Object.keys(catalog.categories) : []), [catalog])

  const handleSaveRole = async () => {
    if (!token || !selectedRoleObj) return
    setRoleSaving(true)
    try {
      await api.roles.update(token, selectedRoleObj.key, {
        canAccessPanel: draftRolePanel,
        canAccessTerminal: draftRoleTerminal,
        permissions: draftRolePerms,
        maxDiscountPercent: draftRoleMaxPct,
        maxDiscountAmount: draftRoleMaxAmt.trim() !== "" ? Number(draftRoleMaxAmt) : null,
      })
      await onReloadRoles()
      showToast(
        `${getRoleDisplayName(selectedRoleObj.key, selectedRoleObj.name)} yetki matrisi güncellendi`,
        "success"
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Rol kaydedilemedi", "error")
    } finally {
      setRoleSaving(false)
    }
  }

  const handleResetRole = async () => {
    if (!token || !selectedRoleObj) return
    setRoleSaving(true)
    setConfirmAction(null)
    try {
      await api.roles.reset(token, selectedRoleObj.key)
      await onReloadRoles()
      showToast("Rol varsayılan yetkilerine sıfırlandı", "success")
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Sıfırlanamadı", "error")
    } finally {
      setRoleSaving(false)
    }
  }

  const handleCreateCustomRole = async () => {
    if (!token || !newRoleName.trim()) return
    setRoleSaving(true)
    try {
      const created = await api.roles.create(token, {
        name: newRoleName.trim(),
        canAccessPanel: false,
        canAccessTerminal: true,
        permissions: ["order.view", "order.create", "order.add_note"],
        maxDiscountPercent: 0,
        maxDiscountAmount: 0,
      })
      await onReloadRoles()
      setSelectedRoleKey(created.key)
      setNewRoleName("")
      setShowNewRoleInput(false)
      showToast(`${created.name} rolü oluşturuldu`, "success")
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Rol oluşturulamadı", "error")
    } finally {
      setRoleSaving(false)
    }
  }

  const handleDeleteCustomRole = async () => {
    if (!token || !selectedRoleObj || selectedRoleObj.isSystem) return
    setRoleSaving(true)
    setConfirmAction(null)
    try {
      await api.roles.delete(token, selectedRoleObj.key)
      await onReloadRoles()
      setSelectedRoleKey("branch_manager")
      showToast("Özel rol silindi", "info")
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Rol silinemedi", "error")
    } finally {
      setRoleSaving(false)
    }
  }

  return (
    <div className="w-full space-y-4">
      <div className="bg-white rounded-2xl border border-[#d1d1d6]/70 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-bold text-[#1d1d1f] flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#e63462]" />
              Şube Rol &amp; 48 Yetki Matrisi Yönetimi
            </h3>
            <p className="text-[12px] text-[#86868b]">
              Mekanınızdaki rollerin panel/terminal erişimini, maksimum iskonto limitlerini ve 48 granüler yetkisini doğrudan buradan yapılandırın.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {showNewRoleInput ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="Özel rol adı (Örn: Barista)"
                  className="h-8 px-3 text-[12px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]"
                />
                <button
                  type="button"
                  disabled={roleSaving}
                  onClick={() => void handleCreateCustomRole()}
                  className="h-8 px-3 rounded-lg bg-[#e63462] text-white text-[12px] font-semibold"
                >
                  Oluştur
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewRoleInput(false)}
                  className="h-8 px-2 rounded-lg text-[12px] text-[#86868b]"
                >
                  İptal
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowNewRoleInput(true)}
                className="h-8 px-3 rounded-lg bg-[#1d1d1f] text-white text-[12px] font-semibold flex items-center gap-1.5 hover:bg-black/80"
              >
                <Plus className="w-3.5 h-3.5" /> Özel Rol Ekle
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {roles.map((r) => {
            const active = selectedRoleObj?.key === r.key
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => setSelectedRoleKey(r.key)}
                className={`rounded-xl border px-3.5 py-2 text-left transition-all ${
                  active
                    ? "border-[#e63462] bg-[#e63462] text-white shadow-xs"
                    : "border-[#e5e5ea] bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#ebebf0]"
                }`}
              >
                <p className="text-[12px] font-bold">{getRoleDisplayName(r.key, r.name)}</p>
                <p className={`text-[10px] ${active ? "text-white/80" : "text-[#86868b]"}`}>
                  {r.permissions.length} Yetki • Maks %{r.maxDiscountPercent} İskonto
                </p>
              </button>
            )
          })}
        </div>

        {selectedRoleObj && (
          <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-[#f0f0f0]">
            <div className="flex flex-wrap items-center gap-5">
              <label className="flex items-center gap-2 text-[12px] font-semibold text-[#1d1d1f] cursor-pointer">
                <input
                  type="checkbox"
                  checked={draftRolePanel}
                  onChange={() => setDraftRolePanel((v) => !v)}
                  className="accent-[#e63462]"
                />
                Merchant Panel Girişi
              </label>
              <label className="flex items-center gap-2 text-[12px] font-semibold text-[#1d1d1f] cursor-pointer">
                <input
                  type="checkbox"
                  checked={draftRoleTerminal}
                  onChange={() => setDraftRoleTerminal((v) => !v)}
                  className="accent-[#e63462]"
                />
                El Terminali (PIN) Girişi
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium text-[#86868b]">Maks İskonto (%):</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={draftRoleMaxPct}
                  onChange={(e) => setDraftRoleMaxPct(Number(e.target.value) || 0)}
                  className="w-20 h-8 px-2.5 text-[12px] font-semibold bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium text-[#86868b]">Maks İskonto (₺):</span>
                <input
                  type="number"
                  min={0}
                  value={draftRoleMaxAmt}
                  onChange={(e) => setDraftRoleMaxAmt(e.target.value)}
                  placeholder="Limitsiz"
                  className="w-24 h-8 px-2.5 text-[12px] font-semibold bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {confirmAction ? (
                <div className="flex items-center gap-1.5 bg-red-50 px-2.5 py-1 rounded-lg border border-red-200">
                  <span className="text-[11px] font-medium text-red-700">
                    {confirmAction === "reset" ? "Sıfırlansın mı?" : "Silinsin mi?"}
                  </span>
                  <button
                    type="button"
                    disabled={roleSaving}
                    onClick={() =>
                      void (confirmAction === "reset"
                        ? handleResetRole()
                        : handleDeleteCustomRole())
                    }
                    className="h-6 px-2 rounded bg-red-600 text-white text-[11px] font-semibold"
                  >
                    Evet
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmAction(null)}
                    className="h-6 px-2 rounded text-[11px] text-[#86868b]"
                  >
                    Vazgeç
                  </button>
                </div>
              ) : selectedRoleObj.isSystem ? (
                <button
                  type="button"
                  disabled={roleSaving}
                  onClick={() => setConfirmAction("reset")}
                  className="h-8 px-3 rounded-lg border border-[#d1d1d6] text-[12px] font-medium text-[#86868b] hover:text-[#1d1d1f] flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Varsayılana Sıfırla
                </button>
              ) : (
                <button
                  type="button"
                  disabled={roleSaving}
                  onClick={() => setConfirmAction("delete")}
                  className="h-8 px-3 rounded-lg border border-red-300 text-[12px] font-medium text-red-600 hover:bg-red-50 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Özel Rolü Sil
                </button>
              )}
              <button
                type="button"
                disabled={roleSaving}
                onClick={() => void handleSaveRole()}
                className="h-8 px-4 rounded-lg bg-[#e63462] text-white text-[12px] font-semibold flex items-center gap-1.5 hover:bg-[#d42d56] disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {roleSaving ? "Kaydediliyor…" : "Rol Yetkilerini Kaydet"}
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedRoleObj && catalog && (
        <div className="space-y-3">
          {categoriesList.map((catKey) => {
            const catMeta = getCategoryLabel(catKey, catalog.categories[catKey])
            const catPerms = catalog.permissions.filter((p) => p.category === catKey)
            const allEnabled = catPerms.every((p) => draftRolePerms.includes(p.key))

            return (
              <div key={catKey} className="bg-white rounded-2xl border border-[#d1d1d6]/60 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-[13px] font-bold text-[#1d1d1f]">{catMeta.title}</h4>
                    <p className="text-[11px] text-[#86868b]">{catMeta.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const keys = catPerms.map((p) => p.key)
                      setDraftRolePerms((prev) =>
                        allEnabled ? prev.filter((k) => !keys.includes(k)) : Array.from(new Set([...prev, ...keys]))
                      )
                    }}
                    className="text-[11px] font-semibold text-[#e63462] hover:underline"
                  >
                    {allEnabled ? "Kategoriyi Kaldır" : "Tümünü Seç"}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {catPerms.map((perm) => {
                    const enabled = draftRolePerms.includes(perm.key)
                    const label = getPermissionLabel(perm.key, perm)
                    return (
                      <button
                        key={perm.key}
                        type="button"
                        onClick={() =>
                          setDraftRolePerms((prev) =>
                            prev.includes(perm.key) ? prev.filter((k) => k !== perm.key) : [...prev, perm.key]
                          )
                        }
                        className={`flex items-start justify-between gap-2 rounded-xl border p-3 text-left transition-all ${
                          enabled
                            ? "border-[#e63462]/40 bg-[#fef3f5]/60 text-[#1d1d1f]"
                            : "border-[#e5e5ea] bg-[#f9f9fb] text-[#86868b]"
                        }`}
                      >
                        <div>
                          <p className="text-[12px] font-semibold leading-tight">{label.title}</p>
                          <p className="mt-0.5 text-[11px] text-[#86868b] leading-snug">{label.description}</p>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 border ${
                            enabled ? "bg-[#e63462] border-[#e63462] text-white" : "border-[#d1d1d6] bg-white"
                          }`}
                        >
                          {enabled && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
