import type { PanelViewId } from "../panel-types"

export type ShortcutCategoryId =
  | "command"
  | "navigation"
  | "tables"
  | "payment"
  | "quick-sale"

export interface ShortcutCategoryMeta {
  id: ShortcutCategoryId
  label: string
  description: string
}

export interface ShortcutDefinition {
  id: string
  category: ShortcutCategoryId
  keys: string[]
  title: string
  description: string
  contextLabel: string
}

export const SHORTCUT_CATEGORIES: readonly ShortcutCategoryMeta[] = [
  {
    id: "command",
    label: "Hızlı Komut & Genel",
    description: "Her ekrandan çalışan arama paleti ve yardımcı kısayollar",
  },
  {
    id: "navigation",
    label: "Ekran Geçişleri",
    description: "Menüye tıklamadan ekranlar arasında anında geçiş",
  },
  {
    id: "tables",
    label: "Masalar & Adisyon",
    description: "Masa arama ve seçili masada hızlı sipariş/hesap işlemleri",
  },
  {
    id: "payment",
    label: "Hesap Kesme & Tahsilat",
    description: "Ödeme modalında tek tuşla ödeme yöntemi seçimi ve onay",
  },
  {
    id: "quick-sale",
    label: "Hızlı Satış",
    description: "Tezgah ve paket satışta hızlı ürün arama ve tahsilat",
  },
] as const

