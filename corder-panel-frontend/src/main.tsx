import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ClientOnlyShell } from "@/components/ClientOnlyShell"
import { PanelAuthProvider } from "@/lib/panel-auth"
import { AuthGate } from "@/components/panel/AuthGate"
import PanelLogin from "@/components/panel/panel-login"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClientOnlyShell>
      <PanelAuthProvider>
        <AuthGate>
          <PanelLogin />
        </AuthGate>
      </PanelAuthProvider>
    </ClientOnlyShell>
  </StrictMode>
)
