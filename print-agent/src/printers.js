const net = require("net")
const fs = require("fs")
const os = require("os")
const path = require("path")
const { execFile } = require("child_process")
const { info, warn } = require("./logger")
const { healNetworkPrinters } = require("./network-healer")
const { loadSettings, saveSettings, buildRuntimeConfig } = require("./settings-store")
const { pushPrintersToBackend } = require("./http-sync")

const SAFE_PRINTER_NAME_RE = /^[\p{L}\p{N}_. \-()+@#/:]{1,128}$/u
const LINUX_USB_DEV_RE = /^\/dev\/(usb\/)?lp[0-9]$/
const SAFE_HOST_RE = /^[a-zA-Z0-9.-]{1,253}$/

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parsePort(p, fallback = 9100) {
  const n = parseInt(String(p || "").trim(), 10)
  return Number.isFinite(n) && n > 0 && n <= 65535 ? n : fallback
}

function assertSafePrinterName(name) {
  const clean = String(name || "").trim()
  if (!clean || !SAFE_PRINTER_NAME_RE.test(clean) || clean.includes("..")) {
    throw new Error(`Invalid or unsafe printer identifier: "${clean.slice(0, 40)}"`)
  }
  return clean
}

function sendRawTcp(host, port, bytes, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const cleanHost = String(host || "").trim()
    if (!cleanHost || !SAFE_HOST_RE.test(cleanHost)) {
      reject(new Error(`Invalid printer host: ${cleanHost}`))
      return
    }
    let settled = false
    const done = (err) => {
      if (settled) return
      settled = true
      if (err) reject(err)
      else resolve()
    }

    const client = net.createConnection({ host: cleanHost, port }, () => {
      try {
        client.setNoDelay(true)
      } catch {
        // noop
      }
      client.write(bytes, (err) => {
        if (err) {
          client.destroy()
          done(err)
          return
        }
        client.end()
      })
    })

    client.setTimeout(timeoutMs)
    client.on("timeout", () => {
      client.destroy()
      done(new Error(`TCP printer timeout (${cleanHost}:${port})`))
    })
    client.on("error", (err) => done(err))
    client.on("close", () => done(null))
  })
}

function runExecFile(binary, args, timeoutMs = 25000, extraEnv = null) {
  return new Promise((resolve, reject) => {
    execFile(
      binary,
      args,
      {
        timeout: timeoutMs,
        windowsHide: true,
        shell: false,
        maxBuffer: 512 * 1024,
        ...(extraEnv ? { env: { ...process.env, ...extraEnv } } : {}),
      },
      (err, stdout, stderr) => {
        if (err) {
          const detail = stderr ? String(stderr).trim().slice(0, 300) : err.message
          reject(new Error(detail || err.message))
          return
        }
        resolve(String(stdout || ""))
      },
    )
  })
}

function hasLinuxUsbPrinterDevice() {
  for (const devPath of ["/dev/usb/lp0", "/dev/usb/lp1", "/dev/usb/lp2", "/dev/lp0", "/dev/lp1"]) {
    if (fs.existsSync(devPath)) return true
  }
  try {
    const base = "/sys/bus/usb/devices"
    if (fs.existsSync(base)) {
      for (const entry of fs.readdirSync(base)) {
        const clsFile = path.join(base, entry, "bInterfaceClass")
        if (fs.existsSync(clsFile) && fs.readFileSync(clsFile, "utf8").trim() === "07") {
          return true
        }
      }
    }
  } catch {
    // ignore sysfs read errors
  }
  return false
}

async function assertLinuxCupsPrinterReady(safeName) {
  if (process.platform !== "linux") return
  try {
    const out = await runExecFile("lpstat", ["-v", safeName], 3000)
    if (out.toLowerCase().includes("usb://") && !hasLinuxUsbPrinterDevice()) {
      await runExecFile("cancel", ["-a", safeName], 3000).catch(() => {})
      throw new Error(`USB yazıcı bilgisayara bağlı değil veya kapalı (${safeName})`)
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("USB yazıcı bilgisayara bağlı değil")) {
      throw err
    }
  }
}

