import { useState } from "react"
import { usePanelStore } from "@/lib/panel-store"
import { Plus, Pencil, Trash2, X, Users, Shield, UserCheck, Lock } from "lucide-react"

const ROLE_LABELS: Record<string, string> = { root: "Root Admin", mudur: "Mudur", kasiyer: "Kasiyer", garson: "Garson" }
const ROLE_COLORS: Record<string, string> = {
  root: "bg-red-50 text-red-600",
  mudur: "bg-purple-50 text-purple-600",
  kasiyer: "bg-blue-50 text-blue-600",
  garson: "bg-green-50 text-green-600",
}

export default function UserManagement() {
  const { users, addUser, updateUser, deleteUser } = usePanelStore()
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState("")
  const [formRole, setFormRole] = useState<"garson" | "mudur" | "kasiyer">("garson")
  const [formPhone, setFormPhone] = useState("")
  const [formPin, setFormPin] = useState("")

  const resetForm = () => { setFormName(""); setFormRole("garson"); setFormPhone(""); setFormPin("") }

  const handleAdd = () => {
    const pin = formPin.replace(/\D/g, "").slice(0, 8)
    if (!formName.trim() || pin.length < 4) return
    addUser({ name: formName, role: formRole, phone: formPhone || undefined, pin, active: true })
    resetForm(); setShowAdd(false)
  }

  const startEdit = (id: string) => {
    const u = users.find((x) => x.id === id)
    if (!u) return
    setEditingId(id); setFormName(u.name); setFormRole(u.role === "root" ? "mudur" : u.role)
    setFormPhone(u.phone || ""); setFormPin(u.pin || "")
  }

  const handleUpdate = () => {
    if (!editingId || !formName.trim()) return
    const pin = formPin.replace(/\D/g, "").slice(0, 8)
    updateUser(editingId, { name: formName, role: formRole, phone: formPhone || undefined, ...(pin.length >= 4 ? { pin } : {}) })
    resetForm(); setEditingId(null)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex-shrink-0 h-[52px] border-b border-[#d1d1d6]/60 bg-white/70 backdrop-blur-xl flex items-center justify-between px-5">
        <h2 className="text-[15px] font-semibold text-[#1d1d1f]">Kullanici Yonetimi</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[12px] text-[#86868b]">
            <Shield className="w-3.5 h-3.5" /> {users.filter((u) => u.role === "mudur").length} Mudur
            <UserCheck className="w-3.5 h-3.5 ml-1" /> {users.filter((u) => u.role === "garson").length} Garson
          </div>
          <button onClick={() => { setShowAdd(true); resetForm() }}
            className="h-[30px] px-3 flex items-center gap-1.5 bg-[#e63462] text-white rounded-lg text-[12px] font-medium hover:bg-[#d42d56] transition-colors">
            <Plus className="w-3.5 h-3.5" /> Kullanici Ekle
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="max-w-4xl">
          {/* Add/Edit form */}
          {(showAdd || editingId) && (
            <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[13px] font-semibold text-[#1d1d1f]">{editingId ? "Kullaniciyi Duzenle" : "Yeni Kullanici"}</h4>
                <button onClick={() => { setShowAdd(false); setEditingId(null); resetForm() }} className="w-6 h-6 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]">
                  <X className="w-3 h-3 text-[#86868b]" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ad Soyad"
                  className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                <select value={formRole} onChange={(e) => setFormRole(e.target.value as typeof formRole)}
                  className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 appearance-none cursor-pointer">
                  <option value="garson">Garson</option>
                  <option value="kasiyer">Kasiyer</option>
                  <option value="mudur">Mudur</option>
                </select>
                <input type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="Telefon"
                  className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50" />
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={formPin} onChange={(e) => setFormPin(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="Kullanici kodu / PIN (4-8 rakam)"
                  className="h-[36px] px-3 text-[13px] bg-[#f5f5f7] rounded-lg border border-[#d1d1d6]/60 focus:outline-none focus:border-[#e63462]/50 font-mono tracking-widest col-span-2" />
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <button onClick={() => { setShowAdd(false); setEditingId(null); resetForm() }} className="h-[34px] px-4 text-[12px] font-medium text-[#86868b] rounded-lg border border-[#d1d1d6]/60 hover:bg-[#f5f5f7]">Iptal</button>
                <button onClick={editingId ? handleUpdate : handleAdd} className="h-[34px] px-4 text-[12px] font-medium text-white bg-[#e63462] rounded-lg hover:bg-[#d42d56]">
                  {editingId ? "Guncelle" : "Ekle"}
                </button>
              </div>
            </div>
          )}

          {/* Users table */}
          <div className="bg-white rounded-xl border border-[#d1d1d6]/60 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#f0f0f0] bg-[#f9f9f9]">
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Kullanici</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Rol</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Iletisim</th>
                  <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Kod (PIN)</th>
                  <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Durum</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wide w-[100px]">Islem</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, idx) => (
                  <tr key={user.id} className={`border-b border-[#f0f0f0] hover:bg-[#f9f9fb] transition-colors ${idx % 2 === 1 ? "bg-[#fafafa]" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#e63462]/10 flex items-center justify-center">
                          <span className="text-[11px] font-bold text-[#e63462]">{user.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="text-[13px] font-medium text-[#1d1d1f] capitalize">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-medium px-2 py-1 rounded-md ${ROLE_COLORS[user.role]}`}>
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[12px] text-[#86868b]">
                        {user.phone ? <p>{user.phone}</p> : <p className="text-[#d1d1d6]">-</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[12px] font-mono tracking-wider ${user.pin ? "text-[#1d1d1f]" : "text-[#d1d1d6]"}`}>
                        {user.pin ? "****" : "Yok"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {user.isRoot ? (
                        <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-600">Aktif</span>
                      ) : (
                        <button onClick={() => updateUser(user.id, { active: !user.active })}
                          className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors ${
                            user.active ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
                          }`}>
                          {user.active ? "Aktif" : "Pasif"}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {user.isRoot ? (
                        <div className="flex items-center justify-end">
                          <Lock className="w-3.5 h-3.5 text-[#aeaeb2]" />
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => startEdit(user.id)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#f5f5f7] transition-colors">
                            <Pencil className="w-3.5 h-3.5 text-[#86868b]" />
                          </button>
                          <button onClick={() => deleteUser(user.id)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors">
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-[13px] text-[#86868b]">
                    <Users className="w-8 h-8 text-[#d1d1d6] mx-auto mb-2" />Kullanici bulunamadi
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
