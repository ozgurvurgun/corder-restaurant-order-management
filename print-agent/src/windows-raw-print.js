const fs = require("fs")
const os = require("os")
const path = require("path")
const { spawn } = require("child_process")
const { getAppDataDir } = require("./config")
const { getWindowsBinary } = require("./windows-usb-direct")
const { warn } = require("./logger")
const { CSHARP_RAW_PRINTER_SOURCE } = require("./windows-raw-printer-cs")

let cachedHelperPaths = null

function ensureWindowsHelperPaths() {
  if (cachedHelperPaths) {
    try {
      if (fs.existsSync(cachedHelperPaths.csPath)) return cachedHelperPaths
    } catch {
      // regenerate
    }
  }
  const dirs = [getAppDataDir(), os.tmpdir()]
  for (const dir of dirs) {
    try {
      fs.mkdirSync(dir, { recursive: true })
      const csPath = path.join(dir, "CorderRawPrinterV5.cs")
      const dllPath = path.join(dir, "CorderRawPrinterV5.dll")
      let needWrite = true
      if (fs.existsSync(csPath)) {
        try {
          if (fs.readFileSync(csPath, "utf8") === CSHARP_RAW_PRINTER_SOURCE) {
            needWrite = false
          }
        } catch {
          needWrite = true
        }
      }
      if (needWrite) {
        fs.writeFileSync(csPath, CSHARP_RAW_PRINTER_SOURCE, "utf8")
        try {
          if (fs.existsSync(dllPath)) fs.unlinkSync(dllPath)
        } catch {
          // ignore
        }
      }
      cachedHelperPaths = { csPath, dllPath }
      return cachedHelperPaths
    } catch {
      // try fallback dir
    }
  }
  return {
    csPath: path.join(os.tmpdir(), "CorderRawPrinterV5.cs"),
    dllPath: path.join(os.tmpdir(), "CorderRawPrinterV5.dll"),
  }
}

const PS_LOAD_HELPER_SNIPPET = `
$dllPath = $env:CORDER_DLL_PATH
if (-not $dllPath) { $dllPath = Join-Path $env:TEMP "CorderRawPrinterV5.dll" }
$csPath = $env:CORDER_CS_PATH
if (-not ('RawPrinterHelper' -as [type])) {
  if (Test-Path -LiteralPath $dllPath) {
    try { Add-Type -LiteralPath $dllPath -ErrorAction Stop } catch {}
  }
}
if (-not ('RawPrinterHelper' -as [type])) {
  $csCode = [System.IO.File]::ReadAllText($csPath, [System.Text.Encoding]::UTF8)
  $tmpDll = "$dllPath.$PID.dll"
  try {
    Add-Type -TypeDefinition $csCode -OutputAssembly $tmpDll -ErrorAction Stop
    Copy-Item -LiteralPath $tmpDll -Destination $dllPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $tmpDll -Force -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $dllPath) {
      Add-Type -LiteralPath $dllPath -ErrorAction SilentlyContinue
    }
    if (-not ('RawPrinterHelper' -as [type]) -and (Test-Path -LiteralPath $tmpDll)) {
      Add-Type -LiteralPath $tmpDll -ErrorAction Stop
    }
  } catch {
    if (-not ('RawPrinterHelper' -as [type])) {
      Add-Type -TypeDefinition $csCode -ErrorAction Stop
    }
  }
}
`.trim()

const WIN_WORKER_BOOTSTRAP_PS = `
$ErrorActionPreference = 'Continue'
${PS_LOAD_HELPER_SNIPPET}
[RawPrinterHelper]::RunWorkerLoop()
`.trim()

const WIN_RAW_SPOOL_PS = `
$ErrorActionPreference = 'Stop'
${PS_LOAD_HELPER_SNIPPET}
$bytes = [System.IO.File]::ReadAllBytes($env:CORDER_PRINT_FILE)
$healed = ""
$err = ""
if ([RawPrinterHelper]::ExecutePrintJob($env:CORDER_PRINTER_NAME, $bytes, [ref]$healed, [ref]$err)) {
  if ($healed) { Write-Output "HEALED_PRINTER:$healed" }
  exit 0
}
[Console]::Error.WriteLine($err)
exit 1
`.trim()

let workerProc = null
let workerReady = false
let workerReqSeq = 0
let stdoutBuf = ""
let isShuttingDown = false
const pendingReqs = new Map()
const pendingWrites = []

function decodeBase64Utf8(raw) {
  const clean = String(raw || "").trim()
  if (!clean) return ""
  try {
    return Buffer.from(clean, "base64").toString("utf8").trim()
  } catch {
    return clean
  }
}

function flushPendingWrites() {
  if (!workerReady || !workerProc || !workerProc.stdin || !workerProc.stdin.writable) return
  while (pendingWrites.length > 0) {
    const item = pendingWrites.shift()
    if (!pendingReqs.has(item.reqId)) continue
    workerProc.stdin.write(item.line, (err) => {
      if (err) {
        const pending = pendingReqs.get(item.reqId)
        if (pending) {
          clearTimeout(pending.timer)
          pendingReqs.delete(item.reqId)
          pending.reject(err)
        }
      }
    })
  }
}

