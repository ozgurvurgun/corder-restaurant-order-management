import { usePanelAuth } from "@/lib/panel-auth"
import { I18nProvider } from "@/lib/panel-i18n"
import { PanelToastProvider } from "@/components/panel/panel-toast"
import { AuthenticatedShell } from "./AuthenticatedShell"

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { token } = usePanelAuth()

  if (token) {
    return <AuthenticatedShell />
  }

  return (
    <I18nProvider>
      <PanelToastProvider>
        <div className="h-dvh w-full overflow-hidden">{children}</div>
      </PanelToastProvider>
    </I18nProvider>
  )
}
