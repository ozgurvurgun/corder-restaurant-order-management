import { Download, Monitor, Printer, ShieldCheck } from "lucide-react"

const R2_PRINT_AGENT_BASE = "https://media.corders.uk/downloads/print-agent"

export const PRINT_AGENT_DOWNLOADS = {
  winPortableExe: `${R2_PRINT_AGENT_BASE}/Corder-Print-Agent-1.1.0-win-x64-portable.exe`,
  winZip: `${R2_PRINT_AGENT_BASE}/Corder-Print-Agent-1.1.0-win-x64.zip`,
  linuxDeb: `${R2_PRINT_AGENT_BASE}/Corder-Print-Agent-1.1.0-linux-amd64.deb`,
  linuxAppImage: `${R2_PRINT_AGENT_BASE}/Corder-Print-Agent-1.1.0-linux-x86_64.AppImage`,
}

export function PrintAgentDownloadCard() {
  return (
    <div className="bg-white rounded-xl border border-[#d1d1d6]/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3 max-w-2xl">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#e63462]/10 text-[#e63462]">
            <Printer className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
                Corder Print Agent Masaüstü Uygulaması (v1.1.0)
              </h3>
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10.5px] font-semibold text-emerald-700">
                Windows 10/11 &amp; Linux · Otomatik Kuyruk Onarımlı
              </span>
            </div>
            <p className="text-[12px] text-[#86868b] mt-1 leading-relaxed">
              Mutfak, bar, adisyon ve X/Z kasa fişlerinin termal yazıcılardan (USB veya Ağ/Ethernet) otomatik basılması için kasa bilgisayarına indirip çalıştırın.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={PRINT_AGENT_DOWNLOADS.winPortableExe}
            download="Corder-Print-Agent-1.1.0-win-x64-portable.exe"
            className="h-[36px] px-4 rounded-xl bg-[#e63462] hover:bg-[#d42d56] text-white text-[12.5px] font-semibold flex items-center gap-2 shadow-xs transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Windows İndir (.exe - Tek Tıkla Çalışır)</span>
          </a>
          <a
            href={PRINT_AGENT_DOWNLOADS.winZip}
            download="Corder-Print-Agent-1.1.0-win-x64.zip"
            className="h-[36px] px-3.5 rounded-xl bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#d1d1d6]/70 text-[#1d1d1f] text-[12px] font-medium flex items-center gap-1.5 transition-colors"
          >
            <Monitor className="w-3.5 h-3.5 text-[#636366]" />
            <span>Windows (.zip)</span>
          </a>
          <a
            href={PRINT_AGENT_DOWNLOADS.linuxDeb}
            download="Corder-Print-Agent-1.1.0-linux-amd64.deb"
            className="h-[36px] px-3 rounded-xl bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#d1d1d6]/70 text-[#636366] hover:text-[#1d1d1f] text-[11.5px] font-medium flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Linux (.deb)</span>
          </a>
          <a
            href={PRINT_AGENT_DOWNLOADS.linuxAppImage}
            download="Corder-Print-Agent-1.1.0-linux-x86_64.AppImage"
            className="h-[36px] px-3 rounded-xl bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#d1d1d6]/70 text-[#636366] hover:text-[#1d1d1f] text-[11.5px] font-medium flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Linux (.AppImage)</span>
          </a>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-[#f0f0f0] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#86868b]">
        <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
          <span>
            Kurulum gerektirmez: İndirdiğiniz .exe dosyasını açıp şube Print-Agent hesabınızla giriş yapmanız yeterlidir.
          </span>
        </div>
        <span className="font-mono text-[10.5px] text-[#86868b]">
          Cloudflare R2 CDN (media.corders.uk)
        </span>
      </div>
    </div>
  )
}

