import { useEffect, useState } from "react"
import { useAdminStore } from "@/lib/store"
import type { Restaurant } from "@/lib/types"
import { CreditCard, CalendarClock } from "lucide-react"
import {
  BillingConfigModal,
  BillingKpiCards,
  formatMoney,
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
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null)

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
    const parsed = Math.max(0, Number(raw) || 0)
    setBusyRestId(r.id)
    try {
      await updateRestaurant(r.id, { monthlyFee: parsed })
      showNotice(`${r.name} aylık ücreti ${formatMoney(parsed)} olarak kaydedildi.`)
    } catch (err) {
      showNotice(err instanceof Error ? err.message : "Ücret güncellenemedi", "err")
    } finally {
      setBusyRestId(null)
    }
  }

  const handleMarkPaid = async (r: Restaurant) => {
    setBusyRestId(r.id)
    try {
      const draftFee = feeDrafts[r.id] !== undefined ? Number(feeDrafts[r.id]) : r.monthlyFee
      if (draftFee !== undefined && draftFee !== r.monthlyFee) {
        await updateRestaurant(r.id, { monthlyFee: Math.max(0, draftFee || 0) })
      }
      await markRestaurantPaid(r.id, { amount: draftFee ?? r.monthlyFee ?? 0 })
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
        monthlyFee: Number(feeDrafts[r.id] ?? r.monthlyFee ?? 0),
      })
      showNotice(`${r.name} ödeme durumu 'Ödeme Bekleniyor (25-30 Tahsilat)' olarak güncellendi.`)
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
      showNotice(err instanceof Error ? err.message : "Erişim durdurulamadı", "err")
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
      showNotice(`Ödeme yapmayan ${res.suspendedCount} mekanın sistem erişimi durduruldu.`)
    } catch (err) {
      showNotice(err instanceof Error ? err.message : "İşlem başarısız", "err")
    } finally {
      setBulkBusy(false)
    }
  }

  const now = new Date()
  const dayOfMonth = now.getDate()
  const isCollectionWindow =
    dayOfMonth >= (billingConfig?.collectionStartDay ?? 25) &&
    dayOfMonth <= (billingConfig?.collectionEndDay ?? 30)

  const totalMrr = restaurants.reduce((acc, r) => acc + (r.monthlyFee ?? 0), 0)
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

  const collectedTotal = paidRestaurants.reduce((acc, r) => acc + (r.monthlyFee ?? 0), 0)
  const pendingTotal = pendingRestaurants.reduce((acc, r) => acc + (r.monthlyFee ?? 0), 0)

  const filteredRestaurants = restaurants.filter((r) => {
    const isSusp = Boolean(r.isAccessSuspended || r.billingStatus === "suspended")
    if (statusFilter === "paid" && (isSusp || r.billingStatus !== "paid")) return false
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2.5">
            <CreditCard className="h-6 w-6 text-[#e63462]" />
            Abonelik Ücretleri &amp; Tahsilat Yönetimi
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Her mekan için ayrı aylık ücret belirleyin, her ayın{" "}
            <strong className="text-white">
              {billingConfig?.collectionStartDay ?? 25} – {billingConfig?.collectionEndDay ?? 30}
            </strong>{" "}
            arası tahsilat durumlarını yönetin ve ödeme yapmayan mekanların erişimini tek tıkla durdurun veya ödeme alındığında otomatik açın.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-300">
          <CalendarClock className="h-4 w-4 text-amber-400 flex-shrink-0" />
          <span>
            Tahsilat Günü: <strong>Her Ayın {billingConfig?.collectionStartDay ?? 25} - {billingConfig?.collectionEndDay ?? 30}&apos;u Arası</strong>
            {isCollectionWindow ? " • (Şu Anda Tahsilat Dönemindeyiz)" : ""}
          </span>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            feedback.type === "err"
              ? "border-red-500/40 bg-red-500/10 text-red-300"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          {feedback.text}
        </div>
      )}

      <BillingKpiCards
        totalMrr={totalMrr}
        restaurantsCount={restaurants.length}
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
        onMarkPaid={(r) => void handleMarkPaid(r)}
        onMarkPending={(r) => void handleMarkPending(r)}
        onSuspendUnpaid={(r) => void handleSuspendUnpaid(r)}
        onStartCycle={() => void handleStartCycle()}
        onBulkSuspendUnpaid={() => void handleBulkSuspendUnpaid()}
      />
    </div>
  )
}
