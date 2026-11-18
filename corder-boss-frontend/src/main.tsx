import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import { installCustomFormValidation } from "./lib/custom-form-validation"
import "./index.css"

installCustomFormValidation()

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    if (import.meta.env.PROD) {
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
    } else {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => {
          for (const reg of regs) {
            void reg.unregister()
          }
        })
        .catch(() => {})
    }
  })
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
