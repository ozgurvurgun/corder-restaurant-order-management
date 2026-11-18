/* global MAX_UI_LOGS, state, $, showToast, apiCall, switchTab, renderAuthGateAndHeader,
   printerLabel, activeModalResolver, closeNicknameModal, askNicknameModal,
   renderPrinters, renderDiscoveredPrinters, renderRoutingDropdowns, renderQueueAndLogs */

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
      $("inputFooterLine").value = state.settings.printFooterLine || ""
      $("inputTicketStamp").value = state.settings.printTicketStamp || ""
      $("inputUsbDrainMs").value = state.settings.printUsbDrainMs ?? 400
      $("inputAutoStartOnBoot").checked = state.settings.autoStartOnBoot !== false
    }
    renderAuthGateAndHeader()
    if (state.settings.authenticated) {
      renderQueueAndLogs()
      if (changed) {
        renderPrinters()
        renderDiscoveredPrinters()
        renderRoutingDropdowns()
      }
    }
  } catch (e) {
    console.error(e)
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
      $("inputFooterLine").value = res.settings?.printFooterLine || ""
      showToast(`Hoş geldiniz: ${res.settings?.restaurantName || "Corder Print Agent"}`)
      await loadState(true)
    } catch (err) {
      errBox.textContent = err.message
      errBox.classList.remove("hidden")
    } finally {
      submitBtn.disabled = false
      submitBtn.textContent = "Giriş Yap"
    }
  })

  $("btnLogoutTop").addEventListener("click", async () => {
    try {
      await apiCall("/api/logout", { method: "POST" })
      showToast("Oturum kapatıldı")
      await loadState(true)
    } catch (err) {
      showToast(err.message, true)
    }
  })
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

  $("btnTestIp").addEventListener("click", async () => {
    const host = $("netPrinterHost").value.trim()
    const port = Number($("netPrinterPort").value) || 9100
    const box = $("ipTestResult")
    box.className = "inline-feedback status-warn"
    box.textContent = `${host}:${port} bağlantısı test ediliyor...`
    box.classList.remove("hidden")
    try {
      const res = await apiCall("/api/test-network", {
        method: "POST",
        body: JSON.stringify({ host, port }),
      })
      box.className = `inline-feedback ${res.ok ? "status-ok" : "status-err"}`
      box.textContent = res.ok
        ? `Bağlantı Başarılı! (${res.latencyMs}ms)`
        : `Bağlantı Başarısız: ${res.error}`
    } catch (e) {
      box.className = "inline-feedback status-err"
      box.textContent = `Hata: ${e.message}`
    }
  })

  $("formAddNetworkPrinter").addEventListener("submit", async (e) => {
    e.preventDefault()
    const name = $("netPrinterName").value.trim()
    const host = $("netPrinterHost").value.trim()
    const port = Number($("netPrinterPort").value) || 9100
    const paperWidth = Number($("netPrinterWidth").value) || 80
    try {
      await apiCall("/api/printers", {
        method: "POST",
        body: JSON.stringify({ name, mode: "network", host, port, paperWidth }),
      })
      e.target.reset()
      $("netPrinterPort").value = "9100"
      showToast(`"${name}" ağ yazıcısı eklendi`)
      await loadState(true)
    } catch (err) {
      showToast(err.message, true)
    }
  })
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
          printFooterLine: $("inputFooterLine").value.trim(),
          printTicketStamp: $("inputTicketStamp").value.trim(),
          printUsbDrainMs: Number($("inputUsbDrainMs").value) || 0,
          autoStartOnBoot: $("inputAutoStartOnBoot").checked,
        }),
      })
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

document.addEventListener("DOMContentLoaded", () => {
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)))
  bindModalEvents()
  bindAuthEvents()
  bindPrinterManagementEvents()
  bindRoutingAndQueueEvents()
  loadState(true)
  setInterval(() => loadState(false), 3500)
})
