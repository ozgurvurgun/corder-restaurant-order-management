import { useEffect, useMemo, useState } from "react"
import { useBossStore } from "@/lib/boss-store"
import type { FraudAlertDto, FraudAlertStatus, FraudSeverity } from "@/lib/types"
import { formatIstanbulDateTime, formatMoney, sumMoney } from "@/lib/format"
import {
  FRAUD_ALGORITHMS,
  playFraudAlertChime,
  requestBrowserNotificationPermission,
  triggerFraudPushNotification,
} from "@/lib/fraud-notifier"
import { PaginationBar } from "./ui/pagination-bar"
import {
  ShieldAlert,
  Bell,
  BellOff,
  Volume2,
  CheckCircle2,
  Eye,
  XCircle,
  AlertTriangle,
  Clock,
  Building2,
  User,
  Cpu,
  MessageSquare,
} from "lucide-react"

const SEVERITY_OPTIONS: Array<{ id: FraudSeverity | "ALL"; label: string }> = [
  { id: "ALL", label: "Tüm Seviyeler" },
  { id: "critical", label: "Kritik" },
  { id: "high", label: "Yüksek" },
  { id: "medium", label: "Orta" },
  { id: "low", label: "Düşük" },
]

const STATUS_OPTIONS: Array<{ id: FraudAlertStatus | "ALL"; label: string }> = [
  { id: "ALL", label: "Tüm Durumlar" },
  { id: "open", label: "Açık" },
  { id: "investigating", label: "İnceleniyor" },
  { id: "resolved", label: "Çözüldü" },
  { id: "false_positive", label: "Yanlış Alarm" },
]

const SEVERITY_BADGES: Record<FraudSeverity, { label: string; className: string }> = {
  critical: { label: "Kritik", className: "bg-red-600 text-white" },
  high: { label: "Yüksek", className: "bg-orange-500 text-white" },
  medium: { label: "Orta", className: "bg-amber-100 text-amber-800" },
  low: { label: "Düşük", className: "bg-zinc-100 text-zinc-700" },
}

const STATUS_BADGES: Record<FraudAlertStatus, { label: string; className: string }> = {
  open: { label: "Açık", className: "bg-red-100 text-red-700 border border-red-200" },
  investigating: { label: "İnceleniyor", className: "bg-blue-100 text-blue-700 border border-blue-200" },
  resolved: { label: "Çözüldü", className: "bg-emerald-100 text-emerald-700 border border-emerald-200" },
  false_positive: { label: "Yanlış Alarm", className: "bg-zinc-100 text-zinc-600 border border-zinc-200" },
}

