import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useAdminStore } from "@/lib/store"
import { formatMoney } from "@/lib/money"
import {
  Plus,
  Pencil,
  CheckCircle2,
  Ban,
  Clock,
  Building2,
  CreditCard,
  Search,
  RefreshCw,
} from "lucide-react"

export function RestaurantsPage() {
  const {
    restaurants,
    restaurantsLoading,
    restaurantsError,
    loadRestaurants,
    markRestaurantPaid,
    suspendRestaurantUnpaid,
  } = useAdminStore()

  const [searchQuery, setSearchQuery] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  )

  useEffect(() => {
    void loadRestaurants()
  }, [loadRestaurants])

  const showNotice = (text: string, type: "ok" | "err" = "ok") => {
    setNotice({ type, text })
    window.setTimeout(() => {
      setNotice((cur) => (cur?.text === text ? null : cur))
    }, 4000)
  }

  const handleQuickMarkPaid = async (id: string, name: string) => {
    setBusyId(id)
    try {
      await markRestaurantPaid(id)
      showNotice(`${name} için ödeme alındı işaretlendi ve erişim açıldı.`)
    } catch (err) {
      showNotice(err instanceof Error ? err.message : "İşlem başarısız", "err")
    } finally {
      setBusyId(null)
    }
  }

  const handleQuickSuspend = async (id: string, name: string) => {
    if (
      !confirm(
        `${name} mekanının ödeme alınmadığı için erişimini durdurmak istiyor musunuz?`
      )
    ) {
      return
    }
    setBusyId(id)
    try {
      await suspendRestaurantUnpaid(id)
      showNotice(`${name} mekanının sistem erişimi durduruldu.`)
    } catch (err) {
      showNotice(err instanceof Error ? err.message : "Erişim durdurulamadı", "err")
    } finally {
      setBusyId(null)
    }
  }

  if (restaurantsLoading && restaurants.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-white">Restoranlar &amp; Şubeler</h1>
        <p className="mt-4 text-zinc-400">Yükleniyor…</p>
      </div>
    )
  }

  if (restaurantsError) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-white">Restoranlar &amp; Şubeler</h1>
        <p className="mt-4 text-red-400">{restaurantsError}</p>
        <button
          type="button"
          onClick={() => void loadRestaurants()}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2 text-sm text-zinc-200 hover:bg-[#2a2a2a]"
        >
          <RefreshCw className="h-4 w-4" />
          Tekrar Dene
        </button>
      </div>
    )
  }

  const filtered = restaurants.filter((r) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    return (
      r.name.toLowerCase().includes(q) ||
      r.slug.toLowerCase().includes(q) ||
      (r.brandName ?? "").toLowerCase().includes(q) ||
      (r.bosses ?? []).some(
        (b) => b.name.toLowerCase().includes(q) || b.email.toLowerCase().includes(q)
      )
    )
  })

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            Restoranlar, Şubeler &amp; Franchise Ağı
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Şube/franchise yapılarını, üst marka ve şube Boss atamalarını, aylık abonelik ücretlerini ve erişim durumlarını yönetin.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="h-4 w-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Restoran, marka veya Boss ara..."
              className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
          <Link
            to="/dashboard/billing"
            className="flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-[#2a2a2a]"
          >
            <CreditCard className="h-4 w-4 text-[#e63462]" />
            Tahsilat &amp; Ücret Yönetimi (25-30)
          </Link>
          <Link
            to="/dashboard/restaurants/new"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" />
            Yeni Restoran / Şube
          </Link>
        </div>
      </div>

      {notice && (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${
            notice.type === "err"
              ? "border-red-500/40 bg-red-500/10 text-red-300"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] overflow-hidden">
        {restaurants.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-zinc-500">Henüz restoran eklenmedi.</p>
            <Link
              to="/dashboard/restaurants/new"
              className="mt-4 inline-block text-blue-400 hover:underline"
            >
              İlk restoranı ekle
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a] text-zinc-400 text-xs">
                  <th className="p-4 font-medium">Restoran / Şube</th>
                  <th className="p-4 font-medium">Marka / Model</th>
                  <th className="p-4 font-medium">Boss Hiyerarşisi</th>
                  <th className="p-4 font-medium">Aylık Ücret</th>
                  <th className="p-4 font-medium">Ödeme &amp; Erişim (25-30)</th>
                  <th className="p-4 text-right font-medium">Hızlı İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const isSusp = Boolean(
                    r.isAccessSuspended || r.billingStatus === "suspended"
                  )
                  const isBusy = busyId === r.id
                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-[#2a2a2a] last:border-0 ${
                        isSusp ? "bg-red-950/15" : "hover:bg-[#222]"
                      }`}
                    >
                      <td className="p-4">
                        <Link
                          to={`/dashboard/restaurants/${r.id}`}
                          className="font-medium text-white hover:underline block"
                        >
                          {r.name}
                          {r.status === "inactive" && (
                            <span className="ml-2 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-normal text-zinc-400">
                              Pasif
                            </span>
                          )}
                        </Link>
                        <span className="text-xs font-mono text-zinc-500">{r.slug}</span>
                      </td>
                      <td className="p-4">
                        {r.brandName ? (
                          <span className="inline-flex items-center gap-1 rounded bg-[#e63462]/15 px-2 py-0.5 text-xs font-medium text-[#e63462]">
                            <Building2 className="h-3 w-3" />
                            {r.brandName}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-500">Bağımsız</span>
                        )}
                        <span className="block text-[11px] text-zinc-400 mt-0.5">
                          {r.branchType === "franchise"
                            ? "Franchise Şubesi"
                            : r.branchType === "company_owned"
                              ? "Merkez Şube"
                              : "Tekil Mekan"}
                        </span>
                      </td>
                      <td className="p-4">
                        {r.bosses && r.bosses.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {r.bosses.map((b) => (
                              <span
                                key={b.id}
                                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium ${
                                  b.bossTier === "brand_owner"
                                    ? "bg-purple-500/20 text-purple-300"
                                    : b.bossTier === "regional_manager"
                                      ? "bg-blue-500/20 text-blue-300"
                                      : "bg-zinc-800 text-zinc-200"
                                }`}
                              >
                                {b.name} (
                                {b.bossTier === "brand_owner"
                                  ? "Marka HQ"
                                  : b.bossTier === "regional_manager"
                                    ? "Bölge Yön."
                                    : "Şube Boss"}
                                )
                              </span>
                            ))}
                          </div>
                        ) : r.rootAdminId ? (
                          <span className="text-xs text-zinc-300">Boss Atanmış</span>
                        ) : (
                          <span className="text-xs text-zinc-500">—</span>
                        )}
                      </td>
                      <td className="p-4 font-semibold text-white">
                        {formatMoney(r.monthlyFee ?? 0)}
                        <span className="text-[11px] font-normal text-zinc-500"> / ay</span>
                      </td>
                      <td className="p-4">
                        {isSusp ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-400">
                            <Ban className="h-3 w-3" />
                            Erişim Durduruldu
                          </span>
                        ) : r.billingStatus === "pending" ||
                          r.billingStatus === "overdue" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300">
                            <Clock className="h-3 w-3" />
                            Ödeme Bekliyor
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Ödendi • Aktif
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {isSusp ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleQuickMarkPaid(r.id, r.name)}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                              title="Ödeme Alındı İşaretle ve Erişimi Aç"
                            >
                              Ödeme Alındı (Aç)
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleQuickSuspend(r.id, r.name)}
                              className="rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                              title="Ödeme Alınmadı — Erişimi Durdur"
                            >
                              Erişimi Durdur
                            </button>
                          )}
                          <Link
                            to={`/dashboard/restaurants/${r.id}`}
                            className="inline-flex rounded-lg p-2 text-zinc-400 hover:bg-[#2a2a2a] hover:text-white"
                            aria-label="Düzenle"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-zinc-500">
                      Arama kriterlerine uygun restoran bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
