const fs = require("fs")
const { spawn, execFile } = require("child_process")
const { getWindowsBinary } = require("./windows-usb-direct")

const CSHARP_RAW_PRINTER_SOURCE = `
using System;
using System.IO;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class RawPrinterHelper {
  private static string _cachedUsbPath = "";

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFOW {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }
  [StructLayout(LayoutKind.Sequential)]
  public struct SP_DEVICE_INTERFACE_DATA {
    public int cbSize;
    public Guid InterfaceClassGuid;
    public int Flags;
    public IntPtr Reserved;
  }
  [StructLayout(LayoutKind.Sequential)]
  public struct USB_INTERFACE_DESCRIPTOR {
    public byte bLength;
    public byte bDescriptorType;
    public byte bInterfaceNumber;
    public byte bAlternateSetting;
    public byte bNumEndpoints;
    public byte bInterfaceClass;
    public byte bInterfaceSubClass;
    public byte bInterfaceProtocol;
    public byte iInterface;
  }
  [StructLayout(LayoutKind.Sequential)]
  public struct WINUSB_PIPE_INFORMATION {
    public int PipeType;
    public byte PipeId;
    public ushort MaximumPacketSize;
    public byte Interval;
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

  [DllImport("setupapi.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern IntPtr SetupDiGetClassDevsW(ref Guid ClassGuid, string Enumerator, IntPtr hwndParent, uint Flags);
  [DllImport("setupapi.dll", SetLastError = true)]
  public static extern bool SetupDiEnumDeviceInterfaces(IntPtr DeviceInfoSet, IntPtr DeviceInfoData, ref Guid InterfaceClassGuid, uint MemberIndex, ref SP_DEVICE_INTERFACE_DATA DeviceInterfaceData);
  [DllImport("setupapi.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool SetupDiGetDeviceInterfaceDetailW(IntPtr DeviceInfoSet, ref SP_DEVICE_INTERFACE_DATA DeviceInterfaceData, IntPtr DeviceInterfaceDetailData, uint DeviceInterfaceDetailDataSize, out uint RequiredSize, IntPtr DeviceInfoData);
  [DllImport("setupapi.dll", SetLastError = true)]
  public static extern bool SetupDiDestroyDeviceInfoList(IntPtr DeviceInfoSet);

  [DllImport("kernel32.dll", EntryPoint = "CreateFileW", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern IntPtr CreateFileW(string lpFileName, uint dwDesiredAccess, uint dwShareMode, IntPtr lpSecurityAttributes, uint dwCreationDisposition, uint dwFlagsAndAttributes, IntPtr hTemplateFile);
  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern bool WriteFile(IntPtr hFile, byte[] lpBuffer, uint nNumberOfBytesToWrite, out uint lpNumberOfBytesWritten, IntPtr lpOverlapped);
  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern bool CloseHandle(IntPtr hObject);

  [DllImport("winusb.dll", SetLastError = true)]
  public static extern bool WinUsb_Initialize(IntPtr DeviceHandle, out IntPtr InterfaceHandle);
  [DllImport("winusb.dll", SetLastError = true)]
  public static extern bool WinUsb_Free(IntPtr InterfaceHandle);
  [DllImport("winusb.dll", SetLastError = true)]
  public static extern bool WinUsb_QueryInterfaceSettings(IntPtr InterfaceHandle, byte AlternateInterfaceNumber, out USB_INTERFACE_DESCRIPTOR UsbAltInterfaceDescriptor);
  [DllImport("winusb.dll", SetLastError = true)]
  public static extern bool WinUsb_QueryPipe(IntPtr InterfaceHandle, byte AlternateInterfaceNumber, byte PipeIndex, out WINUSB_PIPE_INFORMATION PipeInformation);
  [DllImport("winusb.dll", SetLastError = true)]
  public static extern bool WinUsb_WritePipe(IntPtr InterfaceHandle, byte PipeID, byte[] Buffer, uint BufferLength, out uint LengthTransferred, IntPtr Overlapped);

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

  public static int SendBytesWithResult(string targetPrinter, byte[] bytes) {
    int err = TrySendBytes(targetPrinter, bytes, "RAW");
    if (err != 0 && TrySendBytes(targetPrinter, bytes, "XPS_PASS") == 0) return 0;
    return err;
  }

  public static string[] GetPresentDevicePaths(string guidStr) {
    List<string> list = new List<string>();
    Guid guid = new Guid(guidStr);
    IntPtr hInfo = SetupDiGetClassDevsW(ref guid, null, IntPtr.Zero, 0x12u);
    if (hInfo == IntPtr.Zero || hInfo == new IntPtr(-1)) return list.ToArray();
    try {
      uint idx = 0;
      while (true) {
        SP_DEVICE_INTERFACE_DATA ifData = new SP_DEVICE_INTERFACE_DATA();
        ifData.cbSize = Marshal.SizeOf(typeof(SP_DEVICE_INTERFACE_DATA));
        if (!SetupDiEnumDeviceInterfaces(hInfo, IntPtr.Zero, ref guid, idx, ref ifData)) break;
        idx++;
        uint reqSize = 0;
        SetupDiGetDeviceInterfaceDetailW(hInfo, ref ifData, IntPtr.Zero, 0, out reqSize, IntPtr.Zero);
        if (reqSize == 0 || reqSize > 4096) continue;
        IntPtr detailBuf = Marshal.AllocHGlobal((int)reqSize);
        try {
          Marshal.WriteInt32(detailBuf, IntPtr.Size == 8 ? 8 : 6);
          if (SetupDiGetDeviceInterfaceDetailW(hInfo, ref ifData, detailBuf, reqSize, out reqSize, IntPtr.Zero)) {
            IntPtr pPath = new IntPtr(detailBuf.ToInt64() + 4);
            string path = Marshal.PtrToStringUni(pPath);
            if (!string.IsNullOrEmpty(path)) list.Add(path);
          }
        } finally { Marshal.FreeHGlobal(detailBuf); }
      }
    } finally { SetupDiDestroyDeviceInfoList(hInfo); }
    return list.ToArray();
  }

  public static bool WriteToDevicePath(string devPath, byte[] bytes) {
    if (string.IsNullOrEmpty(devPath)) return false;
    IntPtr hFile = CreateFileW(devPath, 0x40000000u, 3u, IntPtr.Zero, 3u, 0u, IntPtr.Zero);
    if (hFile == IntPtr.Zero || hFile == new IntPtr(-1)) {
      hFile = CreateFileW(devPath, 0xC0000000u, 3u, IntPtr.Zero, 3u, 0u, IntPtr.Zero);
    }
    if (hFile == IntPtr.Zero || hFile == new IntPtr(-1)) return false;
    try {
      int offset = 0;
      while (offset < bytes.Length) {
        int chunk = Math.Min(4096, bytes.Length - offset);
        byte[] buf = new byte[chunk];
        Array.Copy(bytes, offset, buf, 0, chunk);
        uint written = 0;
        if (!WriteFile(hFile, buf, (uint)chunk, out written, IntPtr.Zero) || written == 0) return false;
        offset += (int)written;
      }
      return true;
    } finally { CloseHandle(hFile); }
  }

  public static bool WriteViaWinUsbPath(string devPath, byte[] bytes) {
    if (string.IsNullOrEmpty(devPath)) return false;
    IntPtr hFile = CreateFileW(devPath, 0xC0000000u, 3u, IntPtr.Zero, 3u, 0x40000000u, IntPtr.Zero);
    if (hFile == IntPtr.Zero || hFile == new IntPtr(-1)) return false;
    try {
      IntPtr hUsb;
      if (!WinUsb_Initialize(hFile, out hUsb)) return false;
      try {
        byte bulkOutPipe = 0;
        USB_INTERFACE_DESCRIPTOR desc;
        if (WinUsb_QueryInterfaceSettings(hUsb, 0, out desc)) {
          for (byte i = 0; i < desc.bNumEndpoints; i++) {
            WINUSB_PIPE_INFORMATION pipe;
            if (WinUsb_QueryPipe(hUsb, 0, i, out pipe)) {
              if (pipe.PipeType == 2 && (pipe.PipeId & 0x80) == 0) {
                bulkOutPipe = pipe.PipeId;
                break;
              }
            }
          }
        }
        if (bulkOutPipe == 0) bulkOutPipe = 0x01;
        uint transferred = 0;
        return WinUsb_WritePipe(hUsb, bulkOutPipe, bytes, (uint)bytes.Length, out transferred, IntPtr.Zero) && transferred > 0;
      } finally { WinUsb_Free(hUsb); }
    } finally { CloseHandle(hFile); }
  }

  public static string SendBytesToDirectUsb(string filterSubstr, byte[] bytes, string[] extraPaths) {
    if (!string.IsNullOrEmpty(_cachedUsbPath)) {
      if (string.IsNullOrEmpty(filterSubstr) || _cachedUsbPath.IndexOf(filterSubstr, StringComparison.OrdinalIgnoreCase) >= 0) {
        if (WriteToDevicePath(_cachedUsbPath, bytes)) return _cachedUsbPath;
      }
    }
    string[] usbPaths = GetPresentDevicePaths("28d78fad-5a12-11d1-ae5b-0000f803a8c2");
    if (!string.IsNullOrEmpty(filterSubstr)) {
      foreach (string p in usbPaths) {
        if (p.IndexOf(filterSubstr, StringComparison.OrdinalIgnoreCase) >= 0 && WriteToDevicePath(p, bytes)) {
          _cachedUsbPath = p;
          return p;
        }
      }
    }
    foreach (string p in usbPaths) {
      if (WriteToDevicePath(p, bytes)) {
        _cachedUsbPath = p;
        return p;
      }
    }
    if (extraPaths != null) {
      foreach (string ep in extraPaths) {
        if (!string.IsNullOrEmpty(ep) && (!string.IsNullOrEmpty(filterSubstr) ? ep.IndexOf(filterSubstr, StringComparison.OrdinalIgnoreCase) >= 0 : true) && WriteToDevicePath(ep, bytes)) {
          _cachedUsbPath = ep;
          return ep;
        }
      }
      foreach (string ep in extraPaths) {
        if (!string.IsNullOrEmpty(ep) && WriteToDevicePath(ep, bytes)) {
          _cachedUsbPath = ep;
          return ep;
        }
      }
    }
    string[] winUsbPaths = GetPresentDevicePaths("dee824ef-729b-4a0e-9c14-b7117d33a817");
    foreach (string p in winUsbPaths) {
      if ((!string.IsNullOrEmpty(filterSubstr) ? p.IndexOf(filterSubstr, StringComparison.OrdinalIgnoreCase) >= 0 : true) && WriteViaWinUsbPath(p, bytes)) return p;
    }
    return "";
  }
}
`.trim()

