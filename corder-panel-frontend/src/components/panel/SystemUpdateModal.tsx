import { useEffect, useState } from "react"
import { RefreshCw, ShieldCheck } from "lucide-react"

interface SystemUpdatePayload {
  id: string
  title?: string
  message?: string
  sentAt?: string
}

const APPLIED_UPDATES_STORAGE_KEY = "corder_applied_system_updates_v1"

function getAppliedUpdateIds(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = localStorage.getItem(APPLIED_UPDATES_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set()
  } catch {
    return new Set()
  }
}

function markUpdateIdApplied(id: string): void {
  if (typeof window === "undefined" || !id) return
  try {
    const existing = Array.from(getAppliedUpdateIds())
    const next = Array.from(new Set([...existing, id])).slice(-100)
    localStorage.setItem(APPLIED_UPDATES_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore storage errors
  }
}

async function purgeBrowserCachesAndReload(updateId: string): Promise<void> {
  markUpdateIdApplied(updateId)

  try {
    if ("caches" in window && window.caches) {
      const keys = await window.caches.keys()
      await Promise.all(keys.map((key) => window.caches.delete(key)))
    }
  } catch {
    // ignore cache storage errors
  }

  try {
    if ("serviceWorker" in navigator && navigator.serviceWorker) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((reg) => reg.unregister()))
    }
  } catch {
    // ignore service worker errors
  }

  try {
    sessionStorage.clear()
  } catch {
    // ignore sessionStorage errors
  }

  try {
    await fetch(window.location.pathname, {
      method: "GET",
      cache: "reload",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    })
  } catch {
    // ignore fetch error
  }

  const nextUrl = new URL(window.location.href)
  nextUrl.searchParams.set("_v", String(Date.now()))
  window.location.replace(nextUrl.toString())
}

export function SystemUpdateModal() {
  const [activeUpdate, setActiveUpdate] = useState<SystemUpdatePayload | null>(null)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    const onSystemUpdate = (evt: Event) => {
      const custom = evt as CustomEvent<SystemUpdatePayload | undefined>
      const detail = custom.detail
      if (!detail || !detail.id) return
      const applied = getAppliedUpdateIds()
      if (applied.has(detail.id)) return
      setActiveUpdate(detail)
    }

    window.addEventListener("corder:system-update", onSystemUpdate)
    return () => {
      window.removeEventListener("corder:system-update", onSystemUpdate)
    }
  }, [])

  if (!activeUpdate) return null

  const title = activeUpdate.title?.trim() || "Yeni Sistem Güncellemesi Yayınlandı"
  const message =
    activeUpdate.message?.trim() ||
    "Sistemimizde yeni özellikler ve performans iyileştirmeleri devreye alındı. Güncel sürümü yüklemek ve tarayıcı önbelleğini temizlemek için aşağıdaki butona tıklayın."

  const handleApply = async () => {
    if (applying) return
    setApplying(true)
    await purgeBrowserCachesAndReload(activeUpdate.id)
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#e5e5ea] bg-white p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-3.5">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[#e63462] text-white shadow-md">
            <RefreshCw className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center rounded-full bg-[#e63462]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#e63462]">
              Anlık Sistem Güncellemesi
            </span>
            <h2 className="mt-1 text-[17px] font-bold text-[#1d1d1f] leading-snug">
              {title}
            </h2>
          </div>
        </div>

        <p className="text-[13px] text-[#48484a] leading-relaxed whitespace-pre-line">
          {message}
        </p>

        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-[12px] text-emerald-900">
          <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <span>
            Açık oturumunuz ve verileriniz korunacaktır. Yalnızca eski tarayıcı önbelleği temizlenip en güncel sürüm yüklenecektir.
          </span>
        </div>

        <button
          type="button"
          disabled={applying}
          onClick={() => void handleApply()}
          className="w-full h-11 rounded-xl bg-[#e63462] hover:bg-[#d42d56] disabled:opacity-60 text-white font-semibold text-[14px] flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${applying ? "animate-spin" : ""}`} />
          <span>
            {applying
              ? "Önbellek Temizleniyor ve Güncelleniyor..."
              : "Şimdi Güncelle ve Önbelleği Temizle"}
          </span>
        </button>
      </div>
    </div>
  )
}

