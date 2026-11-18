import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useAdminStore } from "@/lib/store"
import type { Restaurant, SubscriptionPaymentMethod } from "@/lib/types"
import {
  formatMoney,
  formatPeriodLong,
  formatPeriodsSummary,
} from "@/lib/money"
import {
  AlertCircle,
  Ban,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Unlock,
} from "lucide-react"
import { PaymentFormModal } from "@/components/billing/PaymentFormModal"

export function RestaurantsPage() {
  const {
    restaurants,
    restaurantsLoading,
    restaurantsError,
    loadRestaurants,
    recordRestaurantPayment,
    suspendRestaurantUnpaid,
    unsuspendRestaurantAccess,
  } = useAdminStore()

  const [searchQuery, setSearchQuery] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [payModalRestId, setPayModalRestId] = useState<string | null>(null)
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

  const handleQuickSuspend = async (id: string, name: string) => {
    if (
      !confirm(`${name} mekanının sistem erişimini durdurmak istiyor musunuz?`)
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

  const handleQuickUnsuspend = async (id: string, name: string) => {
    setBusyId(id)
    try {
      await unsuspendRestaurantAccess(id)
      showNotice(`${name} mekanının sistem erişimi yeniden açıldı.`)
    } catch (err) {
      showNotice(err instanceof Error ? err.message : "Erişim açılamadı", "err")
    } finally {
      setBusyId(null)
    }
  }

  if (restaurantsError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-[13px] text-red-700">
        <p className="font-medium">{restaurantsError}</p>
        <button
          type="button"
          onClick={() => void loadRestaurants()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-red-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
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

  const payModalRestaurant: Restaurant | null = payModalRestId
    ? restaurants.find((r) => r.id === payModalRestId) ?? null
    : null

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-[#1d1d1f]">
            Restoranlar, Şubeler &amp; Franchise Ağı ({filtered.length})
          </h2>
          <p className="text-[12px] text-[#86868b] mt-0.5">
            Şube/franchise yapılarını, Boss atamalarını, abonelik dönemlerini ve erişim durumlarını yönetin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-[#86868b] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Restoran, marka veya Boss ara..."
              className="h-9 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] pl-8 pr-3 text-[12px] text-[#1d1d1f] outline-none focus:border-[#e63462]"
            />
          </div>
          <Link
            to="/dashboard/billing"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3.5 text-[12px] font-medium text-[#1d1d1f] hover:bg-[#e8e8ed]"
          >
            <CreditCard className="h-3.5 w-3.5 text-[#e63462]" />
            Dönemsel Tahsilat &amp; Çizelge
          </Link>
          <Link
            to="/dashboard/restaurants/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#e63462] px-3.5 text-[12px] font-semibold text-white hover:bg-[#d42d56]"
          >
            <Plus className="h-3.5 w-3.5" />
            Yeni Restoran / Şube
          </Link>
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 text-[13px] font-medium ${
            notice.type === "err"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="rounded-2xl border border-[#e5e5ea] bg-white overflow-hidden">
        {restaurantsLoading && restaurants.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-[#86868b]">Yükleniyor…</div>
        ) : restaurants.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-[13px] text-[#86868b]">Henüz restoran eklenmedi.</p>
            <Link
              to="/dashboard/restaurants/new"
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#e63462] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#d42d56]"
            >
              <Plus className="h-4 w-4" />
              İlk restoranı ekle
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#f0f0f0] bg-[#fafafa] text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                  <th className="px-4 py-3">Restoran / Şube</th>
                  <th className="px-4 py-3">Marka / Model</th>
                  <th className="px-4 py-3">Boss Hiyerarşisi</th>
                  <th className="px-4 py-3">Aylık Ücret</th>
                  <th className="px-4 py-3">Abonelik &amp; Kapsam</th>
                  <th className="px-4 py-3 text-right">Hızlı İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f0]">
                {filtered.map((r) => {
                  const isSusp = Boolean(
                    r.isAccessSuspended || r.billingStatus === "suspended"
                  )
                  const overdueCount = r.overduePeriods?.length ?? 0
                  const isBusy = busyId === r.id
                  return (
                    <tr
                      key={r.id}
                      className={`transition-colors ${
                        isSusp ? "bg-red-50/50" : "hover:bg-[#f9f9fb]"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/dashboard/restaurants/${r.id}`}
                          className="font-semibold text-[#1d1d1f] hover:text-[#e63462] block"
                        >
                          {r.name}
                          {r.status === "inactive" && (
                            <span className="ml-2 rounded-md bg-[#f5f5f7] px-1.5 py-0.5 text-[10px] font-medium text-[#86868b]">
                              Pasif
                            </span>
                          )}
                        </Link>
                        <span className="text-[11px] font-mono text-[#86868b]">{r.slug}</span>
                      </td>
                      <td className="px-4 py-3">
                        {r.brandName ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#e63462]/10 px-2 py-0.5 text-[11px] font-semibold text-[#e63462]">
                            <Building2 className="h-3 w-3" />
                            {r.brandName}
                          </span>
                        ) : (
                          <span className="text-[12px] text-[#86868b]">Bağımsız</span>
                        )}
                        <span className="block text-[11px] text-[#86868b] mt-0.5">
                          {r.branchType === "franchise"
                            ? "Franchise Şubesi"
                            : r.branchType === "company_owned"
                              ? "Merkez Şube"
                              : "Tekil Mekan"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.bosses && r.bosses.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {r.bosses.map((b) => (
                              <span
                                key={b.id}
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                                  b.bossTier === "brand_owner"
                                    ? "bg-purple-50 text-purple-700"
                                    : b.bossTier === "regional_manager"
                                      ? "bg-blue-50 text-blue-700"
                                      : "bg-[#f5f5f7] text-[#1d1d1f]"
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
                          <span className="text-[12px] text-[#636366]">Boss Atanmış</span>
                        ) : (
                          <span className="text-[12px] text-[#86868b]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#1d1d1f] tabular-nums">
                        {formatMoney(r.monthlyFee ?? 0)}
                        <span className="text-[11px] font-normal text-[#86868b]"> / ay</span>
                      </td>
                      <td className="px-4 py-3">
                        {isSusp ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600">
                            <Ban className="h-3 w-3" />
                            Erişim Durduruldu
                          </span>
                        ) : overdueCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                            <AlertCircle className="h-3 w-3" />
                            {overdueCount} Dönem Gecikti
                          </span>
                        ) : r.billingStatus === "pending" ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                            <Clock className="h-3 w-3" />
                            Bu Ay Bekliyor
                          </span>
                        ) : (
                          <div>
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" />
                              Ödendi • Aktif
                            </span>
                            {r.paidThroughPeriod && (
                              <span className="block text-[10px] text-[#86868b] mt-0.5">
                                {formatPeriodLong(r.paidThroughPeriod)} sonuna kadar
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setPayModalRestId(r.id)}
                            className="rounded-lg bg-[#34c759] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#2db84e] disabled:opacity-50"
                          >
                            Tahsilat Al
                          </button>
                          {isSusp ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleQuickUnsuspend(r.id, r.name)}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              <Unlock className="h-3 w-3" />
                              Aç
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleQuickSuspend(r.id, r.name)}
                              className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                            >
                              Durdur
                            </button>
                          )}
                          <Link
                            to={`/dashboard/restaurants/${r.id}`}
                            className="inline-flex rounded-lg bg-[#f5f5f7] p-2 text-[#636366] hover:bg-[#e8e8ed] hover:text-[#1d1d1f]"
                            aria-label="Düzenle"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-[13px] text-[#86868b]">
                      Arama kriterlerine uygun restoran bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PaymentFormModal
        restaurant={payModalRestaurant}
        onClose={() => setPayModalRestId(null)}
        onSubmitNew={async (
          rest,
          payload: {
            amount: number
            periods: string[]
            paidAt: string
            paymentMethod: SubscriptionPaymentMethod
            note: string | null
            reopenAccess: boolean
          }
        ) => {
          await recordRestaurantPayment(rest.id, payload)
          showNotice(
            `${rest.name} için ${formatPeriodsSummary(payload.periods)} (${formatMoney(payload.amount)}) tahsilatı kaydedildi.`
          )
        }}
      />
    </div>
  )
}
