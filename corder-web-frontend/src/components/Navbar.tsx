import { Cpu, Layers, Lock, Server, ShieldCheck, Terminal } from "lucide-react"

interface NavbarProps {
  activeSection: string
}

export function Navbar({ activeSection }: NavbarProps) {
  const navItems = [
    { id: "ecosystem", label: "7'li Ekosistem", icon: Layers },
    { id: "workflows", label: "Çalışma Mimarisi", icon: Cpu },
    { id: "simulator", label: "İş Günü & Vardiya Simülatörü", icon: Terminal },
    { id: "specs", label: "Veritabanı & 48 RBAC", icon: Lock },
    { id: "topology", label: "Dağıtım & Ölçek", icon: Server },
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-[#d1d1d6]/70 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <a href="#top" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#e63462] to-[#be1847] text-white shadow-sm">
            <span className="text-[17px] font-black tracking-tight">C</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[16px] font-bold tracking-tight text-[#1d1d1f]">
                Corder
              </span>
              <span className="rounded-full bg-[#e63462]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#e63462]">
                Enterprise POS
              </span>
            </div>
            <p className="text-[11px] text-[#86868b]">
              Sistem Mimarisi &amp; Teknik Dokümantasyon Portalı
            </p>
          </div>
        </a>

        <nav className="hidden md:flex items-center gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeSection === item.id
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] font-semibold transition-all ${
                  isActive
                    ? "bg-[#e63462] text-white shadow-sm"
                    : "text-[#636366] hover:bg-black/[0.04] hover:text-[#1d1d1f]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </a>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>128/128 Test · 0 Kuruş Sapma</span>
          </div>
        </div>
      </div>
    </header>
  )
}