const PS_LOAD_HELPER_SNIPPET = `
$dllPath = Join-Path $env:TEMP "CorderRawPrinterV3.dll"
if (-not ('RawPrinterHelper' -as [type])) {
  if (Test-Path $dllPath) {
    try { [void][System.Reflection.Assembly]::LoadFrom($dllPath) } catch {}
  }
}
if (-not ('RawPrinterHelper' -as [type])) {
  $csCode = @'
${CSHARP_RAW_PRINTER_SOURCE}
'@
  try {
    Add-Type -TypeDefinition $csCode -OutputAssembly $dllPath -ErrorAction Stop
    [void][System.Reflection.Assembly]::LoadFrom($dllPath)
  } catch {
    if (-not ('RawPrinterHelper' -as [type])) {
      Add-Type -TypeDefinition $csCode
    }
  }
}

function Get-CorderExtraUsbPaths {
  $extra = @()
  $devClassKey = "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\DeviceClasses\\{28d78fad-5a12-11d1-ae5b-0000f803a8c2}"
  if (Test-Path $devClassKey) {
    foreach ($item in @(Get-ChildItem -LiteralPath $devClassKey -ErrorAction SilentlyContinue)) {
      $childName = [string]$item.PSChildName
      if ($childName -like '##?#*') {
        $extra += ("\\\\?\\" + $childName.Substring(4))
      }
    }
  }
  return [string[]]$extra
}

function Invoke-CorderPrintBytes([string]$printerName, [byte[]]$bytes) {
  if ($printerName -match '\\b(COM\\d{1,3})\\b') {
    $comName = $Matches[1].ToUpper()
    try {
      $sp = New-Object System.IO.Ports.SerialPort($comName, 115200, [System.IO.Ports.Parity]::None, 8, [System.IO.Ports.StopBits]::One)
      $sp.WriteTimeout = 5000
      $sp.Open()
      $sp.Write($bytes, 0, $bytes.Length)
      $sp.BaseStream.Flush()
      $sp.Close()
      return @{ ok = $true; healed = "" }
    } catch {
      if ([RawPrinterHelper]::WriteToDevicePath("\\\\.\\$comName", $bytes)) {
        return @{ ok = $true; healed = "" }
      }
    }
  }

  $vpFilter = ""
  if ($printerName -match '([0-9A-Fa-f]{4}):([0-9A-Fa-f]{4})') {
    $vpFilter = "vid_$($Matches[1])&pid_$($Matches[2])"
  }
  if ($vpFilter -or $printerName -match '^USB Termal Yaz') {
    $matched = [RawPrinterHelper]::SendBytesToDirectUsb($vpFilter, $bytes, $null)
    if (-not $matched) {
      $matched = [RawPrinterHelper]::SendBytesToDirectUsb($vpFilter, $bytes, (Get-CorderExtraUsbPaths))
    }
    if ($matched) { return @{ ok = $true; healed = "" } }
  }

  $errCode = [RawPrinterHelper]::SendBytesWithResult($printerName, $bytes)
  if ($errCode -eq 0) { return @{ ok = $true; healed = "" } }

  $directFast = [RawPrinterHelper]::SendBytesToDirectUsb($vpFilter, $bytes, (Get-CorderExtraUsbPaths))
  if ($directFast) {
    $healedName = ""
    if ($directFast -match 'vid_([0-9a-f]{4})&pid_([0-9a-f]{4})') {
      $healedName = "USB Termal Yazıcı ($($Matches[1].ToUpper()):$($Matches[2].ToUpper()))"
    }
    return @{ ok = $true; healed = $healedName }
  }

  $allPrinters = @(Get-Printer -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -ne $printerName -and $_.Name -notmatch '^(Microsoft Print to PDF|Microsoft XPS Document Writer|OneNote|Send To OneNote|Fax)'
  })
  foreach ($cand in $allPrinters) {
    if ($cand -and $cand.Name -and [RawPrinterHelper]::SendBytesWithResult([string]$cand.Name, $bytes) -eq 0) {
      return @{ ok = $true; healed = [string]$cand.Name }
    }
  }

  return @{ ok = $false; error = "Windows Yazici Hatasi (Win32=$errCode): '$printerName' yazicisina ulasilamadi. Lutfen yazicinin acik ve USB kablosunun takili oldugundan emin olun." }
}
`.trim()

