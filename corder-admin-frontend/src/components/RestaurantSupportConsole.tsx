import { useCallback, useEffect, useState } from "react"
import {
  getPlatformToken,
  getRestaurantDiagnostics,
  runRestaurantSupportAction,
  type RestaurantDiagnosticsDto,
} from "@/lib/api"
import type { RestaurantDiagnosticsStaffDto, RestaurantSupportActionType } from "@/lib/types"
import { formatIstanbulDate, formatMoney } from "@/lib/money"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { CopyEmailInlineButton } from "@/components/CorderEmailInput"
import { PaginationBar } from "@/components/ui/pagination-bar"
import { PasswordInputWithGenerator } from "@/components/ui/password-input"
import {
  Activity, AlertTriangle, BellOff, CheckCircle2, KeyRound, LayoutGrid,
  Power, Printer, RefreshCw, ShieldAlert, ShoppingBag, Users, Utensils, Wallet, Wrench,
} from "lucide-react"

const STAFF_PAGE_SIZE = 8

const ROLE_LABELS: Record<string, string> = {
  branch_manager: "Şube Müdürü", manager: "Yönetici", shift_supervisor: "Vardiya Amiri",
  cashier: "Kasiyer", head_waiter: "Şef Garson", waiter: "Garson",
  runner: "Komi / Runner", inventory_manager: "Depo & Stok Sorumlusu", accountant: "Muhasebe",
}

function extractDiagnosticsViewModel(raw: RestaurantDiagnosticsDto | null) {
  return {
    totalTables: raw?.tablesSummary?.total ?? 0,
    occupiedTables: raw?.tablesSummary?.occupied ?? 0,
    emptyTables: raw?.tablesSummary?.empty ?? 0,
    reservedTables: raw?.tablesSummary?.reserved ?? 0,
    activeOrders: raw?.activeOrdersCount ?? 0,
    todayRevenue: raw?.todayRevenue ?? 0,
    totalRevenue: raw?.totalRevenue ?? 0,
    openShift: raw?.openShift ?? null,
    categoriesCount: raw?.categoriesCount ?? 0,
    productsCount: raw?.productsCount ?? 0,
    pendingPrintJobs: raw?.pendingPrintJobsCount ?? 0,
    openCreditCount: raw?.ledgerSummary?.customerCount ?? 0,
    openCreditDebt: raw?.ledgerSummary?.totalReceivable ?? 0,
    securityAlertsCount: raw?.openFraudAlertsCount ?? 0,
    printers: raw?.printers ?? [],
    staff: raw?.staffMembers ?? [],
  }
}

