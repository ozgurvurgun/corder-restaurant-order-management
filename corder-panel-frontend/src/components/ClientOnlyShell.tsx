import { useState, useEffect, useRef, type ReactNode } from "react"

/**
 * App content is rendered on the client only; no SSR.
 * Timeout prevents getting stuck (shows content after ~2s even if the first chunk is slow).
 */
const FALLBACK_MS = 2200

export function ClientOnlyShell({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const fallbackDone = useRef(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (fallbackDone.current) return
    const id = setTimeout(() => {
      fallbackDone.current = true
      setMounted(true)
    }, FALLBACK_MS)
    return () => clearTimeout(id)
  }, [])

  if (!mounted) {
    return (
      <div className="h-dvh w-full flex items-center justify-center bg-[#0a0a0a]" suppressHydrationWarning>
        <span className="text-zinc-500 text-sm">Yükleniyor…</span>
      </div>
    )
  }

  return <>{children}</>
}
