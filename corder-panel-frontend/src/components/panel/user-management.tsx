import { useEffect, useMemo, useState } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { usePanelAuth } from "@/lib/panel-auth"
import { api } from "@/lib/api"
import type {
  PanelPermissionCatalogDto,
  PanelRoleDefinitionDto,
} from "@/lib/api/system.api"
import { getRoleDisplayName } from "@/lib/permission-labels"
import { StaffAccountModal } from "./users/staff-account-modal"
import { RolePermissionsMatrix } from "./users/role-permissions-matrix"
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  ShieldCheck,
  Lock,
  Monitor,
  Smartphone,
} from "lucide-react"

const ROLE_COLORS: Record<string, string> = {
  root: "bg-red-50 text-red-600",
  boss: "bg-red-50 text-red-600",
  branch_manager: "bg-purple-50 text-purple-600",
  manager: "bg-purple-50 text-purple-600",
  shift_supervisor: "bg-sky-50 text-sky-600",
  cashier: "bg-blue-50 text-blue-600",
  head_waiter: "bg-teal-50 text-teal-600",
  waiter: "bg-green-50 text-green-600",
  runner: "bg-slate-100 text-slate-600",
  inventory_manager: "bg-amber-50 text-amber-700",
  accountant: "bg-indigo-50 text-indigo-600",
}

