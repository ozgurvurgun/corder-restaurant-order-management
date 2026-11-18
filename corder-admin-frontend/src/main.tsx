import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { ClientOnlyShell } from "@/components/ClientOnlyShell"
import { PlatformAuthProvider } from "@/lib/auth-context"
import { AdminStoreProvider } from "@/lib/store"
import App from "./App"
import { installCustomFormValidation } from "./lib/custom-form-validation"
import "./index.css"

installCustomFormValidation()

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            void registration.update().catch(() => {})
          }
        })
      })
      .catch(() => {
        // Service worker registration failed
      })
  })
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClientOnlyShell>
      <PlatformAuthProvider>
        <AdminStoreProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AdminStoreProvider>
      </PlatformAuthProvider>
    </ClientOnlyShell>
  </StrictMode>
)
