import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ClientOnlyShell } from "@/components/ClientOnlyShell"
import { AppProvider } from "@/lib/store"
import { IOSToastProvider } from "@/components/ios-toast"
import App from "./App"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClientOnlyShell>
      <AppProvider>
        <IOSToastProvider>
          <App />
        </IOSToastProvider>
      </AppProvider>
    </ClientOnlyShell>
  </StrictMode>
)
