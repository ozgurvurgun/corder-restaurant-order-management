# Corder Print Agent (Windows 10)

> [English](README.md)

Bu klasör, terminal web uygulamasından bağımsız çalışan bir Node.js servisidir.  
Backend Socket.IO kanalına bağlanır, `order:created` olayını dinler ve termal yazıcıya ESC/POS fiş basar.

## Neden bu yapı?

- Tarayıcı/PWA kapalı olsa bile yazdırma devam eder.
- Sipariş backend'e kaydedildiği anda baskı tetiklenebilir.
- Yazdırma hatasında kuyruk + yeniden deneme ile kayıp azalır.

## Mevcut backend ile uyumluluk

- Backend gateway: `path: /ws` (Socket.IO).
- Olay: `order:created`.
- Agent bu olayı dinleyip **mutfak fişi** basar.

Not: `receipt` gibi ek fiş tipleri için backend'in ayrıca olay yayınlaması gerekir.

## Kurulum

1. Paketleri kurun:

```bash
npm install
```

2. Ortam dosyası:

```bash
copy .env.example .env
```

3. Admin panelden restoranın statik print tokenını tanımlayın:

- Restoran düzenleme ekranında `Print Agent Token` alanına token girin/üretin.
- Bu token backend'de restoran kaydında saklanır.
- Socket bağlantısında `AGENT_TOKEN` bu değerle aynıysa restoran tanınır.

4. `.env` doldurun:

- `BACKEND_WS_URL` (örnek: `https://api.corders.uk`)
- `BACKEND_SOCKET_PATH` (genelde `/ws`)
- `BACKEND_ORDER_EVENT_NAME` (genelde `order:created`)
- `AGENT_TOKEN` (admin panelde restoran için tanımladığınız statik print token)
- `RESTAURANT_ID` (`*` tüm restoranlar; önerilen: gerçek id)
- `PRINTER_NAME` (Windows yazıcı adı)

5. Agent'ı başlatın:

```bash
npm start
```

## USB (Windows) varsayılan kurulum

Bu repoda `.env` dosyası USB termal için hazır oluşturulmuştur.

1. Yazıcı adını öğrenin:

```powershell
Get-Printer | Select-Object Name
```

2. `.env` içinde `PRINTER_NAME` alanına birebir yazın.

3. `npm start` ile çalıştırın.

USB yazdırma, `scripts/send-raw-printer.ps1` ile Windows spooler RAW modunda yapılır.

## Opsiyonel: özel print olayı

Agent ileri uyumluluk için `order.print_job` olayını da dinler.  
Bu olay formatı:

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

## Bilgisayar açılışında otomatik başlatma (önerilen)

Her yeniden başlatmadan sonra agent'ı elle çalıştırmayın. Print-agent'ın POS bilgisayarı açıldığında başlayıp mutfak ve adisyon yazdırması için çalışır kalması amacıyla bir **cron / zamanlanmış görev** tanımlayın.

### Linux / macOS — cron `@reboot`

```bash
crontab -e
```

Şu satırı ekleyin (Node ikili dosyası ve `print-agent` klasör yollarını kendinize göre düzenleyin):

```cron
@reboot cd /opt/corder/print-agent && /usr/bin/npm start >> /var/log/corder-print-agent.log 2>&1
```

Veya mutlak Node yolu ile:

```cron
@reboot /usr/bin/node /opt/corder/print-agent/src/index.js >> /var/log/corder-print-agent.log 2>&1
```

`.env` dosyasının işin kullandığı çalışma dizininde olduğundan emin olun (yukarıdaki gibi `print-agent` içine `cd` edin) veya gerekli değişkenleri crontab satırında export edin.

### Windows — Task Scheduler (boot cron eşdeğeri)

Windows'ta sistem crontab'ı yoktur; `@reboot` yerine aynı amaçla **Task Scheduler** kullanın:

1. Task Scheduler → Create Task.
2. General: Kullanıcı oturum açmasa da çalıştırın; yazıcı erişimi için gerekiyorsa en yüksek yetkilerle çalıştırın.
3. Triggers: At startup (veya POS kullanıcısı için At log on).
4. Actions: Start a program
   - Program: `node.exe` tam yolu
   - Arguments: `src\index.js`
   - Start in: `print-agent` klasörünün tam yolu
5. Settings: Görev başarısız olursa her 1 dakikada yeniden dene; en fazla 3 kez.

İsteğe bağlı tek satır (yönetici PowerShell; yolları düzenleyin):

```powershell
$action = New-ScheduledTaskAction -Execute "C:\Program Files\nodejs\node.exe" -Argument "src\index.js" -WorkingDirectory "C:\corder\print-agent"
$trigger = New-ScheduledTaskTrigger -AtStartup
Register-ScheduledTask -TaskName "CorderPrintAgent" -Action $action -Trigger $trigger -RunLevel Highest
```

### Alternatif: Windows servisi (NSSM)

Zamanlanmış görev yerine servis tercih ederseniz:

1. `nssm install CorderPrintAgent`
2. Path: `node.exe`
3. Startup dir: bu klasör (`print-agent`)
4. Arguments: `src/index.js`
5. Service start type: Automatic

## Notlar

- Kuyruk dosyası varsayılan olarak Desktop yerine güvenli bir dizine yazılır:
  - Windows: `%LOCALAPPDATA%\\CorderPrintAgent\\print-jobs.json`
  - macOS/Linux: `~/.corder/print-jobs.json`
- İsterseniz `.env` ile `QUEUE_FILE` üzerinden tam yolu override edebilirsiniz.
- Çift baskı engeli: `jobId + printType`

## Gecikme neden olur?

- İlk sürümde kuyruk işleyici periyodik çalışıyordu; bu da başarısız denemelerde **1–2 sn** gibi hissedilir gecikme yaratabilirdi.
- Ayrıca yazdırma hata verip kuyruğa düşerse, retry backoff ile gecikme artar.
- Güncel sürümde olay sonrasında kuyruk **hemen flush** edilir ve varsayılan tarama süresi `QUEUE_DRAIN_MS` ile düşürülür (default 500ms).
