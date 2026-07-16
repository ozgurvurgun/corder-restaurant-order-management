/**
 * Category UUID -> Windows printer name (PRINT_CATEGORY_ROUTES) or host:port (PRINT_CATEGORY_NETWORK).
 * Lines going to the same target are merged into one ticket; different targets = sequential tickets.
 */

/**
 * Dedup key: do not use splitIndex — WS vs HTTP can order products differently, so the
 * index would drift and the same ticket could print twice. Route (cmd:/net:) per order is enough.
 */
function makeKitchenKey(evt) {
  const route = evt.targetPrinterKey != null ? evt.targetPrinterKey : "default"
  return `${evt.jobId}:kitchen:${route}`
}

function makeReceiptKey(evt) {
  const route = evt.targetPrinterKey != null ? evt.targetPrinterKey : "default"
  return `${evt.jobId}:receipt:${route}`
}

/**
 * @param {object} evt — items: { categoryId?, price, quantity, ... }[]
 * @param {object} config
 * @param {{ kind: 'kitchen' | 'receipt' }} kind
 * @returns {object[]}
 */
function expandCategoryRoutedJobs(evt, config, kind) {
  const routes = config.categoryPrinterRoutes || {}
  const netRoutes = config.categoryNetworkRoutes || {}
  const hasRoutes = Object.keys(routes).length > 0 || Object.keys(netRoutes).length > 0

  const defaultName = String(config.printerName || "MUTFAK").trim() || "MUTFAK"

  if (!hasRoutes || !evt.items?.length) {
    const lineTotal = evt.items.reduce((s, i) => s + Number(i.price || 0) * Number(i.quantity || 0), 0)
    const single = {
      ...evt,
      items: evt.items,
      total: lineTotal,
      targetPrinterName: null,
      targetNetwork: null,
      targetPrinterKey: null,
      splitIndex: 0,
      _splitKeys: null,
      _mySplitKey: null,
    }
    const keyFn = kind === "receipt" ? makeReceiptKey : makeKitchenKey
    single._mySplitKey = keyFn(single)
    return [single]
  }

  /** @type {Map<string, { items: typeof evt.items, printerName: string | null, network: string | null }>} */
  const groups = new Map()

  for (const item of evt.items) {
    const cid = item.categoryId || ""
    let printerName = String(defaultName || "").trim() || "MUTFAK"
    let network = null
    if (cid && routes[cid]) {
      printerName = String(routes[cid] || "").trim() || printerName
    }
    if (cid && netRoutes[cid]) {
      network = netRoutes[cid].trim()
    }
    const gkey = network ? `net:${network}` : `cmd:${printerName}`
    if (!groups.has(gkey)) {
      groups.set(gkey, {
        items: [],
        printerName: network ? null : printerName,
        network,
      })
    }
    groups.get(gkey).items.push(item)
  }

  const list = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, g]) => g)
    .filter((g) => g.items.length > 0)
  if (list.length === 0) {
    return []
  }

  const keyFn = kind === "receipt" ? makeReceiptKey : makeKitchenKey

  const jobs = list.map((g, splitIndex) => {
    const targetNetwork = g.network
    const targetPrinterName = g.printerName
    const targetPrinterKey = targetNetwork ? `net:${targetNetwork}` : `cmd:${targetPrinterName || defaultName}`
    const lineTotal = g.items.reduce((s, i) => s + Number(i.price || 0) * Number(i.quantity || 0), 0)
    return {
      ...evt,
      items: g.items,
      total: lineTotal,
      targetPrinterName,
      targetNetwork,
      targetPrinterKey,
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

module.exports = {
  expandKitchenPrintJobs,
  expandReceiptPrintJobs,
  makeKitchenKey,
  makeReceiptKey,
}
