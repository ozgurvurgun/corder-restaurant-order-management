# Corder Print Agent (Windows 10)

> [Türkçe](README.tr.md)

This folder is a Node.js service that runs independently of the terminal web app.  
It connects to the backend Socket.IO channel, listens for the `order:created` event, and prints ESC/POS tickets on a thermal printer.

## Why this setup?

- Printing continues even if the browser/PWA is closed.
- Print can be triggered as soon as the order is saved on the backend.
- On print failure, queue + retry reduces lost tickets.

## Compatibility with the current backend

- Backend gateway: `path: /ws` (Socket.IO).
- Event: `order:created`.
- The agent listens for this event and prints a **kitchen ticket**.

Note: for extra ticket types such as `receipt`, the backend must publish a separate event.

## Setup

1. Install packages:

```bash
npm install
```

2. Environment file:

```bash
copy .env.example .env
```

3. Set the restaurant’s static print token from the admin panel:

- On the restaurant edit screen, enter/generate a token in the `Print Agent Token` field.
- This token is stored on the restaurant record in the backend.
- On the socket connection, the restaurant is recognized when `AGENT_TOKEN` matches this value.

4. Fill in `.env`:

- `BACKEND_WS_URL` (e.g. `https://api.corders.uk`)
- `BACKEND_SOCKET_PATH` (usually `/ws`)
- `BACKEND_ORDER_EVENT_NAME` (usually `order:created`)
- `AGENT_TOKEN` (the static print token you set for the restaurant in the admin panel)
- `RESTAURANT_ID` (`*` for all restaurants; recommended: the real id)
- `PRINTER_NAME` (Windows printer name)

5. Start the agent:

```bash
npm start
```

## USB (Windows) default setup

In this repo, the `.env` file is prepared for a USB thermal printer.

1. Find the printer name:

```powershell
Get-Printer | Select-Object Name
```

2. Set `PRINTER_NAME` in `.env` to that exact name.

3. Run with `npm start`.

USB printing uses `scripts/send-raw-printer.ps1` in Windows spooler RAW mode.

## Optional: dedicated print event

For forward compatibility, the agent also listens for the `order.print_job` event.  
Event format:

```json
{
  "type": "order.print_job",
  "jobId": "ord_123:kitchen",
  "restaurantId": "rest_1",
  "printType": "kitchen",
  "createdAt": "2026-04-15T10:35:00.000Z",
  "order": {
    "tableName": "Bahce 1",
    "waiterName": "Serkan",
    "total": 300,
    "items": [
      { "productName": "Lahmacun", "quantity": 2, "price": 90, "note": "az acili" }
    ]
  }
}
```

## Auto-start on boot (recommended)

Do not rely on starting the agent by hand after each reboot. Define a **cron / scheduled job** so the print-agent starts when the POS PC boots and stays running for kitchen and receipt printing.

### Linux / macOS — cron `@reboot`

```bash
crontab -e
```

Add a line (adjust paths to your Node binary and `print-agent` folder):

```cron
@reboot cd /opt/corder/print-agent && /usr/bin/npm start >> /var/log/corder-print-agent.log 2>&1
```

Or with an absolute Node path:

```cron
@reboot /usr/bin/node /opt/corder/print-agent/src/index.js >> /var/log/corder-print-agent.log 2>&1
```

Ensure `.env` lives in the working directory used by the job (`cd` into `print-agent` as above), or export required variables in the crontab line.

### Windows — Task Scheduler (boot equivalent of cron)

Windows has no system crontab; use **Task Scheduler** the same way you would use `@reboot`:

1. Open Task Scheduler → Create Task.
2. General: Run whether user is logged on or not; Run with highest privileges if printer access requires it.
3. Triggers: At startup (or At log on for the POS user).
4. Actions: Start a program
   - Program: full path to `node.exe`
   - Arguments: `src\index.js`
   - Start in: full path to the `print-agent` folder
5. Settings: If the task fails, restart every 1 minute; allow restart up to 3 times.

Optional one-liner (run elevated PowerShell; adjust paths):

```powershell
$action = New-ScheduledTaskAction -Execute "C:\Program Files\nodejs\node.exe" -Argument "src\index.js" -WorkingDirectory "C:\corder\print-agent"
$trigger = New-ScheduledTaskTrigger -AtStartup
Register-ScheduledTask -TaskName "CorderPrintAgent" -Action $action -Trigger $trigger -RunLevel Highest
```

### Alternative: Windows service (NSSM)

If you prefer a service instead of a scheduled task:

1. `nssm install CorderPrintAgent`
2. Path: `node.exe`
3. Startup dir: this folder (`print-agent`)
4. Arguments: `src/index.js`
5. Service start type: Automatic

## Notes

- By default the queue file is written to a safe directory instead of the Desktop:
  - Windows: `%LOCALAPPDATA%\\CorderPrintAgent\\print-jobs.json`
  - macOS/Linux: `~/.corder/print-jobs.json`
- You can override the full path with `QUEUE_FILE` in `.env`.
- Duplicate print prevention: `jobId + printType`

## Why is there delay?

- In the first version the queue worker ran periodically, which could feel like a **1–2 s** delay on failed attempts.
- If printing fails and the job is re-queued, retry backoff increases the delay.
- In the current version the queue is **flushed immediately** after an event, and the default scan interval is lowered via `QUEUE_DRAIN_MS` (default 500ms).
