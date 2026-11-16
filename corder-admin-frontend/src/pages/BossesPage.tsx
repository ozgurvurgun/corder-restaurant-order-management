import { useEffect, useState } from "react"
import { useAdminStore } from "@/lib/store"
import type { RootAdmin } from "@/lib/types"
import {
  Crown,
  Plus,
  Building2,
  Mail,
  Phone,
  Pencil,
  Trash2,
  X,
  Check,
  ExternalLink,
} from "lucide-react"

export function BossesPage() {
  const {
    allBosses,
    bossesLoading,
    loadAllBosses,
    restaurants,
    loadRestaurants,
    createBoss,
    updateBoss,
    deleteBoss,
  } = useAdminStore()

  const [showModal, setShowModal] = useState(false)
  const [editingBoss, setEditingBoss] = useState<RootAdmin | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<string[]>([])
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    void loadAllBosses()
    void loadRestaurants()
  }, [loadAllBosses, loadRestaurants])

  useEffect(() => {
    if (!showModal) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) setShowModal(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [showModal, submitting])

  const openCreate = () => {
    setEditingBoss(null)
    setName("")
    setEmail("")
    setPhone("")
    setPassword("")
    setSelectedRestaurantIds(restaurants[0] ? [restaurants[0].id] : [])
    setError("")
    setShowModal(true)
  }

  const openEdit = (boss: RootAdmin) => {
    setEditingBoss(boss)
    setName(boss.name)
    setEmail(boss.email)
    setPhone(boss.phone ?? "")
    setPassword("")
    setSelectedRestaurantIds(boss.restaurants?.map((r) => r.id) ?? [])
    setError("")
    setShowModal(true)
  }

  const toggleBranch = (id: string) => {
    setSelectedRestaurantIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!name.trim() || !email.trim()) {
      setError("Ad soyad ve e-posta zorunludur.")
      return
    }
    if (!editingBoss && password.length < 8) {
      setError("Parola en az 8 karakter olmalıdır.")
      return
    }
    if (editingBoss && password.length > 0 && password.length < 8) {
      setError("Yeni parola en az 8 karakter olmalıdır.")
      return
    }
    setSubmitting(true)
    try {
      if (editingBoss) {
        await updateBoss(editingBoss.id, {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          ...(password ? { password } : {}),
          restaurantIds: selectedRestaurantIds,
        })
      } else {
        await createBoss({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          password,
          restaurantIds: selectedRestaurantIds,
        })
      }
      setShowModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem başarısız")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (boss: RootAdmin) => {
    if (
      !confirm(
        `${boss.name} (${boss.email}) Boss hesabını tamamen silmek istediğinize emin misiniz?`
      )
    ) {
      return
    }
    try {
      await deleteBoss(boss.id)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Silinemedi")
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2.5">
            <Crown className="h-6 w-6 text-[#e63462]" />
            Patronlar (Boss Hesapları)
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            İşletme sahiplerini oluşturun ve birden fazla şube/dükkan ataması yapın. Boss kullanıcıları Corder Boss PWA üzerinden kendi şubelerinin personel ve yetkilerini yönetir.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-[#e63462] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#d42d56] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Yeni Boss Oluştur
        </button>
      </div>

      {bossesLoading && allBosses.length === 0 ? (
        <p className="mt-8 text-zinc-400">Yükleniyor…</p>
      ) : allBosses.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-12 text-center">
          <Crown className="mx-auto h-10 w-10 text-zinc-600" />
          <h3 className="mt-3 text-base font-medium text-white">Henüz Boss hesabı yok</h3>
          <p className="mt-1 text-sm text-zinc-400">
            İlk işletme sahibi (Boss) hesabını oluşturarak şubeleri bağlayın.
          </p>
          <button
            onClick={openCreate}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#e63462] px-4 py-2 text-sm font-medium text-white hover:bg-[#d42d56]"
          >
            <Plus className="h-4 w-4" />
            Boss Oluştur
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {allBosses.map((boss) => (
            <div
              key={boss.id}
              className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-[#e63462]/15 flex items-center justify-center text-[#e63462] font-bold text-base">
                      {boss.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{boss.name}</h3>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#e63462]">
                        İşletme Sahibi (Boss)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(boss)}
                      className="rounded-lg p-2 text-zinc-400 hover:bg-[#2a2a2a] hover:text-white"
                      title="Düzenle & Şube Ata"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => void handleDelete(boss)}
                      className="rounded-lg p-2 text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
                      title="Sil"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-zinc-400">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-zinc-500" />
                    <span>{boss.email}</span>
                  </div>
                  {boss.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-zinc-500" />
                      <span>{boss.phone}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                    Bağlı Şubeler ({boss.restaurants?.length ?? 0})
                  </p>
                  {boss.restaurants && boss.restaurants.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {boss.restaurants.map((r) => (
                        <span
                          key={r.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-2.5 py-1 text-xs text-zinc-200"
                        >
                          <Building2 className="h-3 w-3 text-[#e63462]" />
                          {r.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-400">Henüz şube atanmamış</p>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#2a2a2a]/60 flex items-center justify-between text-xs text-zinc-500">
                <span>Kayıt: {new Date(boss.createdAt).toLocaleDateString("tr-TR")}</span>
                <button
                  onClick={() => openEdit(boss)}
                  className="text-[#e63462] hover:underline inline-flex items-center gap-1 font-medium"
                >
                  Şubeleri Yönet <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => !submitting && setShowModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#2a2a2a] pb-4">
              <h2 className="text-lg font-semibold text-white">
                {editingBoss ? "Boss Hesabını Düzenle" : "Yeni Boss (İşletme Sahibi) Oluştur"}
              </h2>
              <button
                onClick={() => !submitting && setShowModal(false)}
                disabled={submitting}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-[#2a2a2a] hover:text-white disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                  Ad Soyad *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Örn. Mehmet Kaya"
                  className="w-full rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#e63462]"
                  required
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                    E-posta (Boss Giriş) *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="patron@isletme.com"
                    className="w-full rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#e63462]"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                    Telefon
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0532 000 00 00"
                    className="w-full rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#e63462]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                  {editingBoss
                    ? "Yeni Parola (değiştirmek istemiyorsanız boş bırakın)"
                    : "Parola (en az 8 karakter) *"}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#e63462]"
                  required={!editingBoss}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                  Yöneteceği Dükkan / Şubeler ({selectedRestaurantIds.length} seçili)
                </label>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-2 space-y-1">
                  {restaurants.map((r) => {
                    const checked = selectedRestaurantIds.includes(r.id)
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => toggleBranch(r.id)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          checked
                            ? "bg-[#e63462]/15 text-white"
                            : "text-zinc-400 hover:bg-[#1a1a1a]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Building2
                            className={`h-4 w-4 ${checked ? "text-[#e63462]" : "text-zinc-500"}`}
                          />
                          <div>
                            <p className="font-medium leading-tight">{r.name}</p>
                            <p className="text-[11px] text-zinc-500">{r.slug}</p>
                          </div>
                        </div>
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                            checked
                              ? "border-[#e63462] bg-[#e63462] text-white"
                              : "border-zinc-700"
                          }`}
                        >
                          {checked && <Check className="h-3.5 w-3.5" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-[#2a2a2a] px-4 py-2.5 text-sm text-zinc-300 hover:bg-[#2a2a2a]"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-[#e63462] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#d42d56] disabled:opacity-50"
                >
                  {submitting
                    ? "Kaydediliyor…"
                    : editingBoss
                      ? "Güncelle"
                      : "Boss Hesabını Oluştur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

