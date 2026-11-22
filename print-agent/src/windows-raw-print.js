const WIN_RAW_SPOOL_PS = `
$ErrorActionPreference = 'Stop'
$printerName = $env:CORDER_PRINTER_NAME
$filePath = $env:CORDER_PRINT_FILE
if (-not ('RawPrinterHelper' -as [type])) {
  Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class RawPrinterHelper {
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

  public static int SendFileWithResult(string targetPrinter, string filePath) {
    byte[] bytes = File.ReadAllBytes(filePath);
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

  public static string SendFileToDirectUsb(string filterSubstr, string filePath, string[] extraPaths) {
    byte[] bytes = File.ReadAllBytes(filePath);
    List<string> allUsbPaths = new List<string>(GetPresentDevicePaths("28d78fad-5a12-11d1-ae5b-0000f803a8c2"));
    if (extraPaths != null) {
      foreach (string ep in extraPaths) {
        if (!string.IsNullOrEmpty(ep) && !allUsbPaths.Contains(ep)) allUsbPaths.Add(ep);
      }
    }
    if (!string.IsNullOrEmpty(filterSubstr)) {
      foreach (string p in allUsbPaths) {
        if (p.IndexOf(filterSubstr, StringComparison.OrdinalIgnoreCase) >= 0 && WriteToDevicePath(p, bytes)) return p;
      }
    }
    foreach (string p in allUsbPaths) {
      if (WriteToDevicePath(p, bytes)) return p;
    }
    string[] winUsbPaths = GetPresentDevicePaths("dee824ef-729b-4a0e-9c14-b7117d33a817");
    foreach (string p in winUsbPaths) {
      if ((!string.IsNullOrEmpty(filterSubstr) ? p.IndexOf(filterSubstr, StringComparison.OrdinalIgnoreCase) >= 0 : true) && WriteViaWinUsbPath(p, bytes)) return p;
    }
    return "";
  }
}
"@
}

$extraUsbPaths = @()
$devClassKey = "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\DeviceClasses\\{28d78fad-5a12-11d1-ae5b-0000f803a8c2}"
if (Test-Path $devClassKey) {
  foreach ($item in @(Get-ChildItem -LiteralPath $devClassKey -ErrorAction SilentlyContinue)) {
    $childName = [string]$item.PSChildName
    if ($childName -like '##?#*') {
      $extraUsbPaths += ("\\\\?\\" + $childName.Substring(4))
    }
  }
}
$pnpUsb = @(Get-CimInstance Win32_PnPEntity -ErrorAction SilentlyContinue | Where-Object { $_.DeviceID -like 'USB\\*' })
if ($pnpUsb.Count -eq 0) {
  $pnpUsb = @(Get-WmiObject Win32_PnPEntity -ErrorAction SilentlyContinue | Where-Object { $_.DeviceID -like 'USB\\*' })
}
foreach ($d in $pnpUsb) {
  $devId = [string]$d.DeviceID
  if ($devId) {
    $extraUsbPaths += ("\\\\?\\" + ($devId.ToLower().Replace('\\', '#')) + "#{28d78fad-5a12-11d1-ae5b-0000f803a8c2}")
  }
}

if ($printerName -match '\\b(COM\\d{1,3})\\b') {
  $comName = $Matches[1].ToUpper()
  $bytes = [System.IO.File]::ReadAllBytes($filePath)
  try {
    $sp = New-Object System.IO.Ports.SerialPort($comName, 115200, [System.IO.Ports.Parity]::None, 8, [System.IO.Ports.StopBits]::One)
    $sp.WriteTimeout = 5000
    $sp.Open()
    $sp.Write($bytes, 0, $bytes.Length)
    $sp.BaseStream.Flush()
    $sp.Close()
    exit 0
  } catch {
    if ([RawPrinterHelper]::WriteToDevicePath("\\\\.\\$comName", $bytes)) { exit 0 }
  }
}

$vpFilter = ""
if ($printerName -match '([0-9A-Fa-f]{4}):([0-9A-Fa-f]{4})') {
  $vpFilter = "vid_$($Matches[1])&pid_$($Matches[2])"
}
if ($vpFilter -or $printerName -match '^USB Termal Yaz') {
  $matched = [RawPrinterHelper]::SendFileToDirectUsb($vpFilter, $filePath, [string[]]$extraUsbPaths)
  if ($matched) { exit 0 }
}

$errCode = [RawPrinterHelper]::SendFileWithResult($printerName, $filePath)
if ($errCode -eq 0) { exit 0 }

$origPrinter = Get-Printer -Name $printerName -ErrorAction SilentlyContinue
$origDriver = if ($origPrinter) { [string]$origPrinter.DriverName } else { "" }
Get-PrintJob -PrinterName $printerName -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 150
if ([RawPrinterHelper]::SendFileWithResult($printerName, $filePath) -eq 0) {
  Write-Output "HEALED_PRINTER:$printerName"; exit 0
}

$baseName = ($printerName -replace '\\s*\\((Kopya|Copy)\\s*\\d+\\)\\s*$', '').Trim()
$allPrinters = @(Get-Printer -ErrorAction SilentlyContinue | Where-Object {
  $_.Name -ne $printerName -and $_.Name -notmatch '^(Microsoft Print to PDF|Microsoft XPS Document Writer|OneNote|Send To OneNote|Fax)'
})
$candidates = @()
$seen = @{}
foreach ($group in @(
  ($allPrinters | Where-Object { $_.Name -like "$baseName*" }),
  ($allPrinters | Where-Object { $origDriver -and $_.DriverName -eq $origDriver }),
  ($allPrinters | Where-Object { $_.PortName -match '^(USB|POS|COM|TM|ESDPRT|LPT)' }),
  $allPrinters
)) {
  foreach ($p in @($group)) {
    $pKey = if ($p -and $p.Name) { [string]$p.Name } else { "" }
    if ($pKey -and -not $seen.ContainsKey($pKey)) {
      $seen[$pKey] = $true
      $candidates += $p
    }
  }
}
foreach ($cand in $candidates) {
  if ([RawPrinterHelper]::SendFileWithResult([string]$cand.Name, $filePath) -eq 0) {
    Write-Output "HEALED_PRINTER:$($cand.Name)"; exit 0
  }
}

$directMatched = [RawPrinterHelper]::SendFileToDirectUsb($vpFilter, $filePath, [string[]]$extraUsbPaths)
if ($directMatched) {
  if ($directMatched -match 'vid_([0-9a-f]{4})&pid_([0-9a-f]{4})') {
    $v = $Matches[1].ToUpper()
    $pd = $Matches[2].ToUpper()
    Write-Output "HEALED_PRINTER:USB Termal Yazıcı ($($v):$($pd))"
  }
  exit 0
}

[Console]::Error.WriteLine("Windows Yazici Hatasi (Win32=$errCode): '$printerName' yazicisina ulasilamadi. Lutfen yazicinin acik ve USB kablosunun bilgisayara tam takili oldugundan emin olup 'Bilgisayardaki Yazicilari Tara' butonuna basin.")
exit 1
`.trim()

module.exports = { WIN_RAW_SPOOL_PS }
