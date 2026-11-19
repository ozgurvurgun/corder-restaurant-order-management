import { useState, useEffect, useMemo, useCallback } from "react"
import {
  AlertOctagon, AlertTriangle, CheckCircle2, Eye, Loader2,
  RefreshCw, ShieldAlert, ShieldCheck, Sparkles, Trash2, User, XCircle,
} from "lucide-react"
import { api, type FraudAlertDto } from "@/lib/api"
import { usePanelAuth } from "@/lib/panel-auth"
import { showPanelToast } from "./panel-toast"
import { formatCurrency, formatIstanbulDateTime, fromMinorUnits, toMinorUnits } from "@/lib/format"
import { PaginationBar } from "@/components/ui/pagination-bar"

const RULE_BADGE_LABELS: Record<string, string> = {
  post_print_void_or_discount: "Fiş Sonrası İptal/İskonto", post_receipt_void: "Fiş Sonrası İptal/İskonto",
  post_print_cancel: "Fiş Sonrası İptal/İskonto", post_receipt_cancel_or_discount: "Fiş Sonrası İptal/İskonto",
  closed_check_downgrade: "Kapalı Hesap Düşürme", completed_order_downgrade: "Kapalı Hesap Düşürme",
  closed_order_reduction: "Kapalı Hesap Düşürme", excessive_void_pattern: "Aşırı İptal Deseni",
  excessive_cancel_pattern: "Aşırı İptal Deseni", high_void_rate: "Aşırı İptal Deseni",
  transfer_then_void: "Masa Aktarma Sonrası İptal", post_transfer_void: "Masa Aktarma Sonrası İptal",
  table_move_then_void: "Masa Aktarma Sonrası İptal", move_then_cancel: "Masa Aktarma Sonrası İptal",
  cash_drawer_discrepancy: "Kasa Açığı", cash_shortage: "Kasa Açığı",
  shift_shortage: "Kasa Açığı", shift_cash_shortage: "Kasa Açığı",
  suspicious_cash_out: "Şüpheli Nakit Çıkışı", unusual_cash_out: "Şüpheli Nakit Çıkışı",
  threshold_discount: "Limit Sınırı İskonto", limit_edge_discount: "Limit Sınırı İskonto",
  boundary_discount_abuse: "Limit Sınırı İskonto", off_hours_sensitive_action: "Mesai Dışı Şüpheli İşlem",
}

const ALL_RULE_LABELS = [
  "Fiş Sonrası İptal/İskonto", "Kapalı Hesap Düşürme", "Aşırı İptal Deseni",
  "Masa Aktarma Sonrası İptal", "Kasa Açığı", "Şüpheli Nakit Çıkışı", "Limit Sınırı İskonto",
]

function resolveRuleBadgeLabel(ruleCode: string): string {
  return RULE_BADGE_LABELS[(ruleCode || "").trim().toLowerCase()] || "Kural İhlali"
}
function getAlertRiskAmount(a: FraudAlertDto): number {
  return Number(a.amountImpact ?? 0) || 0
}
function getAlertActorName(a: FraudAlertDto): string {
  return (a.actorName || "").trim()
}

const SEVERITY_STYLES: Record<FraudAlertDto["severity"], { label: string; badge: string; border: string }> = {
  critical: { label: "Kritik Risk", badge: "bg-red-100 text-red-700 border border-red-200", border: "border-red-300 bg-red-50/20" },
  high: { label: "Yüksek Risk", badge: "bg-orange-100 text-orange-700 border border-orange-200", border: "border-orange-200 bg-orange-50/15" },
  medium: { label: "Orta Risk", badge: "bg-amber-100 text-amber-800 border border-amber-200", border: "border-[#d1d1d6]/70 bg-white" },
  low: { label: "Düşük Risk", badge: "bg-slate-100 text-slate-700 border border-slate-200", border: "border-[#d1d1d6]/60 bg-white" },
}

const STATUS_LABELS: Record<FraudAlertDto["status"], { label: string; badge: string }> = {
  open: { label: "Açık Uyarı", badge: "bg-red-50 text-red-600" },
  investigating: { label: "İnceleniyor", badge: "bg-amber-50 text-amber-700" },
  resolved: { label: "Çözüldü", badge: "bg-green-50 text-green-600" },
  false_positive: { label: "Yanlış Alarm", badge: "bg-slate-100 text-slate-600" },
}

const cachedFraudAlertsByRestaurant = new Map<string, FraudAlertDto[]>()