export function SecurityFraudTab() {
  const { fraudAlerts, pushSoundEnabled, togglePushSound, updateFraudAlertStatus, showToast } = useBossStore()
  const [severityFilter, setSeverityFilter] = useState<FraudSeverity | "ALL">("ALL")
  const [statusFilter, setStatusFilter] = useState<FraudAlertStatus | "ALL">("ALL")
  const [showAlgorithms, setShowAlgorithms] = useState(true)
  const [activeNoteAlertId, setActiveNoteAlertId] = useState<string | null>(null)
  const [pendingStatus, setPendingStatus] = useState<FraudAlertStatus>("investigating")
  const [noteDraft, setNoteDraft] = useState("")
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 6

  useEffect(() => {
    setPage(1)
  }, [severityFilter, statusFilter])

  const summary = useMemo(() => {
    const openOrInv = fraudAlerts.filter((a) => a.status === "open" || a.status === "investigating")
    const criticalHigh = openOrInv.filter((a) => a.severity === "critical" || a.severity === "high")
    const totalImpact = openOrInv.reduce((s, a) => sumMoney(s, a.amountImpact), 0)
    const resolvedCount = fraudAlerts.filter((a) => a.status === "resolved" || a.status === "false_positive").length
    return { openCount: openOrInv.length, criticalHighCount: criticalHigh.length, totalImpact, resolvedCount }
  }, [fraudAlerts])

  const filteredAlerts = useMemo(
    () =>
      fraudAlerts.filter((a) => {
        if (severityFilter !== "ALL" && a.severity !== severityFilter) return false
        if (statusFilter !== "ALL" && a.status !== statusFilter) return false
        return true
      }),
    [fraudAlerts, severityFilter, statusFilter]
  )

  const pagedAlerts = useMemo(
    () => filteredAlerts.slice((page - 1) * pageSize, page * pageSize),
    [filteredAlerts, page]
  )

  const openActionPrompt = (alert: FraudAlertDto, status: FraudAlertStatus) => {
    setActiveNoteAlertId(alert.id)
    setPendingStatus(status)
    setNoteDraft(alert.resolutionNote ?? "")
  }

  const handleConfirmAction = async (alertId: string) => {
    setSubmittingId(alertId)
    try {
      await updateFraudAlertStatus(alertId, pendingStatus, noteDraft.trim() || undefined)
      setActiveNoteAlertId(null)
      setNoteDraft("")
    } finally {
      setSubmittingId(null)
    }
  }

  const handleTestPushAndSound = async () => {
    playFraudAlertChime("critical")
    const perm = await requestBrowserNotificationPermission()
    if (perm === "granted") {
      await triggerFraudPushNotification({
        id: `test-${Date.now()}`,
        ruleKey: "POST_PRINT_VOID_DISCOUNT",
        title: "Fiş Basımı Sonrası İptal / İskonto (Test)",
        description: "Push ve sesli güvenlik uyarısı sistemi aktif ve sorunsuz çalışıyor.",
        severity: "critical",
        status: "open",
        amountImpact: 450,
        branchName: "Test Şube",
        createdAt: new Date().toISOString(),
      })
      showToast("Sesli alarm ve tarayıcı Push bildirimi gönderildi")
    } else {
      showToast("Sesli alarm çalındı (tarayıcı bildirim izni verilmedi)")
    }
  }

  return (
    <div className="space-y-4">
      {/* Header & Push / Sound Notification Controls */}
      <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-[#1d1d1f]">
                Hırsızlık, Kaçak &amp; Suistimal Tespit Merkezi
              </h2>
              <p className="mt-0.5 text-[12px] text-[#86868b]">
                Kasa, adisyon, fiş basımı sonrası iptal, masa taşıma ve vardiya açıklarını 7 gerçek zamanlı algoritma ile denetler.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void togglePushSound(!pushSoundEnabled)}
              className={`inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-[12px] font-semibold transition-all border ${
                pushSoundEnabled
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-[#d1d1d6] bg-[#f5f5f7] text-[#636366]"
              }`}
            >
              {pushSoundEnabled ? <Bell className="h-4 w-4 text-emerald-600" /> : <BellOff className="h-4 w-4 text-[#86868b]" />}
              Push &amp; Sesli Uyarı: {pushSoundEnabled ? "Açık" : "Kapalı"}
            </button>

            <button
              type="button"
              onClick={() => void handleTestPushAndSound()}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e5e5ea] bg-[#f9f9fb] px-3 text-[12px] font-medium text-[#1d1d1f] hover:bg-[#f0f0f5]"
            >
              <Volume2 className="h-3.5 w-3.5 text-[#e63462]" />
              Sesi &amp; Bildirimi Test Et
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-[#e5e5ea] bg-[#f9f9fb] p-3">
            <p className="text-[11px] font-medium text-[#86868b]">Açık / İncelenen Uyarı</p>
            <p className="mt-1 text-[18px] font-bold text-[#1d1d1f] tabular-nums">{summary.openCount} Adet</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50/60 p-3">
            <p className="text-[11px] font-medium text-red-700">Kritik &amp; Yüksek Risk</p>
            <p className="mt-1 text-[18px] font-bold text-red-600 tabular-nums">{summary.criticalHighCount} Adet</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
            <p className="text-[11px] font-medium text-amber-800">Riskli Tutar Etkisi</p>
            <p className="mt-1 text-[18px] font-bold text-amber-900 tabular-nums">₺{formatMoney(summary.totalImpact)}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
            <p className="text-[11px] font-medium text-emerald-800">Çözülen / Kapatılan</p>
            <p className="mt-1 text-[18px] font-bold text-emerald-700 tabular-nums">{summary.resolvedCount} Adet</p>
          </div>
        </div>
      </div>

      {/* 7 Real-Time Fraud Detection Algorithms Overview */}
      <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-[#e63462]" />
            <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
              Aktif Gerçek Zamanlı Suistimal Tespit Algoritmaları (7 Kural)
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowAlgorithms((v) => !v)}
            className="text-[12px] font-semibold text-[#e63462] hover:underline"
          >
            {showAlgorithms ? "Gizle" : "Algoritmaları Göster"}
          </button>
        </div>

        {showAlgorithms && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {FRAUD_ALGORITHMS.map((alg) => {
              const badge = SEVERITY_BADGES[alg.severity]
              return (
                <div key={alg.key} className="rounded-xl border border-[#e5e5ea] bg-[#f9f9fb] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-semibold text-[#1d1d1f]">{alg.title}</span>
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#86868b] leading-relaxed">{alg.description}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Filters & Paginated Fraud Alerts List */}
      <div className="rounded-2xl border border-[#d1d1d6]/60 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-[#86868b] mr-1">Risk Seviyesi:</span>
            {SEVERITY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSeverityFilter(opt.id)}
                className={`rounded-xl px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  severityFilter === opt.id ? "bg-[#e63462] text-white" : "bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-[#86868b] mr-1">Durum:</span>
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStatusFilter(opt.id)}
                className={`rounded-xl px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  statusFilter === opt.id ? "bg-[#1d1d1f] text-white" : "bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {filteredAlerts.length === 0 ? (
          <div className="py-10 text-center">
            <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" />
            <p className="mt-2 text-[14px] font-semibold text-[#1d1d1f]">
              Seçili kriterlerde güvenlik veya kaçak uyarısı bulunmuyor
            </p>
            <p className="mt-0.5 text-[12px] text-[#86868b]">
              Tüm şube kasa ve adisyon hareketleri gerçek zamanlı olarak izlenmektedir.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {pagedAlerts.map((alert) => {
                const sevBadge = SEVERITY_BADGES[alert.severity]
                const stBadge = STATUS_BADGES[alert.status]
                const isEditingNote = activeNoteAlertId === alert.id
                return (
                  <div
                    key={alert.id}
                    className={`rounded-2xl border p-4 transition-all ${
                      alert.severity === "critical" && alert.status === "open"
                        ? "border-red-300 bg-red-50/30"
                        : "border-[#e5e5ea] bg-[#f9f9fb]"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${sevBadge.className}`}>{sevBadge.label}</span>
                          <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${stBadge.className}`}>{stBadge.label}</span>
                          <h4 className="text-[13.5px] font-semibold text-[#1d1d1f]">{alert.title}</h4>
                          {alert.branchName && (
                            <span className="inline-flex items-center gap-1 rounded bg-white border border-[#e5e5ea] px-2 py-0.5 text-[10.5px] font-medium text-[#1d1d1f]">
                              <Building2 className="h-3 w-3 text-[#e63462]" /> {alert.branchName}
                            </span>
                          )}
                          {alert.staffName && (
                            <span className="inline-flex items-center gap-1 rounded bg-white border border-[#e5e5ea] px-2 py-0.5 text-[10.5px] font-medium text-[#636366]">
                              <User className="h-3 w-3" /> {alert.staffName}
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-[12px] text-[#1d1d1f] leading-relaxed">{alert.description}</p>
                        {alert.resolutionNote && (
                          <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white border border-[#e5e5ea] px-2.5 py-1 text-[11px] text-[#636366]">
                            <MessageSquare className="h-3 w-3 text-[#e63462]" />
                            <span className="font-semibold text-[#1d1d1f]">Patron Notu:</span> {alert.resolutionNote}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        {alert.amountImpact > 0 && (
                          <p className="text-[15px] font-bold text-red-600 tabular-nums">₺{formatMoney(alert.amountImpact)}</p>
                        )}
                        <p className="flex items-center justify-end gap-1 text-[10.5px] text-[#86868b] mt-0.5">
                          <Clock className="h-3 w-3" /> {formatIstanbulDateTime(alert.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#e5e5ea] pt-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openActionPrompt(alert, "investigating")}
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          <Eye className="h-3 w-3" /> İnceleniyor
                        </button>
                        <button
                          type="button"
                          onClick={() => openActionPrompt(alert, "resolved")}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          <CheckCircle2 className="h-3 w-3" /> Çözüldü
                        </button>
                        <button
                          type="button"
                          onClick={() => openActionPrompt(alert, "false_positive")}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-100"
                        >
                          <XCircle className="h-3 w-3" /> Yanlış Alarm
                        </button>
                      </div>
                      <span className="text-[10px] font-mono text-[#86868b]">Kural: {alert.ruleKey}</span>
                    </div>

                    {isEditingNote && (
                      <div className="mt-3 rounded-xl border border-[#d1d1d6] bg-white p-3 space-y-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1d1d1f]">
                          <AlertTriangle className="h-3.5 w-3.5 text-[#e63462]" />
                          Durumu &ldquo;{STATUS_BADGES[pendingStatus].label}&rdquo; Olarak Güncelle
                        </div>
                        <input
                          type="text"
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          placeholder="İnceleme veya aksiyon notunuzu yazın (isteğe bağlı)..."
                          className="h-9 w-full rounded-lg border border-[#d1d1d6] bg-[#f5f5f7] px-3 text-[12px] outline-none focus:border-[#e63462] focus:bg-white"
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveNoteAlertId(null)}
                            className="h-8 rounded-lg px-3 text-[11px] font-medium text-[#86868b] hover:bg-[#f5f5f7]"
                          >
                            Vazgeç
                          </button>
                          <button
                            type="button"
                            disabled={submittingId === alert.id}
                            onClick={() => void handleConfirmAction(alert.id)}
                            className="h-8 rounded-lg bg-[#e63462] px-3.5 text-[11px] font-semibold text-white hover:bg-[#d42d56] disabled:opacity-50"
                          >
                            {submittingId === alert.id ? "Kaydediliyor…" : "Kaydet"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <PaginationBar
              currentPage={page}
              totalItems={filteredAlerts.length}
              pageSize={pageSize}
              onPageChange={setPage}
              itemLabel="güvenlik uyarısı"
            />
          </>
        )}
      </div>
    </div>
  )
}
