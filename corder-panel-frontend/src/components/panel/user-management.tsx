import { useState } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { usePanelAuth } from "@/lib/panel-auth"
import type { PanelUserRole } from "@/lib/panel-types"
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Users,
  Shield,
  Lock,
  Monitor,
  Smartphone,
} from "lucide-react"

const ROLE_LABELS: Record<string, string> = {
  root: "İşletme Sahibi (Boss)",
  boss: "İşletme Sahibi (Boss)",
  branch_manager: "Şube Müdürü",
  manager: "Şube Müdürü",
  shift_supervisor: "Vardiya Amiri / Şef",
  cashier: "Kasiyer",
  head_waiter: "Şef Garson",
  waiter: "Garson",
  runner: "Komi / Stajyer",
  inventory_manager: "Depo & Stok Sorumlusu",
  accountant: "Muhasebe & Finans",
}

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

const ROLE_OPTIONS: Array<{ value: PanelUserRole; label: string }> = [
  { value: "branch_manager", label: "Şube Müdürü" },
  { value: "shift_supervisor", label: "Vardiya Amiri / Şef" },
  { value: "cashier", label: "Kasiyer" },
  { value: "head_waiter", label: "Şef Garson" },
  { value: "waiter", label: "Garson" },
  { value: "runner", label: "Komi / Stajyer" },
  { value: "inventory_manager", label: "Depo & Stok Sorumlusu" },
  { value: "accountant", label: "Muhasebe & Finans" },
]

