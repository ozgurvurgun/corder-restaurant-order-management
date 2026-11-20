const MAX_UI_LOGS = 40

const state = {
  status: {},
  settings: {
    printers: [],
    categories: [],
    categoryRoutes: {},
    authenticated: false,
    username: "",
    autoStartOnBoot: true,
  },
  discoveredPrinters: [],
  discoveredNetworkPrinters: [],
  scannedSubnets: [],
  networkScanCompleted: false,
  initialDiscoveryRun: false,
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
  if (window.corderDesktop?.invokeApi) {
    const method = String(options.method || "GET").toUpperCase()
    const body = options.body ? JSON.parse(options.body) : {}
    const data = await window.corderDesktop.invokeApi(method, url, body)
    if (!data || data.ok === false) {
      throw new Error(data?.error || "İstek başarısız")
    }
    return data
  }
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
  closeAllCustomSelects()
  let activeTitle = "Yazıcılar & Kategori Eşleştirme"
  document.querySelectorAll(".tab-btn").forEach((b) => {
    const isTarget = b.dataset.tab === tabId
    b.classList.toggle("active", isTarget)
    if (isTarget && b.dataset.title) activeTitle = b.dataset.title
  })
  const heading = $("activePageHeading")
  if (heading) heading.textContent = activeTitle
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${tabId}`))
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

const TURKIC_CHAR_RE = /[çğıöşüÇĞİÖŞÜ]/u

function formatTitleCase(input, locale) {
  if (input === undefined || input === null) return ""
  const raw = String(input).trim().replace(/\s+/g, " ")
  if (!raw) return ""
  const resolvedLocale = locale || (TURKIC_CHAR_RE.test(raw) ? "tr" : undefined)
  const normalized = (
    resolvedLocale ? raw.toLocaleLowerCase(resolvedLocale) : raw.toLowerCase()
  ).replace(/\u0307/g, "")
  return normalized.replace(
    /([^\p{L}']|^)(\p{L})/gu,
    (_m, sep, ch) => `${sep}${resolvedLocale ? ch.toLocaleUpperCase(resolvedLocale) : ch.toUpperCase()}`,
  )
}

function renderAuthGateAndHeader() {
  const isAuth = Boolean(state.settings.authenticated)
  $("loginView").classList.toggle("hidden", isAuth)
  $("appShell").classList.toggle("hidden", !isAuth)
  if (!isAuth) return

  const pill = $("connectionPill")
  const text = $("connectionText")
  const rName = formatTitleCase(state.settings.restaurantName || state.status.restaurantName || "")
  const uname = state.settings.username || ""
  $("headerQueueCount").textContent = String(state.queue.length || 0)
  $("headerBranchInfo").textContent = rName || "Bağlı İşletme"
  if ($("sidebarRestaurantTitle")) {
    $("sidebarRestaurantTitle").textContent = rName || "Corder Print Agent"
  }
  if ($("sidebarUsernameSub")) {
    $("sidebarUsernameSub").textContent = uname || "Print Agent"
  }
  if ($("sidebarAvatar")) {
    const ch = (rName || uname || "P").trim().charAt(0).toLocaleUpperCase("tr-TR")
    $("sidebarAvatar").textContent = ch || "P"
  }

  $("infoRestaurantName").textContent = rName || "Bağlı İşletme"
  $("infoUsername").textContent = `Kullanıcı: ${uname || "-"}`

  pill.className = "status-pill"
  if (state.status.socketConnected) {
    pill.classList.add("status-ok")
    text.textContent = rName ? `Bağlı: ${rName}` : "Canlı Bağlantı Aktif"
  } else {
    pill.classList.add("status-err")
    text.textContent = state.status.lastError
      ? `Yeniden Bağlanıyor (${state.status.lastError})`
      : "Sunucuya Bağlanıyor..."
  }
}

function printerLabel(p) {
  return formatTitleCase(p?.name) || String(p?.systemPrinterName || p?.host || "Yazıcı").trim()
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
  if (!modal || !input) return Promise.resolve(defaultValue || null)
  if (activeModalResolver) closeNicknameModal(null)
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
  const existing = new Set(
    (state.settings.printers || [])
      .filter((p) => p.mode === "system")
      .map((p) => p.systemPrinterName),
  )
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

function renderDiscoveredNetworkPrinters() {
  const container = $("discoveredNetworkPrintersList")
  if (!container) return
  const netPrinters = (state.settings.printers || []).filter((p) => p.mode === "network")
  const existingHosts = new Set(
    netPrinters.map((p) => `${p.host}:${Number(p.port) || 9100}`),
  )
  const existingMacs = new Set(
    netPrinters.map((p) => String(p.mac || "").trim().toUpperCase()).filter(Boolean),
  )
  if (!state.discoveredNetworkPrinters.length) {
    const subnetInfo = state.scannedSubnets.length
      ? ` (${escapeHtml(state.scannedSubnets.join(", "))} ağında 9100 portu açık cihaz bulunamadı)`
      : ""
    container.innerHTML = `<div class="empty-hint">${
      state.networkScanCompleted
        ? `Yerel ağda açık termal yazıcı bulunamadı${subnetInfo}.`
        : 'Yerel ağdaki yazıcıları görmek için "Ağdaki Yazıcıları Tara" butonuna tıklayın.'
    }</div>`
    return
  }
  container.innerHTML = state.discoveredNetworkPrinters
    .map((np) => {
      const key = `${np.host}:${Number(np.port) || 9100}`
      const cleanMac = String(np.mac || "").trim().toUpperCase()
      const added = existingHosts.has(key) || (cleanMac && existingMacs.has(cleanMac))
      const macInfo = cleanMac ? ` · MAC: ${escapeHtml(cleanMac)}` : ""
      return `<div class="discovered-item">
        <div class="printer-meta">
          <div class="printer-title">
            <span>${escapeHtml(np.host)}:${escapeHtml(np.port || 9100)}</span>
            <span class="tag tag-net">${escapeHtml(np.latencyMs ?? 1)}ms</span>
          </div>
          <div class="printer-sub">Ağ Termal Yazıcı (${escapeHtml(np.subnet || "LAN")}${macInfo})</div>
        </div>
        ${
          added
            ? '<span class="tag">Eklendi</span>'
            : `<button class="btn btn-primary btn-sm" data-action="use-network-printer" data-host="${escapeHtml(np.host)}" data-port="${escapeHtml(np.port || 9100)}" data-mac="${escapeHtml(cleanMac)}">+ Kullan</button>`
        }
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
    upgradeAllCustomSelects()
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
        <span class="category-name">${cat.isSub ? "↳ " : ""}${escapeHtml(formatTitleCase(cat.name))}</span>
        <select class="category-select" data-category-id="${escapeHtml(cat.id)}">${opts}</select>
      </div>`
    })
    .join("")
  upgradeAllCustomSelects()
}

let activeFloatingMenu = null
let activeSelectWrapper = null

function closeAllCustomSelects() {
  if (activeFloatingMenu) {
    activeFloatingMenu.remove()
    activeFloatingMenu = null
  }
  if (activeSelectWrapper) {
    activeSelectWrapper.classList.remove("open")
    activeSelectWrapper = null
  }
}

function openCustomSelectMenu(selectEl, wrapper, triggerBtn) {
  if (activeSelectWrapper === wrapper) {
    closeAllCustomSelects()
    return
  }
  closeAllCustomSelects()
  wrapper.classList.add("open")
  activeSelectWrapper = wrapper

  const menu = document.createElement("div")
  menu.className = "c-select-menu open"
  const options = Array.from(selectEl.options)
  menu.innerHTML = options
    .map((opt) => {
      const isSelected = opt.value === selectEl.value
      const checkSvg = isSelected
        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
        : ""
      return `<button type="button" class="c-select-option ${isSelected ? "selected" : ""}" data-val="${escapeHtml(opt.value)}">
        <span>${escapeHtml(opt.textContent)}</span>
        ${checkSvg}
      </button>`
    })
    .join("")

  document.body.appendChild(menu)
  activeFloatingMenu = menu

  const rect = triggerBtn.getBoundingClientRect()
  const menuHeight = Math.min(240, options.length * 36 + 12)
  const spaceBelow = window.innerHeight - rect.bottom
  const top = spaceBelow < menuHeight + 12 && rect.top > menuHeight
    ? rect.top - menuHeight - 4
    : rect.bottom + 4
  menu.style.width = `${Math.max(rect.width, 190)}px`
  menu.style.left = `${Math.min(rect.left, window.innerWidth - Math.max(rect.width, 190) - 8)}px`
  menu.style.top = `${Math.max(8, top)}px`

  menu.addEventListener("click", (e) => {
    const btn = e.target.closest(".c-select-option")
    if (!btn) return
    const nextVal = btn.dataset.val ?? ""
    if (selectEl.value !== nextVal) {
      selectEl.value = nextVal
      selectEl.dispatchEvent(new Event("change", { bubbles: true }))
    }
    const labelSpan = triggerBtn.querySelector(".c-select-label")
    const selectedOpt = Array.from(selectEl.options).find((o) => o.value === selectEl.value) || selectEl.options[0]
    if (labelSpan && selectedOpt) labelSpan.textContent = selectedOpt.textContent
    closeAllCustomSelects()
  })
}

function upgradeSelectToCustom(selectEl) {
  if (!selectEl) return
  let wrapper = selectEl.nextElementSibling
  if (!wrapper || !wrapper.classList.contains("c-select")) {
    selectEl.classList.add("sr-only-select")
    wrapper = document.createElement("div")
    wrapper.className = "c-select"
    wrapper.innerHTML = `<button type="button" class="c-select-trigger">
      <span class="c-select-label"></span>
      <svg class="c-select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
    </button>`
    selectEl.insertAdjacentElement("afterend", wrapper)
    const triggerBtn = wrapper.querySelector(".c-select-trigger")
    triggerBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      openCustomSelectMenu(selectEl, wrapper, triggerBtn)
    })
  }
  const labelSpan = wrapper.querySelector(".c-select-label")
  const selectedOpt = Array.from(selectEl.options).find((o) => o.value === selectEl.value) || selectEl.options[0]
  if (labelSpan) labelSpan.textContent = selectedOpt ? selectedOpt.textContent : "Seçin..."
}

function upgradeAllCustomSelects() {
  document.querySelectorAll("select").forEach((sel) => upgradeSelectToCustom(sel))
}

function renderQueueAndLogs() {
  $("pendingQueueContainer").innerHTML = state.queue.length
    ? state.queue
        .slice(0, 20)
        .map(
          (item) => `<div class="queue-row">
        <div><strong>Masa: ${escapeHtml(formatTitleCase(item.tableName) || "-")}</strong> &bull; ${escapeHtml(item.printType || "kitchen")}
        <div class="printer-sub">Deneme: ${item.retryCount || 0} | Hata: ${escapeHtml(item.lastError || "-")}</div></div>
        <span class="tag">${escapeHtml(formatTitleCase(item.targetPrinter?.name || item.targetPrinterName) || "Varsayılan")}</span>
      </div>`,
        )
        .join("")
    : `<div class="empty-hint">Bekleyen fiş yok. Tüm siparişler anında yazdırıldı.</div>`

  $("recentPrintedContainer").innerHTML = state.recentPrinted.length
    ? state.recentPrinted
        .slice(0, 12)
        .map(
          (item) => `<div class="queue-row">
        <div><strong>Masa: ${escapeHtml(formatTitleCase(item.tableName) || "-")}</strong> (${escapeHtml(item.printType)})
        <div class="printer-sub">${new Date(item.printedAt).toLocaleTimeString("tr-TR")} &bull; Yazıcı: ${escapeHtml(formatTitleCase(item.printerName) || "-")}</div></div>
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

