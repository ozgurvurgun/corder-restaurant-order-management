import type { LiveOrderDto, TableDiscountDto } from "./types"

const ISTANBUL_TZ = "Europe/Istanbul"

const trMoneyFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const trTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: ISTANBUL_TZ,
  hour: "2-digit",
  minute: "2-digit",
})

const trDateTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: ISTANBUL_TZ,
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

const trDayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ISTANBUL_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/**
 * Converts a major-unit TL amount into integer minor units
 * to avoid IEEE-754 floating-point drift.
 */
export function toMinorUnits(amount: number | string | null | undefined): number {
  if (amount === null || amount === undefined || amount === "") return 0
  const n = typeof amount === "number" ? amount : Number(amount)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

/**
 * Converts integer minor units back to a 2-decimal TL number.
 */
export function fromMinorUnits(minorUnits: number): number {
  if (!Number.isFinite(minorUnits)) return 0
  return Number((Math.round(minorUnits) / 100).toFixed(2))
}

/**
 * Sums multiple major-unit TL amounts using integer minor-unit arithmetic.
 */
export function sumMoney(
  ...amounts: Array<number | string | null | undefined>
): number {
  let totalMinorUnits = 0
  for (const a of amounts) {
    totalMinorUnits += toMinorUnits(a)
  }
  return fromMinorUnits(totalMinorUnits)
}

/**
 * Formats a major-unit TL number in Turkish locale (e.g. "1.250,50").
 * Internally rounds to integer minor units first.
 */
export function formatMoney(amount: number | string | null | undefined): string {
  const major = fromMinorUnits(toMinorUnits(amount))
  return trMoneyFormatter.format(major)
}

/**
 * Computes subtotal, discount amount, and net total for a table's active orders
 * using integer minor-unit arithmetic and matching backend `Money.computeDiscount`.
 */
export function computeTableTotals(
  activeOrders: LiveOrderDto[],
  discount?: TableDiscountDto | null
): {
  subtotal: number
  discountAmount: number
  netTotal: number
} {
  let rawMinorUnits = 0
  for (const ord of activeOrders) {
    for (const item of ord.items) {
      if (item.status !== "cancelled" && item.status !== "ledger") {
        rawMinorUnits += toMinorUnits(item.price) * Number(item.quantity || 0)
      }
    }
  }

  let discountMinorUnits = 0
  if (discount && rawMinorUnits > 0) {
    const val = Number(discount.value)
    if (discount.type === "complimentary") {
      discountMinorUnits = rawMinorUnits
    } else if (discount.type === "percent" && Number.isFinite(val) && val > 0) {
      if (val >= 100) {
        discountMinorUnits = rawMinorUnits
      } else {
        discountMinorUnits = Math.min(rawMinorUnits, Math.max(0, Math.round((rawMinorUnits * val) / 100)))
      }
    } else if (discount.type === "amount" && Number.isFinite(val) && val > 0) {
      discountMinorUnits = Math.min(rawMinorUnits, Math.max(0, toMinorUnits(val)))
    }
  }

  const netMinorUnits = Math.max(0, rawMinorUnits - discountMinorUnits)
  return {
    subtotal: fromMinorUnits(rawMinorUnits),
    discountAmount: fromMinorUnits(discountMinorUnits),
    netTotal: fromMinorUnits(netMinorUnits),
  }
}

export function formatIstanbulTime(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate
  if (Number.isNaN(d.getTime())) return ""
  return trTimeFormatter.format(d)
}

export function formatIstanbulDateTime(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate
  if (Number.isNaN(d.getTime())) return ""
  const now = new Date()
  if (trDayKeyFormatter.format(d) === trDayKeyFormatter.format(now)) {
    return `Bugün ${trTimeFormatter.format(d)}`
  }
  return trDateTimeFormatter.format(d)
}

export function getWaiterDisplayName(order: LiveOrderDto): string | null {
  const name = (order.userName ?? order.userDisplayName ?? "").trim()
  return name || null
}

const ERROR_TRANSLATIONS: Array<[RegExp, string | ((m: RegExpMatchArray) => string)]> = [
  [/^Invalid email or password$/i, "E-posta adresi veya parola hatalı."],
  [/^No active restaurant branch assigned to this Boss account$/i, "Bu Boss hesabına atanmış aktif bir restoran şubesi bulunamadı."],
  [/^Boss account is not active$/i, "Boss hesabınız aktif değil."],
  [/^Boss account not found$/i, "Boss hesabı bulunamadı."],
  [/^You do not have access to this branch$/i, "Bu şubeye erişim yetkiniz bulunmuyor."],
  [/^Selected branch is not active$/i, "Seçilen şube şu anda aktif değil."],
  [/^Only Boss accounts can switch branches$/i, "Yalnızca Boss hesapları şube değiştirebilir."],
  [/^This email address is already in use by another user$/i, "Bu e-posta adresi başka bir kullanıcı tarafından kullanılıyor."],
  [/^This PIN code is already in use by another staff member in this branch$/i, "Bu PIN kodu bu şubedeki başka bir personel tarafından kullanılıyor."],
  [/^A 4-8 digit PIN is required for terminal users$/i, "El terminali kullanıcıları için 4-8 haneli PIN kodu zorunludur."],
  [/^Email and password are required for users with Merchant Panel access$/i, "Merchant Panel erişimi olan kullanıcılar için e-posta ve parola zorunludur."],
  [/^A role with this key already exists in this branch$/i, "Bu şubede aynı isim/anahtara sahip bir rol zaten mevcut."],
  [/^Reserved or invalid role key$/i, "Geçersiz veya sistem tarafından ayrılmış rol adı."],
  [/^System roles cannot be deleted$/i, "Sistem varsayılan rolleri silinemez."],
  [/^Only system role templates can be reset to default$/i, "Yalnızca sistem varsayılan rolleri fabrika ayarlarına sıfırlanabilir."],
  [/^Cannot delete role while staff members are assigned to it$/i, "Bu role atanmış personeller varken rol silinemez. Önce personellerin rolünü değiştirin."],
  [/^You cannot assign your own account as a subordinate branch manager$/i, "Kendi hesabınızı alt şube yöneticisi olarak atayamazsınız."],
  [/^You cannot unlink your own account from a branch$/i, "Kendi hesabınızın şube bağlantısını kaldıramazsınız."],
  [/^Brand Owner \(HQ\) cannot be unlinked from a branch$/i, "Marka Sahibi (HQ) şubeden ayrılamaz."],
  [/^A password of at least 8 characters is required/i, "Yeni Şube / Franchise Boss hesabı için en az 8 karakterli bir parola girilmelidir."],
  [/^Please select at least one authorized branch$/i, "Lütfen yetki sahibi olduğunuz en az bir şube seçin."],
  [/^Too many login attempts/i, "Çok fazla başarısız giriş denemesi yapıldı. Lütfen birkaç dakika bekleyip tekrar deneyin."],
]

export function localizeApiError(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return "Beklenmeyen bir sunucu hatası oluştu."
  if (trimmed.toUpperCase().includes("ACCESS SUSPENDED DUE TO UNPAID SUBSCRIPTION")) {
    const branchMatch = trimmed.match(/for "([^"]+)"/i)
    const ibanMatch = trimmed.match(/Payment Account:\s*(.+)$/i)
    const branchPart = branchMatch?.[1] ? `"${branchMatch[1]}" şubesi` : "İşletmeniz"
    const ibanPart = ibanMatch?.[1] ? ` Ödeme Bilgileri: ${ibanMatch[1]}` : ""
    return `ÖDEME ALINMADIĞI İÇİN ERİŞİM DURDURULDU: ${branchPart} için aylık abonelik ödemesi alınamadığından sistem erişimi geçici olarak durdurulmuştur. Lütfen ödemeyi tamamlayarak sağlayıcınızla iletişime geçin.${ibanPart}`
  }
  for (const [pattern, replacement] of ERROR_TRANSLATIONS) {
    const match = trimmed.match(pattern)
    if (match) {
      return typeof replacement === "function" ? replacement(match) : replacement
    }
  }
  return trimmed
}