function cleanupWorker(reason = "Worker closed") {
  workerProc = null
  workerReady = false
  stdoutBuf = ""
  pendingWrites.length = 0
  for (const [, req] of pendingReqs) {
    clearTimeout(req.timer)
    req.reject(new Error(reason))
  }
  pendingReqs.clear()
  if (process.platform === "win32" && !isShuttingDown) {
    const respawnTimer = setTimeout(() => ensureWarmPrintWorker(), 400)
    if (typeof respawnTimer.unref === "function") respawnTimer.unref()
  }
}

function ensureWarmPrintWorker() {
  if (process.platform !== "win32" || isShuttingDown) return null
  if (workerProc && !workerProc.killed) return workerProc

  try {
    const { csPath, dllPath } = ensureWindowsHelperPaths()
    const encoded = Buffer.from(WIN_WORKER_BOOTSTRAP_PS, "utf16le").toString("base64")
    const proc = spawn(
      getWindowsBinary("powershell.exe"),
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
      {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          CORDER_CS_PATH: csPath,
          CORDER_DLL_PATH: dllPath,
        },
      },
    )
    workerProc = proc
    workerReady = false
    stdoutBuf = ""

    proc.stdout.setEncoding("utf8")
    proc.stdout.on("data", (chunk) => {
      stdoutBuf += chunk
      let nlIdx
      while ((nlIdx = stdoutBuf.indexOf("\n")) >= 0) {
        const line = stdoutBuf.slice(0, nlIdx).trim()
        stdoutBuf = stdoutBuf.slice(nlIdx + 1)
        if (line === "CORDER_WORKER_READY") {
          workerReady = true
          flushPendingWrites()
          continue
        }
        if (line.startsWith("CORDER_RES|")) {
          const parts = line.split("|")
          const reqId = parts[1]
          const status = parts[2]
          const payload = decodeBase64Utf8(parts.slice(3).join("|"))
          const pending = pendingReqs.get(reqId)
          if (pending) {
            clearTimeout(pending.timer)
            pendingReqs.delete(reqId)
            if (status === "OK") {
              pending.resolve(payload || null)
            } else {
              const pErr = new Error(payload || "Yazdırma hatası")
              pErr.isPrinterError = true
              pending.reject(pErr)
            }
          }
        }
      }
    })

    proc.stderr.setEncoding("utf8")
    proc.stderr.on("data", (chunk) => {
      const msg = String(chunk || "").trim()
      if (msg) {
        warn("Windows warm print worker stderr", { error: msg.slice(0, 240) })
      }
    })

    proc.on("error", (err) => {
      warn("Windows warm print worker process error", { error: err.message })
      cleanupWorker("Worker process error")
    })
    proc.on("exit", (code) => {
      if (!isShuttingDown && code !== 0) {
        warn("Windows warm print worker exited", { code })
      }
      cleanupWorker("Worker process exited")
    })
    if (typeof proc.unref === "function") proc.unref()
    return proc
  } catch (err) {
    warn("Failed to start Windows warm print worker", {
      error: err instanceof Error ? err.message : String(err),
    })
    workerProc = null
    workerReady = false
    return null
  }
}

function sendViaWarmWorker(printerName, bytes, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const proc = ensureWarmPrintWorker()
    if (!proc || !proc.stdin || !proc.stdin.writable) {
      reject(new Error("Warm worker unavailable"))
      return
    }
    const reqId = String(++workerReqSeq)
    const nameB64 = Buffer.from(String(printerName || ""), "utf8").toString("base64")
    const bytesB64 = Buffer.from(bytes).toString("base64")
    const line = `PRINT|${reqId}|${nameB64}|${bytesB64}\n`
    const timer = setTimeout(() => {
      pendingReqs.delete(reqId)
      reject(new Error("Warm worker timeout"))
    }, timeoutMs)

    pendingReqs.set(reqId, { resolve, reject, timer })
    if (workerReady) {
      proc.stdin.write(line, (err) => {
        if (err) {
          clearTimeout(timer)
          pendingReqs.delete(reqId)
          reject(err)
        }
      })
    } else {
      pendingWrites.push({ reqId, line })
    }
  })
}

if (process.platform === "win32") {
  setTimeout(() => ensureWarmPrintWorker(), 20)
  process.on("exit", () => {
    isShuttingDown = true
    if (workerProc && !workerProc.killed) {
      try {
        workerProc.kill()
      } catch {
        // noop
      }
    }
  })
}

module.exports = {
  WIN_RAW_SPOOL_PS,
  WIN_WORKER_BOOTSTRAP_PS,
  ensureWindowsHelperPaths,
  sendViaWarmWorker,
  ensureWarmPrintWorker,
}
