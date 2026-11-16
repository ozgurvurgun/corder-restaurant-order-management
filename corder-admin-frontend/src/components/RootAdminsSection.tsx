import { useState } from "react"
import { UserPlus } from "lucide-react"
import type { RootAdmin } from "@/lib/types"

interface RootAdminsSectionProps {
  restaurantId: string
  rootAdmins: RootAdmin[]
  loading: boolean
  error: string | null
  onAddRootAdmin: (
    restaurantId: string,
    input: { name: string; email: string; password: string }
  ) => Promise<void>
  onDeleteRootAdmin: (restaurantId: string, adminId: string) => Promise<void>
}

export function RootAdminsSection({
  restaurantId,
  rootAdmins,
  loading,
  error,
  onAddRootAdmin,
  onDeleteRootAdmin,
}: RootAdminsSectionProps) {
  const [showAdminForm, setShowAdminForm] = useState(false)
  const [adminName, setAdminName] = useState("")
  const [adminEmail, setAdminEmail] = useState("")
  const [adminPassword, setAdminPassword] = useState("")
  const [adminError, setAdminError] = useState("")
  const [adminSubmitLoading, setAdminSubmitLoading] = useState(false)

  const handleAddRootAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdminError("")
    if (!adminName.trim() || !adminEmail.trim()) {
      setAdminError("Ad ve e-posta gerekli.")
      return
    }
    if (adminPassword.length < 8) {
      setAdminError("Parola en az 8 karakter olmalı.")
      return
    }
    setAdminSubmitLoading(true)
    try {
      await onAddRootAdmin(restaurantId, {
        name: adminName.trim(),
        email: adminEmail.trim(),
        password: adminPassword,
      })
      setShowAdminForm(false)
      setAdminName("")
      setAdminEmail("")
      setAdminPassword("")
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Root admin oluşturulamadı")
    } finally {
      setAdminSubmitLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
      <h2 className="text-lg font-medium text-white">Root admin</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Bu restoranın panelinde e-posta ve parola ile giriş yapacak yöneticiler. Her e-posta
        yalnızca bir restorana atanır. Parolalar backend&apos;de güvenli saklanır.
      </p>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      {loading ? (
        <p className="mt-4 text-sm text-zinc-500">Yükleniyor…</p>
      ) : (
        <>
          <ul className="mt-4 space-y-3">
            {rootAdmins.map((admin) => (
              <li
                key={admin.id}
                className="rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] p-4"
              >
                <p className="font-medium text-white">{admin.name}</p>
                <p className="text-sm text-zinc-400">{admin.email}</p>
                <button
                  type="button"
                  onClick={() => void onDeleteRootAdmin(restaurantId, admin.id)}
                  className="mt-3 text-sm text-red-400 hover:underline"
                >
                  Kaldır
                </button>
              </li>
            ))}
          </ul>
          {showAdminForm ? (
            <form onSubmit={handleAddRootAdmin} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-zinc-300">Ad soyad</label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="Yönetici adı"
                  className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2.5 text-white outline-none focus:border-blue-500"
                  required
                  disabled={adminSubmitLoading}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-zinc-300">
                  E-posta (giriş için)
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@restaurant.com"
                  className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2.5 text-white outline-none focus:border-blue-500"
                  required
                  disabled={adminSubmitLoading}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-zinc-300">
                  Parola (en az 8 karakter) *
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                  className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2.5 text-white outline-none focus:border-blue-500"
                  required
                  disabled={adminSubmitLoading}
                />
              </div>
              {adminError && <p className="text-sm text-red-400">{adminError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={adminSubmitLoading}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {adminSubmitLoading ? "Oluşturuluyor…" : "Root admin oluştur"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdminForm(false)}
                  className="rounded-lg border border-[#2a2a2a] px-4 py-2.5 text-sm text-zinc-300 hover:bg-[#2a2a2a]"
                >
                  İptal
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setShowAdminForm(true)
                setAdminName("")
                setAdminEmail("")
                setAdminPassword("")
                setAdminError("")
              }}
              className="mt-4 flex items-center gap-2 rounded-lg border border-dashed border-[#2a2a2a] px-4 py-3 text-sm text-zinc-400 hover:border-blue-500/50 hover:text-blue-400"
            >
              <UserPlus className="h-4 w-4" />
              {rootAdmins.length > 0 ? "Yeni root admin ekle" : "Root admin oluştur"}
            </button>
          )}
        </>
      )}
    </div>
  )
}
