# Corder Print Agent & Desktop Control Center

Cross-platform Electron desktop application (Linux, Windows, macOS) for automatic ESC/POS kitchen tickets, cancellation tickets, and cash receipts.

## Features

- **Account-Based Authentication**: Log in with the branch's Print Agent username and password created in the Corder Admin Panel (`POST /restaurant/print-agent/login`).
- **Embedded Server Configuration**: Connects automatically to the Corder Backend without `.env` files or manual URL entry.
- **Cross-Platform Printing**:
  - **Linux**: CUPS (`lp` / `lpr -o raw`), direct USB thermal devices (`/dev/usb/lp0`..`/dev/usb/lp9`), and TCP/IP (`9100`).
  - **Windows**: Native Spooler raw copy and TCP/IP (`9100`) without external `.ps1` scripts.
  - **macOS**: CUPS (`lp -o raw`) and TCP/IP (`9100`).
- **Visual Category Routing**: Map each menu category or subcategory to a dedicated thermal printer.
- **Hardened Security & Bounded Memory**:
  - Context-isolated Electron renderer (`contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`) with per-session CSRF token and strict CSP (`script-src 'self'`).
  - `execFile` (`shell: false`) with strict identifier validation.
  - Bounded in-memory log ring buffer (`MAX_LOG_ENTRIES = 60`) with duplicate collapsing and automatic expiry.

## Usage

```bash
cd print-agent
npm run electron
```
