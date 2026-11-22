import {
  DATABASE_SCHEMA_GROUPS,
  RBAC_PERMISSION_CATEGORIES,
} from "@/data/architecture-pillars.data"
import {
  CheckCircle2,
  Database,
  Gauge,
  KeyRound,
  Lock,
  Server,
  ShieldAlert,
} from "lucide-react"

export function DeepDiveSpecsSection() {
  const scaleSuiteResults = [
    {
      code: "SC-01",
      title: "10.000 Restoran + 50 Franchise Marka + 20.000 Ödeme Zenginleştirmesi",
      metric: "459 ms",
      target: "Hedef < 600 ms",
      detail:
        "Bellek içi O(1) Map indeksleme ile N+1 sorgu olmadan tüm SaaS abonelik ve marka ağacını tek geçişte birleştirir.",
    },
    {
      code: "SC-02",
      title: "10.000 Aktif Restoranda Toplu Abonelik Askıya Alma (suspendAllUnpaid)",
      metric: "164 ms",
      target: "Hedef < 400 ms",
      detail:
        "Ayın 1'inde ödenmemiş restoranları tespit edip açık vardiyaları toplu sorgulayarak sıfır N+1 ile askıya alır.",
    },
    {
      code: "SC-03",
      title: "100 Şubeli Boss Canlı Ciro & 2.000 Masa + 10.000 Adisyon Konsolidasyonu",
      metric: "77 ms",
      target: "Hedef < 350 ms",
      detail:
        "Şube bazlı SOD/EOD İş Günü sınırlarına göre 100 şubenin anlık ciro, ödeme kırılımı, royalty ve iptal karnesini hesaplar.",
    },
    {
      code: "SC-04",
      title: "200 Eşzamanlı Suistimal (Fraud) Taraması Tekilleştirme (In-Flight Coalescing)",
      metric: "18 ms",
      target: "200 İstek -> 1 DB Sorgusu",
      detail:
        "Yoğun saatlerde aynı şube için tetiklenen yüzlerce anomali taramasını tek veritabanı yürütmesinde birleştirir.",
    },
  ]

  return (
    <section id="specs" className="py-14 sm:py-20 border-t border-[#d1d1d6]/60 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Database Schema Section */}
        <div className="max-w-3xl">
          <span className="text-[11.5px] font-bold uppercase tracking-widest text-[#e63462]">
            Veri Modeli &amp; Şema Bütünlüğü
          </span>
          <h2 className="mt-1 text-2xl sm:text-4xl font-black tracking-tight text-[#1d1d1f]">
            35 TypeORM Entity &amp; 21 Deterministik Migration
          </h2>
          <p className="mt-3 text-[14.5px] text-[#636366] leading-relaxed">
            Üretim ortamında <code className="rounded bg-[#f5f5f7] px-1.5 py-0.5 text-[12.5px] font-mono text-[#e63462]">DB_SYNCHRONIZE=false</code>{" "}
            kuralı donanımsal olarak zorlanır; tüm şema değişiklikleri yukarı ve aşağı
            (up/down) test edilmiş 21 deterministik migration ile yürütülür:
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {DATABASE_SCHEMA_GROUPS.map((group) => (
            <div
              key={group.domain}
              className="rounded-2xl border border-[#d1d1d6]/80 bg-[#f9f9fb] p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e63462]/10 text-[#e63462]">
                    <Database className="h-4 w-4" />
                  </div>
                  <span className="rounded-full bg-white border border-[#d1d1d6]/70 px-2.5 py-0.5 text-[11px] font-bold text-[#1d1d1f]">
                    {group.entityCount} Tablo
                  </span>
                </div>
                <h3 className="text-[15px] font-bold text-[#1d1d1f]">
                  {group.domain}
                </h3>
                <p className="mt-1.5 text-[12.5px] text-[#636366] leading-relaxed">
                  {group.purpose}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5 pt-3 border-t border-[#e5e5ea]">
                {group.entities.map((ent) => (
                  <span
                    key={ent}
                    className="rounded-md bg-white border border-[#d1d1d6]/70 px-2 py-0.5 font-mono text-[10.5px] font-medium text-[#1d1d1f]"
                  >
                    {ent}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 48 RBAC Permission Matrix Section */}
        <div className="mt-16">
          <div className="max-w-3xl">
            <span className="text-[11.5px] font-bold uppercase tracking-widest text-[#e63462]">
              Rol Tabanlı &amp; Granüler Yetkilendirme (RBAC)
            </span>
            <h2 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-[#1d1d1f]">
              48 İzin Kodu, 8 Rol Şablonu ve Sayısal Personel Limitleri
            </h2>
            <p className="mt-2.5 text-[14px] text-[#636366] leading-relaxed">
              Her personel için seçilen rol şablonunun üzerine tekil yetki eklenebilir
              (<code className="font-mono text-[#e63462]">grant</code>), mevcut bir
              yetki kaldırılabilir (<code className="font-mono text-[#e63462]">revoke</code>)
              veya indirim yüzdesi / iptal tutarı tavanı uygulanabilir:
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
            {RBAC_PERMISSION_CATEGORIES.map((cat) => (
              <div
                key={cat.category}
                className="rounded-2xl border border-[#d1d1d6]/80 bg-white p-4 shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 text-[#e63462] mb-2">
                    <KeyRound className="h-4 w-4 shrink-0" />
                    <span className="font-mono text-[11px] font-bold">
                      {cat.codePrefix}
                    </span>
                  </div>
                  <h4 className="text-[13.5px] font-bold text-[#1d1d1f]">
                    {cat.category}
                  </h4>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {cat.examples.map((ex) => (
                      <span
                        key={ex}
                        className="rounded bg-[#f5f5f7] px-1.5 py-0.5 font-mono text-[10px] text-[#636366]"
                      >
                        {ex}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="mt-3 pt-2.5 border-t border-[#f0f0f0] text-[11px] font-medium text-[#1d1d1f]">
                  {cat.limitSupport}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 10,000+ Restaurant Scale & Security Benchmark Section */}
        <div id="topology" className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 rounded-3xl border border-[#d1d1d6]/80 bg-[#f5f5f7] p-6 sm:p-7">
            <div className="flex items-center gap-2 text-[#e63462] text-[11.5px] font-bold uppercase tracking-wider">
              <Gauge className="h-4 w-4" />
              <span>10.000+ Restoran Ölçek, Eşzamanlılık &amp; Finans Süiti</span>
            </div>
            <h3 className="mt-1.5 text-xl sm:text-2xl font-black text-[#1d1d1f]">
              Doğrulanmış Yük ve Performans Test Sonuçları
            </h3>
            <p className="mt-1 text-[13px] text-[#636366]">
              Her derlemede otomatik koşan 46 test süiti ve 128 birim/ölçek testinden
              gerçek çalışma zamanı ölçümleri:
            </p>

            <div className="mt-5 space-y-3">
              {scaleSuiteResults.map((sc) => (
                <div
                  key={sc.code}
                  className="rounded-2xl border border-[#d1d1d6]/70 bg-white p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-[#e63462] px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                        {sc.code}
                      </span>
                      <h4 className="text-[13.5px] font-bold text-[#1d1d1f]">
                        {sc.title}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 font-mono text-[12px] font-black text-emerald-700">
                        {sc.metric}
                      </span>
                      <span className="text-[11px] text-[#86868b]">{sc.target}</span>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[12px] text-[#636366]">{sc.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 rounded-3xl border border-[#1d1d1f] bg-[#141417] p-6 sm:p-7 text-white flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-[#ff6b8b] text-[11.5px] font-bold uppercase tracking-wider">
                <Server className="h-4 w-4" />
                <span>Üretim Güvenliği &amp; Altyapı İzolasyonu</span>
              </div>
              <h3 className="mt-1.5 text-xl sm:text-2xl font-black text-white">
                Savunma Derinliği (Defense-in-Depth)
              </h3>
              <p className="mt-1.5 text-[13px] text-zinc-400 leading-relaxed">
                Veritabanından ağ katmanına ve kimlik doğrulamaya kadar uygulanan
                sıfır-güven (zero-trust) kuralları:
              </p>

              <div className="mt-5 space-y-3">
                {[
                  {
                    title: "Dış Dünyaya Kapalı PostgreSQL 16 (corder_internal)",
                    desc: "Veritabanı konteyneri host makineye hiçbir port bağlamaz; yalnızca Docker iç ağındaki API servisi erişebilir.",
                  },
                  {
                    title: "Platform Admin 2 Aşamalı Kriptografik Giriş",
                    desc: "1. aşamada yönetici parolası (PLATFORM_ADMIN_PASSWORD), 2. aşamada bağımsız yüksek entropili Auth Kodu (PLATFORM_ADMIN_AUTH_CODE) zorunludur.",
                  },
                  {
                    title: "SSRF Korumalı VAPID Web Push & Rate Limiting",
                    desc: "Özel IP bloklarına (127.0.0.1, 10.x, 192.168.x, 169.254.169.254) giden push abonelikleri engellenir; PIN girişleri brute-force korumalıdır.",
                  },
                  {
                    title: "Sızıntısız GlobalExceptionFilter",
                    desc: "PostgreSQL hata detayları veya tablo/sütun isimleri istemciye asla sızdırılmaz; güvenli HTTP 400/409/500 yanıtlarına dönüştürülür.",
                  },
                ].map((sec) => (
                  <div
                    key={sec.title}
                    className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5"
                  >
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-[13px] font-bold text-white">
                          {sec.title}
                        </h4>
                        <p className="mt-0.5 text-[11.5px] text-zinc-400 leading-relaxed">
                          {sec.desc}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-[#e63462]/40 bg-[#e63462]/15 p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Lock className="h-4 w-4 text-[#ff6b8b]" />
                <span className="text-[12px] font-bold text-white">
                  Tüm Kaynak Dosyalarda &lt; 500 Satır Modülerlik Standardı
                </span>
              </div>
              <ShieldAlert className="h-4 w-4 text-[#ff6b8b] shrink-0" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