const WIN_WORKER_LOOP_PS = `
$ErrorActionPreference = 'Continue'
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
${PS_LOAD_HELPER_SNIPPET}
[Console]::Out.WriteLine("CORDER_WORKER_READY")
[Console]::Out.Flush()

while ($null -ne ($line = [Console]::In.ReadLine())) {
  if (-not $line) { continue }
  if ($line.StartsWith("PRINT|")) {
    $parts = $line.Split('|')
    if ($parts.Length -ge 4) {
      $reqId = $parts[1]
      try {
        $pName = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($parts[2]))
        $bytes = [Convert]::FromBase64String($parts[3])
        $res = Invoke-CorderPrintBytes $pName $bytes
        if ($res.ok) {
          [Console]::Out.WriteLine("CORDER_RES|$reqId|OK|$($res.healed)")
        } else {
          [Console]::Out.WriteLine("CORDER_RES|$reqId|ERR|$($res.error)")
        }
      } catch {
        $msg = ($_.Exception.Message -replace '[\\r\\n|]+', ' ').Trim()
        [Console]::Out.WriteLine("CORDER_RES|$reqId|ERR|$msg")
      }
      [Console]::Out.Flush()
    }
  }
}
`.trim()

const WIN_RAW_SPOOL_PS = `
$ErrorActionPreference = 'Stop'
${PS_LOAD_HELPER_SNIPPET}
$bytes = [System.IO.File]::ReadAllBytes($env:CORDER_PRINT_FILE)
$res = Invoke-CorderPrintBytes $env:CORDER_PRINTER_NAME $bytes
if ($res.ok) {
  if ($res.healed) { Write-Output "HEALED_PRINTER:$($res.healed)" }
  exit 0
}
[Console]::Error.WriteLine($res.error)
exit 1
`.trim()