async function purgeSystemPrintQueues(config = {}) {
  const names = new Set()
  if (config?.printerName) names.add(String(config.printerName).trim())
  if (Array.isArray(config?.printers)) {
    for (const p of config.printers) {
      if (p && p.mode !== "network") {
        const candidate = String(p.systemPrinterName || p.name || "").trim()
        if (candidate) names.add(candidate)
      }
    }
  }

  const safeNames = []
  for (const raw of names) {
    try {
      const clean = assertSafePrinterName(raw)
      if (!LINUX_USB_DEV_RE.test(clean)) safeNames.push(clean)
    } catch {
      // skip invalid identifier
    }
  }

  if (process.platform === "win32") {
    for (const safeName of safeNames) {
      const ps = `
        $p = $env:CORDER_PRINTER_NAME
        Get-PrintJob -PrinterName $p -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue
      `.trim()
      await runExecFile(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", ps],
        8000,
        { CORDER_PRINTER_NAME: safeName },
      ).catch(() => {})
    }
    return
  }

  for (const safeName of safeNames) {
    await runExecFile("cancel", ["-a", safeName], 4000).catch(() => {})
    if (process.platform === "linux") {
      await runExecFile("cupsenable", [safeName], 3000).catch(() => {})
      await runExecFile("cupsaccept", [safeName], 3000).catch(() => {})
    }
  }
  await runExecFile("cancel", ["-a"], 4000).catch(() => {})
}

const WIN_RAW_SPOOL_PS = `
$ErrorActionPreference = 'Stop'
$printerName = $env:CORDER_PRINTER_NAME
$filePath = $env:CORDER_PRINT_FILE
Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;
public class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFOW {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }
  [StructLayout(LayoutKind.Sequential)]
  public struct PRINTER_DEFAULTS {
    public IntPtr pDatatype;
    public IntPtr pDevMode;
    public int DesiredAccess;
  }
  [DllImport("winspool.Drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true)]
  public static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true)]
  public static extern bool OpenPrinterWithDefaults(string src, out IntPtr hPrinter, ref PRINTER_DEFAULTS pd);
  [DllImport("winspool.Drv", EntryPoint = "SetPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true)]
  public static extern bool SetPrinter(IntPtr hPrinter, int level, IntPtr pPrinter, int command);
  [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true)]
  public static extern int StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFOW di);
  [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true)]
  public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

  public static void PurgeQueue(string targetPrinter) {
    IntPtr hPrinter;
    PRINTER_DEFAULTS pd = new PRINTER_DEFAULTS();
    pd.DesiredAccess = 0x000F000C;
    if (OpenPrinterWithDefaults(targetPrinter, out hPrinter, ref pd) || OpenPrinter(targetPrinter, out hPrinter, IntPtr.Zero)) {
      try { SetPrinter(hPrinter, 0, IntPtr.Zero, 3); } finally { ClosePrinter(hPrinter); }
    }
  }

  public static int TrySendBytes(string targetPrinter, byte[] bytes, string dataType) {
    IntPtr hPrinter;
    if (!OpenPrinter(targetPrinter, out hPrinter, IntPtr.Zero)) return Marshal.GetLastWin32Error();
    try {
      DOCINFOW di = new DOCINFOW { pDocName = "Corder POS Ticket", pDataType = dataType };
      if (StartDocPrinter(hPrinter, 1, di) == 0) return Marshal.GetLastWin32Error();
      try {
        StartPagePrinter(hPrinter);
        try {
          int written = 0;
          if (!WritePrinter(hPrinter, bytes, bytes.Length, out written)) return Marshal.GetLastWin32Error();
        } finally { EndPagePrinter(hPrinter); }
      } finally { EndDocPrinter(hPrinter); }
    } finally { ClosePrinter(hPrinter); }
    return 0;
  }

  public static int SendFileWithResult(string targetPrinter, string filePath) {
    byte[] bytes = File.ReadAllBytes(filePath);
    int err = TrySendBytes(targetPrinter, bytes, "RAW");
    if (err != 0 && TrySendBytes(targetPrinter, bytes, "XPS_PASS") == 0) return 0;
    return err;
  }
}
"@

$errCode = [RawPrinterHelper]::SendFileWithResult($printerName, $filePath)
if ($errCode -eq 1905 -or $errCode -eq 1801) {
  $origPrinter = Get-Printer -Name $printerName -ErrorAction SilentlyContinue
  $origDriver = if ($origPrinter) { [string]$origPrinter.DriverName } else { "" }
  $origPort = if ($origPrinter) { [string]$origPrinter.PortName } else { "" }

  [RawPrinterHelper]::PurgeQueue($printerName)
  Get-PrintJob -PrinterName $printerName -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 350

  if ([RawPrinterHelper]::SendFileWithResult($printerName, $filePath) -eq 0) {
    Write-Output "HEALED_PRINTER:$printerName"; exit 0
  }

  $baseName = ($printerName -replace '\\s*\\((Kopya|Copy)\\s*\\d+\\)\\s*$', '').Trim()
  $allPrinters = @(Get-Printer -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -ne $printerName -and $_.Name -notmatch '^(Microsoft Print to PDF|Microsoft XPS Document Writer|OneNote|Fax)'
  })
  $candidates = New-Object System.Collections.Generic.List[object]
  $seen = New-Object System.Collections.Generic.HashSet[string]([System.StringComparer]::OrdinalIgnoreCase)
  foreach ($group in @(
    ($allPrinters | Where-Object { $_.Name -like "$baseName*" }),
    ($allPrinters | Where-Object { $origDriver -and $_.DriverName -eq $origDriver }),
    ($allPrinters | Where-Object { $_.PortName -match '^(USB|POS|COM|TM|ESDPRT|LPT)' }),
    $allPrinters
  )) {
    foreach ($p in @($group)) {
      if ($p -and $p.Name -and -not $seen.Contains([string]$p.Name)) {
        [void]$seen.Add([string]$p.Name); $candidates.Add($p)
      }
    }
  }
  foreach ($cand in $candidates) {
    if ([RawPrinterHelper]::SendFileWithResult([string]$cand.Name, $filePath) -eq 0) {
      Write-Output "HEALED_PRINTER:$($cand.Name)"; exit 0
    }
  }

  $useDriver = $origDriver
  if (-not $useDriver) {
    $drvObj = Get-PrinterDriver -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch 'Microsoft|Generic|Fax|XPS|OneNote|PDF' } | Select-Object -First 1
    if ($drvObj) { $useDriver = [string]$drvObj.Name }
  }
  if ($useDriver) {
    Remove-Printer -Name $printerName -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 250
    $usbPorts = @(Get-PrinterPort -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^(USB|POS|ESDPRT)\\d*' } | Sort-Object Name -Descending | ForEach-Object { [string]$_.Name })
    $tryPorts = New-Object System.Collections.Generic.List[string]
    if ($origPort) { $tryPorts.Add($origPort) }
    foreach ($up in $usbPorts) { if (-not $tryPorts.Contains($up)) { $tryPorts.Add($up) } }
    foreach ($portName in $tryPorts) {
      Remove-Printer -Name $printerName -ErrorAction SilentlyContinue
      Add-Printer -Name $printerName -DriverName $useDriver -PortName $portName -ErrorAction SilentlyContinue | Out-Null
      Start-Sleep -Milliseconds 250
      if ([RawPrinterHelper]::SendFileWithResult($printerName, $filePath) -eq 0) {
        Write-Output "HEALED_PRINTER:$printerName"; exit 0
      }
    }
  }
  [Console]::Error.WriteLine("Windows Yazici Hatasi (Win32=$errCode): '$printerName' yazicisi Windows'ta silinmis veya USB baglantisi kopmus. Lutfen yazicinin acik ve USB kablosunun takili oldugundan emin olup 'Bilgisayardaki Yazicilari Tara' butonuna basin.")
  exit 1
}
if ($errCode -ne 0) {
  [Console]::Error.WriteLine("Windows Yazici Hatasi (Win32=$errCode): '$printerName' yazicisina fis gonderilemedi.")
  exit 1
}
`.trim()

