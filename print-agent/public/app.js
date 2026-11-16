const state = {
  status: {},
  settings: { printers: [], categories: [], categoryRoutes: {} },
  discoveredPrinters: [],
  queue: [],
  recentPrinted: [],
  logs: [],
  initializedForms: false,
}
const $ = (id) => document.getElementById(id)

function showToast(message, isError = false) {
  const el = document.createElement("div")
  el.className = "toast"
  if (isError) el.style.background = "#dc2626"
  el.textContent = message
  $("toastContainer").appendChild(el)
  setTimeout(() => el.remove(), 3200)
}

async function apiCall(url, options = {}) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.ok === false) throw new Error(data.error || `İstek başarısız (${res.status})`)
  return data
}

function switchTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tabId))
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${tabId}`))
}

function escapeHtml(str) {
  return String(str ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")
}

function renderHeader() {
  const pill = $("connectionPill")
  const text = $("connectionText")
  const banner = $("setupBanner")
  const rName = state.settings.restaurantName || state.status.restaurantName || ""
  $("headerQueueCount").textContent = String(state.queue.length || 0)
  if (rName) $("headerBranchInfo").textContent = `Aktif Şube: ${rName} (${state.settings.backendUrl || ""})`

  pill.className = "status-pill"
  if (state.status.setupRequired || !state.settings.agentToken) {
    pill.classList.add("status-warn")
    text.textContent = "Kurulum Bekleniyor (Anahtar Girilmedi)"
    banner.classList.remove("hidden")
  } else if (state.status.socketConnected) {
    pill.classList.add("status-ok")
    text.textContent = rName ? `Bağlı: ${rName}` : "Sunucuya Bağlı (Canlı)"
    banner.classList.add("hidden")
  } else {
    pill.classList.add("status-err")
    text.textContent = state.status.lastError ? `Bağlantı Yok (${state.status.lastError})` : "Sunucuya Bağlanıyor..."
    banner.classList.add("hidden")
  }
}

function renderPrinters() {
  const printers = state.settings.printers || []
  $("printerCountBadge").textContent = `${printers.length} Yazıcı`
  const container = $("configuredPrintersList")
  if (!printers.length) {
    container.innerHTML = `<div class="empty-hint">Henüz yazıcı eklenmedi. Aşağıdan USB veya Ağ (IP) yazıcısı ekleyebilirsiniz.</div>`
    return
  }
  container.innerHTML = printers
    .map((p) => {
      const isNet = p.mode === "network"
      const targetText = isNet ? `${escapeHtml(p.host)}:${escapeHtml(p.port)}` : escapeHtml(p.systemPrinterName || p.name)
      const nextW = Number(p.paperWidth) === 58 ? 80 : 58
      return `<div class="printer-item">
        <div class="printer-meta">
          <div class="printer-title">
            <span>${escapeHtml(p.name)}</span>
            <span class="tag ${isNet ? "tag-net" : "tag-usb"}">${isNet ? "Ağ (IP:Port)" : "USB / Sistem"}</span>
            <span class="tag">${p.paperWidth || 80}mm</span>
          </div>
          <div class="printer-sub">Hedef: <strong>${targetText}</strong></div>
        </div>
        <div class="btn-group">
          <button class="btn btn-secondary btn-sm" onclick="togglePrinterWidth('${escapeHtml(p.id)}', ${nextW})">${nextW}mm Yap</button>
          <button class="btn btn-primary btn-sm" onclick="testPrint('${escapeHtml(p.id)}')">Test Fişi Yazdır</button>
          <button class="btn btn-danger btn-sm" onclick="deletePrinter('${escapeHtml(p.id)}')">Sil</button>
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
        ${added ? '<span class="tag">Eklendi</span>' : `<button class="btn btn-primary btn-sm" onclick="useSystemPrinter('${escapeHtml(dp.name)}')">+ Kullan</button>`}
      </div>`
    })
    .join("")
}

function renderRoutingDropdowns() {
  const printers = state.settings.printers || []
  const receiptSelect = $("selectReceiptPrinter")
  const kitchenSelect = $("selectDefaultKitchenPrinter")
  const optionsHtml = printers.length
    ? printers.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join("")
    : `<option value="">-- Önce Yazıcı Ekleyin --</option>`
  receiptSelect.innerHTML = optionsHtml
  kitchenSelect.innerHTML = optionsHtml
  if (state.settings.receiptPrinterId) receiptSelect.value = state.settings.receiptPrinterId
  if (state.settings.defaultKitchenPrinterId) kitchenSelect.value = state.settings.defaultKitchenPrinterId

  const catContainer = $("categoryRoutingList")
  const categories = state.settings.categories || []
  const routes = state.settings.categoryRoutes || {}
  if (!categories.length) {
    catContainer.innerHTML = `<div class="empty-hint">Henüz kategori listesi çekilmedi. "Şubeden Kategorileri Yenile" butonuna basarak menü kategorilerinizi getirebilirsiniz.</div>`
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
        ...printers.map((p) => `<option value="${escapeHtml(p.id)}" ${p.id === selectedId ? "selected" : ""}>${escapeHtml(p.name)}</option>`),
      ].join("")
      return `<div class="category-row ${cat.isSub ? "sub-category" : ""}">
        <span class="category-name">${cat.isSub ? "↳ " : ""}${escapeHtml(cat.name)}</span>
        <select class="category-select" onchange="updateCategoryRoute('${escapeHtml(cat.id)}', this.value)">${opts}</select>
      </div>`
    })
    .join("")
}

function renderQueueAndLogs() {
  $("pendingQueueContainer").innerHTML = state.queue.length
    ? state.queue
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

  $("logsContainer").innerHTML = state.logs
    .slice(0, 80)
    .map(
      (l) =>
        `<div class="log-line log-${escapeHtml(l.level)}">[${new Date(l.timestamp).toLocaleTimeString("tr-TR")}] ${escapeHtml(l.level)}: ${escapeHtml(l.message)} ${l.meta ? escapeHtml(JSON.stringify(l.meta)) : ""}</div>`,
    )
    .join("")
}

async function loadState(rerenderAll = false) {
  try {
    const data = await apiCall("/api/state")
    const changed =
      rerenderAll ||
      JSON.stringify(state.settings.printers) !== JSON.stringify(data.settings?.printers) ||
      JSON.stringify(state.settings.categories) !== JSON.stringify(data.settings?.categories) ||
      JSON.stringify(state.settings.categoryRoutes) !== JSON.stringify(data.settings?.categoryRoutes)

    state.status = data.status || {}
    state.settings = data.settings || {}
    state.queue = data.queue || []
    state.recentPrinted = data.recentPrinted || []
    state.logs = data.logs || []

    if (!state.initializedForms) {
      state.initializedForms = true
      $("inputBackendUrl").value = state.settings.backendUrl || "https://api.corders.uk"
      $("inputAgentToken").value = state.settings.agentToken || ""
      $("inputFooterLine").value = state.settings.printFooterLine || ""
      $("inputTicketStamp").value = state.settings.printTicketStamp || ""
      $("inputUsbDrainMs").value = state.settings.printUsbDrainMs ?? 600
    }
    renderHeader()
    renderQueueAndLogs()
    if (changed) {
      renderPrinters()
      renderDiscoveredPrinters()
      renderRoutingDropdowns()
    }
  } catch (e) {
    console.error(e)
  }
}

window.useSystemPrinter = async (sysName) => {
  try {
    await apiCall("/api/printers", { method: "POST", body: JSON.stringify({ name: sysName, mode: "system", systemPrinterName: sysName, paperWidth: 80 }) })
    showToast(`"${sysName}" yazıcısı eklendi`)
    await loadState(true)
  } catch (e) { showToast(e.message, true) }
}

window.togglePrinterWidth = async (printerId, paperWidth) => {
  const p = (state.settings.printers || []).find((item) => item.id === printerId)
  if (!p) return
  try {
    await apiCall("/api/printers", { method: "POST", body: JSON.stringify({ ...p, paperWidth }) })
    showToast(`${p.name} kağıt genişliği ${paperWidth}mm yapıldı`)
    await loadState(true)
  } catch (e) { showToast(e.message, true) }
}

window.testPrint = async (printerId) => {
  try {
    showToast("Test fişi gönderiliyor...")
    await apiCall("/api/test-print", { method: "POST", body: JSON.stringify({ printerId }) })
    showToast("Test fişi başarıyla yazdırıldı!")
    await loadState(false)
  } catch (e) { showToast(`Yazdırma hatası: ${e.message}`, true) }
}

window.deletePrinter = async (printerId) => {
  try {
    await apiCall(`/api/printers/${encodeURIComponent(printerId)}`, { method: "DELETE" })
    showToast("Yazıcı kaldırıldı")
    await loadState(true)
  } catch (e) { showToast(e.message, true) }
}

window.updateCategoryRoute = async (categoryId, printerId) => {
  const nextRoutes = { ...(state.settings.categoryRoutes || {}) }
  if (printerId) nextRoutes[categoryId] = printerId
  else delete nextRoutes[categoryId]
  try {
    await apiCall("/api/routes", { method: "POST", body: JSON.stringify({ categoryRoutes: nextRoutes }) })
    state.settings.categoryRoutes = nextRoutes
    showToast("Kategori yönlendirmesi kaydedildi")
  } catch (e) { showToast(e.message, true) }
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".tab-btn").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)))
  $("btnGoSetup").addEventListener("click", () => switchTab("connection"))

  $("btnDiscoverPrinters").addEventListener("click", async () => {
    try {
      showToast("Bilgisayardaki yazıcılar taranıyor...")
      const data = await apiCall("/api/discover-printers")
      state.discoveredPrinters = data.printers || []
      renderDiscoveredPrinters()
      showToast(`${state.discoveredPrinters.length} sistem yazıcısı bulundu`)
    } catch (e) { showToast(e.message, true) }
  })

  $("btnTestIp").addEventListener("click", async () => {
    const host = $("netPrinterHost").value.trim()
    const port = Number($("netPrinterPort").value) || 9100
    const box = $("ipTestResult")
    box.className = "inline-feedback status-warn"
    box.textContent = `${host}:${port} bağlantısı test ediliyor...`
    box.classList.remove("hidden")
    try {
      const res = await fetch("/api/test-network", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ host, port }) }).then((r) => r.json())
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
    } catch (err) { showToast(err.message, true) }
  })

  const saveDefaults = async () => {
    try {
      await apiCall("/api/routes", { method: "POST", body: JSON.stringify({ receiptPrinterId: $("selectReceiptPrinter").value, defaultKitchenPrinterId: $("selectDefaultKitchenPrinter").value }) })
      showToast("Temel yazıcı yönlendirmesi kaydedildi")
      await loadState(true)
    } catch (e) { showToast(e.message, true) }
  }
  $("selectReceiptPrinter").addEventListener("change", saveDefaults)
  $("selectDefaultKitchenPrinter").addEventListener("change", saveDefaults)

  const syncBranchContext = async (backendUrl, agentToken) => {
    showToast("Şube bilgileri ve kategoriler çekiliyor...")
    const res = await apiCall("/api/connect", { method: "POST", body: JSON.stringify({ backendUrl, agentToken }) })
    showToast(`Bağlandı: ${res.context?.restaurant?.name || "Şube"} (${res.context?.categories?.length || 0} kategori)`)
    await loadState(true)
  }

  $("btnRefreshCategories").addEventListener("click", () => syncBranchContext(state.settings.backendUrl, state.settings.agentToken).catch((e) => showToast(e.message, true)))
  $("formConnectBranch").addEventListener("submit", async (e) => {
    e.preventDefault()
    try {
      await syncBranchContext($("inputBackendUrl").value.trim(), $("inputAgentToken").value.trim())
      switchTab("workspace")
    } catch (err) { showToast(`Bağlantı hatası: ${err.message}`, true) }
  })

  $("formTicketSettings").addEventListener("submit", async (e) => {
    e.preventDefault()
    try {
      await apiCall("/api/routes", { method: "POST", body: JSON.stringify({ printFooterLine: $("inputFooterLine").value.trim(), printTicketStamp: $("inputTicketStamp").value.trim(), printUsbDrainMs: Number($("inputUsbDrainMs").value) || 0 }) })
      showToast("Fiş ayarları kaydedildi")
      await loadState(true)
    } catch (err) { showToast(err.message, true) }
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
    await loadState(false)
  })

  loadState(true)
  setInterval(() => loadState(false), 3500)
})
