import { useEffect, useState } from "react"
import { useAdminStore } from "@/lib/store"
import type {
  Restaurant,
  RestaurantPaymentRecord,
  SubscriptionPaymentMethod,
} from "@/lib/types"
import {
  addMonthsToPeriod,
  formatMoney,
  formatPeriodLong,
  formatPeriodsSummary,
  fromMinorUnits,
  getIstanbulBillingPeriod,
  getIstanbulDayOfMonth,
  toMinorUnits,
} from "@/lib/money"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Landmark,
  ListChecks,
  ReceiptText,
  Settings2,
} from "lucide-react"
import {
  BillingConfigModal,
  BillingKpiCards,
} from "@/components/billing/BillingConfigModal"
import {
  RecordPaymentModal,
  type BillingStatusFilter,
} from "@/components/billing/RecordPaymentModal"
import { BillingMatrixView } from "@/components/billing/BillingMatrixView"
import { BillingLedgerView } from "@/components/billing/BillingLedgerView"
import { PaymentFormModal } from "@/components/billing/PaymentFormModal"
import { RestaurantBillingHistoryModal } from "@/components/billing/RestaurantBillingHistoryModal"
import { useBillingPeriodMetrics } from "@/components/billing/use-billing-metrics"

type BillingTabMode = "period" | "matrix" | "ledger"

