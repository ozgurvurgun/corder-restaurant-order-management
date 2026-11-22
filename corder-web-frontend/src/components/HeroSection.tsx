import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Database,
  Lock,
  Printer,
  ShieldAlert,
  Smartphone,
} from "lucide-react"

export function HeroSection() {
  const keyStats = [
    {
      label: "Entegre Uygulama & Servis",
      value: "7 Bileşen",
      sub: "5 Web/PWA + Core API + Print-Agent",
      icon: Smartphone,
      color: "#e63462",
    },
    {
      label: "Finansal Hassasiyet",
      value: "0 Kuruş Sapma",
      sub: "Tam Sayı Kuruş (Minor Units) Motoru",
      icon: CheckCircle2,
      color: "#34c759",
    },
    {
      label: "Yetki & Güvenlik Matrisi",
      value: "48 RBAC İzin",
      sub: "8 Rol + Grant/Revoke + Suistimal Radarı",
      icon: Lock,
      color: "#007aff",
    },
    {
      label: "Veritabanı & Ölçek Doğrulaması",
      value: "10.000+ Şube",
      sub: "35 Entity · 21 Migration · 128 Test",
      icon: Database,
      color: "#af52de",
    },
  ]

  return (
    <section id="top" className="relative overflow-hidden pt-8 pb-14 sm:pt-12 sm:pb-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e63462]/25 bg-[#e63462]/8 px-3.5 py-1.5 text-[12px] font-semibold text-[#e63462] mb-5">
            <Activity className="h-3.5 w-3.5" />
            <span>
              Oracle MICROS Simphony Standardında Çok Kiracılı Restoran &amp; Franchise POS Mimarisi
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-[#1d1d1f] leading-[1.12]">
            Masadan Mutfağa, Kasadan{" "}
            <span className="bg-gradient-to-r from-[#e63462] to-[#be1847] bg-clip-text text-transparent">
              Franchise Komuta Merkezine
            </span>{" "}
            Tam Entegre POS Ekosistemi
          </h1>

          <p className="mt-5 text-[15px] sm:text-[17px] text-[#636366] leading-relaxed max-w-3xl mx-auto">
            Corder; garson el terminalinden (PWA) kasa ve reçete stok yönetimine, tarayıcıdan
            bağımsız ESC/POS termal yazıcı ajanından çok şubeli Boss suistimal (fraud) radarına
            kadar restoran operasyonlarının her katmanını kuruşu kuruşuna doğrulukla yöneten
            kurumsal bir platformdur.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#ecosystem"
              className="inline-flex items-center gap-2 rounded-xl bg-[#e63462] px-5 py-3 text-[13.5px] font-semibold text-white shadow-sm hover:bg-[#d42c57] transition-all"
            >
              <span>7 Bileşenli Ekosistemi İncele</span>
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#workflows"
              className="inline-flex items-center gap-2 rounded-xl border border-[#d1d1d6] bg-white px-5 py-3 text-[13.5px] font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] transition-all"
            >
              <span>Çalışma Mimarisi &amp; Akışlar</span>
            </a>
            <a
              href="#simulator"
              className="inline-flex items-center gap-2 rounded-xl border border-[#d1d1d6] bg-white px-5 py-3 text-[13.5px] font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] transition-all"
            >
              <Clock className="h-4 w-4 text-[#e63462]" />
              <span>SOD/EOD İş Günü Simülatörü</span>
            </a>
          </div>
        </div>

        {/* 4 Key Architecture Pillars */}
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {keyStats.map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.label}
                className="rounded-2xl border border-[#d1d1d6]/70 bg-white p-5 shadow-xs transition-all hover:border-[#e63462]/40"
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${stat.color}15` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: stat.color }} />
                  </div>
                  <span className="rounded-full bg-[#f5f5f7] px-2.5 py-0.5 text-[10.5px] font-semibold text-[#636366]">
                    Doğrulanmış
                  </span>
                </div>
                <p className="text-[22px] font-black text-[#1d1d1f] tracking-tight">
                  {stat.value}
                </p>
                <p className="text-[13px] font-semibold text-[#1d1d1f] mt-0.5">
                  {stat.label}
                </p>
                <p className="text-[11.5px] text-[#86868b] mt-1">{stat.sub}</p>
              </div>
            )
          })}
        </div>

        {/* Visual End-to-End Architecture Topology Banner */}
        <div className="mt-8 rounded-3xl border border-[#1d1d1f] bg-[#141417] p-6 sm:p-8 text-white shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4 mb-6">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#e63462]">
                Uçtan Uca Canlı Sistem Topolojisi
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-white mt-0.5">
                İstemcilerden İzole Veritabanına ve Fiziksel Termal Yazıcılara Veri Akışı
              </h2>
            </div>
            <div className="flex items-center gap-2 text-[11.5px] text-emerald-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Gerçek Zamanlı Socket.IO + REST + ESC/POS</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-center">
            {/* Left Column: 5 Client Apps */}
            <div className="lg:col-span-4 space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                1. İstemci Katmanı (Cloudflare Pages / PWA)
              </div>
              {[
                {
                  name: "Merchant Panel (:3001)",
                  desc: "Kasa, Masa, Reçete Stok, Cari & X/Z Rapor",
                  badge: "REST + WS",
                },
                {
                  name: "Garson Terminali (:3000)",
                  desc: "Masa Kilidi, Geofence, Sipariş & Web Push",
                  badge: "PWA + WS",
                },
                {
                  name: "Corder Boss (:3004)",
                  desc: "Çoklu Şube Ciro, 48 RBAC & Fraud Radarı",
                  badge: "PWA + REST",
                },
                {
                  name: "QR Dijital Menü (:3002)",
                  desc: "Müşteri Menüsü & Anlık Garson Çağrısı",
                  badge: "Public Edge",
                },
                {
                  name: "Platform Admin (:3003)",
                  desc: "2FA Giriş, 25-30 Tahsilat & 360° Teşhis",
                  badge: "SaaS Admin",
                },
              ].map((client) => (
                <div
                  key={client.name}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5"
                >
                  <div>
                    <p className="text-[12.5px] font-bold text-white">{client.name}</p>
                    <p className="text-[11px] text-zinc-400">{client.desc}</p>
                  </div>
                  <span className="rounded-lg bg-[#e63462]/20 px-2 py-0.5 text-[10px] font-bold text-[#ff6b8b]">
                    {client.badge}
                  </span>
                </div>
              ))}
            </div>

            {/* Middle Column: Core Backend Engine */}
            <div className="lg:col-span-4">
              <div className="rounded-2xl border-2 border-[#e63462] bg-gradient-to-b from-[#e63462]/15 to-transparent p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="rounded-lg bg-[#e63462] px-2.5 py-1 text-[10.5px] font-bold text-white">
                    Merkezi Çekirdek (:4000)
                  </span>
                  <span className="text-[11px] font-mono text-zinc-300">
                    NestJS 10 + Socket.IO
                  </span>
                </div>
                <h3 className="text-[16px] font-bold text-white">
                  Corder Core Domain Engine
                </h3>
                <p className="text-[11.5px] text-zinc-300 mt-1 leading-relaxed">
                  Nginx Reverse Proxy arkasında çalışan çok kiracılı iş mantığı katmanı:
                </p>
                <div className="mt-3.5 space-y-2 text-[11.5px]">
                  <div className="flex items-center gap-2 rounded-lg bg-black/40 px-3 py-1.5 text-zinc-200">
                    <Lock className="h-3.5 w-3.5 text-[#e63462] shrink-0" />
                    <span>PanelRootGuard (Default-Deny + 48 RBAC)</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-black/40 px-3 py-1.5 text-zinc-200">
                    <Clock className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span>ShiftAutoClosePolicy (SOD/EOD + 45dk/15dk)</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-black/40 px-3 py-1.5 text-zinc-200">
                    <CheckCircle2 className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                    <span>CheckSettlement &amp; RecipeStock (Minor Units)</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-black/40 px-3 py-1.5 text-zinc-200">
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span>FraudDetectionService (6 Kural + Coalescing)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Persistence, Hardware & Cloud */}
            <div className="lg:col-span-4 space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                3. Veri, Donanım &amp; Bildirim Katmanı
              </div>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-emerald-400" />
                  <span className="text-[13px] font-bold text-white">
                    PostgreSQL 16 (İzole Docker Ağı)
                  </span>
                </div>
                <p className="text-[11px] text-zinc-300 mt-1">
                  Dış internete kapalı (internal network), 35 tablo, pessimistic_write
                  satır kilitleri ve pg_advisory_xact_lock sipariş sıralaması.
                </p>
              </div>

              <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3.5">
                <div className="flex items-center gap-2">
                  <Printer className="h-4 w-4 text-sky-400" />
                  <span className="text-[13px] font-bold text-white">
                    Corder Print-Agent (80mm ESC/POS)
                  </span>
                </div>
                <p className="text-[11px] text-zinc-300 mt-1">
                  Socket.IO + HTTP Polling fallback ile Mutfak, Bar, İptal, Adisyon ve
                  X/Z Vardiya fişlerini yerel yazıcılara sıfır kayıpla basar.
                </p>
              </div>

              <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3.5">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-purple-400" />
                  <span className="text-[13px] font-bold text-white">
                    Cloudflare R2 &amp; RFC 8291 Web Push
                  </span>
                </div>
                <p className="text-[11px] text-zinc-300 mt-1">
                  S3 uyumlu R2 medya depolama (WebP dönüşümlü) ve P-256 VAPID şifreli
                  arka plan garson çağrı bildirimleri.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

