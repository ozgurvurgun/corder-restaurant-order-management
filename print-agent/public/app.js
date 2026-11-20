/* global MAX_UI_LOGS, state, $, showToast, apiCall, switchTab, renderAuthGateAndHeader,
   printerLabel, activeModalResolver, closeNicknameModal, askNicknameModal,
   renderPrinters, renderDiscoveredPrinters, renderRoutingDropdowns, renderQueueAndLogs,
   upgradeAllCustomSelects, closeAllCustomSelects */

async function loadState(rerenderAll = false) {
  try {
    const data = await apiCall("/api/state")
    const changed =
      rerenderAll ||
      state.settings.authenticated !== data.settings?.authenticated ||
      JSON.stringify(state.settings.printers) !== JSON.stringify(data.settings?.printers) ||
      JSON.stringify(state.settings.categories) !== JSON.stringify(data.settings?.categories) ||
      JSON.stringify(state.settings.categoryRoutes) !== JSON.stringify(data.settings?.categoryRoutes)

    state.status = data.status || {}
    state.settings = data.settings || {}
    state.queue = (data.queue || []).slice(0, 30)
    state.recentPrinted = (data.recentPrinted || []).slice(0, 15)
    state.logs = (data.logs || []).slice(0, MAX_UI_LOGS)

    if (!state.initializedForms) {
      state.initializedForms = true
      $("inputUsername").value = state.settings.username || ""
      $("inputFooterLine").value = formatTitleCase(state.settings.printFooterLine || "")
      $("inputUsbDrainMs").value = state.settings.printUsbDrainMs ?? 400
      $("inputAutoStartOnBoot").checked = state.settings.autoStartOnBoot !== false
    }
    renderAuthGateAndHeader()
    if (state.settings.authenticated) {
      renderQueueAndLogs()
      if (changed) {
        renderPrinters()
        renderDiscoveredPrinters()
        renderDiscoveredNetworkPrinters()
        renderRoutingDropdowns()
      }
      if (!state.initialDiscoveryRun) {
        state.initialDiscoveryRun = true
        void scanAllPrintersSilently()
      }
    }
  } catch (e) {
    console.error(e)
  }
}

async function scanAllPrintersSilently() {
  try {
    const sysData = await apiCall("/api/discover-printers")
    state.discoveredPrinters = sysData.printers || []
    renderDiscoveredPrinters()
  } catch {
    // ignore background scan errors
  }
  try {
    const netData = await apiCall("/api/discover-network-printers", {
      method: "POST",
      body: JSON.stringify({ port: 9100 }),
    })
    state.discoveredNetworkPrinters = netData.printers || []
    state.scannedSubnets = netData.scannedSubnets || []
    state.networkScanCompleted = true
    renderDiscoveredNetworkPrinters()
  } catch {
    // ignore background scan errors
  }
}

function bindModalEvents() {
  const formNickname = $("formNicknameModal")
  if (formNickname) {
    formNickname.addEventListener("submit", (e) => {
      e.preventDefault()
      const val = ($("inputNicknameModal")?.value || "").trim()
      if (!val) {
        showToast("Takma ad boş olamaz", true)
        return
      }
      closeNicknameModal(val)
    })
  }
  const btnNicknameCancel = $("btnNicknameCancel")
  if (btnNicknameCancel) {
    btnNicknameCancel.addEventListener("click", () => closeNicknameModal(null))
  }
  const nicknameModal = $("nicknameModal")
  if (nicknameModal) {
    nicknameModal.addEventListener("click", (e) => {
      if (e.target === nicknameModal) closeNicknameModal(null)
    })
  }
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && activeModalResolver) {
      closeNicknameModal(null)
    }
  })
}

function bindAuthEvents() {
  $("formLogin").addEventListener("submit", async (e) => {
    e.preventDefault()
    const errBox = $("loginErrorBox")
    const submitBtn = $("btnLoginSubmit")
    errBox.classList.add("hidden")
    submitBtn.disabled = true
    submitBtn.textContent = "Giriş Yapılıyor..."
    try {
      const res = await apiCall("/api/login", {
        method: "POST",
        body: JSON.stringify({
          username: $("inputUsername").value.trim(),
          password: $("inputPassword").value,
        }),
      })
      $("inputPassword").value = ""
      $("inputFooterLine").value = formatTitleCase(res.settings?.printFooterLine || "")
      showToast(`Hoş geldiniz: ${formatTitleCase(res.settings?.restaurantName) || "Corder Print Agent"}`)
      await loadState(true)
    } catch (err) {
      errBox.textContent = err.message
      errBox.classList.remove("hidden")
    } finally {
      submitBtn.disabled = false
      submitBtn.textContent = "Giriş Yap"
    }
  })

  const doLogout = async () => {
    try {
      await apiCall("/api/logout", { method: "POST" })
      showToast("Oturum kapatıldı")
      await loadState(true)
    } catch (err) {
      showToast(err.message, true)
    }
  }
  $("btnLogoutTop").addEventListener("click", doLogout)
  if ($("btnLogoutSidebar")) $("btnLogoutSidebar").addEventListener("click", doLogout)
}

