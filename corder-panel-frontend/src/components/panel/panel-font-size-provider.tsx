import { useEffect } from "react"
import { usePanelStore } from "@/lib/panel-store"

export function PanelFontSizeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = usePanelStore()
  
  useEffect(() => {
    const root = document.documentElement
    
    // Remove all font size classes
    root.classList.remove("panel-font-small", "panel-font-medium", "panel-font-large")
    
    // Add the current font size class
    const fontSizeClass = `panel-font-${settings.fontSize || "medium"}`
    root.classList.add(fontSizeClass)
    
    // Apply CSS custom properties for font scaling
    const scale = settings.fontSize === "small" ? 0.9 : settings.fontSize === "large" ? 1.1 : 1
    root.style.setProperty("--panel-font-scale", String(scale))
    
  }, [settings.fontSize])
  
  return <>{children}</>
}
