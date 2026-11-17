/**
 * Routes kitchen and cancel order items by categoryId (walking full parent hierarchy,
 * with department name fallback) to target printers.
 * Customer receipts (`receipt`) always route to the configured receipt printer.
 */

function makeKitchenKey(evt) {
  const route = evt.targetPrinterKey != null ? evt.targetPrinterKey : "default"
  return `${evt.jobId}:kitchen:${route}`
}

function makeReceiptKey(evt) {
  const route = evt.targetPrinterKey != null ? evt.targetPrinterKey : "default"
  return `${evt.jobId}:receipt:${route}`
}

function makeKitchenCancelKey(evt) {
  const route = evt.targetPrinterKey != null ? evt.targetPrinterKey : "default"
  return `${evt.jobId}:kitchen_cancel:${route}`
}

function keyFnForKind(kind) {
  if (kind === "receipt") return makeReceiptKey
  if (kind === "kitchen_cancel") return makeKitchenCancelKey
  return makeKitchenKey
}

function normalizeMatchToken(str) {
  if (!str) return ""
  return String(str)
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replaceAll("\u0131", "i")
    .replaceAll("\u015f", "s")
    .replaceAll("\u011f", "g")
    .replaceAll("\u00fc", "u")
    .replaceAll("\u00f6", "o")
    .replaceAll("\u00e7", "c")
}

function resolveCategoryPrinterId(categoryId, config) {
  if (!categoryId) return null
  const routes = config.categoryRoutes || {}
  const parentMap = config.categoryParentMap || {}
  const visited = new Set()
  let current = categoryId

  while (current && !visited.has(current) && visited.size < 16) {
    visited.add(current)
    if (routes[current]) {
      return routes[current]
    }
    current = parentMap[current] || null
  }

  // Fallback: match category/ancestor name against printer `department` or `name`
  const categoriesById = config.categoriesById || {}
  const printers = Array.isArray(config.printers) ? config.printers : []
  if (printers.length > 0) {
    for (const cid of visited) {
      const cat = categoriesById[cid]
      const catNorm = normalizeMatchToken(cat?.name)
      if (!catNorm) continue
      const byDept = printers.find(
        (p) => p.department && normalizeMatchToken(p.department) === catNorm,
      )
      if (byDept) return byDept.id
    }
  }

  return null
}

function formatPrinterTarget(activePrinter) {
  const isNet = activePrinter.mode === "network"
  const netStr = isNet ? `${activePrinter.host}:${activePrinter.port || 9100}` : null
  const sysName = !isNet ? activePrinter.systemPrinterName || activePrinter.name : null
  const key = activePrinter.id
    ? `printer:${activePrinter.id}`
    : isNet
      ? `net:${netStr}`
      : `cmd:${sysName}`
  return {
    groupKey: key,
    targetPrinter: {
      id: activePrinter.id,
      name: activePrinter.name,
      mode: activePrinter.mode,
      systemPrinterName: activePrinter.systemPrinterName,
      host: activePrinter.host,
      port: activePrinter.port,
      paperWidth: activePrinter.paperWidth,
      feedLinesBeforeCut: activePrinter.feedLinesBeforeCut,
      autoCut: activePrinter.autoCut !== false,
      department: activePrinter.department || null,
    },
    targetPrinterName: sysName,
    targetNetwork: netStr,
  }
}