function bindPrinterManagementEvents() {
  $("configuredPrintersList").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]")
    if (!btn) return
    const action = btn.dataset.action
    const id = btn.dataset.id
    if (action === "rename-printer") {
      const p = (state.settings.printers || []).find((item) => item.id === id)
      if (!p) return
      const current = printerLabel(p)
      const next = await askNicknameModal("Yazıcı Takma Adını Düzenle", current)
      if (next == null) return
      const name = String(next).trim()
      if (!name) return showToast("Takma ad boş olamaz", true)
      if (name === current) return
      try {
        await apiCall("/api/printers", { method: "POST", body: JSON.stringify({ ...p, name }) })
        showToast(`Takma ad güncellendi: ${name}`)
        await loadState(true)
      } catch (err) {
        showToast(err.message, true)
      }
    } else if (action === "toggle-width") {
      const paperWidth = Number(btn.dataset.width) || 80
      const p = (state.settings.printers || []).find((item) => item.id === id)
      if (!p) return
      try {
        await apiCall("/api/printers", { method: "POST", body: JSON.stringify({ ...p, paperWidth }) })
        showToast(`${printerLabel(p)} kağıt genişliği ${paperWidth}mm yapıldı`)
        await loadState(true)
      } catch (err) {
        showToast(err.message, true)
      }
    } else if (action === "test-print") {
      try {
        showToast("Test fişi gönderiliyor...")
        await apiCall("/api/test-print", { method: "POST", body: JSON.stringify({ printerId: id }) })
        showToast("Test fişi başarıyla yazdırıldı!")
        await loadState(false)
      } catch (err) {
        showToast(`Yazdırma hatası: ${err.message}`, true)
      }
    } else if (action === "delete-printer") {
      try {
        await apiCall(`/api/printers/${encodeURIComponent(id)}`, { method: "DELETE" })
        showToast("Yazıcı kaldırıldı")
        await loadState(true)
      } catch (err) {
        showToast(err.message, true)
      }
    }
  })

  $("discoveredPrintersList").addEventListener("click", async (e) => {
    const btn = e.target.closest('button[data-action="use-system-printer"]')
    if (!btn) return
    const sysName = btn.dataset.name
    const nickRaw = await askNicknameModal(`Yazıcı Ekle (${sysName})`, sysName)
    if (nickRaw == null) return
    const name = String(nickRaw).trim() || sysName
    try {
      await apiCall("/api/printers", {
        method: "POST",
        body: JSON.stringify({ name, mode: "system", systemPrinterName: sysName, paperWidth: 80 }),
      })
      showToast(`"${name}" eklendi (${sysName})`)
      await loadState(true)
    } catch (err) {
      showToast(err.message, true)
    }
  })

  $("btnDiscoverPrinters").addEventListener("click", async () => {
    try {
      showToast("Bilgisayardaki yazıcılar taranıyor...")
      const data = await apiCall("/api/discover-printers")
      state.discoveredPrinters = data.printers || []
      renderDiscoveredPrinters()
      showToast(`${state.discoveredPrinters.length} sistem yazıcısı bulundu`)
    } catch (e) {
      showToast(e.message, true)
    }
  })

  if ($("btnDiscoverNetworkPrinters")) {
    $("btnDiscoverNetworkPrinters").addEventListener("click", async () => {
      const btn = $("btnDiscoverNetworkPrinters")
      btn.disabled = true
      btn.textContent = "Ağ Taranıyor..."
      try {
        showToast("Yerel ağdaki termal yazıcılar taranıyor...")
        const data = await apiCall("/api/discover-network-printers", {
          method: "POST",
          body: JSON.stringify({ port: 9100 }),
        })
        state.discoveredNetworkPrinters = data.printers || []
        state.scannedSubnets = data.scannedSubnets || []
        state.networkScanCompleted = true
        renderDiscoveredNetworkPrinters()
        showToast(`${state.discoveredNetworkPrinters.length} ağ yazıcısı bulundu`)
      } catch (e) {
        showToast(e.message, true)
      } finally {
        btn.disabled = false
        btn.textContent = "Ağdaki Yazıcıları Tara"
      }
    })
  }

  if ($("discoveredNetworkPrintersList")) {
    $("discoveredNetworkPrintersList").addEventListener("click", async (e) => {
      const btn = e.target.closest('button[data-action="use-network-printer"]')
      if (!btn) return
      const host = btn.dataset.host
      const port = Number(btn.dataset.port) || 9100
      const mac = btn.dataset.mac || ""
      const nickRaw = await askNicknameModal(`Ağ Yazıcısı Ekle (${host}:${port})`, `Mutfak`)
      if (nickRaw == null) return
      const name = String(nickRaw).trim() || `Yazıcı (${host})`
      try {
        await apiCall("/api/printers", {
          method: "POST",
          body: JSON.stringify({ name, mode: "network", host, port, mac, paperWidth: 80 }),
        })
        showToast(`"${name}" ağ yazıcısı eklendi (${host}:${port})`)
        await loadState(true)
      } catch (err) {
        showToast(err.message, true)
      }
    })
  }
}

