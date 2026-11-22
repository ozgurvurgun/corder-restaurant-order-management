import { useState } from "react"
import { ARCHITECTURE_WORKFLOWS } from "@/data/architecture-pillars.data"
import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  Terminal,
  UtensilsCrossed,
} from "lucide-react"

export function ArchitectureFlowSection() {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(
    ARCHITECTURE_WORKFLOWS[0].id,
  )
  const activeWorkflow =
    ARCHITECTURE_WORKFLOWS.find((w) => w.id === selectedWorkflowId) ??
    ARCHITECTURE_WORKFLOWS[0]

  // Interactive SOD/EOD & Auto-Close Simulator state
  const [simCutoffTime, setSimCutoffTime] = useState("07:00")
  const [simOpenTablesCount, setSimOpenTablesCount] = useState(3)
  const [simMinutesSinceLastActivity, setSimMinutesSinceLastActivity] = useState(12)
  const [simWallClockTime, setSimWallClockTime] = useState("04:30")

  const isAfterCutoff = simWallClockTime >= simCutoffTime
  const graceLimitMinutes = simOpenTablesCount > 0 ? 45 : 15
  const willAutoClose =
    isAfterCutoff && simMinutesSinceLastActivity >= graceLimitMinutes

  return (
    <section id="workflows" className="py-14 sm:py-20 border-t border-[#d1d1d6]/60 bg-[#f5f5f7]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <span className="text-[11.5px] font-bold uppercase tracking-widest text-[#e63462]">
            Çalışma Mantığı &amp; Domain Akışları
          </span>
          <h2 className="mt-1 text-2xl sm:text-4xl font-black tracking-tight text-[#1d1d1f]">
            Corder Arka Planda Nasıl Çalışır?
          </h2>
          <p className="mt-3 text-[14.5px] text-[#636366] leading-relaxed">
            Bir siparişin girilmesinden mutfak yazıcısına basılmasına, parçalı
            tahsilattan gece servisini bölmeyen SOD/EOD İş Günü otomasyonuna kadar
            sistemin 4 ana mühendislik akışı:
          </p>
        </div>

        {/* Workflow Selector Buttons */}
        <div className="mt-7 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {ARCHITECTURE_WORKFLOWS.map((wf) => {
            const active = wf.id === activeWorkflow.id
            return (
              <button
                key={wf.id}
                type="button"
                onClick={() => setSelectedWorkflowId(wf.id)}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  active
                    ? "border-[#e63462] bg-white shadow-md ring-2 ring-[#e63462]/15"
                    : "border-[#d1d1d6]/80 bg-white/70 hover:bg-white"
                }`}
              >
                <span className="inline-block rounded-md bg-[#e63462]/10 px-2 py-0.5 text-[10.5px] font-bold text-[#e63462]">
                  {wf.badge}
                </span>
                <p className="mt-2 text-[13.5px] font-bold text-[#1d1d1f] leading-snug">
                  {wf.title}
                </p>
              </button>
            )
          })}
        </div>

        {/* Selected Workflow Steps */}
        <div className="mt-6 rounded-3xl border border-[#d1d1d6]/80 bg-white p-5 sm:p-8 shadow-xs">
          <div className="border-b border-[#f0f0f0] pb-4 mb-6">
            <span className="rounded-full bg-[#e63462]/10 px-3 py-1 text-[11px] font-bold text-[#e63462]">
              {activeWorkflow.badge}
            </span>
            <h3 className="mt-2 text-xl sm:text-2xl font-black text-[#1d1d1f]">
              {activeWorkflow.title}
            </h3>
            <p className="mt-1 text-[13.5px] text-[#636366]">
              {activeWorkflow.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {activeWorkflow.steps.map((s) => (
              <div
                key={s.step}
                className="rounded-2xl border border-[#d1d1d6]/70 bg-[#f9f9fb] p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e63462] text-[12px] font-black text-white">
                      {s.step}
                    </span>
                    <span className="rounded-full bg-white border border-[#d1d1d6]/70 px-2.5 py-0.5 text-[11px] font-semibold text-[#636366]">
                      Katman: {s.actor}
                    </span>
                  </div>
                  <h4 className="text-[15px] font-bold text-[#1d1d1f]">
                    {s.title}
                  </h4>
                  <p className="mt-1.5 text-[12.5px] text-[#636366] leading-relaxed">
                    {s.description}
                  </p>
                </div>

                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-[11.5px] font-medium text-emerald-900">
                    <strong className="font-bold">Sistem Garantisi:</strong>{" "}
                    {s.technicalGuarantee}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Interactive SOD/EOD Business Day & Shift Auto-Close Simulator */}
        <div
          id="simulator"
          className="mt-10 rounded-3xl border border-[#1d1d1f] bg-[#141417] p-6 sm:p-8 text-white shadow-xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#e63462]/20 px-3 py-1 text-[11px] font-bold text-[#ff6b8b]">
                <Terminal className="h-3.5 w-3.5" />
                <span>Canlı Politika Simülatörü (ShiftAutoClosePolicy)</span>
              </div>
              <h3 className="mt-2 text-xl sm:text-2xl font-black text-white">
                SOD / EOD İş Günü &amp; Açık Masa Duyarlı Vardiya Karar Motorunu Test Edin
              </h3>
              <p className="mt-1 text-[13px] text-zinc-400">
                Gece çalışan bir restoranda açık masa sayısı, son işlem üzerinden geçen
                süre ve gün sonu saatine göre sistemin nasıl karar verdiğini canlı
                deneyin:
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Simulator Controls */}
            <div className="lg:col-span-7 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <label className="block text-[11.5px] font-bold text-zinc-300 mb-2">
                    1. Ayarlar &rarr; Otomatik Gün Sonu Saati (SOD/EOD)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {["04:00", "06:00", "07:00", "08:00"].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSimCutoffTime(t)}
                        className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition-all ${
                          simCutoffTime === t
                            ? "bg-[#e63462] text-white"
                            : "bg-white/10 text-zinc-300 hover:bg-white/15"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-zinc-400">
                    İş Günü (Bugün), her sabah <strong>{simCutoffTime}</strong> saatinde
                    başlar ve ertesi sabah <strong>{simCutoffTime}</strong> saatine kadar
                    24 saat sürer.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <label className="block text-[11.5px] font-bold text-zinc-300 mb-2">
                    2. Şu Anki İstanbul Saati
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {["02:30", "04:30", "06:15", "07:20", "08:30"].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSimWallClockTime(t)}
                        className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition-all ${
                          simWallClockTime === t
                            ? "bg-emerald-500 text-white"
                            : "bg-white/10 text-zinc-300 hover:bg-white/15"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-zinc-400">
                    {simWallClockTime < simCutoffTime
                      ? `Saat henüz ${simCutoffTime} olmadığı için aktif İş Günü dün sabah ${simCutoffTime}'da başlayan iş günüdür.`
                      : `Saat ${simCutoffTime} sınırını geçtiği için gün sonu değerlendirme penceresi aktif.`}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11.5px] font-bold text-zinc-300">
                      3. İçerideki Açık Masa Sayısı (openTablesCount)
                    </label>
                    <span className="rounded-md bg-[#e63462]/20 px-2 py-0.5 text-[12px] font-black text-[#ff6b8b]">
                      {simOpenTablesCount} Masa
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={simOpenTablesCount}
                    onChange={(e) => setSimOpenTablesCount(Number(e.target.value))}
                    className="w-full accent-[#e63462]"
                  />
                  <div className="flex justify-between text-[10.5px] text-zinc-400 mt-1">
                    <span>0 (Tüm Masalar Boş)</span>
                    <span>5 Açık Masa</span>
                    <span>10 Açık Masa</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11.5px] font-bold text-zinc-300">
                      4. Son Sipariş / Tahsilattan Beri Geçen Süre
                    </label>
                    <span className="rounded-md bg-sky-500/20 px-2 py-0.5 text-[12px] font-black text-sky-300">
                      {simMinutesSinceLastActivity} dk
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={60}
                    step={5}
                    value={simMinutesSinceLastActivity}
                    onChange={(e) =>
                      setSimMinutesSinceLastActivity(Number(e.target.value))
                    }
                    className="w-full accent-[#e63462]"
                  />
                  <div className="flex justify-between text-[10.5px] text-zinc-400 mt-1">
                    <span>0 dk (Canlı İşlem)</span>
                    <span>15 dk</span>
                    <span>45 dk</span>
                    <span>60 dk</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Simulator Decision Output */}
            <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-white/15 bg-white/[0.05] p-5">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Motor Kararı (isShiftDueForAutoClose)
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                      willAutoClose
                        ? "bg-amber-500/20 text-amber-300 border border-amber-400/30"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                    }`}
                  >
                    {willAutoClose
                      ? "OTOMATİK GÜN SONU YAPILIR (due: true)"
                      : "VARDİYA AÇIK KALIR (due: false)"}
                  </span>
                </div>

                <div className="mt-4 rounded-xl bg-black/40 p-4 border border-white/10">
                  {!isAfterCutoff ? (
                    <div className="flex items-start gap-2.5">
                      <Clock className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[13.5px] font-bold text-white">
                          Gece Servisi Aktif · Gün Sonu Saatine ({simCutoffTime}) Henüz Gelinmedi
                        </p>
                        <p className="mt-1 text-[12px] text-zinc-300 leading-relaxed">
                          Saat <strong>{simWallClockTime}</strong> olduğu için gece
                          servisi kesintisiz devam eder. Kapanan tüm masalar bir önceki
                          günün İş Gününe ve mevcut açık vardiyaya işlenir.
                        </p>
                      </div>
                    </div>
                  ) : !willAutoClose ? (
                    <div className="flex items-start gap-2.5">
                      <UtensilsCrossed className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[13.5px] font-bold text-white">
                          Aktif Servis Koruması Devrede ({graceLimitMinutes} dk Tolerans)
                        </p>
                        <p className="mt-1 text-[12px] text-zinc-300 leading-relaxed">
                          Gün sonu saati ({simCutoffTime}) geçmiş olmasına rağmen{" "}
                          {simOpenTablesCount > 0
                            ? `içeride ${simOpenTablesCount} açık masa bulunduğu ve son ${simMinutesSinceLastActivity} dk içinde işlem yapıldığı için (< 45 dk)`
                            : `son ${simMinutesSinceLastActivity} dk içinde kasa işlemi yapıldığı için (< 15 dk)`}{" "}
                          sistem vardiyayı <strong>asla bölmez</strong>.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[13.5px] font-bold text-white">
                          Güvenli Otomatik Kapanış &amp; Açık Masa Devri (Rollover)
                        </p>
                        <p className="mt-1 text-[12px] text-zinc-300 leading-relaxed">
                          Saat {simCutoffTime} sınırını geçti ve{" "}
                          {simOpenTablesCount > 0
                            ? `${simOpenTablesCount} açık masada ${simMinutesSinceLastActivity} dakikadır (>= 45 dk) hiçbir hareket olmadığı için personel kasayı kapatmadan çıkmış kabul edilir. Açık masalar kapatılmaz; fotoğraflanıp yeni vardiyaya devredilir.`
                            : `içeride hiç açık masa kalmadığı (0 masa) ve son işlemden beri ${simMinutesSinceLastActivity} dk (>= 15 dk) geçtiği için kasa sıfır farkla otomatik kapatılır.`}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className="rounded-lg bg-white/[0.04] p-2">
                  <span className="text-zinc-400 block">Gerekli Sessizlik</span>
                  <strong className="text-white text-[13px]">{graceLimitMinutes} dk</strong>
                </div>
                <div className="rounded-lg bg-white/[0.04] p-2">
                  <span className="text-zinc-400 block">Açık Masa</span>
                  <strong className="text-white text-[13px]">{simOpenTablesCount} Adet</strong>
                </div>
                <div className="rounded-lg bg-white/[0.04] p-2">
                  <span className="text-zinc-400 block">İş Günü Kesimi</span>
                  <strong className="text-[#ff6b8b] text-[13px]">{simCutoffTime}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