export default function UserManagement() {
  const { users, addUser, updateUser, deleteUser } = usePanelStore()
  const { hasPermission } = usePanelAuth()
  const canManageStaff = hasPermission("staff.manage")

  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState("")
  const [formRole, setFormRole] = useState<PanelUserRole | string>("waiter")
  const [formPhone, setFormPhone] = useState("")
  const [formPin, setFormPin] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formPassword, setFormPassword] = useState("")
  const [formCanAccessPanel, setFormCanAccessPanel] = useState(false)
  const [formCanAccessTerminal, setFormCanAccessTerminal] = useState(true)

  const resetForm = () => {
    setFormName("")
    setFormRole("waiter")
    setFormPhone("")
    setFormPin("")
    setFormEmail("")
    setFormPassword("")
    setFormCanAccessPanel(false)
    setFormCanAccessTerminal(true)
  }

  const handleAdd = () => {
    const pin = formPin.replace(/\D/g, "").slice(0, 8)
    if (!formName.trim()) return
    if (formCanAccessTerminal && !formCanAccessPanel && pin.length < 4) return
    if (formCanAccessPanel && (!formEmail.trim() || formPassword.length < 6)) return
    addUser({
      name: formName,
      role: formRole,
      phone: formPhone || undefined,
      ...(pin.length >= 4 ? { pin } : {}),
      ...(formEmail.trim() ? { email: formEmail.trim() } : {}),
      ...(formPassword ? { password: formPassword } : {}),
      canAccessPanel: formCanAccessPanel,
      canAccessTerminal: formCanAccessTerminal,
      active: true,
    })
    resetForm()
    setShowAdd(false)
  }

  const startEdit = (id: string) => {
    const u = users.find((x) => x.id === id)
    if (!u) return
    setEditingId(id)
    setFormName(u.name)
    setFormRole(u.role === "root" ? "branch_manager" : u.role)
    setFormPhone(u.phone || "")
    setFormEmail(u.email || "")
    setFormPassword("")
    setFormPin("")
    setFormCanAccessPanel(Boolean(u.canAccessPanel || u.email))
    setFormCanAccessTerminal(u.canAccessTerminal ?? true)
  }

  const handleUpdate = () => {
    if (!editingId || !formName.trim()) return
    const pin = formPin.replace(/\D/g, "").slice(0, 8)
    updateUser(editingId, {
      name: formName,
      role: formRole,
      phone: formPhone || undefined,
      email: formEmail.trim() || undefined,
      ...(formPassword.length >= 6 ? { password: formPassword } : {}),
      ...(pin.length >= 4 ? { pin } : {}),
      canAccessPanel: formCanAccessPanel,
      canAccessTerminal: formCanAccessTerminal,
    })
    resetForm()
    setEditingId(null)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 h-[52px] border-b border-[#d1d1d6]/60 bg-white/70 backdrop-blur-xl flex items-center justify-between px-5">
        <h2 className="text-[15px] font-semibold text-[#1d1d1f]">
          Kullanici &amp; Personel Yonetimi
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[12px] text-[#86868b]">
            <Shield className="w-3.5 h-3.5 text-[#e63462]" />
            <span>
              Detaylı rol ve 48 yetki kısıtlaması <strong>Corder Boss</strong> uygulamasından yönetilir.
            </span>
          </div>
          {canManageStaff && (
            <button
              onClick={() => {
                setShowAdd(true)
                resetForm()
              }}
              className="h-[30px] px-3 flex items-center gap-1.5 bg-[#e63462] text-white rounded-lg text-[12px] font-medium hover:bg-[#d42d56] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Kullanici Ekle
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="max-w-5xl">
          {canManageStaff && (showAdd || editingId) && (
            <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[13px] font-semibold text-[#1d1d1f]">
                  {editingId ? "Kullaniciyi Duzenle" : "Yeni Kullanici / Personel"}
                </h4>
                <button
                  onClick={() => {
                    setShowAdd(false)
                    setEditingId(null)
                    resetForm()
                  }}
                  className="w-6 h-6 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]"
                >
                  <X className="w-3 h-3 text-[#86868b]" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ad Soyad"
                  className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
                />
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 cursor-pointer"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="Telefon"
                  className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formPin}
                  onChange={(e) => setFormPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder={
                    editingId
                      ? "Yeni Terminal PIN (degistirmek icin 4-8 rakam)"
                      : "Terminal PIN Kodu (4-8 rakam)"
                  }
                  className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 font-mono tracking-widest"
                />

                <div className="col-span-2 flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 text-[12px] font-medium text-[#1d1d1f] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formCanAccessPanel}
                      onChange={(e) => setFormCanAccessPanel(e.target.checked)}
                      className="accent-[#e63462]"
                    />
                    Merchant Paneline Giriş Yapabilsin (E-posta &amp; Parola)
                  </label>
                  <label className="flex items-center gap-2 text-[12px] font-medium text-[#1d1d1f] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formCanAccessTerminal}
                      onChange={(e) => setFormCanAccessTerminal(e.target.checked)}
                      className="accent-[#e63462]"
                    />
                    El Terminaline Giriş Yapabilsin (PIN)
                  </label>
                </div>

                {formCanAccessPanel && (
                  <>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="Merchant Panel E-posta Adresi"
                      className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
                    />
                    <input
                      type="password"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder={
                        editingId
                          ? "Yeni Parola (boş bırakılırsa değişmez)"
                          : "Merchant Panel Parolası (en az 6 krk)"
                      }
                      className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50"
                    />
                  </>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={() => {
                    setShowAdd(false)
                    setEditingId(null)
                    resetForm()
                  }}
                  className="h-[34px] px-4 text-[12px] font-medium text-[#86868b] rounded-lg border border-[#d1d1d6]/60 hover:bg-[#f5f5f7]"
                >
                  Iptal
                </button>
                <button
                  onClick={editingId ? handleUpdate : handleAdd}
                  className="h-[34px] px-4 text-[12px] font-medium text-white bg-[#e63462] rounded-lg hover:bg-[#d42d56]"
                >
                  {editingId ? "Guncelle" : "Ekle"}
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#f0f0f0] bg-[#f9f9f9]">
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Kullanici</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Rol</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Erişim &amp; Yetkiler</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Iletisim</th>
                  <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Durum</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide w-[100px]">Islem</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, idx) => (
                  <tr
                    key={user.id}
                    className={`border-b border-[#f0f0f0] hover:bg-[#f9f9fb] transition-colors ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#e63462]/10 flex items-center justify-center">
                          <span className="text-[11px] font-bold text-[#e63462]">{user.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <span className="text-[13px] font-medium text-[#1d1d1f] capitalize block">{user.name}</span>
                          {user.email && <span className="text-[11px] text-[#86868b] block">{user.email}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-medium px-2 py-1 rounded-md ${ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-700"}`}>
                        {ROLE_LABELS[user.role] || user.roleLabel || user.role}
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
                            {user.permissions.length} yetki • Maks %{user.limits?.maxDiscountPercent ?? 0} iskonto
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[12px] text-[#86868b]">
                        {user.phone ? <p>{user.phone}</p> : <p className="text-[#d1d1d6]">-</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {user.isRoot || !canManageStaff ? (
                        <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-600">
                          {user.active ? "Aktif" : "Pasif"}
                        </span>
                      ) : (
                        <button
                          onClick={() => updateUser(user.id, { active: !user.active })}
                          className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors ${
                            user.active ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
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
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => startEdit(user.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#f5f5f7] transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5 text-[#86868b]" />
                          </button>
                          <button
                            onClick={() => deleteUser(user.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {users.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-10 h-10 text-[#d1d1d6] mx-auto mb-2" />
                <p className="text-[13px] text-[#86868b]">Henuz kullanici eklenmemis</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
