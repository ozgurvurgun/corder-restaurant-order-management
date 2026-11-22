import { useState } from "react"
import { platform } from "@/lib/api"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { RefreshCw, Zap } from "lucide-react"

interface SystemUpdateBroadcastCardProps {
  venueScope: "all" | "selected"
  selectedRestIds: string[]
  totalRestaurantsCount: number
  onBroadcastSuccess: () => void
  onNotice: (text: string, type?: "ok" | "err") => void
}

const DEFAULT_UPDATE_TITLE = "Yeni Sistem Güncellemesi Yayınlandı"
const DEFAULT_UPDATE_MESSAGE =
  "Sistemimizde yeni özellikler ve performans iyileştirmeleri devreye alındı. Güncel sürümü yüklemek ve önbelleği temizlemek için lütfen aşağıdaki güncelleme butonuna tıklayın."

export function SystemUpdateBroadcastCard({
  venueScope,
  selectedRestIds,
  totalRestaurantsCount,
  onBroadcastSuccess,
  onNotice,
}: SystemUpdateBroadcastCardProps) {
  const confirm = useConfirm()
  const [title, setTitle] = useState(DEFAULT_UPDATE_TITLE)
  const [message, setMessage] = useState(DEFAULT_UPDATE_MESSAGE)
  const [expanded, setExpanded] = useState(false)
  const [sending, setSending] = useState(false)

  const targetLabel =
    venueScope === "all"
      ? `Tüm Aktif Mekanlar (${totalRestaurantsCount})`
      : `Seçili Mekanlar (${selectedRestIds.length})`

  const handleTrigger = async () => {
    if (venueScope === "selected" && selectedRestIds.length === 0) {
      onNotice("Lütfen güncelleme tetiklenecek en az bir mekan seçin.", "err")
      return
    }
    const ok = await confirm({
      title: "Anlık Güncelleme & Cache Temizleme Tetikle",
      message: `${targetLabel} kapsamındaki açık tüm Merchant Panel, Corder Boss ve Garson Terminali ekranlarında anında güncelleme penceresi açılacak. Onaylıyor musunuz?`,
      confirmLabel: "Anında Tetikle & Yayınla",
    })
    if (!ok) return

    setSending(true)
    try {
      await platform.notifications.broadcastUpdate({
        title: title.trim() || DEFAULT_UPDATE_TITLE,
        message: message.trim() || DEFAULT_UPDATE_MESSAGE,
        targetRestaurantIds: venueScope === "all" ? [] : selectedRestIds,
      })
      onBroadcastSuccess()
      onNotice(
        "Güncelleme ve önbellek temizleme modalı hedef ekranlarda anında tetiklendi.",
        "ok",
      )
    } catch (err) {
      onNotice(
        err instanceof Error ? err.message : "Güncelleme tetiklenemedi",
        "err",
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-2xl border border-[#e63462]/25 bg-gradient-to-r from-[#fff5f7] via-white to-[#f5f7ff] p-4 sm:p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#e63462] text-white shadow-sm">
            <RefreshCw className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-semibold text-[#1d1d1f]">
                Anlık Sistem Güncellemesi &amp; Önbellek Temizleme (Cache Purge)
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#e63462]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#e63462]">
                <Zap className="h-3 w-3" />
                Canlı Soket Tetikleyici
              </span>
            </div>
            <p className="text-[12px] text-[#636366] mt-0.5">
              Müşteri ekranlarında anında güncelleme modalı açar; butona bastıklarında oturumları kapanmadan önbellek temizlenip en güncel sürüm yüklenir.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="h-9 rounded-xl border border-[#d1d1d6] bg-white px-3 text-[12px] font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
          >
            {expanded ? "Mesajı Gizle" : "Mesajı Özelleştir"}
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={() => void handleTrigger()}
            className="h-9 rounded-xl bg-[#e63462] hover:bg-[#d42d56] disabled:opacity-50 px-4 text-[12px] font-semibold text-white flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${sending ? "animate-spin" : ""}`} />
            <span>{sending ? "Tetikleniyor..." : "Güncelleme Modalı Tetikle"}</span>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-3.5 border-t border-[#e5e5ea] grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4">
            <label className="block text-[11px] font-semibold text-[#1d1d1f] mb-1">
              Modal Başlığı ({targetLabel})
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-9 rounded-xl border border-[#d1d1d6] bg-white px-3 text-[12px] text-[#1d1d1f] outline-none focus:border-[#e63462]"
            />
          </div>
          <div className="md:col-span-8">
            <label className="block text-[11px] font-semibold text-[#1d1d1f] mb-1">
              Müşteri Ekranında Görünecek Açıklama Metni
            </label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full h-9 rounded-xl border border-[#d1d1d6] bg-white px-3 text-[12px] text-[#1d1d1f] outline-none focus:border-[#e63462]"
            />
          </div>
        </div>
      )}
    </div>
  )
}

