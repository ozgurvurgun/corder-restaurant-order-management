import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

export type Locale = "tr" | "en"

const translations: Record<string, Record<Locale, string>> = {
  // Sidebar & Nav
  dashboard: { tr: "Panel", en: "Dashboard" },
  tables: { tr: "Masalar", en: "Tables" },
  liveOrders: { tr: "Tamamlanan Siparisler", en: "Completed Orders" },
  completedOrders: { tr: "Tamamlanan Siparisler", en: "Completed Orders" },
  cashRegister: { tr: "Kasa", en: "Cash Register" },
  products: { tr: "Urun Yonetimi", en: "Product Management" },
  stock: { tr: "Stok Yonetimi", en: "Stock Management" },
  users: { tr: "Kullanicilar", en: "Users" },
  reports: { tr: "Raporlar", en: "Reports" },
  technical: { tr: "Teknik", en: "Technical" },
  settings: { tr: "Ayarlar", en: "Settings" },
  operations: { tr: "Operasyon", en: "Operations" },
  management: { tr: "Yonetim", en: "Management" },
  analysisSystem: { tr: "Analiz & Sistem", en: "Analysis & System" },
  adminPanel: { tr: "Yonetim Paneli", en: "Admin Panel" },

  // Dashboard
  totalRevenue: { tr: "Toplam Ciro", en: "Total Revenue" },
  totalOrders: { tr: "Toplam Siparis", en: "Total Orders" },
  occupiedTables: { tr: "Dolu Masalar", en: "Occupied Tables" },
  cancellations: { tr: "Iptaller", en: "Cancellations" },
  empty: { tr: "bos", en: "empty" },
  hourlyRevenue: { tr: "Saatlik Ciro", en: "Hourly Revenue" },
  paymentBreakdown: { tr: "Odeme Dagilimi", en: "Payment Breakdown" },
  topProducts: { tr: "En Cok Satanlar", en: "Top Products" },
  waiterPerformance: { tr: "Garson Performansi", en: "Waiter Performance" },
  recentActivity: { tr: "Son Aktiviteler", en: "Recent Activity" },
  shiftOpen: { tr: "Vardiya Acik", en: "Shift Open" },
  unreadNotification: { tr: "okunmamis bildirim", en: "unread notifications" },
  pieces: { tr: "adet", en: "pcs" },
  revenue: { tr: "Ciro", en: "Revenue" },

  // Tables
  allSections: { tr: "Tumu", en: "All" },
  table: { tr: "Masa", en: "Table" },
  emptyTable: { tr: "Bos", en: "Empty" },
  occupied: { tr: "Dolu", en: "Occupied" },
  order: { tr: "siparis", en: "order" },
  search: { tr: "Ara...", en: "Search..." },

  // Payment
  closeCheck: { tr: "Hesap Kes", en: "Close Check" },
  paymentMethod: { tr: "Odeme Yontemi", en: "Payment Method" },
  cash: { tr: "Nakit", en: "Cash" },
  creditCard: { tr: "Kredi Karti", en: "Credit Card" },
  mealCard: { tr: "Yemek Karti", en: "Meal Card" },
  multiPayment: { tr: "Coklu Odeme", en: "Split Payment" },
  multinet: { tr: "Multinet", en: "Multinet" },
  total: { tr: "Toplam", en: "Total" },
  totalAmount: { tr: "Toplam Tutar", en: "Total Amount" },
  netAmount: { tr: "Net Tutar", en: "Net Amount" },
  discount: { tr: "Indirim", en: "Discount" },
  discountComplimentary: { tr: "Indirim / Ikram", en: "Discount / Complimentary" },
  percent: { tr: "Yuzde", en: "Percent" },
  amount: { tr: "Tutar", en: "Amount" },
  reason: { tr: "Sebep", en: "Reason" },
  reasonOptional: { tr: "Sebep (opsiyonel)", en: "Reason (optional)" },
  cancel: { tr: "Vazgec", en: "Cancel" },
  confirm: { tr: "Onayla", en: "Confirm" },
  processing: { tr: "Isleniyor...", en: "Processing..." },
  changeAmount: { tr: "Para Ustu", en: "Change" },
  receivedAmount: { tr: "Alinan Tutar", en: "Received Amount" },

  // Split Bill
  splitBill: { tr: "Hesap Bol", en: "Split Bill" },
  splitByPerson: { tr: "Kisi Bazli", en: "By Person" },
  splitByItem: { tr: "Urun Bazli", en: "By Item" },
  numberOfPeople: { tr: "Kisi Sayisi", en: "Number of People" },
  perPerson: { tr: "Kisi Basi", en: "Per Person" },
  selectItems: { tr: "Urunleri Sec", en: "Select Items" },
  selectedTotal: { tr: "Secili Toplam", en: "Selected Total" },
  paySelected: { tr: "Secileni Ode", en: "Pay Selected" },

  // Discount / Complimentary
  ownerComplimentary: { tr: "Patron Ikrami", en: "Owner's Complimentary" },
  customerComplaint: { tr: "Musteri Sikayeti", en: "Customer Complaint" },
  staffDiscount: { tr: "Personel Indirimi", en: "Staff Discount" },
  campaign: { tr: "Kampanya", en: "Campaign" },
  other: { tr: "Diger", en: "Other" },
  applyDiscount: { tr: "Indirim Uygula", en: "Apply Discount" },
  complimentary: { tr: "Ikram", en: "Complimentary" },
  fullComplimentary: { tr: "Tam Ikram", en: "Full Complimentary" },

  // Notifications
  notifications: { tr: "Bildirimler", en: "Notifications" },
  markAllRead: { tr: "Tumunu Okundu Isaretle", en: "Mark All Read" },
  noNotifications: { tr: "Bildirim yok", en: "No notifications" },
  newOrder: { tr: "Yeni Siparis", en: "New Order" },
  stockLow: { tr: "Stok Uyarisi", en: "Low Stock" },
  system: { tr: "Sistem", en: "System" },

  // Dark mode
  darkMode: { tr: "Karanlik Mod", en: "Dark Mode" },
  lightMode: { tr: "Aydinlik Mod", en: "Light Mode" },
  language: { tr: "Dil", en: "Language" },

  // Print
  print: { tr: "Yazdir", en: "Print" },
  reprint: { tr: "Tekrar Bas", en: "Reprint" },
  move: { tr: "Tasi", en: "Move" },
  cancelItem: { tr: "Iptal Et", en: "Cancel Item" },
  check: { tr: "Adisyon", en: "Check" },
}

interface I18nContextType {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextType | null>(null)

export function usePanelI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("usePanelI18n must be used within I18nProvider")
  return ctx
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("tr")

  const t = useCallback((key: string): string => {
    return translations[key]?.[locale] || key
  }, [locale])

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}