async function sendToWindowsPrinter(tempFile, safeName) {
  const stdout = await runExecFile(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", WIN_RAW_SPOOL_PS],
    25000,
    { CORDER_PRINTER_NAME: safeName, CORDER_PRINT_FILE: tempFile },
  )
  const match = String(stdout || "").match(/HEALED_PRINTER:(.+)/)
  return match && match[1] ? match[1].trim() : null
}

async function sendToSystemPrinter(bytes, printerName, usbDrainMs) {
  const safeName = assertSafePrinterName(printerName)

  if (process.platform === "linux" && LINUX_USB_DEV_RE.test(safeName)) {
    await fs.promises.writeFile(safeName, bytes)
    const drain = Math.max(0, Number(usbDrainMs) || 0)
    if (drain > 0) await sleep(drain)
    return
  }

  const tempFile = path.join(
    os.tmpdir(),
    `corder-job-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.bin`,
  )
  fs.writeFileSync(tempFile, bytes, { mode: 0o600 })

  const started = Date.now()
  let healedPrinterName = null
  try {
    if (process.platform === "win32") {
      healedPrinterName = await sendToWindowsPrinter(tempFile, safeName)
    } else {
      if (process.platform === "linux") {
        await assertLinuxCupsPrinterReady(safeName)
        await runExecFile("cupsenable", [safeName], 3000).catch(() => {})
        await runExecFile("cupsaccept", [safeName], 3000).catch(() => {})
      }
      try {
        await runExecFile("lp", ["-d", safeName, "-o", "raw", tempFile])
      } catch (lpErr) {
        await runExecFile("lpr", ["-P", safeName, "-o", "raw", tempFile]).catch(() => {
          throw lpErr
        })
      }
    }
    const elapsed = Date.now() - started
    if (elapsed > 4000) {
      info(`System print completed slowly (${elapsed}ms)`, { printer: safeName })
    }
  } catch (err) {
    warn("System print failed", { printer: safeName, error: err.message })
    throw err
  } finally {
    try {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile)
    } catch {
      // noop
    }
  }

  const drain = Math.max(0, Number(usbDrainMs) || 0)
  if (drain > 0) await sleep(drain)
  return healedPrinterName
}

