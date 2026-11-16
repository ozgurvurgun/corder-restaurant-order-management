/**
 * Routes order items by categoryId (with parent category fallback) to target printers.
 * Items routed to the same target printer are grouped into a single ticket.
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

function resolveCategoryPrinterId(categoryId, config) {
  if (!categoryId) return null
  const routes = config.categoryRoutes || {}
  if (routes[categoryId]) return routes[categoryId]
  const parentMap = config.categoryParentMap || {}
  const parentId = parentMap[categoryId]
  if (parentId && routes[parentId]) {
    return routes[parentId]
  }
  return null
}

function resolveItemTarget(item, config, kind) {
  const cid = item.categoryId || ""
  const printersById = config.printersById || {}
  const matchedPrinterId = resolveCategoryPrinterId(cid, config)
  const matchedPrinter = matchedPrinterId ? printersById[matchedPrinterId] : null

  const fallbackPrinter =
    kind === "receipt"
      ? config.receiptPrinter || config.defaultKitchenPrinter || null
      : config.defaultKitchenPrinter || null

  const activePrinter = matchedPrinter || fallbackPrinter
  if (activePrinter) {
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
      },
      targetPrinterName: sysName,
      targetNetwork: netStr,
    }
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

  const groups = new Map()
  for (const item of items) {
    const resolved = resolveItemTarget(item, config, kind)
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
