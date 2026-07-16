import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { ClientOnlyShell } from "@/components/ClientOnlyShell"
import { PlatformAuthProvider } from "@/lib/auth-context"
import { AdminStoreProvider } from "@/lib/store"
import App from "./App"
import "./index.css"

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
