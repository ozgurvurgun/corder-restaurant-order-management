import { lazy, Suspense } from "react"
import { usePanelAuth } from "@/lib/panel-auth"
import { I18nProvider } from "@/lib/panel-i18n"
import { PanelToastProvider } from "@/components/panel/panel-toast"

const AuthenticatedShell = lazy(() =>
  import("./AuthenticatedShell").then((m) => ({ default: m.AuthenticatedShell }))
)

function AuthGateLoading() {
  return (
    <div className="h-dvh w-full flex items-center justify-center bg-[#0a0a0a]">
      <span className="text-zinc-500 text-sm">Yükleniyor…</span>
    </div>
  )
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { token } = usePanelAuth()

  if (token) {
    return (
      <Suspense fallback={<AuthGateLoading />}>
        <AuthenticatedShell />
      </Suspense>
    )
  }

  return (
    <I18nProvider>
      <PanelToastProvider>
        <div className="h-dvh w-full overflow-hidden">{children}</div>
      </PanelToastProvider>
    </I18nProvider>
  )
}
