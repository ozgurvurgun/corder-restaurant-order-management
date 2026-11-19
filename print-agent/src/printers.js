const net = require("net")
const fs = require("fs")
const os = require("os")
const path = require("path")
const { execFile } = require("child_process")
const { info, warn } = require("./logger")

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
      (err, _stdout, stderr) => {
        if (err) {
          const detail = stderr ? String(stderr).trim().slice(0, 300) : err.message
          reject(new Error(detail || err.message))
          return
        }
        resolve()
      },
    )
  })
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
  [DllImport("winspool.Drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true)]
  public static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);
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

  public static void SendFile(string printerName, string filePath) {
    byte[] bytes = File.ReadAllBytes(filePath);
    IntPtr hPrinter;
    if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
      throw new Exception("OpenPrinter failed for '" + printerName + "' (Win32=" + Marshal.GetLastWin32Error() + ")");
    }
    try {
      DOCINFOW di = new DOCINFOW();
      di.pDocName = "Corder POS Ticket";
      di.pDataType = "RAW";
      if (StartDocPrinter(hPrinter, 1, di) == 0) {
        throw new Exception("StartDocPrinter failed (Win32=" + Marshal.GetLastWin32Error() + ")");
      }
      try {
        StartPagePrinter(hPrinter);
        try {
          int written = 0;
          if (!WritePrinter(hPrinter, bytes, bytes.Length, out written)) {
            throw new Exception("WritePrinter failed (Win32=" + Marshal.GetLastWin32Error() + ")");
          }
        } finally {
          EndPagePrinter(hPrinter);
        }
      } finally {
        EndDocPrinter(hPrinter);
      }
    } finally {
      ClosePrinter(hPrinter);
    }
  }
}
"@
[RawPrinterHelper]::SendFile($printerName, $filePath)
`.trim()

async function sendToWindowsPrinter(tempFile, safeName) {
  try {
    await runExecFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", WIN_RAW_SPOOL_PS],
      25000,
      { CORDER_PRINTER_NAME: safeName, CORDER_PRINT_FILE: tempFile },
    )
  } catch (spoolErr) {
    await runExecFile("cmd.exe", [
      "/d",
      "/s",
      "/c",
      `copy /b "${tempFile}" "\\\\localhost\\${safeName}"`,
    ]).catch(() => {
      throw spoolErr
    })
  }
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
  try {
    if (process.platform === "win32") {
      await sendToWindowsPrinter(tempFile, safeName)
    } else {
      if (process.platform === "linux") {
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
    await sendRawTcp(host, port, bytes)
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
    await sendToSystemPrinter(bytes, sysName, config.printUsbDrainMs)
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

module.exports = { createPrinter, printBytes }