function resolveItemTarget(item, config, kind) {
  const printersById = config.printersById || {}

  if (kind === "receipt") {
    if (config.receiptPrinterId === "none") return null
    const receiptPrinter = config.receiptPrinter || config.defaultKitchenPrinter || null
    if (receiptPrinter) {
      return formatPrinterTarget(receiptPrinter)
    }
    const mgmtName = String(config.managementReceiptPrinter || config.printerName || "").trim()
    if (!mgmtName) return null
    return {
      groupKey: `cmd:${mgmtName}`,
      targetPrinter: null,
      targetPrinterName: mgmtName,
      targetNetwork: null,
    }
  }

  const cid = item.categoryId || ""
  const matchedPrinterId = resolveCategoryPrinterId(cid, config)
  if (matchedPrinterId === "none") {
    return null
  }
  const matchedPrinter = matchedPrinterId ? printersById[matchedPrinterId] : null

  if (!matchedPrinter && config.defaultKitchenPrinterId === "none") {
    return null
  }
  const activePrinter = matchedPrinter || config.defaultKitchenPrinter || null
  if (activePrinter) {
    return formatPrinterTarget(activePrinter)
  }

  const legacyRoutes = config.categoryPrinterRoutes || {}
  const legacyNetRoutes = config.categoryNetworkRoutes || {}
  const defaultName = String(config.printerName || "KITCHEN").trim() || "KITCHEN"

  let printerName = defaultName
  let network = null
  if (cid && legacyRoutes[cid]) {
    printerName = String(legacyRoutes[cid]).trim() || printerName
  }
  if (cid && legacyNetRoutes[cid]) {
    network = String(legacyNetRoutes[cid]).trim()
  }
  const groupKey = network ? `net:${network}` : `cmd:${printerName}`
  return {
    groupKey,
    targetPrinter: null,
    targetPrinterName: network ? null : printerName,
    targetNetwork: network,
  }
}

/**
 * @param {object} evt
 * @param {object} config
 * @param {'kitchen' | 'receipt' | 'kitchen_cancel'} kind
 * @returns {object[]}
 */
function expandCategoryRoutedJobs(evt, config, kind) {
  const keyFn = keyFnForKind(kind)
  const items = Array.isArray(evt.items) ? evt.items : []

  if (!items.length) {
    return []
  }

  if (kind === "receipt") {
    const resolved = resolveItemTarget(items[0], config, "receipt")
    if (!resolved) return []
    const job = {
      ...evt,
      items,
      targetPrinter: resolved.targetPrinter || null,
      targetPrinterName: resolved.targetPrinterName || null,
      targetNetwork: resolved.targetNetwork || null,
      targetPrinterKey: resolved.groupKey,
      splitIndex: 0,
      _splitKeys: null,
      _mySplitKey: null,
    }
    const key = keyFn(job)
    job._splitKeys = [key]
    job._mySplitKey = key
    return [job]
  }

  const groups = new Map()
  for (const item of items) {
    const resolved = resolveItemTarget(item, config, kind)
    if (!resolved) continue
    if (!groups.has(resolved.groupKey)) {
      groups.set(resolved.groupKey, {
        ...resolved,
        items: [],
      })
    }
    groups.get(resolved.groupKey).items.push(item)
  }

  const list = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, g]) => g)
    .filter((g) => g.items.length > 0)

  if (!list.length) return []

  const jobs = list.map((g, splitIndex) => {
    const lineTotal = g.items.reduce(
      (s, i) => s + Number(i.price || 0) * Number(i.quantity || 0),
      0,
    )
    return {
      ...evt,
      items: g.items,
      total: lineTotal,
      targetPrinter: g.targetPrinter || null,
      targetPrinterName: g.targetPrinterName || null,
      targetNetwork: g.targetNetwork || null,
      targetPrinterKey: g.groupKey,
      splitIndex,
      _splitKeys: null,
      _mySplitKey: null,
    }
  })

  const keys = jobs.map((j) => keyFn(j))
  jobs.forEach((j, i) => {
    j._splitKeys = keys
    j._mySplitKey = keys[i]
  })

  return jobs
}

function expandKitchenPrintJobs(evt, config) {
  return expandCategoryRoutedJobs(evt, config, "kitchen")
}

function expandReceiptPrintJobs(evt, config) {
  return expandCategoryRoutedJobs(evt, config, "receipt")
}

function expandCancelPrintJobs(evt, config) {
  return expandCategoryRoutedJobs(evt, config, "kitchen_cancel")
}

module.exports = {
  expandCategoryRoutedJobs,
  expandKitchenPrintJobs,
  expandReceiptPrintJobs,
  expandCancelPrintJobs,
  makeKitchenKey,
  makeReceiptKey,
  makeKitchenCancelKey,
}
