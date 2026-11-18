import { useEffect, useState } from "react"
import { useAdminStore } from "@/lib/store"
import type { Restaurant } from "@/lib/types"
import {
  formatMoney,
  fromMinorUnits,
  getIstanbulDayOfMonth,
  sumMoneyMajor,
  toMinorUnits,
} from "@/lib/money"
import { CreditCard, CalendarClock } from "lucide-react"
import {
  BillingConfigModal,
  BillingKpiCards,
} from "@/components/billing/BillingConfigModal"
import {
  RecordPaymentModal,
  type BillingStatusFilter,
} from "@/components/billing/RecordPaymentModal"

export function BillingPage() {
  const {
    restaurants,
    loadRestaurants,
    billingConfig,
    billingConfigError,
    loadBillingConfig,
    updateBillingConfig,
    updateRestaurant,
    updateRestaurantBilling,
    markRestaurantPaid,
    suspendRestaurantUnpaid,
    startMonthlyCollectionCycle,
    suspendAllUnpaidRestaurants,
  } = useAdminStore()

  const [feeDrafts, setFeeDrafts] = useState<Record<string, string>>({})
  const [busyRestId, setBusyRestId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [statusFilter, setStatusFilter] = useState<BillingStatusFilter>("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  )

  useEffect(() => {
    void loadRestaurants()
    void loadBillingConfig()
  }, [loadRestaurants, loadBillingConfig])

  useEffect(() => {
    const next: Record<string, string> = {}
    for (const r of restaurants) {
      next[r.id] = String(r.monthlyFee ?? 0)
    }
    setFeeDrafts(next)
  }, [restaurants])

  const showNotice = (text: string, type: "ok" | "err" = "ok") => {
    setFeedback({ type, text })
    window.setTimeout(() => {
      setFeedback((cur) => (cur?.text === text ? null : cur))
    }, 4000)
  }

  const handleSaveMonthlyFee = async (r: Restaurant) => {
    const raw = feeDrafts[r.id]
    const parsed = Math.max(0, fromMinorUnits(toMinorUnits(raw)))
    setBusyRestId(r.id)
    try {
      await updateRestaurant(r.id, { monthlyFee: parsed })
      showNotice(`${r.name} aylık ücreti ${formatMoney(parsed)} olarak kaydedildi.`)
    } catch (err) {
      showNotice(
        err instanceof Error ? err.message : "Ücret güncellenemedi",
        "err"
      )
    } finally {
      setBusyRestId(null)
    }
  }

  const handleMarkPaid = async (
    r: Restaurant,
    details?: { amount?: number; period?: string; note?: string }
  ) => {
    setBusyRestId(r.id)
    try {
      const draftFee =
        details?.amount !== undefined
          ? fromMinorUnits(toMinorUnits(details.amount))
          : feeDrafts[r.id] !== undefined
            ? fromMinorUnits(toMinorUnits(feeDrafts[r.id]))
            : (r.monthlyFee ?? 0)
      if (
        details?.amount === undefined &&
        toMinorUnits(draftFee) !== toMinorUnits(r.monthlyFee ?? 0)
      ) {
        await updateRestaurant(r.id, { monthlyFee: Math.max(0, draftFee) })
      }
      await markRestaurantPaid(r.id, {
        amount: Math.max(0, draftFee),
        period: details?.period,
        note: details?.note,
      })
      showNotice(
        `${r.name} için ödeme alındı olarak işaretlendi ve tüm sistem erişimleri otomatik açıldı.`
      )
    } catch (err) {
      showNotice(err instanceof Error ? err.message : "İşlem başarısız", "err")
    } finally {
      setBusyRestId(null)
    }
  }

  const handleMarkPending = async (r: Restaurant) => {
    setBusyRestId(r.id)
    try {
      await updateRestaurantBilling(r.id, {
        billingStatus: "pending",
        monthlyFee: fromMinorUnits(toMinorUnits(feeDrafts[r.id] ?? r.monthlyFee ?? 0)),
      })
      showNotice(
        `${r.name} ödeme durumu 'Ödeme Bekleniyor (25-30 Tahsilat)' olarak güncellendi.`
      )
    } catch (err) {
      showNotice(err instanceof Error ? err.message : "İşlem başarısız", "err")
    } finally {
      setBusyRestId(null)
    }
  }

  const handleSuspendUnpaid = async (r: Restaurant) => {
    if (
      !confirm(
        `${r.name} işletmesinin aylık ödemesi alınmadığı için tüm sistemlere (Merchant Panel, Boss Panel, El Terminali, Print Agent) erişimini durdurmak istediğinize emin misiniz?`
      )
    ) {
      return
    }
    setBusyRestId(r.id)
    try {
      await suspendRestaurantUnpaid(
        r.id,
        "25-30 tahsilat döneminde ödeme alınmadığı için sistem erişimi durduruldu."
      )
      showNotice(`${r.name} işletmesinin tüm sistem erişimleri durduruldu.`)
    } catch (err) {
      showNotice(
        err instanceof Error ? err.message : "Erişim durdurulamadı",
        "err"
      )
    } finally {
      setBusyRestId(null)
    }
  }

  const handleStartCycle = async () => {
    if (
      !confirm(
        "Bu ay için henüz ödeme kaydı olmayan aktif mekanları 'Ödeme Bekleniyor (25-30 Tahsilat)' durumuna geçirmek istiyor musunuz?"
      )
    ) {
      return
    }
    setBulkBusy(true)
    try {
      const res = await startMonthlyCollectionCycle()
      showNotice(
        `${res.period} dönemi tahsilat süreci başlatıldı (${res.updatedCount} mekan ödeme bekliyor).`
      )
    } catch (err) {
      showNotice(err instanceof Error ? err.message : "İşlem başarısız", "err")
    } finally {
      setBulkBusy(false)
    }
  }

  const handleBulkSuspendUnpaid = async () => {
    if (
      !confirm(
        "Ödeme durumu 'Bekliyor' veya 'Gecikmiş' olan TÜM mekanların sistem erişimlerini durdurmak istediğinize emin misiniz?"
      )
    ) {
      return
    }
    setBulkBusy(true)
    try {
      const res = await suspendAllUnpaidRestaurants()
      showNotice(
        `Ödeme yapmayan ${res.suspendedCount} mekanın sistem erişimi durduruldu.`
      )
    } catch (err) {
      showNotice(err instanceof Error ? err.message : "İşlem başarısız", "err")
    } finally {
      setBulkBusy(false)
    }
  }

  const dayOfMonth = getIstanbulDayOfMonth()
  const isCollectionWindow =
    dayOfMonth >= (billingConfig?.collectionStartDay ?? 25) &&
    dayOfMonth <= (billingConfig?.collectionEndDay ?? 30)

  const billableRestaurants = restaurants.filter((r) => r.status !== "inactive")
  const totalMrr = sumMoneyMajor(billableRestaurants.map((r) => r.monthlyFee ?? 0))
  const paidRestaurants = restaurants.filter(
    (r) => !r.isAccessSuspended && r.billingStatus === "paid"
  )
  const pendingRestaurants = restaurants.filter(
    (r) =>
      !r.isAccessSuspended &&
      (r.billingStatus === "pending" || r.billingStatus === "overdue")
  )
  const suspendedRestaurants = restaurants.filter(
    (r) => r.isAccessSuspended || r.billingStatus === "suspended"
  )

  const collectedTotal = sumMoneyMajor(
    paidRestaurants.map((r) => r.monthlyFee ?? 0)
  )
  const pendingTotal = sumMoneyMajor(
    pendingRestaurants.map((r) => r.monthlyFee ?? 0)
  )

  const filteredRestaurants = restaurants.filter((r) => {
    const isSusp = Boolean(
      r.isAccessSuspended || r.billingStatus === "suspended"
    )
    if (statusFilter === "paid" && (isSusp || r.billingStatus !== "paid"))
      return false
    if (
      statusFilter === "pending" &&
      (isSusp || (r.billingStatus !== "pending" && r.billingStatus !== "overdue"))
    ) {
      return false
    }
    if (statusFilter === "suspended" && !isSusp) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const matchName = r.name.toLowerCase().includes(q)
      const matchBrand = (r.brandName ?? "").toLowerCase().includes(q)
      const matchSlug = r.slug.toLowerCase().includes(q)
      return matchName || matchBrand || matchSlug
    }
    return true
  })

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-[#e63462]" />
            <h2 className="text-[15px] font-semibold text-[#1d1d1f]">
              Abonelik Ücretleri &amp; Tahsilat Yönetimi
            </h2>
          </div>
          <p className="mt-0.5 text-[12px] text-[#86868b]">
            Her mekan için ayrı aylık ücret belirleyin, her ayın{" "}
            <span className="font-semibold text-[#1d1d1f]">
              {billingConfig?.collectionStartDay ?? 25} –{" "}
              {billingConfig?.collectionEndDay ?? 30}
            </span>{" "}
            arası tahsilat durumlarını yönetin ve ödeme yapmayan mekanların erişimini tek tıkla durdurun veya açın.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-[12px] text-amber-800">
          <CalendarClock className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <span>
            Tahsilat Günü:{" "}
            <span className="font-semibold">
              Her Ayın {billingConfig?.collectionStartDay ?? 25} -{" "}
              {billingConfig?.collectionEndDay ?? 30}&apos;u Arası
            </span>
            {isCollectionWindow ? " • (Tahsilat Dönemindeyiz)" : ""}
          </span>
        </div>
      </div>

      {billingConfigError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {billingConfigError}
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-[13px] font-medium ${
            feedback.type === "err"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {feedback.text}
        </div>
      )}

      <BillingKpiCards
        totalMrr={totalMrr}
        restaurantsCount={billableRestaurants.length}
        collectedTotal={collectedTotal}
        paidCount={paidRestaurants.length}
        pendingTotal={pendingTotal}
        pendingCount={pendingRestaurants.length}
        suspendedCount={suspendedRestaurants.length}
      />

      <BillingConfigModal
        billingConfig={billingConfig}
        onUpdateConfig={updateBillingConfig}
        onNotice={showNotice}
      />

      <RecordPaymentModal
        restaurantsCount={restaurants.length}
        paidCount={paidRestaurants.length}
        pendingCount={pendingRestaurants.length}
        suspendedCount={suspendedRestaurants.length}
        filteredRestaurants={filteredRestaurants}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        feeDrafts={feeDrafts}
        onFeeDraftChange={(id, value) =>
          setFeeDrafts((prev) => ({ ...prev, [id]: value }))
        }
        busyRestId={busyRestId}
        bulkBusy={bulkBusy}
        onSaveMonthlyFee={(r) => void handleSaveMonthlyFee(r)}
        onMarkPaid={(r, details) => void handleMarkPaid(r, details)}
        onMarkPending={(r) => void handleMarkPending(r)}
        onSuspendUnpaid={(r) => void handleSuspendUnpaid(r)}
        onStartCycle={() => void handleStartCycle()}
        onBulkSuspendUnpaid={() => void handleBulkSuspendUnpaid()}
      />
    </div>
  )
}