function bindRoutingAndQueueEvents() {
  $("categoryRoutingList").addEventListener("change", async (e) => {
    const sel = e.target.closest("select[data-category-id]")
    if (!sel) return
    const categoryId = sel.dataset.categoryId
    const printerId = sel.value
    const nextRoutes = { ...(state.settings.categoryRoutes || {}) }
    if (printerId) nextRoutes[categoryId] = printerId
    else delete nextRoutes[categoryId]
    try {
      await apiCall("/api/routes", { method: "POST", body: JSON.stringify({ categoryRoutes: nextRoutes }) })
      state.settings.categoryRoutes = nextRoutes
      showToast("Kategori yönlendirmesi kaydedildi")
    } catch (err) {
      showToast(err.message, true)
    }
  })

  const saveDefaults = async () => {
    try {
      await apiCall("/api/routes", {
        method: "POST",
        body: JSON.stringify({
          receiptPrinterId: $("selectReceiptPrinter").value,
          defaultKitchenPrinterId: $("selectDefaultKitchenPrinter").value,
        }),
      })
      showToast("Temel yazıcı yönlendirmesi kaydedildi")
      await loadState(true)
    } catch (e) {
      showToast(e.message, true)
    }
  }
  $("selectReceiptPrinter").addEventListener("change", saveDefaults)
  $("selectDefaultKitchenPrinter").addEventListener("change", saveDefaults)

  $("btnRefreshCategories").addEventListener("click", async () => {
    try {
      showToast("Kategoriler yenileniyor...")
      const res = await apiCall("/api/sync-context", { method: "POST" })
      showToast(`Kategoriler güncellendi (${res.settings?.categories?.length || 0} kategori)`)
      await loadState(true)
    } catch (e) {
      showToast(e.message, true)
    }
  })

  $("formTicketSettings").addEventListener("submit", async (e) => {
    e.preventDefault()
    try {
      await apiCall("/api/routes", {
        method: "POST",
        body: JSON.stringify({
          printFooterLine: formatTitleCase($("inputFooterLine").value.trim()),
          printUsbDrainMs: Number($("inputUsbDrainMs").value) || 0,
          autoStartOnBoot: $("inputAutoStartOnBoot").checked,
        }),
      })
      $("inputFooterLine").value = formatTitleCase($("inputFooterLine").value.trim())
      showToast("Ayarlar kaydedildi")
      await loadState(true)
    } catch (err) {
      showToast(err.message, true)
    }
  })

  const flushNow = async () => {
    await apiCall("/api/queue/flush", { method: "POST" })
    showToast("Kuyruk yazdırma tetiklendi")
    await loadState(false)
  }
  $("btnFlushTop").addEventListener("click", flushNow)
  $("btnQueueFlush").addEventListener("click", flushNow)
  $("btnQueueClear").addEventListener("click", async () => {
    await apiCall("/api/queue/clear", { method: "POST" })
    showToast("Bekleyen kuyruk temizlendi")
    await loadState(false)
  })
  $("btnClearLogs").addEventListener("click", async () => {
    await apiCall("/api/logs/clear", { method: "POST" })
    state.lastLogDigest = ""
    await loadState(false)
  })
}

