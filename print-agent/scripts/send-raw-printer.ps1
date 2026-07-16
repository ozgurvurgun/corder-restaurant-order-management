# -----------------------------------------------------------------------------
# ROOT CAUSE (ticket only appears after unplug/replug):
# WritePrinter often only writes into the Winspool/USB driver buffer;
# if ClosePrinter is called too early, the channel can close before the last
# USB bulk transfer finishes and data stays buffered. Unplugging resets USB
# and the buffered (or next) job becomes visible.
# FIX: Small chunks + delays between chunks; delay between EndDoc and
# ClosePrinter. Permanent fix: Ethernet + PRINTER_MODE=network_raw.
#
# SLOW PRINT (~30-60s): Each run COMPILES C# via Add-Type; very slow on weak PCs.
# RawPrinterHelper.dll + .version compiles once, then loads via Path.
# -----------------------------------------------------------------------------

param(
  [Parameter(Mandatory = $true)]
  [string]$PrinterName,

  [Parameter(Mandatory = $true)]
  [string]$FilePath
)

if (!(Test-Path $FilePath)) {
  Write-Error "File not found: $FilePath"
  exit 1
}

$source = @"
using System;
using System.Runtime.InteropServices;
using System.Threading;

public class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
    public class DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)]
        public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)]
        public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)]
        public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="AbortPrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool AbortPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static bool SendBytesToPrinter(string printerName, byte[] bytes)
    {
        IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
        Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);

        IntPtr hPrinter;
        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero))
        {
            Marshal.FreeCoTaskMem(pUnmanagedBytes);
            return false;
        }

        DOCINFOA di = new DOCINFOA();
        di.pDocName = "Corder Print Job";
        di.pOutputFile = null;
        di.pDataType = "RAW";

        bool success = false;

        if (StartDocPrinter(hPrinter, 1, di))
        {
            if (!StartPagePrinter(hPrinter))
            {
                AbortPrinter(hPrinter);
            }
            else
            {
                const int chunkSize = 1024;
                int offset = 0;
                bool writeOk = true;
                while (offset < bytes.Length && writeOk)
                {
                    int len = Math.Min(chunkSize, bytes.Length - offset);
                    long addr = pUnmanagedBytes.ToInt64() + offset;
                    IntPtr pChunk = new IntPtr(addr);
                    int writtenChunk = 0;
                    writeOk = WritePrinter(hPrinter, pChunk, len, out writtenChunk);
                    if (!writeOk || writtenChunk != len)
                    {
                        writeOk = false;
                        break;
                    }
                    offset += len;
                    if (offset < bytes.Length)
                        Thread.Sleep(12);
                }

                if (!writeOk || offset != bytes.Length)
                {
                    EndPagePrinter(hPrinter);
                    AbortPrinter(hPrinter);
                }
                else
                {
                    success = true;
                    Thread.Sleep(25);
                    EndPagePrinter(hPrinter);
                    Thread.Sleep(25);
                    EndDocPrinter(hPrinter);
                }
            }
        }

        Thread.Sleep(700);
        ClosePrinter(hPrinter);
        Marshal.FreeCoTaskMem(pUnmanagedBytes);
        return success;
    }
}
"@

$helperDll = Join-Path $PSScriptRoot "RawPrinterHelper.dll"
$helperVer = Join-Path $PSScriptRoot "RawPrinterHelper.version"
$helperAssemblyVersion = "7"

try {
  $haveDll =
    (Test-Path $helperDll) -and
    (Test-Path $helperVer) -and
    ((Get-Content $helperVer -Raw) -eq $helperAssemblyVersion)
  if ($haveDll) {
    Add-Type -Path $helperDll -ErrorAction Stop
  } else {
    Remove-Item $helperDll -ErrorAction SilentlyContinue
    Remove-Item $helperVer -ErrorAction SilentlyContinue
    Add-Type -TypeDefinition $source -OutputAssembly $helperDll -OutputType Library -ErrorAction Stop
    Set-Content -Path $helperVer -Value $helperAssemblyVersion -NoNewline
    Add-Type -Path $helperDll -ErrorAction Stop
  }
} catch {
  Write-Warning "RawPrinterHelper DLL load/compile: $($_.Exception.Message); retrying."
  Remove-Item $helperDll -ErrorAction SilentlyContinue
  Remove-Item $helperVer -ErrorAction SilentlyContinue
  try {
    Add-Type -TypeDefinition $source -OutputAssembly $helperDll -OutputType Library -ErrorAction Stop
    Set-Content -Path $helperVer -Value $helperAssemblyVersion -NoNewline
    Add-Type -Path $helperDll -ErrorAction Stop
  } catch {
    Write-Warning "Could not create DLL; compiling in-memory (slow): $($_.Exception.Message)"
    Add-Type -TypeDefinition $source -Language CSharp -ErrorAction Stop
  }
}

$bytes = [System.IO.File]::ReadAllBytes($FilePath)
$ok = [RawPrinterHelper]::SendBytesToPrinter($PrinterName, $bytes)

if (!$ok) {
  Write-Error "Raw print failed. Printer='$PrinterName'"
  exit 1
}

Write-Host "Printed raw bytes to $PrinterName ($($bytes.Length) bytes)"
