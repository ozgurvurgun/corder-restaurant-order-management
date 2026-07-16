import { useState, useEffect, type ReactNode } from "react"

/**
 * App content is rendered on the client only; no SSR.
 */
export function ClientOnlyShell({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#0f0f0f]" suppressHydrationWarning>
        <span className="text-white/60 text-sm">Yükleniyor…</span>
      </div>
    )
  }

  return <>{children}</>
}
