const MAX_UI_LOGS = 40

const state = {
  status: {},
  settings: { printers: [], categories: [], categoryRoutes: {}, authenticated: false, username: "", autoStartOnBoot: true },
  discoveredPrinters: [],
  queue: [],
  recentPrinted: [],
  logs: [],
  lastLogDigest: "",
  initializedForms: false,
}
const $ = (id) => document.getElementById(id)

function showToast(message, isError = false) {
  const container = $("toastContainer")
  while (container.childNodes.length >= 4) {
    container.firstChild.remove()
  }
  const el = document.createElement("div")
  el.className = "toast"
  if (isError) el.style.background = "#dc2626"
  el.textContent = message
  container.appendChild(el)
  setTimeout(() => el.remove(), 3000)
}

async function apiCall(url, options = {}) {
  const sessionToken = window.corderDesktop?.sessionToken || ""
  const headers = {
    "Content-Type": "application/json",
    ...(sessionToken ? { "X-Corder-Session": sessionToken } : {}),
    ...(options.headers || {}),
  }
  const res = await fetch(url, { credentials: "same-origin", ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.ok === false) throw new Error(data.error || `İstek başarısız (${res.status})`)
  return data
}

function switchTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tabId))
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${tabId}`))
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function renderAuthGateAndHeader() {
  const isAuth = Boolean(state.settings.authenticated)
  $("loginView").classList.toggle("hidden", isAuth)
  $("appShell").classList.toggle("hidden", !isAuth)
  if (!isAuth) return

  const pill = $("connectionPill")
  const text = $("connectionText")
  const rName = state.settings.restaurantName || state.status.restaurantName || ""
  const uname = state.settings.username || ""
  $("headerQueueCount").textContent = String(state.queue.length || 0)
  $("headerBranchInfo").textContent = rName
    ? `${rName}${uname ? ` • Kullanıcı: ${uname}` : ""}`
    : "Otomatik Fiş & Kategori Yönlendirme Sistemi"

  $("infoRestaurantName").textContent = rName || "Bağlı İşletme"
  $("infoUsername").textContent = `Kullanıcı: ${uname || "-"}`

  pill.className = "status-pill"
  if (state.status.socketConnected) {
    pill.classList.add("status-ok")
    text.textContent = rName ? `Bağlı: ${rName}` : "Canlı Bağlantı Aktif"
  } else {
    pill.classList.add("status-err")
    text.textContent = state.status.lastError ? `Yeniden Bağlanıyor (${state.status.lastError})` : "Sunucuya Bağlanıyor..."
  }
}

function printerLabel(p) {
  return String(p?.name || p?.systemPrinterName || p?.host || "Yazıcı").trim()
}

let activeModalResolver = null

function closeNicknameModal(result = null) {
  const modal = $("nicknameModal")
  if (modal) modal.classList.add("hidden")
  if (activeModalResolver) {
    const resolve = activeModalResolver
    activeModalResolver = null
    resolve(result)
  }
}

function askNicknameModal(title, defaultValue = "") {
  const modal = $("nicknameModal")
  const titleEl = $("nicknameModalTitle")
  const input = $("inputNicknameModal")
  if (!modal || !input) {
    return Promise.resolve(defaultValue || null)
  }
  if (activeModalResolver) {
    closeNicknameModal(null)
  }
  if (titleEl) titleEl.textContent = title || "Yazıcı Takma Adı"
  input.value = defaultValue || ""
  modal.classList.remove("hidden")
  setTimeout(() => {
    input.focus()
    input.select()
  }, 20)
  return new Promise((resolve) => {
    activeModalResolver = resolve
  })
}

function renderPrinters() {
  const printers = state.settings.printers || []
  $("printerCountBadge").textContent = `${printers.length} Yazıcı`
  const container = $("configuredPrintersList")
  if (!printers.length) {
    container.innerHTML = `<div class="empty-hint">Henüz yazıcı eklenmedi. Aşağıdan USB/Sistem veya Ağ (IP) yazıcısı ekleyebilirsiniz.</div>`
    return
  }
  container.innerHTML = printers
    .map((p) => {
      const isNet = p.mode === "network"
      const label = printerLabel(p)
      const hardware = isNet
        ? `${p.host || "?"}:${p.port || 9100}`
        : p.systemPrinterName || p.name || "-"
      const nextW = Number(p.paperWidth) === 58 ? 80 : 58
      return `<div class="printer-item">
        <div class="printer-meta">
          <div class="printer-title">
            <span>${escapeHtml(label)}</span>
            <span class="tag ${isNet ? "tag-net" : "tag-usb"}">${isNet ? "Ağ (IP:Port)" : "USB / Sistem"}</span>
            <span class="tag">${p.paperWidth || 80}mm</span>
          </div>
          <div class="printer-sub">Takma ad selectlerde görünür · Cihaz: <strong>${escapeHtml(hardware)}</strong></div>
        </div>
        <div class="btn-group">
          <button class="btn btn-secondary btn-sm" data-action="rename-printer" data-id="${escapeHtml(p.id)}">Takma Ad</button>
          <button class="btn btn-secondary btn-sm" data-action="toggle-width" data-id="${escapeHtml(p.id)}" data-width="${nextW}">${nextW}mm Yap</button>
          <button class="btn btn-primary btn-sm" data-action="test-print" data-id="${escapeHtml(p.id)}">Test Fişi Yazdır</button>
          <button class="btn btn-danger btn-sm" data-action="delete-printer" data-id="${escapeHtml(p.id)}">Sil</button>
        </div>
      </div>`
    })
    .join("")
}

function renderDiscoveredPrinters() {
  const container = $("discoveredPrintersList")
  const existing = new Set((state.settings.printers || []).filter((p) => p.mode === "system").map((p) => p.systemPrinterName))
  if (!state.discoveredPrinters.length) {
    container.innerHTML = `<div class="empty-hint">Sistemde tanımlı yazıcı bulunamadı veya henüz tarama yapılmadı.</div>`
    return
  }
  container.innerHTML = state.discoveredPrinters
    .map((dp) => {
      const added = existing.has(dp.name)
      return `<div class="discovered-item">
        <div class="printer-meta">
          <div class="printer-title"><span>${escapeHtml(dp.name)}</span>${dp.isDefault ? '<span class="tag">Varsayılan</span>' : ""}</div>
          <div class="printer-sub">${escapeHtml(dp.driverName || "Sistem Yazıcısı")} (${escapeHtml(dp.portName || "USB")})</div>
        </div>
        ${added ? '<span class="tag">Eklendi</span>' : `<button class="btn btn-primary btn-sm" data-action="use-system-printer" data-name="${escapeHtml(dp.name)}">+ Kullan</button>`}
      </div>`
    })
    .join("")
}

function renderRoutingDropdowns() {
  const printers = state.settings.printers || []
  const receiptSelect = $("selectReceiptPrinter")
  const kitchenSelect = $("selectDefaultKitchenPrinter")
  const printerOptions = printers
    .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(printerLabel(p))}</option>`)
    .join("")
  const optionsHtml = printers.length
    ? `${printerOptions}<option value="none">-- Bu Bilgisayarda Yazdırma (Kapalı) --</option>`
    : `<option value="">-- Önce Yazıcı Ekleyin --</option><option value="none">-- Bu Bilgisayarda Yazdırma (Kapalı) --</option>`
  receiptSelect.innerHTML = optionsHtml
  kitchenSelect.innerHTML = optionsHtml
  if (state.settings.receiptPrinterId) receiptSelect.value = state.settings.receiptPrinterId
  if (state.settings.defaultKitchenPrinterId) kitchenSelect.value = state.settings.defaultKitchenPrinterId

  const catContainer = $("categoryRoutingList")
  const categories = state.settings.categories || []
  const routes = state.settings.categoryRoutes || {}
  if (!categories.length) {
    catContainer.innerHTML = `<div class="empty-hint">Henüz kategori tanımlanmamış. "Kategorileri Yenile" butonuna basarak menü kategorilerinizi güncelleyebilirsiniz.</div>`
    return
  }

  const parents = categories.filter((c) => !c.parentId).sort((a, b) => (a.order || 0) - (b.order || 0))
  const ordered = []
  for (const p of parents) {
    ordered.push({ ...p, isSub: false })
    categories
      .filter((c) => c.parentId === p.id)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .forEach((s) => ordered.push({ ...s, isSub: true }))
  }
  const seen = new Set(ordered.map((r) => r.id))
  categories.forEach((c) => {
    if (!seen.has(c.id)) ordered.push({ ...c, isSub: Boolean(c.parentId) })
  })

  catContainer.innerHTML = ordered
    .map((cat) => {
      const selectedId = routes[cat.id] || ""
      const opts = [
        `<option value="">Varsayılan Mutfak Yazıcısı</option>`,
        ...printers.map((p) => `<option value="${escapeHtml(p.id)}" ${p.id === selectedId ? "selected" : ""}>${escapeHtml(printerLabel(p))}</option>`),
        `<option value="none" ${selectedId === "none" ? "selected" : ""}>-- Bu Bilgisayarda Yazdırma --</option>`,
      ].join("")
      return `<div class="category-row ${cat.isSub ? "sub-category" : ""}">
        <span class="category-name">${cat.isSub ? "↳ " : ""}${escapeHtml(cat.name)}</span>
        <select class="category-select" data-category-id="${escapeHtml(cat.id)}">${opts}</select>
      </div>`
    })
    .join("")
}