export default function UserManagement() {
  const { users, addUser, updateUser, deleteUser } = usePanelStore()
  const { token, hasPermission, isBoss, currentBusiness } = usePanelAuth()

  const canViewStaff = isBoss || hasPermission("staff.view", "staff.manage")
  const canManageStaff = isBoss || hasPermission("staff.manage")
  const canManageRoles = isBoss || hasPermission("roles.manage")

  const [activeTab, setActiveTab] = useState<"staff" | "roles">("staff")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Roles & Catalog state
  const [catalog, setCatalog] = useState<PanelPermissionCatalogDto | null>(null)
  const [roles, setRoles] = useState<PanelRoleDefinitionDto[]>([])

  // Staff modal state
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (!canViewStaff && canManageRoles && activeTab === "staff") {
      setActiveTab("roles")
    }
  }, [canViewStaff, canManageRoles, activeTab])

  const editingUser = useMemo(
    () => (editingId ? users.find((x) => x.id === editingId) ?? null : null),
    [users, editingId],
  )

  const loadRolesAndCatalog = async () => {
    if (!token) return
    try {
      const [catRes, rolesRes] = await Promise.all([
        api.roles.catalog(token),
        api.roles.list(token),
      ])
      setCatalog(catRes)
      setRoles(rolesRes)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void loadRolesAndCatalog()
  }, [token, currentBusiness?.id])

  const closeStaffModal = () => {
    setShowAdd(false)
    setEditingId(null)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 h-[52px] border-b border-[#d1d1d6]/60 bg-white/70 backdrop-blur-xl flex items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg bg-[#f5f5f7] p-0.5 border border-[#d1d1d6]/60">
            {canViewStaff && (
              <button
                type="button"
                onClick={() => setActiveTab("staff")}
                className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors ${
                  activeTab === "staff"
                    ? "bg-white text-[#1d1d1f] shadow-2xs"
                    : "text-[#86868b] hover:text-[#1d1d1f]"
                }`}
              >
                Personel &amp; Kullanıcılar ({users.length})
              </button>
            )}
            {canManageRoles && (
              <button
                type="button"
                onClick={() => setActiveTab("roles")}
                className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === "roles"
                    ? "bg-white text-[#e63462] shadow-2xs"
                    : "text-[#86868b] hover:text-[#1d1d1f]"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Roller &amp; 48 Yetki Matrisi
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === "staff" && canManageStaff && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null)
                setShowAdd(true)
              }}
              className="h-[32px] px-3.5 flex items-center gap-1.5 bg-[#e63462] text-white rounded-lg text-[12px] font-medium hover:bg-[#d42d56] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Yeni Kullanıcı Oluştur
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        {activeTab === "staff" ? (
          <div className="w-full space-y-4">
            {canManageStaff && (showAdd || editingUser) && (
              <StaffAccountModal
                key={editingUser?.id ?? "new"}
                editingUser={editingUser}
                roles={roles}
                catalog={catalog}
                onClose={closeStaffModal}
                onAddUser={addUser}
                onUpdateUser={updateUser}
              />
            )}

            <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#f0f0f0] bg-[#f9f9f9]">
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                      Kullanıcı
                    </th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                      Rol
                    </th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                      Erişim &amp; Yetkiler
                    </th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                      İletişim
                    </th>
                    <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                      Durum
                    </th>
                    <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide w-[160px]">
                      İşlem
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, idx) => {
                    const hasCustomOverrides =
                      (user.grantedPermissions?.length ?? 0) > 0 ||
                      (user.revokedPermissions?.length ?? 0) > 0 ||
                      user.maxDiscountPercentOverride != null ||
                      user.maxDiscountAmountOverride != null

                    return (
                      <tr
                        key={user.id}
                        className={`border-b border-[#f0f0f0] hover:bg-[#f9f9fb] transition-colors ${
                          idx % 2 === 1 ? "bg-[#fafafa]" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#e63462]/10 flex items-center justify-center">
                              <span className="text-[11px] font-bold text-[#e63462]">
                                {user.name.charAt(0).toLocaleUpperCase("tr-TR")}
                              </span>
                            </div>
                            <div>
                              <span className="text-[13px] font-medium text-[#1d1d1f] block">
                                {user.name}
                              </span>
                              {user.email && (
                                <span className="text-[11px] text-[#86868b] block">
                                  {user.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-[11px] font-medium px-2 py-1 rounded-md ${
                              ROLE_COLORS[user.role] ??
                              "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {getRoleDisplayName(user.role, user.roleLabel)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {user.canAccessPanel && (
                              <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                                <Monitor className="w-2.5 h-2.5" /> Panel
                              </span>
                            )}
                            {user.canAccessTerminal !== false && (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                <Smartphone className="w-2.5 h-2.5" /> Terminal
                              </span>
                            )}
                            {user.permissions && (
                              <span className="rounded bg-[#f5f5f7] px-2 py-0.5 text-[10px] font-medium text-[#86868b]">
                                {user.permissions.length} yetki • Maks %
                                {user.limits?.maxDiscountPercent ?? 0} iskonto
                              </span>
                            )}
                            {hasCustomOverrides && (
                              <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                Özel Yetki
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-[12px] text-[#86868b]">
                            {user.phone ? (
                              <p>{user.phone}</p>
                            ) : (
                              <p className="text-[#d1d1d6]">-</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {user.isRoot || !canManageStaff ? (
                            <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-600">
                              {user.active ? "Aktif" : "Pasif"}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                updateUser(user.id, { active: !user.active })
                              }
                              className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors ${
                                user.active
                                  ? "bg-green-50 text-green-600"
                                  : "bg-red-50 text-red-500"
                              }`}
                            >
                              {user.active ? "Aktif" : "Pasif"}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {user.isRoot || !canManageStaff ? (
                            <div className="flex items-center justify-end">
                              <Lock className="w-3.5 h-3.5 text-[#aeaeb2]" />
                            </div>
                          ) : confirmDeleteId === user.id ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  deleteUser(user.id)
                                  setConfirmDeleteId(null)
                                }}
                                className="px-2 h-7 rounded-lg bg-red-600 text-white text-[11px] font-medium hover:bg-red-700"
                              >
                                Sil
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 h-7 rounded-lg bg-[#f5f5f7] text-[#86868b] text-[11px] font-medium hover:bg-[#e8e8ed]"
                              >
                                İptal
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                title="Yetkileri & Bilgileri Düzenle"
                                onClick={() => {
                                  setShowAdd(false)
                                  setEditingId(user.id)
                                }}
                                className="px-2.5 h-7 rounded-lg flex items-center gap-1 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[11px] font-medium text-[#1d1d1f] transition-colors"
                              >
                                <Pencil className="w-3 h-3 text-[#e63462]" />
                                Yetki &amp; Düzenle
                              </button>
                              <button
                                type="button"
                                title="Sil"
                                onClick={() => setConfirmDeleteId(user.id)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {users.length === 0 && (
                <div className="text-center py-12">
                  <Users className="w-10 h-10 text-[#d1d1d6] mx-auto mb-2" />
                  <p className="text-[13px] text-[#86868b]">
                    Henüz kullanıcı eklenmemiş
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <RolePermissionsMatrix
            token={token}
            catalog={catalog}
            roles={roles}
            onReloadRoles={loadRolesAndCatalog}
          />
        )}
      </div>
    </div>
  )
}