let workerProc = null
let workerReady = false
let workerReqSeq = 0
let stdoutBuf = ""
const pendingReqs = new Map()

function cleanupWorker(reason = "Worker closed") {
  workerProc = null
  workerReady = false
  stdoutBuf = ""
  for (const [, req] of pendingReqs) {
    clearTimeout(req.timer)
    req.reject(new Error(reason))
  }
  pendingReqs.clear()
}

function ensureWarmPrintWorker() {
  if (process.platform !== "win32") return null
  if (workerProc && !workerProc.killed) return workerProc

  try {
    const proc = spawn(
      getWindowsBinary("powershell.exe"),
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "-"],
      { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
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
          continue
        }
        if (line.startsWith("CORDER_RES|")) {
          const parts = line.split("|")
          const reqId = parts[1]
          const status = parts[2]
          const payload = parts.slice(3).join("|").trim()
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

    proc.on("error", () => cleanupWorker("Worker process error"))
    proc.on("exit", () => cleanupWorker("Worker process exited"))
    if (typeof proc.unref === "function") proc.unref()

    proc.stdin.write(WIN_WORKER_LOOP_PS + "\n")
    return proc
  } catch {
    workerProc = null
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
    const timer = setTimeout(() => {
      pendingReqs.delete(reqId)
      reject(new Error("Warm worker timeout"))
    }, timeoutMs)

    pendingReqs.set(reqId, { resolve, reject, timer })
    proc.stdin.write(`PRINT|${reqId}|${nameB64}|${bytesB64}\n`, (err) => {
      if (err) {
        clearTimeout(timer)
        pendingReqs.delete(reqId)
        reject(err)
      }
    })
  })
}

if (process.platform === "win32") {
  setTimeout(() => ensureWarmPrintWorker(), 50)
  process.on("exit", () => {
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
  sendViaWarmWorker,
  ensureWarmPrintWorker,
}
