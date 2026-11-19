import { useEffect, useMemo, useState } from "react"
import { useBossStore } from "@/lib/boss-store"
import { bossApi } from "@/lib/api"
import type { StaffMemberDto } from "@/lib/types"
import { getRoleDisplayName } from "@/lib/permission-labels"
import { StaffUserModal } from "./staff-user-modal"
import { SubBossesSection } from "./sub-bosses-section"
import { TerminalGeofenceBossCard } from "./terminal-geofence-boss-card"
import { CustomSelect } from "./ui/custom-inputs"
import { useConfirm } from "./ui/confirm-dialog"
import { PaginationBar } from "./ui/pagination-bar"
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Monitor,
  Smartphone,
  Shield,
  Mail,
  Phone,
  Building2,
  Clock,
} from "lucide-react"

export function StaffUsersTab() {
  const {
    staff,
    roles,
    catalog,
    branches,
    selectedBranchId,
    effectiveBranchId,
    effectiveBranch,
    setSelectedBranchId,
    refreshBranchDetails,
    showToast,
  } = useBossStore()
  const confirm = useConfirm()

  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<StaffMemberDto | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 8

  useEffect(() => {
    setPage(1)
  }, [effectiveBranchId, staff.length])

  const pagedStaff = useMemo(() => {
    const start = (page - 1) * pageSize
    return staff.slice(start, start + pageSize)
  }, [staff, page])

  const openCreateModal = () => {
    setEditingUser(null)
    setShowModal(true)
  }

  const openEditModal = (u: StaffMemberDto) => {
    setEditingUser(u)
    setShowModal(true)
  }

  const handleSaveUser = async (payload: {
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
    shiftRestrictionEnabled?: boolean
    shiftStartTime?: string | null
    shiftEndTime?: string | null
    shiftCutoffOffsetMinutes?: number
  }) => {
    if (!effectiveBranchId) return
    setSubmitting(true)
    try {
      if (editingUser) {
        await bossApi.staff.update(effectiveBranchId, editingUser.id, payload)
        showToast(`${payload.name} bilgileri ve yetkileri güncellendi`)
      } else {
        await bossApi.staff.create(effectiveBranchId, {
          ...payload,
          phone: payload.phone ?? undefined,
          email: payload.email ?? undefined,
        })
        showToast(`${payload.name} kullanıcısı oluşturuldu`)
      }
      await refreshBranchDetails(effectiveBranchId)
      setShowModal(false)
    } catch (err) {
      showToast(err instanceof Error ? err.message : "İşlem başarısız", "error")
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (u: StaffMemberDto) => {
    if (!effectiveBranchId) return
    try {
      await bossApi.staff.update(effectiveBranchId, u.id, { isActive: !u.isActive })
      await refreshBranchDetails(effectiveBranchId)
      showToast(`${u.name} ${!u.isActive ? "aktif" : "pasif"} yapıldı`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Güncellenemedi", "error")
    }
  }

  const handleToggleTerminalAccess = async (u: StaffMemberDto) => {
    if (!effectiveBranchId) return
    const nextAccess = !u.canAccessTerminal
    try {
      await bossApi.staff.update(effectiveBranchId, u.id, {
        canAccessTerminal: nextAccess,
      })
      await refreshBranchDetails(effectiveBranchId)
      showToast(
        nextAccess
          ? `${u.name} el terminali erişimi açıldı`
          : `${u.name} el terminalinden anında düşürüldü ve girişi kapatıldı`
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Güncellenemedi", "error")
    }
  }

  const handleDelete = async (u: StaffMemberDto) => {
    if (!effectiveBranchId) return
    if (!(await confirm(`${u.name} kullanıcısını silmek istediğinize emin misiniz?`))) return
    try {
      await bossApi.staff.remove(effectiveBranchId, u.id)
      await refreshBranchDetails(effectiveBranchId)
      showToast(`${u.name} silindi`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Silinemedi", "error")
    }
  }

  return (
    <div className="space-y-4">
      <SubBossesSection />
      <TerminalGeofenceBossCard />

      {/* Branch Staff & Merchant Panel Users */}
      <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[#e63462]" />
              <h2 className="text-[15px] font-semibold text-[#1d1d1f]">
                Merchant Panel &amp; Terminal Kullanıcıları ({staff.length})
              </h2>
            </div>
            <p className="mt-0.5 text-[12px] text-[#86868b]">
              Şube: <span className="font-semibold text-[#1d1d1f]">{effectiveBranch?.name}</span> - Müdür, kasiyer, garson ve özel yetkili kullanıcıları buradan veya Merchant Panelinden oluşturabilirsiniz.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {branches.length > 1 && (
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-[#e63462]/30 bg-[#fef3f5] px-2.5 py-1.5">
                <Building2 className="h-3.5 w-3.5 text-[#e63462]" />
                <span className="text-[11px] font-medium text-[#86868b]">
                  {selectedBranchId === "ALL" ? "Düzenlenen:" : "Şube:"}
                </span>
                <CustomSelect
                  value={effectiveBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  aria-label="Düzenlenen Şube"
                  className="bg-transparent text-[12px] font-semibold text-[#1d1d1f]"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </CustomSelect>
              </div>
            )}
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#e63462] px-3.5 text-[12px] font-semibold text-white shadow-sm hover:bg-[#d42d56]"
            >
              <Plus className="h-4 w-4" />
              Yeni Kullanıcı Oluştur
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-4">
        {staff.length === 0 ? (
          <div className="p-6 text-center">
            <Users className="mx-auto h-9 w-9 text-[#86868b]" />
            <h3 className="mt-2 text-[15px] font-semibold text-[#1d1d1f]">
              Bu şubede henüz kullanıcı yok
            </h3>
            <p className="mt-1 text-[12px] text-[#86868b]">
              Merchant Paneline e-posta/parola ile veya El Terminaline PIN ile girecek personelleri oluşturun.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#e63462] px-4 py-2 text-[13px] font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> İlk Kullanıcıyı Ekle
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {pagedStaff.map((u) => {
                const hasOverrides =
                  u.grantedPermissions.length > 0 ||
                  u.revokedPermissions.length > 0 ||
                  u.maxDiscountPercentOverride != null ||
                  u.maxDiscountAmountOverride != null

                return (
                  <div
                    key={u.id}
                    className="rounded-2xl border border-[#e5e5ea] bg-[#f9f9fb] p-3.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-[14px] font-semibold text-white"
                          style={{ backgroundColor: u.roleColor || "#e63462" }}
                        >
                          {u.name.charAt(0).toLocaleUpperCase("tr-TR")}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="truncate text-[14px] font-semibold text-[#1d1d1f]">
                              {u.name}
                            </h3>
                            <span
                              className="rounded-lg px-2 py-0.5 text-[11px] font-semibold text-white"
                              style={{ backgroundColor: u.roleColor || "#e63462" }}
                            >
                              {getRoleDisplayName(u.role, u.roleLabel)}
                            </span>
                            {hasOverrides && (
                              <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                Özel Yetki Tanımlı
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-[#86868b]">
                            {u.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" /> {u.email}
                              </span>
                            )}
                            {u.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {u.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                        <div
                          onClick={() => void handleToggleTerminalAccess(u)}
                          title={
                            u.canAccessTerminal
                              ? "Terminalden Anında Düşür & Erişimi Kapat"
                              : "El Terminali Erişimini Aç"
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[#e5e5ea] bg-white px-2.5 py-1 cursor-pointer select-none"
                        >
                          <Smartphone
                            className={`h-3.5 w-3.5 ${
                              u.canAccessTerminal ? "text-[#e63462]" : "text-[#86868b]"
                            }`}
                          />
                          <span className="text-[11px] font-semibold text-[#1d1d1f]">
                            Terminal
                          </span>
                          <button
                            type="button"
                            className={`h-5 w-9 flex-shrink-0 rounded-full p-0.5 transition-colors ${
                              u.canAccessTerminal ? "bg-[#e63462]" : "bg-[#d1d1d6]"
                            }`}
                          >
                            <div
                              className={`h-4 w-4 rounded-full bg-white transition-transform ${
                                u.canAccessTerminal ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleToggleActive(u)}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            u.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {u.isActive ? "Aktif" : "Pasif"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(u)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl bg-white border border-[#e5e5ea] text-[#1d1d1f] hover:bg-[#e8e8ed]"
                          title="Düzenle & Yetkileri Özelleştir"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(u)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl bg-white border border-[#e5e5ea] text-red-500 hover:bg-red-50"
                          title="Sil"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#e5e5ea] pt-2.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                          u.canAccessPanel
                            ? "bg-blue-50 text-blue-700"
                            : "bg-white text-[#86868b]"
                        }`}
                      >
                        <Monitor className="h-3 w-3" />
                        Merchant Panel: {u.canAccessPanel ? "Açık" : "Kapalı"}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                          u.canAccessTerminal
                            ? u.hasPin
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-100 text-amber-800"
                            : "bg-white text-[#86868b]"
                        }`}
                      >
                        <Smartphone className="h-3 w-3" />
                        El Terminali (PIN):{" "}
                        {u.canAccessTerminal
                          ? u.hasPin
                            ? "Açık"
                            : "Açık (PIN Eksik)"
                          : "Kapalı"}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-[#fef3f5] px-2.5 py-1 text-[11px] font-semibold text-[#e63462]">
                        <Shield className="h-3 w-3" />
                        {u.permissions.length} Yetki • Maks %{u.limits.maxDiscountPercent} İskonto
                        {u.limits.maxDiscountAmount != null
                          ? ` (Maks ${u.limits.maxDiscountAmount} ₺)`
                          : ""}
                      </span>
                      {u.shiftRestrictionEnabled &&
                        u.shiftStartTime &&
                        (u.effectiveShiftEndTime || u.shiftEndTime) && (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-2.5 py-1 text-[11px] font-semibold text-purple-700">
                            <Clock className="h-3 w-3" />
                            Mesai: {u.shiftStartTime} - {u.effectiveShiftEndTime || u.shiftEndTime}
                          </span>
                        )}
                    </div>
                  </div>
                )
              })}
            </div>

            <PaginationBar
              currentPage={page}
              totalItems={staff.length}
              pageSize={pageSize}
              onPageChange={setPage}
              itemLabel="kullanıcı"
            />
          </>
        )}
      </div>

      {showModal && (
        <StaffUserModal
          branchName={effectiveBranch?.name ?? ""}
          branchSlug={effectiveBranch?.slug ?? ""}
          editingUser={editingUser}
          roles={roles}
          catalog={catalog}
          submitting={submitting}
          onClose={() => setShowModal(false)}
          onSubmit={handleSaveUser}
        />
      )}
    </div>
  )
}
