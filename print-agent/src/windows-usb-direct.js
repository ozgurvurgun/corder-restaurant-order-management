const fs = require("fs")
const path = require("path")
const { execFile } = require("child_process")

const VIRTUAL_WIN_PRINTER_RE =
  /^(Microsoft Print to PDF|Microsoft XPS Document Writer|OneNote|Send To OneNote|Fax|Adobe PDF|Foxit .* PDF|CutePDF|Bullzip PDF|doPDF|PDFCreator)/i

function getWindowsBinary(name) {
  if (process.platform !== "win32") return name
  const sysRoot = process.env.SystemRoot || process.env.windir || "C:\\Windows"
  const lower = String(name || "").toLowerCase()
  if (lower === "powershell.exe") {
    const full = path.join(sysRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
    if (fs.existsSync(full)) return full
  }
  if (lower === "reg.exe") {
    const full = path.join(sysRoot, "System32", "reg.exe")
    if (fs.existsSync(full)) return full
  }
  return name
}

function execWinText(binary, args, timeoutMs = 8000, extraEnv = null) {
  return new Promise((resolve) => {
    execFile(
      getWindowsBinary(binary),
      args,
      {
        timeout: timeoutMs,
        windowsHide: true,
        shell: false,
        maxBuffer: 1024 * 1024,
        ...(extraEnv ? { env: { ...process.env, ...extraEnv } } : {}),
      },
      (err, stdout) => {
        if (err) {
          resolve("")
          return
        }
        resolve(String(stdout || "").trim())
      },
    )
  })
}

function sanitizeModelLabel(raw) {
  const clean = String(raw || "")
    .replace(/[^\p{L}\p{N}_. \-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!clean) return ""
  if (
    /^(usb\s*(printing\s*support|yazd[iı]rma\s*deste[gğ]i|bile[sş]ik\s*ayg[iı]t|composite\s*device)|unknown.*|generic.*)$/i.test(
      clean,
    )
  ) {
    return ""
  }
  return clean.slice(0, 42)
}

function formatDirectUsbPrinterName(vid, pid, modelHint = "") {
  const v = String(vid || "0000").toUpperCase()
  const p = String(pid || "0000").toUpperCase()
  const model = sanitizeModelLabel(modelHint)
  return model
    ? `USB Termal Yazıcı - ${model} (${v}:${p})`
    : `USB Termal Yazıcı (${v}:${p})`
}

const WIN_DISCOVER_ALL_PS = `
$ErrorActionPreference = 'SilentlyContinue'
$result = @{ usbDirect = @(); comPorts = @(); spooler = @() }

$dllPath = Join-Path $env:TEMP "CorderUsbSetupV3.dll"
if (-not ('CorderUsbSetupApi' -as [type])) {
  if (Test-Path $dllPath) {
    try { [void][System.Reflection.Assembly]::LoadFrom($dllPath) } catch {}
  }
}
if (-not ('CorderUsbSetupApi' -as [type])) {
  $csSetup = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public class CorderUsbSetupApi {
  [StructLayout(LayoutKind.Sequential)]
  public struct SP_DEVICE_INTERFACE_DATA {
    public int cbSize;
    public Guid InterfaceClassGuid;
    public int Flags;
    public IntPtr Reserved;
  }

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
  public static extern bool CloseHandle(IntPtr hObject);

  public static bool CanOpenDevicePath(string devPath) {
    if (string.IsNullOrEmpty(devPath)) return false;
    IntPtr h = CreateFileW(devPath, 0x40000000u, 3u, IntPtr.Zero, 3u, 0u, IntPtr.Zero);
    if (h == IntPtr.Zero || h == new IntPtr(-1)) {
      h = CreateFileW(devPath, 0xC0000000u, 3u, IntPtr.Zero, 3u, 0u, IntPtr.Zero);
    }
    if (h != IntPtr.Zero && h != new IntPtr(-1)) {
      CloseHandle(h);
      return true;
    }
    return false;
  }

  public static string[] GetPresentPaths(string guidString) {
    List<string> list = new List<string>();
    Guid guid = new Guid(guidString);
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
        } finally {
          Marshal.FreeHGlobal(detailBuf);
        }
      }
    } finally {
      SetupDiDestroyDeviceInfoList(hInfo);
    }
    return list.ToArray();
  }
}
'@
  try {
    Add-Type -TypeDefinition $csSetup -OutputAssembly $dllPath -ErrorAction Stop
    [void][System.Reflection.Assembly]::LoadFrom($dllPath)
  } catch {
    if (-not ('CorderUsbSetupApi' -as [type])) {
      Add-Type -TypeDefinition $csSetup
    }
  }
}

$pnpList = @(Get-CimInstance Win32_PnPEntity -Filter "DeviceID LIKE 'USB%' OR DeviceID LIKE 'USBPRINT%'" -ErrorAction SilentlyContinue)
if ($pnpList.Count -eq 0) {
  $pnpList = @(Get-WmiObject Win32_PnPEntity -Filter "DeviceID LIKE 'USB%' OR DeviceID LIKE 'USBPRINT%'" -ErrorAction SilentlyContinue)
}

$ieeeModels = @()
foreach ($d in $pnpList) {
  $devId = [string]$d.DeviceID
  if ($devId -like 'USBPRINT\\*') {
    $parts = $devId.Split('\\')
    if ($parts.Length -ge 2 -and $parts[1]) {
      $ieeeModels += $parts[1]
    } elseif ($d.Name) {
      $ieeeModels += [string]$d.Name
    }
  }
}

$regUsbPrintPath = "HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\USBPRINT"
if (Test-Path $regUsbPrintPath) {
  foreach ($sub in @(Get-ChildItem -LiteralPath $regUsbPrintPath -ErrorAction SilentlyContinue)) {
    $mName = [string]$sub.PSChildName
    if ($mName -and $ieeeModels -notcontains $mName) {
      $ieeeModels += $mName
    }
  }
}

$presentPaths = @()
$seenLowerPaths = @{}
function Add-UsbPathIfNew([string]$p) {
  if (-not $p) { return }
  $k = $p.ToLower()
  if (-not $seenLowerPaths.ContainsKey($k)) {
    $seenLowerPaths[$k] = $true
    $script:presentPaths += $p
  }
}

if ('CorderUsbSetupApi' -as [type]) {
  foreach ($p in @([CorderUsbSetupApi]::GetPresentPaths("28d78fad-5a12-11d1-ae5b-0000f803a8c2"))) {
    Add-UsbPathIfNew $p
  }
}

$devClassKey = "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\DeviceClasses\\{28d78fad-5a12-11d1-ae5b-0000f803a8c2}"
if (Test-Path $devClassKey) {
  foreach ($item in @(Get-ChildItem -LiteralPath $devClassKey -ErrorAction SilentlyContinue)) {
    $childName = [string]$item.PSChildName
    if ($childName -like '##?#*') {
      $candPath = "\\\\?\\" + $childName.Substring(4)
      if (('CorderUsbSetupApi' -as [type]) -and [CorderUsbSetupApi]::CanOpenDevicePath($candPath)) {
        Add-UsbPathIfNew $candPath
      }
    }
  }
}

foreach ($d in $pnpList) {
  $devId = [string]$d.DeviceID
  $svc = [string]$d.Service
  $name = [string]$d.Name
  $compat = if ($d.CompatibleID) { ($d.CompatibleID -join ' ') } else { '' }
  if ($devId -like 'USB\\*' -and ($svc -eq 'usbprint' -or $compat -match 'Class_07' -or $devId -match 'VID_(0483|0416|04B8|0519|1504|0FE6|1FC9|28E9|1A86|067B|0471|20D1|2730|0DD4|154F|6868|8866|0493|1659)' -or $name -match 'POS|Thermal|Termal|Printer|Yazici|Receipt|Xprinter|Rongta|Bixolon|Epson|Star|HPRT|Zywell|Gprinter|Sewoo|Zjiang')) {
    if ($svc -eq 'WinUSB') {
      $result.usbDirect += @{
        devicePath = $devId
        model = $name
        mode = "winusb"
      }
    } else {
      $constructed = "\\\\?\\" + ($devId.ToLower().Replace('\\', '#')) + "#{28d78fad-5a12-11d1-ae5b-0000f803a8c2}"
      Add-UsbPathIfNew $constructed
      if ($name -and $ieeeModels -notcontains $name) {
        $ieeeModels += $name
      }
    }
  }
  if (($d.PNPClass -eq 'Ports' -or $name -match '\\(COM\\d+\\)') -and $devId -like 'USB\\*') {
    if ($name -match '\\((COM\\d+)\\)') {
      $result.comPorts += @{
        com = $Matches[1].ToUpper()
        name = $name
      }
    }
  }
}

$idx = 0
foreach ($p in $presentPaths) {
  $model = if ($idx -lt $ieeeModels.Count) { [string]$ieeeModels[$idx] } elseif ($ieeeModels.Count -gt 0) { [string]$ieeeModels[0] } else { "" }
  $idx++
  $result.usbDirect += @{
    devicePath = [string]$p
    model = $model
    mode = "usbprint"
  }
}

$serialCommKey = "HKLM:\\HARDWARE\\DEVICEMAP\\SERIALCOMM"
if (Test-Path $serialCommKey) {
  $props = Get-ItemProperty -LiteralPath $serialCommKey -ErrorAction SilentlyContinue
  if ($props) {
    foreach ($prop in $props.PSObject.Properties) {
      if ($prop.Name -match 'USBSER|VCP|CH34|Prolific|Silab|FTDI|USB' -and [string]$prop.Value -match '^COM\\d+$') {
        $result.comPorts += @{
          com = ([string]$prop.Value).ToUpper()
          name = ""
        }
      }
    }
  }
}

$printers = @(Get-Printer -ErrorAction SilentlyContinue)
if ($printers.Count -eq 0) {
  $printers = @(Get-WmiObject Win32_Printer -ErrorAction SilentlyContinue)
}
foreach ($pr in $printers) {
  $pName = [string]$pr.Name
  $pStatus = [string]$pr.PrinterStatus
  if (-not $pName -or $pStatus -match 'PendingDeletion|Deleting') { continue }
  $result.spooler += @{
    name = $pName
    driverName = [string]$pr.DriverName
    portName = [string]$pr.PortName
    status = $pStatus
  }
}

$result | ConvertTo-Json -Compress -Depth 4
`.trim()

async function discoverWindowsDirectAndSpoolerPrinters(extraPrinters = []) {
  const psRaw = await execWinText(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", WIN_DISCOVER_ALL_PS],
    9000,
  )

  let psData = { usbDirect: [], comPorts: [], spooler: [] }
  if (psRaw) {
    try {
      const parsed = JSON.parse(psRaw)
      if (parsed && typeof parsed === "object") psData = parsed
    } catch {
      // ignore json parse failure
    }
  }

  const merged = new Map()
  const seenVidPids = new Set()

  const addDirectUsb = (rawPath, rawModel = "", mode = "usbprint") => {
    const vp = String(rawPath || "").match(/VID_([0-9A-F]{4})&PID_([0-9A-F]{4})/i)
    const vid = vp ? vp[1].toUpperCase() : "0000"
    const pid = vp ? vp[2].toUpperCase() : "0000"
    const key = `${mode}:${vid}:${pid}`
    if (seenVidPids.has(key)) return
    seenVidPids.add(key)
    const cleanModel = sanitizeModelLabel(String(rawModel || "").replace(/_/g, " "))
    const name =
      mode === "winusb"
        ? `USB Termal Yazıcı ${cleanModel ? `- ${cleanModel} ` : ""}(WINUSB:${vid}:${pid})`
        : formatDirectUsbPrinterName(vid, pid, cleanModel)
    merged.set(name, {
      name,
      driverName: "Sürücüsüz Doğrudan USB (Tak-Çalıştır)",
      portName: `USB Kablo (${vid}:${pid})`,
      status: "Ready",
      isDefault: merged.size === 0,
      source: "windows-usb-direct",
    })
  }

  for (const item of Array.isArray(psData.usbDirect) ? psData.usbDirect : []) {
    if (item && item.devicePath) addDirectUsb(item.devicePath, item.model, item.mode || "usbprint")
  }

  const seenComs = new Set()
  const addComPort = (comRaw, labelRaw = "") => {
    const com = String(comRaw || "").trim().toUpperCase()
    if (!/^COM\d{1,3}$/.test(com) || seenComs.has(com)) return
    seenComs.add(com)
    const cleanDesc = sanitizeModelLabel(String(labelRaw || "").replace(/\(COM\d+\)/gi, ""))
    const name = cleanDesc
      ? `USB Seri Termal Yazıcı - ${cleanDesc} (${com})`
      : `USB Seri Termal Yazıcı (${com})`
    merged.set(name, {
      name,
      driverName: "Sürücüsüz USB-Seri (Tak-Çalıştır)",
      portName: com,
      status: "Ready",
      isDefault: merged.size === 0,
      source: "windows-usb-serial",
    })
  }

  for (const c of Array.isArray(psData.comPorts) ? psData.comPorts : []) {
    if (c && c.com) addComPort(c.com, c.name)
  }

  for (const sp of Array.isArray(psData.spooler) ? psData.spooler : []) {
    const name = String(sp?.name || "").trim()
    if (!name || VIRTUAL_WIN_PRINTER_RE.test(name) || merged.has(name)) continue
    merged.set(name, {
      name,
      driverName: String(sp.driverName || "Windows Spooler").trim(),
      portName: String(sp.portName || "USB").trim(),
      status: String(sp.status || "Ready"),
      isDefault: merged.size === 0,
      source: "windows",
    })
  }

  for (const extra of Array.isArray(extraPrinters) ? extraPrinters : []) {
    const name = String(extra?.name || extra?.displayName || "").trim()
    if (!name || VIRTUAL_WIN_PRINTER_RE.test(name) || merged.has(name)) continue
    const statusNum = Number(extra?.status)
    if (Number.isFinite(statusNum) && (statusNum & 0x00000004) !== 0) continue
    if (/pending|deleting/i.test(String(extra?.status || ""))) continue
    merged.set(name, {
      name,
      driverName: String(extra?.driverName || extra?.description || "Windows Spooler").trim(),
      portName: String(extra?.options?.["printer-location"] || "USB / Spooler").trim(),
      status: "Ready",
      isDefault: Boolean(extra?.isDefault) || merged.size === 0,
      source: "windows",
    })
  }

  return [...merged.values()]
}

module.exports = {
  getWindowsBinary,
  discoverWindowsDirectAndSpoolerPrinters,
}
