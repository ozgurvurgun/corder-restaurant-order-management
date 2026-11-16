import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

export type Locale = "tr" | "en"

const translations: Record<string, Record<Locale, string>> = {
  // Sidebar & Nav
  dashboard: { tr: "Panel", en: "Dashboard" },
  tables: { tr: "Masalar", en: "Tables" },
  liveOrders: { tr: "Tamamlanan Siparişler", en: "Completed Orders" },
  completedOrders: { tr: "Tamamlanan Siparişler", en: "Completed Orders" },
  cashRegister: { tr: "Kasa", en: "Cash Register" },
  products: { tr: "Ürün Yönetimi", en: "Product Management" },
  stock: { tr: "Stok Yönetimi", en: "Stock Management" },
  users: { tr: "Kullanıcılar", en: "Users" },
  reports: { tr: "Raporlar", en: "Reports" },
  technical: { tr: "Teknik", en: "Technical" },
  settings: { tr: "Ayarlar", en: "Settings" },
  operations: { tr: "Operasyon", en: "Operations" },
  management: { tr: "Yönetim", en: "Management" },
  analysisSystem: { tr: "Analiz & Sistem", en: "Analysis & System" },
  adminPanel: { tr: "Yönetim Paneli", en: "Admin Panel" },

  // Dashboard
  totalRevenue: { tr: "Toplam Ciro", en: "Total Revenue" },
  totalOrders: { tr: "Toplam Sipariş", en: "Total Orders" },
  occupiedTables: { tr: "Dolu Masalar", en: "Occupied Tables" },
  cancellations: { tr: "İptaller", en: "Cancellations" },
  empty: { tr: "boş", en: "empty" },
  hourlyRevenue: { tr: "Saatlik Ciro", en: "Hourly Revenue" },
  paymentBreakdown: { tr: "Ödeme Dağılımı", en: "Payment Breakdown" },
  topProducts: { tr: "En Çok Satanlar", en: "Top Products" },
  waiterPerformance: { tr: "Garson Performansı", en: "Waiter Performance" },
  recentActivity: { tr: "Son Aktiviteler", en: "Recent Activity" },
  shiftOpen: { tr: "Vardiya Açık", en: "Shift Open" },
  unreadNotification: { tr: "okunmamış bildirim", en: "unread notifications" },
  pieces: { tr: "adet", en: "pcs" },
  revenue: { tr: "Ciro", en: "Revenue" },

  // Tables
  allSections: { tr: "Tümü", en: "All" },
  table: { tr: "Masa", en: "Table" },
  emptyTable: { tr: "Boş", en: "Empty" },
  occupied: { tr: "Dolu", en: "Occupied" },
  order: { tr: "sipariş", en: "order" },
  search: { tr: "Ara...", en: "Search..." },

  // Payment
  closeCheck: { tr: "Hesap Kes", en: "Close Check" },
  paymentMethod: { tr: "Ödeme Yöntemi", en: "Payment Method" },
  cash: { tr: "Nakit", en: "Cash" },
  creditCard: { tr: "Kredi Kartı", en: "Credit Card" },
  mealCard: { tr: "Yemek Kartı", en: "Meal Card" },
  multiPayment: { tr: "Çoklu Ödeme", en: "Split Payment" },
  multinet: { tr: "Multinet", en: "Multinet" },
  total: { tr: "Toplam", en: "Total" },
  totalAmount: { tr: "Toplam Tutar", en: "Total Amount" },
  netAmount: { tr: "Net Tutar", en: "Net Amount" },
  discount: { tr: "İndirim", en: "Discount" },
  discountComplimentary: { tr: "İndirim / İkram", en: "Discount / Complimentary" },
  percent: { tr: "Yüzde", en: "Percent" },
  amount: { tr: "Tutar", en: "Amount" },
  reason: { tr: "Sebep", en: "Reason" },
  reasonOptional: { tr: "Sebep (opsiyonel)", en: "Reason (optional)" },
  cancel: { tr: "Vazgeç", en: "Cancel" },
  confirm: { tr: "Onayla", en: "Confirm" },
  processing: { tr: "İşleniyor...", en: "Processing..." },
  changeAmount: { tr: "Para Üstü", en: "Change" },
  receivedAmount: { tr: "Alınan Tutar", en: "Received Amount" },

  // Split Bill
  splitBill: { tr: "Hesap Böl", en: "Split Bill" },
  splitByPerson: { tr: "Kişi Bazlı", en: "By Person" },
  splitByItem: { tr: "Ürün Bazlı", en: "By Item" },
  numberOfPeople: { tr: "Kişi Sayısı", en: "Number of People" },
  perPerson: { tr: "Kişi Başı", en: "Per Person" },
  selectItems: { tr: "Ürünleri Seç", en: "Select Items" },
  selectedTotal: { tr: "Seçili Toplam", en: "Selected Total" },
  paySelected: { tr: "Seçileni Öde", en: "Pay Selected" },

  // Discount / Complimentary
  ownerComplimentary: { tr: "Patron İkramı", en: "Owner's Complimentary" },
  customerComplaint: { tr: "Müşteri Şikayeti", en: "Customer Complaint" },
  staffDiscount: { tr: "Personel İndirimi", en: "Staff Discount" },
  campaign: { tr: "Kampanya", en: "Campaign" },
  other: { tr: "Diğer", en: "Other" },
  applyDiscount: { tr: "İndirim Uygula", en: "Apply Discount" },
  complimentary: { tr: "İkram", en: "Complimentary" },
  fullComplimentary: { tr: "Tam İkram", en: "Full Complimentary" },

  // Notifications
  notifications: { tr: "Bildirimler", en: "Notifications" },
  markAllRead: { tr: "Tümünü Okundu İşaretle", en: "Mark All Read" },
  noNotifications: { tr: "Bildirim yok", en: "No notifications" },
  newOrder: { tr: "Yeni Sipariş", en: "New Order" },
  stockLow: { tr: "Stok Uyarısı", en: "Low Stock" },
  system: { tr: "Sistem", en: "System" },

  // Dark mode
  darkMode: { tr: "Karanlık Mod", en: "Dark Mode" },
  lightMode: { tr: "Aydınlık Mod", en: "Light Mode" },
  language: { tr: "Dil", en: "Language" },

  // Print
  print: { tr: "Yazdır", en: "Print" },
  reprint: { tr: "Tekrar Bas", en: "Reprint" },
  move: { tr: "Taşı", en: "Move" },
  cancelItem: { tr: "İptal Et", en: "Cancel Item" },
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