function renderQueueAndLogs() {
  $("pendingQueueContainer").innerHTML = state.queue.length
    ? state.queue
        .slice(0, 20)
        .map(
          (item) => `<div class="queue-row">
        <div><strong>Masa: ${escapeHtml(item.tableName || "-")}</strong> &bull; ${escapeHtml(item.printType || "kitchen")}
        <div class="printer-sub">Deneme: ${item.retryCount || 0} | Hata: ${escapeHtml(item.lastError || "-")}</div></div>
        <span class="tag">${escapeHtml(item.targetPrinter?.name || item.targetPrinterName || "Varsayılan")}</span>
      </div>`,
        )
        .join("")
    : `<div class="empty-hint">Bekleyen fiş yok. Tüm siparişler anında yazdırıldı.</div>`

  $("recentPrintedContainer").innerHTML = state.recentPrinted.length
    ? state.recentPrinted
        .slice(0, 12)
        .map(
          (item) => `<div class="queue-row">
        <div><strong>Masa: ${escapeHtml(item.tableName)}</strong> (${escapeHtml(item.printType)})
        <div class="printer-sub">${new Date(item.printedAt).toLocaleTimeString("tr-TR")} &bull; Yazıcı: ${escapeHtml(item.printerName)}</div></div>
        <span class="tag">${Number(item.total || 0).toFixed(2)} TL</span>
      </div>`,
        )
        .join("")
    : `<div class="empty-hint">Henüz yazdırılmış fiş kaydı bulunmuyor.</div>`

  const boundedLogs = state.logs.slice(0, MAX_UI_LOGS)
  const digest = boundedLogs.length
    ? `${boundedLogs.length}:${boundedLogs[0].timestamp}:${boundedLogs[0].repeatCount || 1}`
    : "empty"
  if (digest !== state.lastLogDigest) {
    state.lastLogDigest = digest
    $("logsContainer").innerHTML = boundedLogs.length
      ? boundedLogs
          .map((l) => {
            const repeatBadge = l.repeatCount > 1 ? ` (x${l.repeatCount})` : ""
            return `<div class="log-line log-${escapeHtml(l.level)}">[${new Date(l.timestamp).toLocaleTimeString("tr-TR")}] ${escapeHtml(l.level)}${repeatBadge}: ${escapeHtml(l.message)} ${l.meta ? escapeHtml(l.meta) : ""}</div>`
          })
          .join("")
      : `<div class="log-line">Günlük kaydı temiz.</div>`
  }
}

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

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".tab-btn").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)))

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
      if (!name) {
        showToast("Takma ad boş olamaz", true)
        return
      }
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
    const nickRaw = await askNicknameModal(
      `Yazıcı Ekle (${sysName})`,
      sysName,
    )
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
      box.textContent = res.ok ? `Bağlantı Başarılı! (${res.latencyMs}ms)` : `Bağlantı Başarısız: ${res.error}`
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
      await apiCall("/api/printers", { method: "POST", body: JSON.stringify({ name, mode: "network", host, port, paperWidth }) })
      e.target.reset()
      $("netPrinterPort").value = "9100"
      showToast(`"${name}" ağ yazıcısı eklendi`)
      await loadState(true)
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

  loadState(true)
  setInterval(() => loadState(false), 3500)
})