let activeInvalidEl = null
let activeValidationTimer = null

function clearCustomFieldValidation() {
  if (activeValidationTimer) {
    clearTimeout(activeValidationTimer)
    activeValidationTimer = null
  }
  if (activeInvalidEl) {
    activeInvalidEl.classList.remove("c-field-invalid")
    activeInvalidEl = null
  }
  const pop = document.getElementById("corder-validation-popover")
  if (pop) pop.remove()
}

function getTurkishValidationMessage(el) {
  const v = el.validity
  if (!v) return "Lütfen bu alanı kontrol edin."
  if (v.valueMissing) {
    if (el.type === "checkbox" || el.type === "radio") {
      return "Lütfen devam etmek için bu seçeneği işaretleyin."
    }
    return "Lütfen bu alanı doldurun."
  }
  if (v.typeMismatch) {
    if (el.type === "email") return "Lütfen geçerli bir e-posta adresi girin."
    if (el.type === "url") return "Lütfen geçerli bir bağlantı (URL) girin."
    return "Lütfen geçerli bir değer girin."
  }
  if (v.tooShort) return `Lütfen en az ${el.minLength} karakter girin.`
  if (v.tooLong) return `Lütfen en fazla ${el.maxLength} karakter girin.`
  if (v.rangeUnderflow) return `Değer en az ${el.min} olmalıdır.`
  if (v.rangeOverflow) return `Değer en fazla ${el.max} olmalıdır.`
  if (v.stepMismatch || v.badInput) return "Lütfen geçerli bir sayı girin."
  if (v.patternMismatch) return el.getAttribute("title") || "Lütfen istenen formatta girin."
  return el.validationMessage || "Lütfen bu alanı kontrol edin."
}

function showCustomFieldValidation(el, message) {
  if (!el) return
  clearCustomFieldValidation()
  activeInvalidEl = el
  el.classList.add("c-field-invalid")
  if (typeof el.focus === "function") el.focus({ preventScroll: true })

  const pop = document.createElement("div")
  pop.id = "corder-validation-popover"
  pop.className = "c-val-popover"
  pop.innerHTML = `<span class="c-val-icon">!</span><span>${escapeHtml(message)}</span>`
  document.body.appendChild(pop)

  const rect = el.getBoundingClientRect()
  const popRect = pop.getBoundingClientRect()
  const placeAbove = window.innerHeight - rect.bottom < popRect.height + 16 && rect.top > popRect.height + 16
  if (placeAbove) pop.classList.add("above")
  const top = placeAbove ? Math.max(8, rect.top - popRect.height - 8) : Math.min(window.innerHeight - popRect.height - 8, rect.bottom + 8)
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - popRect.width - 8))
  pop.style.top = `${top}px`
  pop.style.left = `${left}px`

  activeValidationTimer = setTimeout(() => clearCustomFieldValidation(), 4200)
}

function installCustomFormValidation() {
  let queuedInvalidEl = null
  document.addEventListener("invalid", (e) => {
    e.preventDefault()
    if (!queuedInvalidEl) {
      queuedInvalidEl = e.target
      queueMicrotask(() => {
        const target = queuedInvalidEl
        queuedInvalidEl = null
        if (target) showCustomFieldValidation(target, getTurkishValidationMessage(target))
      })
    }
  }, true)
  document.addEventListener("input", () => clearCustomFieldValidation(), true)
  document.addEventListener("change", () => clearCustomFieldValidation(), true)
  document.addEventListener("mousedown", () => clearCustomFieldValidation(), true)
}

document.addEventListener("DOMContentLoaded", () => {
  installCustomFormValidation()
  document.querySelectorAll(".tab-btn").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)))
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".c-select") && !e.target.closest(".c-select-menu")) closeAllCustomSelects()
  })
  const dismissPopovers = () => { closeAllCustomSelects(); clearCustomFieldValidation() }
  window.addEventListener("resize", dismissPopovers)
  window.addEventListener("scroll", dismissPopovers, true)
  window.addEventListener("keydown", (e) => { if (e.key === "Escape") dismissPopovers() })
  upgradeAllCustomSelects()
  bindModalEvents()
  bindAuthEvents()
  bindPrinterManagementEvents()
  bindRoutingAndQueueEvents()
  loadState(true)
  setInterval(() => loadState(false), 3500)
})
