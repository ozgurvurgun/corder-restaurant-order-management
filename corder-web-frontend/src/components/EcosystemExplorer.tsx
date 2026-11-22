import { useState } from "react"
import { ECOSYSTEM_APPS } from "@/data/platform-apps.data"
import {
  CheckCircle2,
  Code2,
  Cpu,
  Globe,
  LayoutDashboard,
  Printer,
  QrCode,
  Server,
  Shield,
  Smartphone,
  Users,
} from "lucide-react"

const APP_ICONS: Record<string, typeof LayoutDashboard> = {
  panel: LayoutDashboard,
  terminal: Smartphone,
  boss: Shield,
  menu: QrCode,
  admin: Users,
  "print-agent": Printer,
  backend: Server,
}

export function EcosystemExplorer() {
  const [selectedId, setSelectedId] = useState<string>(ECOSYSTEM_APPS[0].id)
  const activeApp =
    ECOSYSTEM_APPS.find((a) => a.id === selectedId) ?? ECOSYSTEM_APPS[0]

  return (
    <section id="ecosystem" className="py-14 sm:py-20 border-t border-[#d1d1d6]/60 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <span className="text-[11.5px] font-bold uppercase tracking-widest text-[#e63462]">
            7 Bileşenli Tam Ekosistem
          </span>
          <h2 className="mt-1 text-2xl sm:text-4xl font-black tracking-tight text-[#1d1d1f]">
            Her Rol İçin Özel Tasarlanmış 7 Bağımsız Uygulama
          </h2>
          <p className="mt-3 text-[14.5px] text-[#636366] leading-relaxed">
            Corder tek bir hantal ekran yerine; kasiyer, garson, işletme sahibi (Boss),
            restoran müşterisi, platform yöneticisi ve fiziksel yazıcı donanımı için
            ayrı ayrı optimize edilmiş 7 bileşenden oluşur. İncelemek istediğiniz
            bileşeni seçin:
          </p>
        </div>

        {/* App Selector Tabs */}
        <div className="mt-8 flex gap-2 overflow-x-auto pb-2">
          {ECOSYSTEM_APPS.map((app) => {
            const Icon = APP_ICONS[app.id] ?? Cpu
            const isSelected = app.id === activeApp.id
            return (
              <button
                key={app.id}
                type="button"
                onClick={() => setSelectedId(app.id)}
                className={`flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-left transition-all shrink-0 ${
                  isSelected
                    ? "border-[#e63462] bg-[#e63462] text-white shadow-md"
                    : "border-[#d1d1d6]/80 bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#ebebef]"
                }`}
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-white text-[#e63462] shadow-2xs"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[13px] font-bold leading-tight">{app.name}</p>
                  <p
                    className={`text-[10.5px] mt-0.5 ${
                      isSelected ? "text-white/85" : "text-[#86868b]"
                    }`}
                  >
                    {app.port} · {app.badge}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Active App Detail Card */}
        <div className="mt-6 rounded-3xl border border-[#d1d1d6]/80 bg-[#f5f5f7] p-5 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#d1d1d6]/70 pb-6">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#e63462] px-3 py-0.5 text-[11px] font-bold text-white">
                  {activeApp.port}
                </span>
                <span className="rounded-full bg-white px-3 py-0.5 text-[11px] font-semibold text-[#1d1d1f] border border-[#d1d1d6]/70">
                  Hedef Kullanıcı: {activeApp.role}
                </span>
                <span className="rounded-full bg-emerald-50 px-3 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                  <Globe className="inline h-3 w-3 mr-1" />
                  {activeApp.deployTarget}
                </span>
              </div>
              <h3 className="mt-3 text-2xl sm:text-3xl font-black text-[#1d1d1f]">
                {activeApp.name}
              </h3>
              <p className="mt-1 text-[14px] font-semibold text-[#e63462]">
                {activeApp.tagline}
              </p>
              <p className="mt-2.5 text-[14px] text-[#636366] leading-relaxed">
                {activeApp.summary}
              </p>
            </div>

            {/* Live Preview Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full lg:w-auto">
              {activeApp.livePreviewMetrics.map((m) => (
                <div
                  key={m.label}
                  className="rounded-2xl border border-[#d1d1d6]/70 bg-white px-4 py-3 min-w-[165px]"
                >
                  <p className="text-[11px] font-semibold text-[#86868b]">{m.label}</p>
                  <p className="text-[18px] font-black text-[#1d1d1f] mt-0.5">
                    {m.value}
                  </p>
                  <p className="text-[10.5px] font-medium text-[#e63462] mt-0.5">
                    {m.sub}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Core Capabilities Grid */}
          <div className="mt-6">
            <h4 className="text-[12px] font-bold uppercase tracking-wider text-[#86868b] mb-3.5">
              Temel Yetenekler ve Operasyonel Fonksiyonlar
            </h4>
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              {activeApp.coreCapabilities.map((cap) => (
                <div
                  key={cap.title}
                  className="rounded-2xl border border-[#d1d1d6]/70 bg-white p-4 shadow-2xs"
                >
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-[#e63462] shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-[14px] font-bold text-[#1d1d1f]">
                        {cap.title}
                      </h5>
                      <p className="mt-1 text-[12.5px] text-[#636366] leading-relaxed">
                        {cap.detail}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Technical Highlights & API/Socket Contracts */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#d1d1d6]/70 bg-white p-4">
              <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-[#1d1d1f] mb-2.5">
                <Cpu className="h-4 w-4 text-[#e63462]" />
                <span>Mimari &amp; Mühendislik Garantileri</span>
              </div>
              <ul className="space-y-2">
                {activeApp.technicalHighlights.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-[12.5px] text-[#636366]"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#e63462] shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-[#1d1d1f] bg-[#141417] p-4 text-white">
              <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-zinc-300 mb-2.5">
                <Code2 className="h-4 w-4 text-[#e63462]" />
                <span>Anahtar API Endpoint &amp; Gerçek Zamanlı Socket Sözleşmeleri</span>
              </div>
              <div className="space-y-1.5 font-mono text-[11.5px]">
                {activeApp.keyEndpointsOrEvents.map((ep) => (
                  <div
                    key={ep}
                    className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-emerald-300 border border-white/5"
                  >
                    {ep}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

