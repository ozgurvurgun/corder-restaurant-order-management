const CSHARP_RAW_PRINTER_SOURCE = `
using System;
using System.IO;
using System.Text;
using System.IO.Ports;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using Microsoft.Win32;

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

  public static bool CanOpenDevicePath(string devPath) {
    if (string.IsNullOrEmpty(devPath)) return false;
    IntPtr hFile = CreateFileW(devPath, 0x40000000u, 3u, IntPtr.Zero, 3u, 0u, IntPtr.Zero);
    if (hFile == IntPtr.Zero || hFile == new IntPtr(-1)) {
      hFile = CreateFileW(devPath, 0xC0000000u, 3u, IntPtr.Zero, 3u, 0u, IntPtr.Zero);
    }
    if (hFile != IntPtr.Zero && hFile != new IntPtr(-1)) {
      CloseHandle(hFile);
      return true;
    }
    return false;
  }

  public static void WarmupUsbCache() {
    try {
      string[] paths = GetPresentDevicePaths("28d78fad-5a12-11d1-ae5b-0000f803a8c2");
      if (paths != null && paths.Length > 0) {
        _cachedUsbPath = paths[0];
        return;
      }
      string[] regPaths = GetRegistryUsbPrintPaths();
      if (regPaths != null) {
        foreach (string rp in regPaths) {
          if (CanOpenDevicePath(rp)) {
            _cachedUsbPath = rp;
            return;
          }
        }
      }
    } catch {}
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

  public static string[] GetRegistryUsbPrintPaths() {
    List<string> list = new List<string>();
    try {
      using (RegistryKey key = Registry.LocalMachine.OpenSubKey("SYSTEM\\\\CurrentControlSet\\\\Control\\\\DeviceClasses\\\\{28d78fad-5a12-11d1-ae5b-0000f803a8c2}")) {
        if (key != null) {
          foreach (string sub in key.GetSubKeyNames()) {
            if (sub != null && sub.StartsWith("##?#")) {
              list.Add("\\\\\\\\?\\\\" + sub.Substring(4));
            }
          }
        }
      }
    } catch {}
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

  public static string SendBytesToDirectUsb(string filterSubstr, byte[] bytes) {
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
    string[] regPaths = GetRegistryUsbPrintPaths();
    if (!string.IsNullOrEmpty(filterSubstr)) {
      foreach (string ep in regPaths) {
        if (ep.IndexOf(filterSubstr, StringComparison.OrdinalIgnoreCase) >= 0 && WriteToDevicePath(ep, bytes)) {
          _cachedUsbPath = ep;
          return ep;
        }
      }
    }
    foreach (string ep in regPaths) {
      if (WriteToDevicePath(ep, bytes)) {
        _cachedUsbPath = ep;
        return ep;
      }
    }
    string[] winUsbPaths = GetPresentDevicePaths("dee824ef-729b-4a0e-9c14-b7117d33a817");
    foreach (string p in winUsbPaths) {
      if ((!string.IsNullOrEmpty(filterSubstr) ? p.IndexOf(filterSubstr, StringComparison.OrdinalIgnoreCase) >= 0 : true) && WriteViaWinUsbPath(p, bytes)) return p;
    }
    return "";
  }

  public static bool ExecutePrintJob(string printerName, byte[] bytes, out string healedName, out string errMsg) {
    healedName = "";
    errMsg = "";
    if (string.IsNullOrEmpty(printerName)) printerName = "";

    Match comMatch = Regex.Match(printerName, "\\\\b(COM\\\\d{1,3})\\\\b", RegexOptions.IgnoreCase);
    if (comMatch.Success) {
      string comName = comMatch.Groups[1].Value.ToUpperInvariant();
      try {
        using (SerialPort sp = new SerialPort(comName, 115200, Parity.None, 8, StopBits.One)) {
          sp.WriteTimeout = 4000;
          sp.Open();
          sp.Write(bytes, 0, bytes.Length);
          sp.BaseStream.Flush();
          sp.Close();
          return true;
        }
      } catch {
        if (WriteToDevicePath("\\\\\\\\.\\\\" + comName, bytes)) return true;
      }
    }

    string vpFilter = "";
    Match vpMatch = Regex.Match(printerName, "([0-9A-Fa-f]{4}):([0-9A-Fa-f]{4})");
    if (vpMatch.Success) {
      vpFilter = "vid_" + vpMatch.Groups[1].Value + "&pid_" + vpMatch.Groups[2].Value;
    }

    if (!string.IsNullOrEmpty(vpFilter) || printerName.StartsWith("USB Termal Yaz", StringComparison.OrdinalIgnoreCase)) {
      string matched = SendBytesToDirectUsb(vpFilter, bytes);
      if (!string.IsNullOrEmpty(matched)) return true;
    }

    int errCode = SendBytesWithResult(printerName, bytes);
    if (errCode == 0) return true;

    string directFallback = SendBytesToDirectUsb(vpFilter, bytes);
    if (!string.IsNullOrEmpty(directFallback)) {
      Match m = Regex.Match(directFallback, "vid_([0-9a-f]{4})&pid_([0-9a-f]{4})", RegexOptions.IgnoreCase);
      if (m.Success) {
        healedName = "USB Termal Yazıcı (" + m.Groups[1].Value.ToUpperInvariant() + ":" + m.Groups[2].Value.ToUpperInvariant() + ")";
      }
      return true;
    }

    errMsg = "Windows Yazici Hatasi (Win32=" + errCode + "): '" + printerName + "' yazicisina ulasilamadi. Lutfen yazicinin acik ve USB kablosunun takili oldugundan emin olun.";
    return false;
  }

  public static void RunWorkerLoop() {
    WarmupUsbCache();
    Stream stdinStream = Console.OpenStandardInput();
    Stream stdoutStream = Console.OpenStandardOutput();
    StreamReader reader = new StreamReader(stdinStream, Encoding.ASCII, false, 65536);
    StreamWriter writer = new StreamWriter(stdoutStream, Encoding.ASCII, 16384) { AutoFlush = true };
    writer.WriteLine("CORDER_WORKER_READY");

    string line;
    while ((line = reader.ReadLine()) != null) {
      if (string.IsNullOrEmpty(line) || !line.StartsWith("PRINT|")) continue;
      string[] parts = line.Split('|');
      if (parts.Length < 4) continue;
      string reqId = parts[1];
      try {
        string pName = Encoding.UTF8.GetString(Convert.FromBase64String(parts[2]));
        byte[] bytes = Convert.FromBase64String(parts[3]);
        string healed;
        string err;
        if (ExecutePrintJob(pName, bytes, out healed, out err)) {
          string healedB64 = string.IsNullOrEmpty(healed)
            ? ""
            : Convert.ToBase64String(Encoding.UTF8.GetBytes(healed));
          writer.WriteLine("CORDER_RES|" + reqId + "|OK|" + healedB64);
        } else {
          string errB64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(err ?? "Yazdirma hatasi"));
          writer.WriteLine("CORDER_RES|" + reqId + "|ERR|" + errB64);
        }
      } catch (Exception ex) {
        string msg = (ex.Message ?? "Hata").Replace("\\r", " ").Replace("\\n", " ");
        string errB64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(msg));
        writer.WriteLine("CORDER_RES|" + reqId + "|ERR|" + errB64);
      }
    }
  }
}
`.trim()

module.exports = { CSHARP_RAW_PRINTER_SOURCE }

