import { useState, useRef, useEffect } from "react"
import { Bell, Globe, ChefHat, AlertTriangle, Package, CreditCard } from "lucide-react"
import { usePanelStore } from "@/lib/panel-store"
import { usePanelI18n } from "@/lib/panel-i18n"
import { ISTANBUL_TZ } from "@/lib/format"
import type { PanelViewId } from "@/lib/panel-types"

interface HeaderBarProps {
  activeView?: PanelViewId
}

export function HeaderBar({ activeView = "dashboard" }: HeaderBarProps) {
  const { notifications, markNotificationRead, clearAllNotifications, currentShift } = usePanelStore()
  const { locale, setLocale, t } = usePanelI18n()
  const [showNotifications, setShowNotifications] = useState(false)
  const [mounted, setMounted] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.read).length

  useEffect(() => {
    setMounted(true)
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowNotifications(false)
      }
    }
    document.addEventListener("keydown", handleKeydown)
    return () => document.removeEventListener("keydown", handleKeydown)
  }, [])

  const getViewTitle = (view: PanelViewId): string => {
    switch (view) {
      case "dashboard":
        return locale === "tr" ? "Ana Sayfa" : "Dashboard"
      case "tables":
        return t("tables")
      case "quick-sale":
        return locale === "tr" ? "Hızlı Satış" : "Quick Sale"
      case "live-orders":
        return t("completedOrders")
      case "cash-register":
        return t("cashRegister")
      case "products":
        return t("products")
      case "campaigns":
        return locale === "tr" ? "Kampanyalar" : "Campaigns"
      case "stock":
        return t("stock")
      case "users":
        return t("users")
      case "reports":
        return t("reports")
      case "technical":
        return t("technical")
      case "billing":
        return locale === "tr" ? "Abonelik & Ödeme" : "Subscription & Payment"
      case "settings":
        return t("settings")
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "order":
        return <ChefHat className="h-4 w-4 text-[#007aff]" />
      case "stock":
      case "stock-low":
        return <Package className="h-4 w-4 text-[#ff9500]" />
      case "payment":
        return <CreditCard className="h-4 w-4 text-[#34c759]" />
      case "alert":
      case "kitchen-alert":
        return <AlertTriangle className="h-4 w-4 text-[#ff3b30]" />
      default:
        return <Bell className="h-4 w-4 text-[#86868b]" />
    }
  }

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return locale === "tr" ? "Şimdi" : "Now"
    if (mins < 60) return `${mins} ${locale === "tr" ? "dk" : "min"}`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} ${locale === "tr" ? "saat" : "hr"}`
    return `${Math.floor(hours / 24)} ${locale === "tr" ? "gün" : "day"}`
  }

  return (
    <div className="h-[52px] flex items-center justify-between gap-4 px-6 border-b border-[#e5e5ea] bg-white/80 backdrop-blur-xl flex-shrink-0 relative z-[100]">
      {/* Left: Page Title & Context */}
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-[16px] font-semibold text-[#1d1d1f] truncate">
          {getViewTitle(activeView)}
        </h1>
        {activeView === "dashboard" && mounted && (
          <div className="hidden sm:flex items-center gap-2 text-[12px] text-[#86868b]">
            <span className="text-[#d1d1d6]">•</span>
            <span>
              {new Date().toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", {
                timeZone: ISTANBUL_TZ,
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            {currentShift && (
              <span className="px-2 py-0.5 rounded-full bg-[#34c759]/10 text-[#34c759] font-medium text-[11px]">
                {t("shiftOpen")}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right: Language Switcher & Notifications */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => setLocale(locale === "tr" ? "en" : "tr")}
          className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-[#f5f5f7] rounded-lg transition-colors"
        >
          <Globe className="h-4 w-4 text-[#86868b]" />
          <span className="text-[13px] font-medium text-[#1d1d1f] uppercase">{locale}</span>
        </button>

        <div ref={notifRef} className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 hover:bg-[#f5f5f7] rounded-lg transition-colors"
          >
            <Bell className="h-5 w-5 text-[#86868b]" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-[#ff3b30] text-white text-[11px] font-bold rounded-full px-1">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl border border-[#e5e5ea] overflow-hidden z-[9999]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e5ea]">
                <h3 className="text-[15px] font-semibold text-[#1d1d1f]">
                  {t("notifications")}
                </h3>
                {notifications.length > 0 && (
                  <button
                    onClick={clearAllNotifications}
                    className="text-[13px] text-[#007aff] hover:underline"
                  >
                    {locale === "tr" ? "Tümünü Temizle" : "Clear All"}
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-auto">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center">
                    <Bell className="h-8 w-8 text-[#d1d1d6] mx-auto mb-2" />
                    <p className="text-[13px] text-[#86868b]">
                      {locale === "tr" ? "Bildirim yok" : "No notifications"}
                    </p>
                  </div>
                ) : (
                  notifications.slice(0, 10).map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => markNotificationRead(notif.id)}
                      className={`flex items-start gap-3 px-4 py-3 hover:bg-[#f5f5f7] cursor-pointer transition-colors border-b border-[#e5e5ea] last:border-0 ${
                        !notif.read ? "bg-[#007aff]/5" : ""
                      }`}
                    >
                      <div className="p-2 bg-[#f5f5f7] rounded-lg flex-shrink-0">
                        {getNotificationIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[14px] ${!notif.read ? "font-semibold" : "font-medium"} text-[#1d1d1f] truncate`}>
                          {notif.title}
                        </p>
                        <p className="text-[13px] text-[#86868b] truncate">{notif.message}</p>
                        <p className="text-[11px] text-[#aeaeb2] mt-1">{mounted ? formatTime(notif.createdAt) : ""}</p>
                      </div>
                      {!notif.read && (
                        <div className="w-2 h-2 bg-[#007aff] rounded-full flex-shrink-0 mt-2" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
