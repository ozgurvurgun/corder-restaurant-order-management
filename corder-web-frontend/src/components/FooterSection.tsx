export function FooterSection() {
  const portTable = [
    { app: "corder-terminal-frontend", port: ":3000", desc: "Garson Saha Sipariş & Masa Kilidi PWA" },
    { app: "corder-panel-frontend", port: ":3001", desc: "Kasa, Masa, Reçete Stok & X/Z Rapor Paneli" },
    { app: "corder-menu-frontend", port: ":3002", desc: "Müşteri QR Dijital Menü & Garson Çağrısı" },
    { app: "corder-admin-frontend", port: ":3003", desc: "Platform Yöneticisi, 25-30 Tahsilat & 360° Destek" },
    { app: "corder-boss-frontend", port: ":3004", desc: "İşletme Sahibi Çoklu Şube, 48 RBAC & Fraud PWA" },
    { app: "corder-web-frontend", port: ":3005", desc: "Sistem Tanıtım, Mimari & Dokümantasyon Portalı" },
    { app: "corder-backend", port: ":4000", desc: "NestJS 10 + PostgreSQL 16 + Socket.IO Core API" },
    { app: "print-agent", port: "Servis", desc: "ESC/POS & Windows Spooler Termal Yazıcı Köprüsü" },
  ]

  return (
    <footer className="border-t border-[#d1d1d6]/70 bg-[#141417] text-white py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e63462] text-white font-black text-[17px]">
                C
              </div>
              <div>
                <span className="text-[17px] font-bold text-white">
                  Corder Enterprise POS
                </span>
                <p className="text-[11.5px] text-zinc-400">
                  Çok Kiracılı Restoran &amp; Franchise Yönetim Platformu
                </p>
              </div>
            </div>
            <p className="mt-4 text-[13px] text-zinc-400 leading-relaxed max-w-md">
              React 19, TypeScript 5.7, Tailwind CSS 4, NestJS 10, TypeORM 0.3,
              PostgreSQL 16, Socket.IO ve yerleşik ESC/POS Print-Agent teknolojileriyle
              sıfır finansal sapma ve maksimum operasyonel hız için geliştirilmiştir.
            </p>
          </div>

          <div className="lg:col-span-7">
            <h4 className="text-[11.5px] font-bold uppercase tracking-wider text-zinc-400 mb-3">
              Uygulama Port &amp; Servis Haritası
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {portTable.map((row) => (
                <div
                  key={row.app}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-[11.5px] font-bold text-white truncate">
                      {row.app}
                    </p>
                    <p className="text-[10.5px] text-zinc-400 truncate">{row.desc}</p>
                  </div>
                  <span className="ml-2 rounded-md bg-[#e63462]/20 px-2 py-0.5 font-mono text-[10.5px] font-bold text-[#ff6b8b] shrink-0">
                    {row.port}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 flex flex-wrap items-center justify-between gap-4 text-[12px] text-zinc-400">
          <span>Corder Hospitality POS &amp; Franchise Platform Architecture</span>
          <span>Europe/Istanbul (UTC+3) · Minor-Unit Financial Engine · SOD/EOD Business Day</span>
        </div>
      </div>
    </footer>
  )
}