export function RestaurantSupportConsole({
  restaurantId,
  restaurantName,
}: {
  restaurantId: string
  restaurantName: string
}) {
  const confirm = useConfirm()
  const [data, setData] = useState<RestaurantDiagnosticsDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [staffPage, setStaffPage] = useState(1)
  const [resetTarget, setResetTarget] = useState<RestaurantDiagnosticsStaffDto | null>(null)
  const [newPassword, setNewPassword] = useState("")

  const showNotice = (text: string, type: "ok" | "err" = "ok") => {
    setNotice({ type, text })
    window.setTimeout(() => setNotice((cur) => (cur?.text === text ? null : cur)), 4500)
  }

  const loadDiagnostics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = getPlatformToken() ?? ""
      setData(await getRestaurantDiagnostics(token, restaurantId))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Canlı destek verileri alınamadı")
    } finally {
      setLoading(false)
    }
  }, [restaurantId])

  useEffect(() => {
    void loadDiagnostics()
  }, [loadDiagnostics])

  const executeSupportAction = async (
    action: RestaurantSupportActionType,
    label: string,
    opts?: { targetId?: string; newPassword?: string; skipConfirm?: boolean }
  ) => {
    if (
      !opts?.skipConfirm &&
      !(await confirm({
        title: "Canlı Destek Müdahalesini Onayla",
        message: `${restaurantName} için "${label}" işlemini uygulamak istiyor musunuz?`,
        confirmLabel: "Uygula",
        variant: "warning",
      }))
    ) {
      return
    }
    setBusyAction(opts?.targetId ? `${action}:${opts.targetId}` : action)
    try {
      const token = getPlatformToken() ?? ""
      const res = await runRestaurantSupportAction(token, restaurantId, {
        action,
        targetId: opts?.targetId,
        newPassword: opts?.newPassword,
      })
      showNotice(res?.message || `${label} başarıyla tamamlandı.`)
      await loadDiagnostics()
    } catch (err) {
      showNotice(err instanceof Error ? err.message : "Destek aksiyonu başarısız", "err")
    } finally {
      setBusyAction(null)
    }
  }

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetTarget || newPassword.trim().length < 4) return
    await executeSupportAction("reset_staff_password", `${resetTarget.name} parola sıfırlama`, {
      targetId: resetTarget.id,
      newPassword: newPassword.trim(),
      skipConfirm: true,
    })
    setResetTarget(null)
    setNewPassword("")
  }

  const m = extractDiagnosticsViewModel(data)
  const totalStaffPages = Math.max(1, Math.ceil(m.staff.length / STAFF_PAGE_SIZE))
  const safeStaffPage = Math.min(staffPage, totalStaffPages)
  const paginatedStaff = m.staff.slice((safeStaffPage - 1) * STAFF_PAGE_SIZE, safeStaffPage * STAFF_PAGE_SIZE)

  const quickActions: Array<{ action: RestaurantSupportActionType; label: string; icon: typeof Printer; color: string; badge?: number }> = [
    { action: "clear_print_queue", label: "Takılı Yazdırma Kuyruğunu Temizle", icon: Printer, color: "text-[#e63462]", badge: m.pendingPrintJobs },
    { action: "force_close_shift", label: "Açık Kasa Vardiyasını Zorla Kapat", icon: Power, color: "text-amber-600" },
    { action: "release_stuck_tables", label: "Askıda Kalan Masaları Boşa Çıkar", icon: ShieldAlert, color: "text-blue-600" },
    { action: "clear_notifications", label: "Mekan Bildirimlerini Sıfırla", icon: BellOff, color: "text-purple-600" },
  ]

  return (
    <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0f0f0] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#e63462]/10 flex items-center justify-center text-[#e63462]">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-[#1d1d1f]">Mekan 360° Canlı Destek &amp; Operasyon Merkezi</h2>
            <p className="text-[12px] text-[#86868b]">Anlık masa, sipariş, vardiya, yazıcı ve personel durumunu inceleyin; tek tıkla teknik müdahale yapın.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadDiagnostics()}
          disabled={loading}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3.5 text-[12px] font-semibold text-[#1d1d1f] hover:bg-[#e8e8ed] disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-[#e63462]" : ""}`} />
          Canlı Verileri Yenile
        </button>
      </div>

      {notice && (
        <div className={`rounded-xl border px-4 py-3 text-[13px] font-medium ${notice.type === "err" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          {notice.text}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-800 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => void loadDiagnostics()} className="rounded-lg bg-amber-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-amber-700">Tekrar Dene</button>
        </div>
      )}

      {/* 1. Canlı Operasyon Metrikleri */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#e5e5ea] bg-[#fafafa] p-3.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#86868b]">
            <span>TOPLAM MASA DURUMU</span>
            <LayoutGrid className="h-4 w-4 text-[#e63462]" />
          </div>
          <p className="mt-1.5 text-[18px] font-bold text-[#1d1d1f] tabular-nums">{m.totalTables} Masa</p>
          <p className="mt-1 text-[11px] text-[#636366]">
            <span className="font-semibold text-[#e63462]">{m.occupiedTables} Dolu</span> • <span className="font-semibold text-emerald-700">{m.emptyTables} Boş</span> • <span className="font-semibold text-amber-700">{m.reservedTables} Rezerve</span>
          </p>
        </div>

        <div className="rounded-xl border border-[#e5e5ea] bg-[#fafafa] p-3.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#86868b]">
            <span>AKTİF SİPARİŞ &amp; CİRO</span>
            <ShoppingBag className="h-4 w-4 text-[#e63462]" />
          </div>
          <p className="mt-1.5 text-[18px] font-bold text-[#1d1d1f] tabular-nums">{m.activeOrders} Aktif Sipariş</p>
          <p className="mt-1 text-[11px] text-[#636366] tabular-nums">
            Bugün: <span className="font-semibold text-[#1d1d1f]">{formatMoney(m.todayRevenue)}</span> • Toplam: <span className="font-semibold text-[#1d1d1f]">{formatMoney(m.totalRevenue)}</span>
          </p>
        </div>

        <div className="rounded-xl border border-[#e5e5ea] bg-[#fafafa] p-3.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#86868b]">
            <span>AÇIK KASA VARDİYASI</span>
            <Wallet className="h-4 w-4 text-emerald-600" />
          </div>
          {m.openShift ? (
            <>
              <p className="mt-1.5 text-[14px] font-bold text-emerald-700 truncate">Açık • {m.openShift.openedBy}</p>
              <p className="mt-1 text-[11px] text-[#636366] tabular-nums">
                Açılış: {formatIstanbulDate(m.openShift.openedAt)} • Bakiye: <span className="font-semibold">{formatMoney(m.openShift.openingBalance)}</span>
              </p>
            </>
          ) : (
            <>
              <p className="mt-1.5 text-[14px] font-semibold text-[#86868b]">Açık Vardiya Yok</p>
              <p className="mt-1 text-[11px] text-[#86868b]">Kasa şu an kapalı durumda</p>
            </>
          )}
        </div>

        <div className="rounded-xl border border-[#e5e5ea] bg-[#fafafa] p-3.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#86868b]">
            <span>MENÜ, KUYRUK &amp; CARİ / GÜVENLİK</span>
            <Utensils className="h-4 w-4 text-[#e63462]" />
          </div>
          <p className="mt-1.5 text-[13px] font-bold text-[#1d1d1f] tabular-nums">{m.categoriesCount} Kategori • {m.productsCount} Ürün</p>
          <p className="mt-1 text-[11px] text-[#636366] tabular-nums">
            Kuyruk: <span className="font-semibold text-[#e63462]">{m.pendingPrintJobs}</span> • Cari: <span className="font-semibold">{formatMoney(m.openCreditDebt)}</span> ({m.openCreditCount}) • Uyarı: <span className="font-semibold text-red-600">{m.securityAlertsCount}</span>
          </p>
        </div>
      </div>

      {/* 2. Hızlı Teknik Destek Aksiyonları */}
      <div className="rounded-xl border border-[#e5e5ea] bg-[#f9f9fb] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wrench className="h-4 w-4 text-[#e63462]" />
          <h3 className="text-[13px] font-semibold text-[#1d1d1f]">Hızlı Teknik Destek Aksiyonları (Tek Tıkla Çözüm)</h3>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map(({ action, label, icon: Icon, color, badge }) => (
            <button
              key={action}
              type="button"
              disabled={busyAction !== null}
              onClick={() => void executeSupportAction(action, label)}
              className="flex items-center justify-between rounded-xl border border-[#e5e5ea] bg-white px-3.5 py-2.5 text-left text-[12px] font-semibold text-[#1d1d1f] hover:border-[#e63462] hover:bg-[#fef3f5] transition-colors disabled:opacity-50 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${color}`} />
                {label}
              </span>
              {badge !== undefined && (
                <span className="rounded-md bg-[#f5f5f7] px-1.5 py-0.5 text-[10px] font-bold text-[#636366]">{badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Kayıtlı Yazıcılar & Durumları Tablosu */}
      <div className="rounded-xl border border-[#e5e5ea] overflow-hidden">
        <div className="bg-[#fafafa] px-4 py-2.5 border-b border-[#f0f0f0] flex items-center gap-2 text-[12px] font-semibold text-[#1d1d1f]">
          <Printer className="h-4 w-4 text-[#e63462]" />
          Kayıtlı Yazıcılar &amp; Durumları ({m.printers.length})
        </div>
        {m.printers.length === 0 ? (
          <div className="p-5 text-center text-[12px] text-[#86868b]">Henüz Print Agent üzerinden tanımlanmış veya senkronize edilmiş yazıcı bulunmuyor.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-[#f0f0f0] bg-[#fafafa] text-[10px] font-semibold uppercase text-[#86868b]">
                  <th className="px-4 py-2.5">Yazıcı Adı / Departman</th>
                  <th className="px-4 py-2.5">Bağlantı (IP / USB)</th>
                  <th className="px-4 py-2.5">Kağıt Genişliği</th>
                  <th className="px-4 py-2.5">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f0]">
                {m.printers.map((p: any) => (
                  <tr key={p.id} className="hover:bg-[#f9f9fb]">
                    <td className="px-4 py-2.5 font-semibold text-[#1d1d1f]">
                      {p.name}
                      {p.department && <span className="ml-2 text-[11px] font-normal text-[#86868b]">({p.department})</span>}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-[#636366]">
                      {String(p.connection ?? "network").toUpperCase()} {p.ipAddress ? `• ${p.ipAddress}${p.port ? `:${p.port}` : ""}` : ""}
                    </td>
                    <td className="px-4 py-2.5 text-[#636366]">{p.paperWidth ?? 80} mm</td>
                    <td className="px-4 py-2.5">
                      {p.status === "online" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" /> Çevrimiçi
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                          <AlertTriangle className="h-3 w-3" /> Çevrimdışı
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Tüm Şube Personelleri & Hızlı Müdahale Tablosu (Paginated) */}
      <div className="rounded-xl border border-[#e5e5ea] overflow-hidden">
        <div className="bg-[#fafafa] px-4 py-2.5 border-b border-[#f0f0f0] flex items-center gap-2 text-[12px] font-semibold text-[#1d1d1f]">
          <Users className="h-4 w-4 text-[#e63462]" />
          Tüm Şube Personelleri &amp; Hızlı Müdahale ({m.staff.length})
        </div>

        {resetTarget && (
          <form onSubmit={(e) => void handlePasswordResetSubmit(e)} className="bg-[#fef3f5] border-b border-[#e63462]/20 p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12px] text-[#1d1d1f]">
              <span className="font-semibold">{resetTarget.name}</span> ({resetTarget.email || resetTarget.role}) için yeni parola ata:
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-64">
                <PasswordInputWithGenerator value={newPassword} onValueChange={setNewPassword} placeholder="Yeni parola (en az 4 krk)" minLength={4} required />
              </div>
              <button type="submit" disabled={busyAction !== null} className="h-10 rounded-xl bg-[#e63462] px-3.5 text-[12px] font-semibold text-white hover:bg-[#d42d56] cursor-pointer">Parolayı Kaydet</button>
              <button type="button" onClick={() => { setResetTarget(null); setNewPassword("") }} className="h-10 rounded-xl border border-[#d1d1d6] bg-white px-3 text-[12px] font-medium text-[#636366] hover:bg-[#f5f5f7] cursor-pointer">İptal</button>
            </div>
          </form>
        )}

        {m.staff.length === 0 ? (
          <div className="p-5 text-center text-[12px] text-[#86868b]">Bu şubede henüz kayıtlı personel bulunmuyor.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-[#f0f0f0] bg-[#fafafa] text-[10px] font-semibold uppercase text-[#86868b]">
                  <th className="px-4 py-2.5">Personel Adı</th>
                  <th className="px-4 py-2.5">Rolü</th>
                  <th className="px-4 py-2.5">E-posta</th>
                  <th className="px-4 py-2.5">Giriş Yetkisi</th>
                  <th className="px-4 py-2.5">Durum</th>
                  <th className="px-4 py-2.5 text-right">Hızlı Müdahale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f0]">
                {paginatedStaff.map((s) => (
                  <tr key={s.id} className="hover:bg-[#f9f9fb]">
                    <td className="px-4 py-2.5 font-semibold text-[#1d1d1f]">{s.name}</td>
                    <td className="px-4 py-2.5 text-[#636366]">{ROLE_LABELS[s.role] ?? s.role}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-[#636366]">
                      <span className="inline-flex items-center gap-1.5">
                        <span>{s.email || "-"}</span>
                        <CopyEmailInlineButton email={s.email} />
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {s.canAccessPanel && <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">Panel</span>}
                        {s.canAccessTerminal !== false && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">Terminal</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${s.isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                        {s.isActive ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={busyAction !== null}
                          onClick={() => void executeSupportAction("toggle_staff_active", `${s.name} aktif/pasif durum değiştirme`, { targetId: s.id, skipConfirm: true })}
                          className="rounded-lg border border-[#d1d1d6] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] cursor-pointer"
                        >
                          {s.isActive ? "Pasife Al" : "Aktifleştir"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setResetTarget(s); setNewPassword("") }}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#e63462]/10 px-2.5 py-1 text-[11px] font-semibold text-[#e63462] hover:bg-[#e63462] hover:text-white transition-colors cursor-pointer"
                        >
                          <KeyRound className="h-3 w-3" /> Yeni Parola Ata
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationBar currentPage={safeStaffPage} totalItems={m.staff.length} pageSize={STAFF_PAGE_SIZE} onPageChange={setStaffPage} itemLabel="personel" />
          </div>
        )}
      </div>
    </div>
  )
}
