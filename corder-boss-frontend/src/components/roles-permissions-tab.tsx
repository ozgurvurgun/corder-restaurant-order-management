import { useEffect, useMemo, useState } from "react"
import { useBossStore } from "@/lib/boss-store"
import { bossApi } from "@/lib/api"
import type { PermissionCategory } from "@/lib/types"
import { getRoleDisplayName } from "@/lib/permission-labels"
import { RolePermissionMatrix } from "./role-permission-matrix"
import { RoleAccessLimitsCard } from "./role-access-limits-card"
import { NewRoleModal } from "./new-role-modal"
import { ShieldCheck, Plus, Save, CopyCheck } from "lucide-react"

export function RolesPermissionsTab() {
  const {
    catalog,
    roles,
    branches,
    effectiveBranchId,
    effectiveBranch,
    setSelectedBranchId,
    refreshBranchDetails,
    showToast,
  } = useBossStore()

  const [selectedRoleKey, setSelectedRoleKey] = useState<string>("branch_manager")
  const [draftPermissions, setDraftPermissions] = useState<string[]>([])
  const [draftPanel, setDraftPanel] = useState(false)
  const [draftTerminal, setDraftTerminal] = useState(true)
  const [draftMaxPct, setDraftMaxPct] = useState<number>(0)
  const [draftMaxAmt, setDraftMaxAmt] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showNewRoleModal, setShowNewRoleModal] = useState(false)

  const selectedRole = useMemo(
    () => roles.find((r) => r.key === selectedRoleKey) ?? roles[0] ?? null,
    [roles, selectedRoleKey]
  )

  useEffect(() => {
    if (!selectedRole) return
    setSelectedRoleKey(selectedRole.key)
    setDraftPermissions(selectedRole.permissions)
    setDraftPanel(selectedRole.canAccessPanel)
    setDraftTerminal(selectedRole.canAccessTerminal)
    setDraftMaxPct(selectedRole.maxDiscountPercent)
    setDraftMaxAmt(
      selectedRole.maxDiscountAmount != null ? String(selectedRole.maxDiscountAmount) : ""
    )
  }, [selectedRole])

  const togglePermission = (permKey: string) => {
    setDraftPermissions((prev) =>
      prev.includes(permKey) ? prev.filter((k) => k !== permKey) : [...prev, permKey]
    )
  }

  const toggleCategoryAll = (cat: PermissionCategory) => {
    if (!catalog) return
    const catKeys = catalog.permissions
      .filter((p) => p.category === cat)
      .map((p) => p.key)
    const allEnabled = catKeys.every((k) => draftPermissions.includes(k))
    if (allEnabled) {
      setDraftPermissions((prev) => prev.filter((k) => !catKeys.includes(k)))
    } else {
      setDraftPermissions((prev) => Array.from(new Set([...prev, ...catKeys])))
    }
  }

  const handleSaveRole = async () => {
    if (!selectedRole || !effectiveBranchId) return
    const roleTitle = getRoleDisplayName(selectedRole.key, selectedRole.name)
    setSaving(true)
    try {
      await bossApi.roles.update(effectiveBranchId, selectedRole.key, {
        canAccessPanel: draftPanel,
        canAccessTerminal: draftTerminal,
        permissions: draftPermissions,
        maxDiscountPercent: draftMaxPct,
        maxDiscountAmount: draftMaxAmt.trim() !== "" ? Number(draftMaxAmt) : null,
      })
      await refreshBranchDetails(effectiveBranchId)
      showToast(`${roleTitle} rol yetkileri kaydedildi`)
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Kaydedilemedi", "error")
    } finally {
      setSaving(false)
    }
  }

  const handleResetDefault = async () => {
    if (!selectedRole || !effectiveBranchId) return
    const roleTitle = getRoleDisplayName(selectedRole.key, selectedRole.name)
    if (!confirm(`${roleTitle} rolünü fabrika varsayılan yetkilerine sıfırlamak istediğinize emin misiniz?`)) return
    setSaving(true)
    try {
      await bossApi.roles.reset(effectiveBranchId, selectedRole.key)
      await refreshBranchDetails(effectiveBranchId)
      showToast(`${roleTitle} varsayılan ayarlara döndürüldü`)
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Sıfırlanamadı", "error")
    } finally {
      setSaving(false)
    }
  }

  const handleSyncToAllBranches = async () => {
    if (!effectiveBranchId || branches.length <= 1) return
    if (!confirm(`${effectiveBranch?.name} şubesindeki tüm rol ve yetki matrisini diğer ${branches.length - 1} şubenize de kopyalamak istiyor musunuz?`)) return
    setSyncing(true)
    try {
      const res = await bossApi.overview.syncRoles(effectiveBranchId)
      showToast(`${res.syncedBranches} şubeye ${res.syncedRoles} rol eşitlendi`)
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Şubeler eşitlenemedi", "error")
    } finally {
      setSyncing(false)
    }
  }

  const handleCreateCustomRole = async (payload: {
    name: string
    description?: string
    color: string
  }) => {
    if (!effectiveBranchId) return
    setSaving(true)
    try {
      const created = await bossApi.roles.create(effectiveBranchId, {
        name: payload.name,
        description: payload.description,
        color: payload.color,
        canAccessPanel: false,
        canAccessTerminal: true,
        permissions: ["order.view", "order.create", "order.add_note"],
        maxDiscountPercent: 0,
        maxDiscountAmount: 0,
      })
      await refreshBranchDetails(effectiveBranchId)
      setSelectedRoleKey(created.key)
      setShowNewRoleModal(false)
      showToast(`${created.name} rolü oluşturuldu`)
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Rol oluşturulamadı", "error")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCustomRole = async () => {
    if (!selectedRole || selectedRole.isSystem || !effectiveBranchId) return
    const roleTitle = getRoleDisplayName(selectedRole.key, selectedRole.name)
    if (!confirm(`${roleTitle} rolünü silmek istediğinize emin misiniz?`)) return
    setSaving(true)
    try {
      await bossApi.roles.remove(effectiveBranchId, selectedRole.key)
      await refreshBranchDetails(effectiveBranchId)
      setSelectedRoleKey("branch_manager")
      showToast("Özel rol silindi")
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Silinemedi", "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#e63462]" />
              <h2 className="text-[16px] font-bold text-[#1d1d1f]">
                Rol &amp; Yetki Kısıtlama Merkezi
              </h2>
            </div>
            <p className="mt-0.5 text-[12px] text-[#86868b]">
              Şube: <strong className="text-[#1d1d1f]">{effectiveBranch?.name}</strong> — Masa taşıma, iskonto limitleri, iptal, kasa ve tüm aksiyon yetkileri.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {branches.length > 1 && (
              <select
                value={effectiveBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="h-9 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3 text-[12px] font-semibold text-[#1d1d1f]"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    Şube: {b.name}
                  </option>
                ))}
              </select>
            )}
            {branches.length > 1 && (
              <button
                type="button"
                onClick={() => void handleSyncToAllBranches()}
                disabled={syncing}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e63462]/30 bg-[#e63462]/10 px-3 text-[12px] font-semibold text-[#e63462] hover:bg-[#e63462]/15"
              >
                <CopyCheck className="h-3.5 w-3.5" />
                {syncing ? "Eşitleniyor…" : "Tüm Şubelere Eşitle"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowNewRoleModal(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#1d1d1f] px-3 text-[12px] font-semibold text-white hover:bg-black/80"
            >
              <Plus className="h-3.5 w-3.5" />
              Özel Rol Ekle
            </button>
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {roles.map((role) => {
            const active = selectedRole?.key === role.key
            const roleTitle = getRoleDisplayName(role.key, role.name)
            return (
              <button
                key={role.key}
                type="button"
                onClick={() => setSelectedRoleKey(role.key)}
                className={`flex-shrink-0 rounded-2xl border px-3.5 py-2 text-left transition-all ${
                  active
                    ? "border-[#e63462] bg-[#e63462] text-white shadow-md shadow-[#e63462]/20"
                    : "border-[#e5e5ea] bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#ebebf0]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: active ? "#ffffff" : role.color }}
                  />
                  <span className="text-[13px] font-bold">{roleTitle}</span>
                </div>
                <p className={`mt-0.5 text-[10px] ${active ? "text-white/80" : "text-[#86868b]"}`}>
                  {role.permissions.length} Yetki • Maks %{role.maxDiscountPercent} İskonto
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {selectedRole && (
        <>
          <RoleAccessLimitsCard
            selectedRole={selectedRole}
            draftPanel={draftPanel}
            draftTerminal={draftTerminal}
            draftMaxPct={draftMaxPct}
            draftMaxAmt={draftMaxAmt}
            saving={saving}
            onTogglePanel={() => setDraftPanel((v) => !v)}
            onToggleTerminal={() => setDraftTerminal((v) => !v)}
            onChangeMaxPct={setDraftMaxPct}
            onChangeMaxAmt={setDraftMaxAmt}
            onResetDefault={() => void handleResetDefault()}
            onDeleteCustomRole={() => void handleDeleteCustomRole()}
            onSaveRole={() => void handleSaveRole()}
          />

          <RolePermissionMatrix
            catalog={catalog}
            draftPermissions={draftPermissions}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onTogglePermission={togglePermission}
            onToggleCategoryAll={toggleCategoryAll}
          />

          <div className="sticky bottom-[72px] z-20 flex items-center justify-between rounded-2xl border border-[#e63462]/30 bg-white/95 p-3 shadow-lg backdrop-blur-md">
            <div>
              <p className="text-[12px] font-bold text-[#1d1d1f]">
                {getRoleDisplayName(selectedRole.key, selectedRole.name)} ({draftPermissions.length} aktif yetki)
              </p>
              <p className="text-[11px] text-[#86868b]">
                Maks İskonto: %{draftMaxPct} {draftMaxAmt ? `• Maks ${draftMaxAmt} ₺` : "• Tutar Limitsiz"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleSaveRole()}
              disabled={saving}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#e63462] px-5 text-[13px] font-bold text-white shadow-md shadow-[#e63462]/25 hover:bg-[#d42d56] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Kaydediliyor…" : "Değişiklikleri Kaydet"}
            </button>
          </div>
        </>
      )}

      {showNewRoleModal && (
        <NewRoleModal
          saving={saving}
          onClose={() => setShowNewRoleModal(false)}
          onSubmit={handleCreateCustomRole}
        />
      )}
    </div>
  )
}