async function printBytes(config, bytes, opts = {}) {
  const targetPrinter = opts.printer || null
  const networkTarget = opts.networkTarget ? String(opts.networkTarget).trim() : ""
  const explicitPrinterName = opts.printerName ? String(opts.printerName).trim() : ""

  if (targetPrinter?.mode === "network" || networkTarget) {
    let host = targetPrinter?.host || config.printerHost || "127.0.0.1"
    let port = parsePort(targetPrinter?.port, config.printerPort || 9100)
    if (networkTarget) {
      const parts = networkTarget.split(":")
      host = (parts[0] || "").trim() || host
      port = parsePort(parts[1], port)
    }
    try {
      await sendRawTcp(host, port, bytes)
    } catch (tcpErr) {
      const healRes = await healNetworkPrinters({
        forceScan: true,
        targetPrinterId: targetPrinter?.id || null,
        onHealed: async (savedSettings) => {
          const nextRuntime = buildRuntimeConfig(savedSettings)
          if (typeof config.onHealedRuntimeConfig === "function") {
            config.onHealedRuntimeConfig(nextRuntime)
          }
          void pushPrintersToBackend(nextRuntime, savedSettings)
        },
      }).catch(() => null)
      const healed = healRes?.healedPrinter
      if (healed?.host && healed.host !== host) {
        if (targetPrinter) targetPrinter.host = healed.host
        host = healed.host
        port = parsePort(healed.port, port)
        await sendRawTcp(host, port, bytes)
      } else {
        throw tcpErr
      }
    }
    const drain = Math.max(0, Number(config.printUsbDrainMs) || 0)
    if (drain > 0) await sleep(drain)
    return
  }

  if (targetPrinter?.mode === "system" || explicitPrinterName) {
    const sysName =
      targetPrinter?.systemPrinterName ||
      targetPrinter?.name ||
      explicitPrinterName ||
      config.printerName
    const healedName = await sendToSystemPrinter(bytes, sysName, config.printUsbDrainMs)
    if (healedName && healedName !== sysName) {
      info(`Windows printer queue self-healed: "${sysName}" -> "${healedName}"`)
      if (targetPrinter) targetPrinter.systemPrinterName = healedName
      try {
        const current = loadSettings()
        let updated = false
        const nextPrinters = (current.printers || []).map((p) => {
          if (
            (targetPrinter?.id && p.id === targetPrinter.id) ||
            p.systemPrinterName === sysName ||
            p.name === sysName
          ) {
            updated = true
            return { ...p, systemPrinterName: healedName }
          }
          return p
        })
        if (updated) {
          const saved = saveSettings({ printers: nextPrinters })
          const nextRuntime = buildRuntimeConfig(saved)
          if (typeof config.onHealedRuntimeConfig === "function") {
            config.onHealedRuntimeConfig(nextRuntime)
          }
          void pushPrintersToBackend(nextRuntime, saved)
        }
      } catch {
        // ignore persistence error after successful print
      }
    }
    return
  }

  if (config.printerMode === "network_raw") {
    const host = config.printerHost || "127.0.0.1"
    const port = parsePort(config.printerPort, 9100)
    await sendRawTcp(host, port, bytes)
    return
  }

  await sendToSystemPrinter(bytes, config.printerName, config.printUsbDrainMs)
}

function createPrinter(initialConfig) {
  let currentConfig = initialConfig
  return {
    print: (bytes, opts) => printBytes(currentConfig, bytes, opts || {}),
    updateConfig: (nextConfig) => {
      currentConfig = nextConfig
    },
  }
}

module.exports = { createPrinter, printBytes, purgeSystemPrintQueues }