export const SHORTCUT_CATALOG: readonly ShortcutDefinition[] = [
  {
    id: "cmd.palette",
    category: "command",
    keys: ["Ctrl", "K"],
    title: "Hızlı Komut & Masa Arama Paleti",
    description: "Herhangi bir masayı adına göre bulup açar veya ekranlar arası geçiş yapar",
    contextLabel: "Her Yerden",
  },
  {
    id: "cmd.guide",
    category: "command",
    keys: ["?"],
    title: "Klavye Kısayolları Rehberi",
    description: "Tüm klavye kısayolları penceresini açar veya kapatır",
    contextLabel: "Her Yerden",
  },
  {
    id: "cmd.escape",
    category: "command",
    keys: ["Esc"],
    title: "Pencereyi / Paneli Kapat",
    description: "Açık olan modalı, bildirim menüsünü veya sağ masa detay panelini kapatır",
    contextLabel: "Her Yerden",
  },
  {
    id: "nav.dashboard",
    category: "navigation",
    keys: ["Alt", "1"],
    title: "Ana Sayfa",
    description: "Genel özet ve günlük performans ekranına geçer",
    contextLabel: "Global",
  },
  {
    id: "nav.tables",
    category: "navigation",
    keys: ["Alt", "2"],
    title: "Masalar",
    description: "Salon ve bölge masa düzeni ekranına geçer",
    contextLabel: "Global",
  },
  {
    id: "nav.quick-sale",
    category: "navigation",
    keys: ["Alt", "3"],
    title: "Hızlı Satış",
    description: "Masasız tezgah/elden hızlı satış ekranına geçer",
    contextLabel: "Global",
  },
  {
    id: "nav.live-orders",
    category: "navigation",
    keys: ["Alt", "4"],
    title: "Tamamlanan Siparişler",
    description: "Kapanmış adisyonlar ve geçmiş siparişler ekranına geçer",
    contextLabel: "Global",
  },
  {
    id: "nav.cash-register",
    category: "navigation",
    keys: ["Alt", "5"],
    title: "Kasa & Vardiya",
    description: "Kasa özeti, gelir/giderler, cariler ve X/Z raporu ekranına geçer",
    contextLabel: "Global",
  },
  {
    id: "nav.products",
    category: "navigation",
    keys: ["Alt", "6"],
    title: "Ürün Yönetimi",
    description: "Kategori ve ürün kataloğu ekranına geçer",
    contextLabel: "Global",
  },
  {
    id: "nav.stock",
    category: "navigation",
    keys: ["Alt", "7"],
    title: "Stok & Reçete",
    description: "Hammadde, reçete ve stok hareketleri ekranına geçer",
    contextLabel: "Global",
  },
  {
    id: "nav.reports",
    category: "navigation",
    keys: ["Alt", "8"],
    title: "Raporlar",
    description: "Finansal ve operasyonel analiz raporları ekranına geçer",
    contextLabel: "Global",
  },
  {
    id: "nav.settings",
    category: "navigation",
    keys: ["Alt", "9"],
    title: "Ayarlar",
    description: "Restoran, masa, QR ve gün sonu ayarları ekranına geçer",
    contextLabel: "Global",
  },
  {
    id: "tables.search",
    category: "tables",
    keys: ["/"],
    title: "Masa Arama Kutusuna Odaklan",
    description: "Masalar ekranında arama kutusunu aktif eder",
    contextLabel: "Masalar Ekranı",
  },
  {
    id: "tables.add-order",
    category: "tables",
    keys: ["N"],
    title: "Seçili Masaya Sipariş Gir",
    description: "Açık olan masa detayında yeni ürün ekleme penceresini açar",
    contextLabel: "Seçili Masa",
  },
  {
    id: "tables.checkout",
    category: "tables",
    keys: ["H"],
    title: "Hesap Kes (Ödeme Al)",
    description: "Açık olan masanın tahsilat / hesap kesme penceresini açar",
    contextLabel: "Seçili Masa",
  },
  {
    id: "tables.split",
    category: "tables",
    keys: ["B"],
    title: "Hesabı Böl",
    description: "Kişi sayısına veya ürünlere göre hesap bölme penceresini açar",
    contextLabel: "Seçili Masa",
  },
  {
    id: "tables.discount",
    category: "tables",
    keys: ["I"],
    title: "İndirim / İkram Uygula",
    description: "Seçili masaya yüzde, tutar veya ikram indirimi penceresini açar",
    contextLabel: "Seçili Masa",
  },
  {
    id: "tables.print",
    category: "tables",
    keys: ["P"],
    title: "Masa Fişi Yazdır",
    description: "Seçili masanın konsolide adisyon fişini termal yazıcıya gönderir",
    contextLabel: "Seçili Masa",
  },
  {
    id: "tables.move",
    category: "tables",
    keys: ["T"],
    title: "Masa Taşı / Birleştir",
    description: "Seçili masayı başka bir masaya taşıma veya birleştirme penceresini açar",
    contextLabel: "Seçili Masa",
  },
  {
    id: "payment.cash",
    category: "payment",
    keys: ["F1"],
    title: "Nakit + Tam Tutar Seç",
    description: "Ödeme yöntemini Nakit yapar ve alınan tutara tam hesap tutarını doldurur",
    contextLabel: "Hesap Kes Modalı",
  },
  {
    id: "payment.card",
    category: "payment",
    keys: ["F2"],
    title: "Kredi Kartı Seç",
    description: "Ödeme yöntemini Kredi Kartı olarak seçer",
    contextLabel: "Hesap Kes Modalı",
  },
  {
    id: "payment.meal-card",
    category: "payment",
    keys: ["F3"],
    title: "Yemek Kartı Seç",
    description: "Ödeme yöntemini Yemek Kartı olarak seçer",
    contextLabel: "Hesap Kes Modalı",
  },
  {
    id: "payment.multinet",
    category: "payment",
    keys: ["F4"],
    title: "Multinet Seç",
    description: "Ödeme yöntemini Multinet olarak seçer",
    contextLabel: "Hesap Kes Modalı",
  },
  {
    id: "payment.split",
    category: "payment",
    keys: ["F5"],
    title: "Karma (Çoklu) Ödeme Seç",
    description: "Ödeme yöntemini Karma Ödeme olarak seçer",
    contextLabel: "Hesap Kes Modalı",
  },
  {
    id: "payment.ledger",
    category: "payment",
    keys: ["F6"],
    title: "Cariye At Seç",
    description: "Ödeme yöntemini Cari (Açık Hesap) olarak seçer",
    contextLabel: "Hesap Kes Modalı",
  },
  {
    id: "payment.confirm",
    category: "payment",
    keys: ["Ctrl", "Enter"],
    title: "Tahsilatı Onayla & Masayı Kapat",
    description: "Seçili ödeme yöntemiyle hesabı kapatır",
    contextLabel: "Hesap Kes Modalı",
  },
  {
    id: "quicksale.search",
    category: "quick-sale",
    keys: ["/"],
    title: "Ürün Arama Kutusuna Odaklan",
    description: "Hızlı satış ekranında ürün arama kutusuna odaklanır",
    contextLabel: "Hızlı Satış",
  },
  {
    id: "quicksale.methods",
    category: "quick-sale",
    keys: ["F1 - F4"],
    title: "Hızlı Satış Ödeme Yöntemi (Nakit / Kart / Yemek / Multinet)",
    description: "F1: Nakit, F2: Kredi Kartı, F3: Yemek Kartı, F4: Multinet seçer",
    contextLabel: "Hızlı Satış",
  },
  {
    id: "quicksale.complete",
    category: "quick-sale",
    keys: ["Ctrl", "Enter"],
    title: "Hızlı Satışı Tamamla",
    description: "Sepetteki ürünleri seçili ödeme yöntemiyle anında tahsil eder",
    contextLabel: "Hızlı Satış",
  },
] as const

export const VIEW_SHORTCUT_BADGES: Partial<Record<PanelViewId, string>> = {
  dashboard: "Alt+1",
  tables: "Alt+2",
  "quick-sale": "Alt+3",
  "live-orders": "Alt+4",
  "cash-register": "Alt+5",
  products: "Alt+6",
  stock: "Alt+7",
  reports: "Alt+8",
  settings: "Alt+9",
}

const ALT_DIGIT_TO_VIEW: Record<string, PanelViewId> = {
  "1": "dashboard",
  "2": "tables",
  "3": "quick-sale",
  "4": "live-orders",
  "5": "cash-register",
  "6": "products",
  "7": "stock",
  "8": "reports",
  "9": "settings",
}

export function isEditableElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  if (tag === "input" || tag === "textarea" || tag === "select") return true
  if (target.isContentEditable) return true
  return Boolean(target.closest("[contenteditable='true']"))
}

export function resolveAltViewShortcut(e: KeyboardEvent): PanelViewId | null {
  if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return null
  const codeMatch = /^Digit([1-9])$/.exec(e.code)
  const digit = codeMatch ? codeMatch[1] : e.key
  return ALT_DIGIT_TO_VIEW[digit] ?? null
}
