type ValidatableElement =
  | HTMLInputElement
  | HTMLTextAreaElement
  | HTMLSelectElement

let installed = false
let activeInvalidEl: ValidatableElement | null = null
let activeTimer: ReturnType<typeof setTimeout> | null = null

const STYLE_ID = "corder-custom-validation-styles"
const POPOVER_ID = "corder-validation-popover"

function ensureValidationStyles() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) {
    return
  }
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = `
    .c-field-invalid {
      border-color: #e63462 !important;
      background-color: #ffffff !important;
      box-shadow: 0 0 0 3px rgba(230, 52, 98, 0.14) !important;
    }
    .c-val-popover {
      position: fixed;
      z-index: 99999;
      display: flex;
      align-items: center;
      gap: 8px;
      background: #ffffff;
      color: #1d1d1f;
      border: 1px solid rgba(230, 52, 98, 0.35);
      border-radius: 11px;
      padding: 8px 12px;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
      font-size: 12.5px;
      font-weight: 600;
      line-height: 1.35;
      max-width: 320px;
      pointer-events: none;
      box-shadow: 0 12px 28px -6px rgba(29, 29, 31, 0.18), 0 4px 10px -2px rgba(230, 52, 98, 0.12);
      animation: cValFadeIn 0.14s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .c-val-popover::before {
      content: "";
      position: absolute;
      top: -5px;
      left: 16px;
      width: 9px;
      height: 9px;
      background: #ffffff;
      border-left: 1px solid rgba(230, 52, 98, 0.35);
      border-top: 1px solid rgba(230, 52, 98, 0.35);
      transform: rotate(45deg);
    }
    .c-val-popover.above::before {
      top: auto;
      bottom: -5px;
      border-left: none;
      border-top: none;
      border-right: 1px solid rgba(230, 52, 98, 0.35);
      border-bottom: 1px solid rgba(230, 52, 98, 0.35);
    }
    .c-val-icon {
      width: 18px;
      height: 18px;
      border-radius: 6px;
      background: #e63462;
      color: #ffffff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 11.5px;
      font-weight: 800;
      flex-shrink: 0;
    }
    @keyframes cValFadeIn {
      from { opacity: 0; transform: translateY(-4px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `
  document.head.appendChild(style)
}

export function clearCustomFieldValidation() {
  if (activeTimer) {
    clearTimeout(activeTimer)
    activeTimer = null
  }
  if (activeInvalidEl) {
    activeInvalidEl.classList.remove("c-field-invalid")
    activeInvalidEl = null
  }
  if (typeof document !== "undefined") {
    document.getElementById(POPOVER_ID)?.remove()
  }
}

function getTurkishValidationMessage(el: ValidatableElement): string {
  const v = el.validity
  if (!v) return "Lütfen bu alanı kontrol edin."
  if (v.valueMissing) {
    if (
      el instanceof HTMLInputElement &&
      (el.type === "checkbox" || el.type === "radio")
    ) {
      return "Lütfen devam etmek için bu seçeneği işaretleyin."
    }
    return "Lütfen bu alanı doldurun."
  }
  if (v.typeMismatch) {
    if (el instanceof HTMLInputElement && el.type === "email") {
      return "Lütfen geçerli bir e-posta adresi girin."
    }
    if (el instanceof HTMLInputElement && el.type === "url") {
      return "Lütfen geçerli bir bağlantı (URL) girin."
    }
    return "Lütfen geçerli bir değer girin."
  }
  if (
    v.tooShort &&
    (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
  ) {
    return `Lütfen en az ${el.minLength} karakter girin.`
  }
  if (
    v.tooLong &&
    (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
  ) {
    return `Lütfen en fazla ${el.maxLength} karakter girin.`
  }
  if (v.rangeUnderflow && el instanceof HTMLInputElement) {
    return `Değer en az ${el.min} olmalıdır.`
  }
  if (v.rangeOverflow && el instanceof HTMLInputElement) {
    return `Değer en fazla ${el.max} olmalıdır.`
  }
  if (v.stepMismatch || v.badInput) {
    return "Lütfen geçerli bir sayı girin."
  }
  if (v.patternMismatch) {
    return el.getAttribute("title") || "Lütfen istenen formatta girin."
  }
  return el.validationMessage || "Lütfen bu alanı kontrol edin."
}

export function showCustomFieldValidation(
  el: ValidatableElement,
  message?: string
) {
  if (typeof document === "undefined" || !el) return
  ensureValidationStyles()
  clearCustomFieldValidation()

  activeInvalidEl = el
  el.classList.add("c-field-invalid")
  if (typeof el.focus === "function") {
    el.focus({ preventScroll: true })
  }

  const pop = document.createElement("div")
  pop.id = POPOVER_ID
  pop.className = "c-val-popover"

  const icon = document.createElement("span")
  icon.className = "c-val-icon"
  icon.textContent = "!"

  const text = document.createElement("span")
  text.textContent = message || getTurkishValidationMessage(el)

  pop.appendChild(icon)
  pop.appendChild(text)
  document.body.appendChild(pop)

  const rect = el.getBoundingClientRect()
  const popRect = pop.getBoundingClientRect()
  const placeAbove =
    window.innerHeight - rect.bottom < popRect.height + 16 &&
    rect.top > popRect.height + 16
  if (placeAbove) {
    pop.classList.add("above")
  }
  const top = placeAbove
    ? Math.max(8, rect.top - popRect.height - 8)
    : Math.min(window.innerHeight - popRect.height - 8, rect.bottom + 8)
  const left = Math.max(
    8,
    Math.min(rect.left, window.innerWidth - popRect.width - 8)
  )
  pop.style.top = `${top}px`
  pop.style.left = `${left}px`

  activeTimer = setTimeout(() => {
    clearCustomFieldValidation()
  }, 4200)
}

export function installCustomFormValidation() {
  if (installed || typeof document === "undefined") return
  installed = true
  ensureValidationStyles()

  let queuedEl: ValidatableElement | null = null

  document.addEventListener(
    "invalid",
    (e) => {
      e.preventDefault()
      const target = e.target
      if (
        !(
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement
        )
      ) {
        return
      }
      if (!queuedEl) {
        queuedEl = target
        queueMicrotask(() => {
          const first = queuedEl
          queuedEl = null
          if (first) {
            showCustomFieldValidation(first)
          }
        })
      }
    },
    true
  )

  document.addEventListener("input", () => clearCustomFieldValidation(), true)
  document.addEventListener("change", () => clearCustomFieldValidation(), true)
  document.addEventListener(
    "mousedown",
    () => clearCustomFieldValidation(),
    true
  )
  window.addEventListener("resize", () => clearCustomFieldValidation())
  window.addEventListener("scroll", () => clearCustomFieldValidation(), true)
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") clearCustomFieldValidation()
  })
}