export function SecurityFraudTab(props: { canManageAlerts: boolean }) {
  const { canManageAlerts } = props
  const { token, currentBusiness } = usePanelAuth()
  const cacheKey = currentBusiness?.id || "default"

  const [alerts, setAlerts] = useState<FraudAlertDto[]>(
    () => cachedFraudAlertsByRestaurant.get(cacheKey) ?? [],
  )
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [severityFilter, setSeverityFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const pageSize = 8

  const loadAlerts = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await api.security.listFraudAlerts(token)
      const list = Array.isArray(res) ? res : (res?.alerts ?? [])
      cachedFraudAlertsByRestaurant.set(cacheKey, list)
      setAlerts(list)
      setSelectedIds((prev) => prev.filter((id) => list.some((a) => a.id === id)))
    } catch {
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }, [token, cacheKey])

  useEffect(() => {
    void loadAlerts()
  }, [loadAlerts])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, severityFilter])

  const handleScan = async () => {
    if (!token || scanning) return
    setScanning(true)
    try {
      const res = await api.security.scanFraudAlerts(token)
      await loadAlerts()
      const createdCount = res?.newAlertsCount ?? res?.created ?? 0
      showPanelToast(
        createdCount > 0
          ? `Suistimal taraması tamamlandı: ${createdCount} yeni uyarı tespit edildi`
          : "Suistimal taraması tamamlandı, yeni şüpheli işlem bulunmadı",
        createdCount > 0 ? "info" : "success",
      )
    } catch (err) {
      showPanelToast(err instanceof Error ? err.message : "Tarama başlatılamadı", "error")
    } finally {
      setScanning(false)
    }
  }

  const handleUpdateStatus = async (id: string, status: FraudAlertDto["status"]) => {
    if (!token || !canManageAlerts || updatingId) return
    setUpdatingId(id)
    try {
      const updated = await api.security.updateFraudAlertStatus(token, id, { status })
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated, status } : a)))
      showPanelToast("Uyarı durumu güncellendi", "success")
    } catch (err) {
      showPanelToast(err instanceof Error ? err.message : "Durum güncellenemedi", "error")
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDeleteOne = async (id: string) => {
    if (!token || !canManageAlerts || deleting) return
    setDeleting(true)
    try {
      await api.security.deleteFraudAlert(token, id)
      setAlerts((prev) => prev.filter((a) => a.id !== id))
      setSelectedIds((prev) => prev.filter((x) => x !== id))
      showPanelToast("Güvenlik kaydı silindi", "success")
    } catch (err) {
      showPanelToast(err instanceof Error ? err.message : "Kayıt silinemedi", "error")
    } finally {
      setDeleting(false)
    }
  }

  const handleBulkDelete = async (opts: { ids?: string[]; deleteAll?: boolean; onlyResolved?: boolean }) => {
    if (!token || !canManageAlerts || deleting) return
    setDeleting(true)
    try {
      const res = await api.security.bulkDeleteFraudAlerts(token, opts)
      if (opts.deleteAll) {
        setAlerts([])
        setSelectedIds([])
      } else if (opts.onlyResolved) {
        setAlerts((prev) => prev.filter((a) => a.status !== "resolved" && a.status !== "false_positive"))
        setSelectedIds([])
      } else if (opts.ids?.length) {
        const idSet = new Set(opts.ids)
        setAlerts((prev) => prev.filter((a) => !idSet.has(a.id)))
        setSelectedIds((prev) => prev.filter((id) => !idSet.has(id)))
      }
      showPanelToast(`${res.deletedCount || 0} güvenlik kaydı temizlendi`, "success")
    } catch (err) {
      showPanelToast(err instanceof Error ? err.message : "Toplu silme başarısız", "error")
    } finally {
      setDeleting(false)
    }
  }

  const kpis = useMemo(() => {
    const active = alerts.filter((a) => a.status === "open" || a.status === "investigating")
    const critical = active.filter((a) => a.severity === "critical" || a.severity === "high")
    const riskMinor = active.reduce((sum, a) => sum + toMinorUnits(getAlertRiskAmount(a)), 0)
    const resolvedCount = alerts.filter((a) => a.status === "resolved" || a.status === "false_positive").length
    return {
      openCount: active.length,
      criticalCount: critical.length,
      estimatedRisk: fromMinorUnits(riskMinor),
      resolvedCount,
    }
  }, [alerts])

  const filteredAlerts = useMemo(
    () =>
      alerts.filter((a) => {
        if (statusFilter !== "all" && a.status !== statusFilter) return false
        if (severityFilter !== "all" && a.severity !== severityFilter) return false
        return true
      }),
    [alerts, statusFilter, severityFilter],
  )

  const paginatedAlerts = useMemo(
    () => filteredAlerts.slice((page - 1) * pageSize, page * pageSize),
    [filteredAlerts, page],
  )

  const allFilteredSelected =
    filteredAlerts.length > 0 && filteredAlerts.every((a) => selectedIds.includes(a.id))

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const fSet = new Set(filteredAlerts.map((a) => a.id))
      setSelectedIds((prev) => prev.filter((id) => !fSet.has(id)))
    } else {
      const next = new Set([...selectedIds, ...filteredAlerts.map((a) => a.id)])
      setSelectedIds(Array.from(next))
    }
  }

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <span className="text-[11px] font-medium text-[#86868b]">Açık Uyarılar</span>
          </div>
          <p className="text-[22px] font-bold text-[#1d1d1f]">{kpis.openCount}</p>
          <p className="text-[11px] text-[#86868b] mt-0.5">İnceleme bekleyen veya devam eden</p>
        </div>

        <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
              <AlertOctagon className="w-3.5 h-3.5 text-red-600" />
            </div>
            <span className="text-[11px] font-medium text-[#86868b]">Kritik Riskler</span>
          </div>
          <p className="text-[22px] font-bold text-red-600">{kpis.criticalCount}</p>
          <p className="text-[11px] text-[#86868b] mt-0.5">Yüksek veya kritik öncelikli anomaliler</p>
        </div>

        <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-[#e63462]/10 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5 text-[#e63462]" />
            </div>
            <span className="text-[11px] font-medium text-[#86868b]">Tahmini Risk Tutarı</span>
          </div>
          <p className="text-[22px] font-bold text-[#e63462]">{"\u20BA"}{formatCurrency(kpis.estimatedRisk)}</p>
          <p className="text-[11px] text-[#86868b] mt-0.5">Açık uyarılardaki potansiyel gelir kaybı</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-[#86868b] mr-1">Aktif Kurallar:</span>
          {ALL_RULE_LABELS.map((lbl) => (
            <span key={lbl} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#f5f5f7] text-[#1d1d1f] border border-[#d1d1d6]/50">
              {lbl}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManageAlerts && selectedIds.length > 0 && (
            <button
              type="button"
              disabled={deleting}
              onClick={() => void handleBulkDelete({ ids: selectedIds })}
              className="h-[30px] px-3 flex items-center gap-1.5 rounded-lg bg-red-600 text-white text-[12px] font-medium hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Seçilenleri Sil ({selectedIds.length})
            </button>
          )}
          {canManageAlerts && kpis.resolvedCount > 0 && (
            <button
              type="button"
              disabled={deleting}
              onClick={() => void handleBulkDelete({ onlyResolved: true })}
              className="h-[30px] px-3 flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-[12px] font-medium hover:bg-red-100 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Kapatılanları Sil ({kpis.resolvedCount})
            </button>
          )}
          {canManageAlerts && alerts.length > 0 && (
            <button
              type="button"
              disabled={deleting}
              onClick={() => void handleBulkDelete({ deleteAll: true })}
              className="h-[30px] px-3 flex items-center gap-1.5 rounded-lg border border-[#d1d1d6]/60 bg-white text-red-600 text-[12px] font-medium hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Tümünü Sil
            </button>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadAlerts()}
            className="h-[30px] px-3 flex items-center gap-1.5 rounded-lg border border-[#d1d1d6]/60 bg-white text-[12px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Yenile
          </button>
          <button
            type="button"
            disabled={scanning}
            onClick={() => void handleScan()}
            className="h-[30px] px-3.5 flex items-center gap-1.5 rounded-lg bg-[#e63462] text-white text-[12px] font-medium hover:bg-[#d42d56] disabled:opacity-50"
          >
            {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Şimdi Denetle &amp; Tara
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {canManageAlerts && filteredAlerts.length > 0 && (
            <label className="inline-flex items-center gap-1.5 h-[28px] px-2.5 rounded-lg bg-white border border-[#d1d1d6]/60 text-[11px] font-medium text-[#1d1d1f] cursor-pointer mr-1">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleSelectAllFiltered}
                className="accent-[#e63462]"
              />
              Tümünü Seç
            </label>
          )}
          {[
            { id: "all", label: "Tüm Durumlar" },
            { id: "open", label: "Açık" },
            { id: "investigating", label: "İnceleniyor" },
            { id: "resolved", label: "Çözüldü" },
            { id: "false_positive", label: "Yanlış Alarm" },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStatusFilter(s.id)}
              className={`h-[28px] px-3 rounded-lg text-[11px] font-medium transition-colors ${
                statusFilter === s.id ? "bg-[#e63462] text-white" : "bg-white border border-[#d1d1d6]/60 text-[#86868b] hover:bg-[#f5f5f7]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: "all", label: "Tüm Riskler" },
            { id: "critical", label: "Kritik" },
            { id: "high", label: "Yüksek" },
            { id: "medium", label: "Orta" },
            { id: "low", label: "Düşük" },
          ].map((sev) => (
            <button
              key={sev.id}
              type="button"
              onClick={() => setSeverityFilter(sev.id)}
              className={`h-[28px] px-2.5 rounded-lg text-[11px] font-medium transition-colors ${
                severityFilter === sev.id ? "bg-[#1d1d1f] text-white" : "bg-white border border-[#d1d1d6]/60 text-[#86868b] hover:bg-[#f5f5f7]"
              }`}
            >
              {sev.label}
            </button>
          ))}
        </div>
      </div>

      {paginatedAlerts.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#d1d1d6]/60 py-12 text-center">
          <ShieldCheck className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="text-[14px] font-semibold text-[#1d1d1f]">Şüpheli İşlem veya Suistimal Uyarısı Bulunmadı</p>
          <p className="text-[12px] text-[#86868b] mt-1">
            Seçili filtrelerde kayıtlı anomali yok. Geçmiş işlemleri denetlemek için &quot;Şimdi Denetle &amp; Tara&quot; butonunu kullanabilirsiniz.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedAlerts.map((alert) => {
            const sev = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.medium
            const st = STATUS_LABELS[alert.status] || STATUS_LABELS.open
            const ruleBadge = resolveRuleBadgeLabel(alert.ruleCode)
            const isBusy = updatingId === alert.id || deleting
            const riskAmt = getAlertRiskAmount(alert)
            const actor = getAlertActorName(alert)
            const isSelected = selectedIds.includes(alert.id)

            return (
              <div key={alert.id} className={`rounded-xl border p-4 transition-all ${sev.border}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-[240px]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {canManageAlerts && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(alert.id)}
                          className="accent-[#e63462] mr-1 cursor-pointer"
                        />
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sev.badge}`}>{sev.label}</span>
                      <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#1d1d1f] text-white">{ruleBadge}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.badge}`}>{st.label}</span>
                      <span className="text-[11px] text-[#86868b] ml-1">{formatIstanbulDateTime(alert.createdAt)}</span>
                    </div>
                    <h4 className="text-[14px] font-semibold text-[#1d1d1f]">{alert.title}</h4>
                    <p className="text-[12px] text-[#636366] leading-relaxed">{alert.description}</p>
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-[#86868b]">
                      {actor && (
                        <span className="inline-flex items-center gap-1 font-medium text-[#1d1d1f]">
                          <User className="w-3 h-3 text-[#e63462]" /> Personel: {actor}
                        </span>
                      )}
                      {alert.tableName && <span>Masa: {alert.tableName}</span>}
                      {alert.resolvedBy && <span>İşlem Yapan: {alert.resolvedBy}</span>}
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-between gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-[#86868b] block">Tahmini Risk Tutarı</span>
                      <span className="text-[16px] font-bold text-[#e63462]">
                        {"\u20BA"}{formatCurrency(riskAmt)}
                      </span>
                    </div>
                    {canManageAlerts && (
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {alert.status !== "investigating" && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleUpdateStatus(alert.id, "investigating")}
                            className="h-[28px] px-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-medium flex items-center gap-1 disabled:opacity-50"
                          >
                            <Eye className="w-3 h-3" /> İncelemeye Al
                          </button>
                        )}
                        {alert.status !== "resolved" && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleUpdateStatus(alert.id, "resolved")}
                            className="h-[28px] px-2.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-[11px] font-medium flex items-center gap-1 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Çözüldü
                          </button>
                        )}
                        {alert.status !== "false_positive" && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleUpdateStatus(alert.id, "false_positive")}
                            className="h-[28px] px-2.5 rounded-lg bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#636366] border border-[#d1d1d6]/60 text-[11px] font-medium flex items-center gap-1 disabled:opacity-50"
                          >
                            <XCircle className="w-3 h-3" /> Yanlış Alarm
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleDeleteOne(alert.id)}
                          title="Kaydı Sil"
                          className="h-[28px] px-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-[11px] font-medium flex items-center gap-1 disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" /> Sil
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          <PaginationBar
            currentPage={page}
            totalItems={filteredAlerts.length}
            pageSize={pageSize}
            onPageChange={setPage}
            itemLabel="güvenlik uyarısı"
          />
        </div>
      )}
    </div>
  )
}
