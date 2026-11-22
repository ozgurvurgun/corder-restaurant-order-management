import { useMemo } from "react"
import { Download, Printer, ShieldCheck } from "lucide-react"

const R2_PRINT_AGENT_BASE = "https://media.corders.uk/downloads/print-agent"

export const PRINT_AGENT_DOWNLOADS = {
  winBundleZip: `${R2_PRINT_AGENT_BASE}/Corder-Print-Agent-1.2.2-win-x64.zip`,
  linuxDeb: `${R2_PRINT_AGENT_BASE}/Corder-Print-Agent-1.2.2-linux-amd64.deb`,
  linuxAppImage: `${R2_PRINT_AGENT_BASE}/Corder-Print-Agent-1.2.2-linux-x86_64.AppImage`,
}

type DetectedOs = "windows" | "linux" | "other"

function detectClientOs(): { os: DetectedOs; label: string } {
  if (typeof navigator === "undefined") {
    return { os: "other", label: "Windows & Linux (64-bit)" }
  }
  const ua = `${navigator.userAgent || ""} ${navigator.platform || ""}`.toLowerCase()
  if (ua.includes("win")) {
    return { os: "windows", label: "Mevcut Sistem: Windows (64-bit)" }
  }
  if (ua.includes("linux") && !ua.includes("android")) {
    return { os: "linux", label: "Mevcut Sistem: Linux (64-bit)" }
  }
  return { os: "other", label: "Windows & Linux (64-bit)" }
}

export function PrintAgentDownloadCard() {
  const { os, label: osBadgeLabel } = useMemo(() => detectClientOs(), [])

  const activeBtnClass =
    "h-[36px] px-4 rounded-xl bg-[#e63462] hover:bg-[#d42d56] text-white text-[12px] font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
  const neutralBtnClass =
    "h-[36px] px-3.5 rounded-xl bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#d1d1d6]/70 text-[#1d1d1f] text-[12px] font-medium flex items-center gap-1.5 transition-colors"

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
                Corder Print Agent Masaüstü Uygulaması (v1.2.2)
              </h3>
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10.5px] font-semibold text-emerald-700">
                {osBadgeLabel}
              </span>
            </div>
            <p className="text-[12px] text-[#86868b] mt-1 leading-relaxed">
              Mutfak, bar, adisyon ve X/Z kasa fişlerinin termal yazıcılardan (USB veya Ağ/Ethernet) otomatik basılması için kasa bilgisayarına indirip içindeki <strong>Corder Print Agent Kur ve Baslat</strong> dosyasına çift tıklayın.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={PRINT_AGENT_DOWNLOADS.winBundleZip}
            download="Corder-Print-Agent-1.2.2-win-x64.zip"
            className={os === "windows" ? activeBtnClass : neutralBtnClass}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Windows İndir (Tek Tıkla Kurulum)</span>
          </a>
          <a
            href={PRINT_AGENT_DOWNLOADS.linuxDeb}
            download="Corder-Print-Agent-1.2.2-linux-amd64.deb"
            className={os === "linux" ? activeBtnClass : neutralBtnClass}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Linux (.deb)</span>
          </a>
          <a
            href={PRINT_AGENT_DOWNLOADS.linuxAppImage}
            download="Corder-Print-Agent-1.2.2-linux-x86_64.AppImage"
            className={neutralBtnClass}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Linux (.AppImage)</span>
          </a>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-[#f0f0f0] flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
        <span>
          İndirdiğiniz paketi açıp şube Print-Agent hesabınızla giriş yapmanız yeterlidir.
        </span>
      </div>
    </div>
  )
}