export function BillingPage() {
  const {
    restaurants,
    loadRestaurants,
    billingConfig,
    billingConfigError,
    loadBillingConfig,
    updateBillingConfig,
    updateRestaurant,
    recordRestaurantPayment,
    updateRestaurantPayment,
    deleteRestaurantPayment,
    suspendRestaurantUnpaid,
    unsuspendRestaurantAccess,
    suspendAllUnpaidRestaurants,
  } = useAdminStore()

  const currentPeriod = getIstanbulBillingPeriod()
  const currentYear = Number(currentPeriod.split("-")[0]) || new Date().getFullYear()

  const [activeTab, setActiveTab] = useState<BillingTabMode>("period")
  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod)
  const [matrixYear, setMatrixYear] = useState(currentYear)
  const [configOpen, setConfigOpen] = useState(false)

  const [feeDrafts, setFeeDrafts] = useState<Record<string, string>>({})
  const [busyRestId, setBusyRestId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [statusFilter, setStatusFilter] = useState<BillingStatusFilter>("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  )

  const [paymentModalState, setPaymentModalState] = useState<{
    restaurantId: string
    initialPeriod?: string
    editingPayment?: RestaurantPaymentRecord
  } | null>(null)
  const [historyModalRestId, setHistoryModalRestId] = useState<string | null>(null)

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
    }, 4500)
  }

  const collectionStartDay = billingConfig?.collectionStartDay ?? 25
  const collectionEndDay = billingConfig?.collectionEndDay ?? 30
  const dayOfMonth = getIstanbulDayOfMonth()

  const { metrics, filteredRestaurants } = useBillingPeriodMetrics({
    restaurants,
    selectedPeriod,
    currentPeriod,
    collectionEndDay,
    dayOfMonth,
    statusFilter,
    searchQuery,
  })

  const handleSaveMonthlyFee = async (r: Restaurant) => {
    const parsed = Math.max(0, fromMinorUnits(toMinorUnits(feeDrafts[r.id])))
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

  const handleCreatePayment = async (
    r: Restaurant,
    payload: {
      amount: number
      periods: string[]
      paidAt: string
      paymentMethod: SubscriptionPaymentMethod
      note: string | null
      reopenAccess: boolean
    }
  ) => {
    await recordRestaurantPayment(r.id, payload)
    showNotice(
      `${r.name} için ${formatPeriodsSummary(payload.periods)} (${formatMoney(payload.amount)}) tahsilatı kaydedildi.`
    )
  }

  const handleEditPayment = async (
    r: Restaurant,
    paymentId: string,
    payload: {
      amount: number
      periods: string[]
      paidAt: string
      paymentMethod: SubscriptionPaymentMethod
      note: string | null
    }
  ) => {
    await updateRestaurantPayment(r.id, paymentId, payload)
    showNotice(`${r.name} tahsilat kaydı güncellendi.`)
  }

  const handleDeletePayment = async (r: Restaurant, payment: RestaurantPaymentRecord) => {
    await deleteRestaurantPayment(r.id, payment.id)
    showNotice(
      `${r.name} — ${formatPeriodsSummary(payment.periods, payment.period)} tahsilat kaydı silindi.`
    )
  }

  const handleSuspendUnpaid = async (r: Restaurant) => {
    if (
      !confirm(
        `${r.name} işletmesinin tüm sistemlere (Merchant Panel, Boss Panel, El Terminali, Print Agent) erişimini durdurmak istediğinize emin misiniz?`
      )
    ) {
      return
    }
    setBusyRestId(r.id)
    try {
      await suspendRestaurantUnpaid(r.id, "Ödeme alınmadığı için sistem erişimi durduruldu.")
      showNotice(`${r.name} işletmesinin sistem erişimi durduruldu.`)
    } catch (err) {
      showNotice(err instanceof Error ? err.message : "Erişim durdurulamadı", "err")
    } finally {
      setBusyRestId(null)
    }
  }

  const handleUnsuspendAccess = async (r: Restaurant) => {
    setBusyRestId(r.id)
    try {
      await unsuspendRestaurantAccess(r.id)
      showNotice(`${r.name} işletmesinin sistem erişimi yeniden açıldı.`)
    } catch (err) {
      showNotice(err instanceof Error ? err.message : "Erişim açılamadı", "err")
    } finally {
      setBusyRestId(null)
    }
  }

  const handleBulkSuspendUnpaid = async () => {
    if (
      !confirm(
        "Bu dönem veya geçmiş dönem ödemesi tamamlanmamış aktif mekanların sistem erişimlerini durdurmak istediğinize emin misiniz? (Açık kasa vardiyası olan mekanlar vardiya kapanana kadar korunur.)"
      )
    ) {
      return
    }
    setBulkBusy(true)
    try {
      const res = await suspendAllUnpaidRestaurants()
      const shiftNote =
        res.deferredOpenShiftCount && res.deferredOpenShiftCount > 0
          ? ` (${res.deferredOpenShiftCount} mekanda açık kasa vardiyası olduğu için ertelendi)`
          : ""
      showNotice(
        `Ödemesi eksik olan ${res.suspendedCount} mekanın sistem erişimi durduruldu.${shiftNote}`
      )
    } catch (err) {
      showNotice(err instanceof Error ? err.message : "İşlem başarısız", "err")
    } finally {
      setBulkBusy(false)
    }
  }

  const activePaymentRestaurant = paymentModalState
    ? restaurants.find((r) => r.id === paymentModalState.restaurantId) ?? null
    : null
  const activeHistoryRestaurant = historyModalRestId
    ? restaurants.find((r) => r.id === historyModalRestId) ?? null
    : null

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-[#f5f5f7] p-1">
          {(
            [
              { id: "period", label: "Dönem Tahsilat Tablosu", icon: ListChecks },
              { id: "matrix", label: "Ay-Ay Yıllık Çizelge", icon: CalendarDays },
              { id: "ledger", label: "Tahsilat Defteri (Tarih Sıralı)", icon: ReceiptText },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all ${
                activeTab === id
                  ? "bg-white text-[#1d1d1f] shadow-2xs"
                  : "text-[#636366] hover:text-[#1d1d1f]"
              }`}
            >
              <Icon className="h-3.5 w-3.5 text-[#e63462]" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] p-1">
            <button
              type="button"
              onClick={() => setSelectedPeriod((p) => addMonthsToPeriod(p, -1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#1d1d1f] shadow-2xs hover:bg-[#ebebf0]"
              title="Önceki Ay"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="month"
              value={selectedPeriod}
              onChange={(e) => {
                if (e.target.value) setSelectedPeriod(e.target.value)
              }}
              className="h-7 bg-transparent px-2 text-[12px] font-semibold text-[#1d1d1f] outline-none cursor-pointer"
            />
            <button
              type="button"
              onClick={() => setSelectedPeriod((p) => addMonthsToPeriod(p, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#1d1d1f] shadow-2xs hover:bg-[#ebebf0]"
              title="Sonraki Ay"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {selectedPeriod !== currentPeriod && (
              <button
                type="button"
                onClick={() => setSelectedPeriod(currentPeriod)}
                className="rounded-lg bg-[#e63462] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#d42d56]"
              >
                Bu Ay
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setConfigOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#d1d1d6] bg-white px-3 text-[12px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7]"
          >
            <Landmark className="h-3.5 w-3.5 text-[#e63462]" />
            <span>
              {billingConfig?.bankName || "Banka"} • Ayın {collectionStartDay}-
              {collectionEndDay}&apos;u
            </span>
            <Settings2 className="h-3.5 w-3.5 text-[#86868b]" />
          </button>
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
        selectedPeriodLabel={formatPeriodLong(selectedPeriod)}
        periodTargetTotal={metrics.periodTargetTotal}
        billableCount={metrics.billableCount}
        periodPaidFeeTotal={metrics.periodPaidFeeTotal}
        periodPaidCount={metrics.periodPaidCount}
        periodCashCollected={metrics.periodCashCollected}
        unpaidBalanceTotal={metrics.unpaidBalanceTotal}
        unpaidVenuesCount={metrics.unpaidVenuesCount}
        overduePeriodsCount={metrics.overduePeriodsCount}
        suspendedCount={metrics.suspendedCount}
      />

      {activeTab === "period" && (
        <RecordPaymentModal
          selectedPeriod={selectedPeriod}
          currentPeriod={currentPeriod}
          collectionEndDay={collectionEndDay}
          allCount={restaurants.length}
          paidCount={metrics.periodPaidCount}
          unpaidCount={metrics.unpaidSelectedCount}
          overdueCount={metrics.overdueVenuesCount}
          suspendedCount={metrics.suspendedCount}
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
          onOpenNewPayment={(r, period) =>
            setPaymentModalState({ restaurantId: r.id, initialPeriod: period })
          }
          onOpenHistory={(r) => setHistoryModalRestId(r.id)}
          onSuspendUnpaid={(r) => void handleSuspendUnpaid(r)}
          onUnsuspendAccess={(r) => void handleUnsuspendAccess(r)}
          onBulkSuspendUnpaid={() => void handleBulkSuspendUnpaid()}
        />
      )}

      {activeTab === "matrix" && (
        <BillingMatrixView
          restaurants={restaurants}
          selectedYear={matrixYear}
          onYearChange={setMatrixYear}
          currentPeriod={currentPeriod}
          collectionEndDay={collectionEndDay}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onOpenNewPayment={(r, period) =>
            setPaymentModalState({ restaurantId: r.id, initialPeriod: period })
          }
          onOpenHistory={(r) => setHistoryModalRestId(r.id)}
        />
      )}

      {activeTab === "ledger" && (
        <BillingLedgerView
          restaurants={restaurants}
          onEditPayment={(r, payment) =>
            setPaymentModalState({ restaurantId: r.id, editingPayment: payment })
          }
          onDeletePayment={handleDeletePayment}
        />
      )}

      <BillingConfigModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        billingConfig={billingConfig}
        onUpdateConfig={updateBillingConfig}
        onNotice={showNotice}
      />

      <PaymentFormModal
        restaurant={activePaymentRestaurant}
        initialPeriod={paymentModalState?.initialPeriod}
        editingPayment={paymentModalState?.editingPayment}
        onClose={() => setPaymentModalState(null)}
        onSubmitNew={handleCreatePayment}
        onSubmitEdit={handleEditPayment}
      />

      <RestaurantBillingHistoryModal
        restaurant={activeHistoryRestaurant}
        collectionEndDay={collectionEndDay}
        onClose={() => setHistoryModalRestId(null)}
        onOpenNewPayment={(r, period) =>
          setPaymentModalState({ restaurantId: r.id, initialPeriod: period })
        }
        onEditPayment={(r, payment) =>
          setPaymentModalState({ restaurantId: r.id, editingPayment: payment })
        }
        onDeletePayment={handleDeletePayment}
      />
    </div>
  )
}
