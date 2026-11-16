import { useEffect, useState } from "react"
import { UserPlus, Link2, Crown, Building2 } from "lucide-react"
import type { RootAdmin } from "@/lib/types"
import { useAdminStore } from "@/lib/store"

interface RootAdminsSectionProps {
  restaurantId: string
  rootAdmins: RootAdmin[]
  loading: boolean
  error: string | null
  onAddRootAdmin: (
    restaurantId: string,
    input: { name: string; email: string; phone?: string; password: string }
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
  const { allBosses, linkExistingBoss } = useAdminStore()
  const [mode, setMode] = useState<"none" | "create" | "link">("none")
  const [adminName, setAdminName] = useState("")
  const [adminEmail, setAdminEmail] = useState("")
  const [adminPhone, setAdminPhone] = useState("")
  const [adminPassword, setAdminPassword] = useState("")
  const [selectedExistingBossId, setSelectedExistingBossId] = useState("")
  const [adminError, setAdminError] = useState("")
  const [adminSubmitLoading, setAdminSubmitLoading] = useState(false)

  useEffect(() => {
    if (mode === "none") return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !adminSubmitLoading) setMode("none")
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [mode, adminSubmitLoading])

  const assignedIds = new Set(rootAdmins.map((a) => a.id))
  const linkableBosses = allBosses.filter((b) => !assignedIds.has(b.id))

  const handleAddBoss = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdminError("")
    if (!adminName.trim() || !adminEmail.trim()) {
      setAdminError("Ad soyad ve e-posta gerekli.")
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
        phone: adminPhone.trim() || undefined,
        password: adminPassword,
      })
      setMode("none")
      setAdminName("")
      setAdminEmail("")
      setAdminPhone("")
      setAdminPassword("")
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Boss hesabı oluşturulamadı")
    } finally {
      setAdminSubmitLoading(false)
    }
  }

  const handleLinkExisting = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedExistingBossId) return
    setAdminError("")
    setAdminSubmitLoading(true)
    try {
      await linkExistingBoss(restaurantId, selectedExistingBossId)
      setMode("none")
      setSelectedExistingBossId("")
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Mevcut Boss bağlanamadı")
    } finally {
      setAdminSubmitLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
      <div className="flex items-center gap-2.5">
        <div className="rounded-lg bg-[#e63462]/20 p-2">
          <Crown className="h-4 w-4 text-[#e63462]" />
        </div>
        <div>
          <h2 className="text-lg font-medium text-white">İşletme Sahibi (Boss) Hesapları</h2>
          <p className="text-xs text-zinc-400">
            Corder Boss PWA ve Merchant Paneline giriş yapabilecek işletme sahipleri. Bir Boss birden fazla şubeyi yönetebilir.
          </p>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {loading ? (
        <p className="mt-4 text-sm text-zinc-500">Yükleniyor…</p>
      ) : (
        <>
          <ul className="mt-4 space-y-3">
            {rootAdmins.map((admin) => (
              <li
                key={admin.id}
                className="rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] p-4 flex items-start justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white">{admin.name}</p>
                    <span className="rounded-md bg-[#e63462]/15 px-2 py-0.5 text-[11px] font-medium text-[#e63462]">
                      Boss
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400 mt-0.5">{admin.email}</p>
                  {admin.phone && (
                    <p className="text-xs text-zinc-500 mt-0.5">{admin.phone}</p>
                  )}
                  {admin.restaurants && admin.restaurants.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {admin.restaurants.map((br) => (
                        <span
                          key={br.id}
                          className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300"
                        >
                          <Building2 className="h-3 w-3 text-zinc-400" />
                          {br.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const actionText =
                      admin.restaurants && admin.restaurants.length > 1
                        ? "bu şubeden ayırmak"
                        : "kaldırmak"
                    if (!confirm(`${admin.name} Boss hesabını ${actionText} istediğinize emin misiniz?`)) return
                    void onDeleteRootAdmin(restaurantId, admin.id)
                  }}
                  className="text-xs text-red-400 hover:underline flex-shrink-0"
                >
                  {admin.restaurants && admin.restaurants.length > 1
                    ? "Şubeden Ayır"
                    : "Kaldır"}
                </button>
              </li>
            ))}
          </ul>

          {mode === "create" && (
            <form onSubmit={handleAddBoss} className="mt-4 space-y-3 border-t border-[#2a2a2a] pt-4">
              <h3 className="text-sm font-medium text-white">Yeni Boss (İşletme Sahibi) Oluştur</h3>
              <div>
                <label className="mb-1 block text-xs text-zinc-300">Ad Soyad *</label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="Örn. Ahmet Yılmaz"
                  className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3.5 py-2 text-sm text-white outline-none focus:border-[#e63462]"
                  required
                  disabled={adminSubmitLoading}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-zinc-300">E-posta (Boss giriş) *</label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="boss@restoran.com"
                    className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3.5 py-2 text-sm text-white outline-none focus:border-[#e63462]"
                    required
                    disabled={adminSubmitLoading}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-300">Telefon</label>
                  <input
                    type="tel"
                    value={adminPhone}
                    onChange={(e) => setAdminPhone(e.target.value)}
                    placeholder="05XX XXX XX XX"
                    className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3.5 py-2 text-sm text-white outline-none focus:border-[#e63462]"
                    disabled={adminSubmitLoading}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-300">Parola (en az 8 karakter) *</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                  className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3.5 py-2 text-sm text-white outline-none focus:border-[#e63462]"
                  required
                  disabled={adminSubmitLoading}
                />
              </div>
              {adminError && <p className="text-xs text-red-400">{adminError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={adminSubmitLoading}
                  className="rounded-lg bg-[#e63462] px-4 py-2 text-xs font-medium text-white hover:bg-[#d42d56] disabled:opacity-50"
                >
                  {adminSubmitLoading ? "Oluşturuluyor…" : "Boss Oluştur ve Şubeye Ata"}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("none")}
                  className="rounded-lg border border-[#2a2a2a] px-4 py-2 text-xs text-zinc-300 hover:bg-[#2a2a2a]"
                >
                  İptal
                </button>
              </div>
            </form>
          )}

          {mode === "link" && (
            <form onSubmit={handleLinkExisting} className="mt-4 space-y-3 border-t border-[#2a2a2a] pt-4">
              <h3 className="text-sm font-medium text-white">Mevcut Boss Hesabına Bu Şubeyi Bağla</h3>
              <select
                value={selectedExistingBossId}
                onChange={(e) => setSelectedExistingBossId(e.target.value)}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3.5 py-2 text-sm text-white outline-none focus:border-[#e63462]"
                required
              >
                <option value="">Boss hesabı seçin...</option>
                {linkableBosses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.email}) — {b.restaurants?.length ?? 0} şube
                  </option>
                ))}
              </select>
              {adminError && <p className="text-xs text-red-400">{adminError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={adminSubmitLoading || !selectedExistingBossId}
                  className="rounded-lg bg-[#e63462] px-4 py-2 text-xs font-medium text-white hover:bg-[#d42d56] disabled:opacity-50"
                >
                  {adminSubmitLoading ? "Bağlanıyor…" : "Şubeyi Bu Boss'a Bağla"}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("none")}
                  className="rounded-lg border border-[#2a2a2a] px-4 py-2 text-xs text-zinc-300 hover:bg-[#2a2a2a]"
                >
                  İptal
                </button>
              </div>
            </form>
          )}

          {mode === "none" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode("create")
                  setAdminError("")
                }}
                className="flex items-center gap-2 rounded-lg border border-dashed border-[#2a2a2a] px-4 py-2.5 text-xs text-zinc-300 hover:border-[#e63462]/60 hover:text-[#e63462]"
              >
                <UserPlus className="h-4 w-4" />
                Yeni Boss Hesabı Oluştur
              </button>
              {linkableBosses.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("link")
                    setAdminError("")
                  }}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-[#2a2a2a] px-4 py-2.5 text-xs text-zinc-300 hover:border-blue-500/60 hover:text-blue-400"
                >
                  <Link2 className="h-4 w-4" />
                  Mevcut Boss&apos;a Şube Olarak Bağla
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
