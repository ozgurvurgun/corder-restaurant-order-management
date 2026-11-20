import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import { installCustomFormValidation } from "./lib/custom-form-validation"
import { installBossPushAutoSetup } from "./lib/fraud-notifier"
import "./index.css"

installCustomFormValidation()
installBossPushAutoSetup()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
