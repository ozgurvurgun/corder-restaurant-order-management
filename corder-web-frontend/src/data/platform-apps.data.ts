export interface EcosystemAppItem {
  id: string
  name: string
  badge: string
  port: string
  role: string
  deployTarget: string
  tagline: string
  summary: string
  coreCapabilities: Array<{
    title: string
    detail: string
  }>
  technicalHighlights: string[]
  keyEndpointsOrEvents: string[]
  livePreviewMetrics: Array<{
    label: string
    value: string
    sub: string
  }>
}

export const ECOSYSTEM_APPS: EcosystemAppItem[] = [
  {
    id: "panel",
    name: "Corder Merchant Panel",
    badge: "Kasa & Operasyon Merkezi",
    port: "Port 3001",
    role: "Şube Müdürü, Kasiyer, Muhasebe & Depo Sorumlusu",
    deployTarget: "Cloudflare Pages (Vite + React 19)",
    tagline: "Salon haritasından X/Z vardiya mutabakatına, reçete stoktan cari deftere tek merkez.",
    summary:
      "Restoranın günlük tüm operasyonel ve finansal akışını yöneten ana komuta ekranıdır. Masa açma, kısmi ürün taşıma, parçalı tahsilat, açık hesap (cari) borç/tahsilat takibi, SOD/EOD İş Günü bazlı akıllı vardiya otomasyonu ve BOM reçete stok düşümünü gerçek zamanlı WebSocket senkronizasyonuyla yürütür.",
    coreCapabilities: [
      {
        title: "Canlı Salon & Masa Operasyonu",
        detail:
          "Bölüm bazlı (Salon, Bahçe, Teras, VIP) masa kartları, masa birleştirme, tam veya kısmi ürün adedi (takeQuantity) ile masalar arası adisyon aktarma ve masa bazlı yüzde/tutar/ikram indirimi.",
      },
      {
        title: "Kuruş Hassasiyetinde Çoklu & Parçalı Tahsilat",
        detail:
          "Nakit, Kredi Kartı, Yemek Kartı, Multinet ve Cari (Açık Hesap) yöntemleriyle tek seferde veya ürün/tutar bazlı parçalı ödeme alma. Kısmi ödemeleri tek bir CompletedOrder kaydında split kırılımıyla birleştirme.",
      },
      {
        title: "SOD / EOD İş Günü & Akıllı Otomatik Vardiya Kapanışı",
        detail:
          "Gece servisi devam ederken (açık masa varken) vardiyayı asla bölmeyen 45 dk aktif servis koruması; servis bittiğinde 15 dk sonra otomatik kapanış ve açık masaları zorla kapatmadan yeni vardiyaya fotoğraflı devir (Rollover Snapshot).",
      },
      {
        title: "Reçete (BOM) & Ağırlıklı Ortalama Maliyet Stok Motoru",
        detail:
          "Gram/kg, ml/lt ve adet dönüşümlü otomatik reçete düşümü, satın alma siparişleri (PO) teslim alındığında ağırlıklı hareketli ortalama birim maliyet güncellemesi, fiziksel sayım ve fire analizi.",
      },
      {
        title: "Geriye Dönük Adisyon Düzenleme & Atomik Mutabakat",
        detail:
          "Kapanmış bir adisyonun ödeme yöntemi veya kalemleri sonradan düzeltildiğinde; ilgili kasa vardiyasını (açık veya kapalı), cari müşteri bakiyesini ve reçete stok hareketlerini tek veritabanı transaction içinde geriye dönük günceller.",
      },
      {
        title: "Cari Defter (Ledger) & X / Z Termal Raporlama",
        detail:
          "Müşteri bazlı borç/tahsilat ekstresi, kredi kartı ile yapılan işletme giderlerinin nakit kasa hesabından otomatik ayrıştırılması ve tek tuşla termal yazıcıdan X (Anlık) / Z (Kapanış) raporu alma.",
      },
    ],
    technicalHighlights: [
      "IEEE-754 kayan nokta sapmasını önleyen Tam Sayı Kuruş (Minor Units) motoru",
      "Ayarlar -> Otomatik Gün Sonu saatine göre dinamik İş Günü (Bugün / Dün) sınırları",
      "Socket.IO ile tüm bağlı garson terminalleri ve Boss ekranıyla milisaniyelik senkronizasyon",
      "CSV (Excel) ve biçimlendirilmiş PDF satış/iptal/performans raporu üretimi",
    ],
    keyEndpointsOrEvents: [
      "POST /restaurant/tables/:id/close-check",
      "PATCH /restaurant/completed-orders/:id",
      "POST /restaurant/cash-shifts/:id/print-report",
      "WS Event: orders:updated / tables:updated / waiter-call:created",
    ],
    livePreviewMetrics: [
      { label: "Açık Vardiya Cirosu", value: "₺46.975,00", sub: "Nakit + Kart + Yemek K. + Cari" },
      { label: "Kuruş Mutabakat Farkı", value: "₺0,00", sub: "100% Minor-Unit Deterministik" },
      { label: "Reçete Stok Düşümü", value: "Otomatik", sub: "gr/kg & ml/lt Birim Dönüşümlü" },
    ],
  },
  {
    id: "terminal",
    name: "Corder Garson Terminali",
    badge: "Saha Sipariş & Masa Kilidi PWA",
    port: "Port 3000",
    role: "Garsonlar, Şef Garsonlar & Saha Servis Ekibi",
    deployTarget: "Cloudflare Pages (Mobil & Tablet PWA)",
    tagline: "Pessimistic masa kilidi, GPS Geofence ve anlık Web Push ile sahada sıfır hata.",
    summary:
      "Garsonların cep telefonu veya el terminalinden saniyeler içinde sipariş girmesini, masa taşımasını ve adisyon bastırmasını sağlayan mobil PWA uygulamasıdır. Sunucu taraflı masa oturum kilidi sayesinde iki garsonun aynı masaya aynı anda işlem yapıp çakışma yaratmasını engeller.",
    coreCapabilities: [
      {
        title: "Pessimistic Table Session Lock (Masa Oturum Kilidi)",
        detail:
          "Bir garson masayı açtığında masa sunucu üzerinde o garsona kilitlenir; başka bir terminal aynı masaya girmek istediğinde kilit sahibini görür. Hareketsiz kalan kilitler otomatik süre aşımıyla (stale threshold) serbest bırakılır.",
      },
      {
        title: "Haversine GPS Geofence (Konum Çiti) Koruması",
        detail:
          "İşletme koordinatları ve izin verilen yarıçap (metre) tanımlandığında, garsonların restoran dışından masa açmasını veya sipariş girmesini matematiksel Haversine mesafe kontrolüyle engeller.",
      },
      {
        title: "RFC 8291 (aes128gcm) VAPID Web Push Bildirimleri",
        detail:
          "Telefon ekranı kilitli veya tarayıcı arka planda olsa bile, müşterinin QR menüden yaptığı garson çağrısı (🔔 B1 (Bahçe) - Garson Çağrısı) anında garsonun cihazına bildirim olarak düşer.",
      },
      {
        title: "Hızlı PIN Geçişi & Brute-Force Koruması",
        detail:
          "Ortak tablet veya bireysel cihazda 4-6 haneli personel PIN koduyla anında oturum açma; ardışık hatalı denemelerde personel bazlı geçici kilitlenme (LoginRateLimiterService).",
      },
    ],
    technicalHighlights: [
      "showInMenu=false olan garson özel ürünlerini (ek garnitür, açık içecek) terminalde gösterip QR menüde gizleme",
      "pg_advisory_xact_lock ile yarış durumsuz günlük sıralı sipariş numarası (YYMMDD-001)",
      "Kısmi ürün iptalinde (takeQuantity) mutfağa otomatik İptal Fişi (kitchen_cancel) gönderimi",
      "Birleştirilmiş (consolidated) veya adisyon bazlı (split) müşteri fişi yazdırma",
    ],
    keyEndpointsOrEvents: [
      "POST /restaurant/tables/:id/lock & /unlock",
      "POST /restaurant/orders (Geofence + Shift Guard)",
      "POST /restaurant/orders/:id/items/:itemId/cancel",
      "POST /restaurant/web-push/subscribe (VAPID P-256)",
    ],
    livePreviewMetrics: [
      { label: "Masa Oturum Kilidi", value: "Atomik", sub: "Çift Garson Çakışma Koruması" },
      { label: "Konum Doğrulama", value: "Geofence", sub: "Haversine Metre Yarıçap Kontrolü" },
      { label: "Arka Plan Bildirimi", value: "RFC 8291", sub: "Native VAPID Web Push" },
    ],
  },
  {
    id: "boss",
    name: "Corder Boss",
    badge: "İşletme Sahibi & Zincir Komuta PWA",
    port: "Port 3004",
    role: "Restoran Sahibi (Boss), Yatırımcı & Franchise Merkez Yönetimi",
    deployTarget: "Cloudflare Pages (Mobil & Masaüstü PWA)",
    tagline: "Tüm şubelerin canlı cirosu, 48 yetkili RBAC matrisi ve 6 kurallı suistimal radarı.",
    summary:
      "Tek şubeli restoran sahiplerinden yüzlerce şubeli franchise zincirlerine kadar tüm işletmeyi gerçek zamanlı izleyen yönetim uygulamasıdır. Şube bazlı İş Günü (SOD/EOD) sınırlarına göre canlı ciro, açık adisyonlar, royalty hak edişleri ve kural tabanlı kasa/iptal anomalilerini tek ekranda sunar.",
    coreCapabilities: [
      {
        title: "Çoklu Şube & Franchise Royalty Konsolidasyonu",
        detail:
          "Özmal (Company-Owned) ve Franchise şubeleri ayrı ayrı veya konsolide izleyebilme; franchise şubelerin günlük ve aylık net ciroları üzerinden sözleşme royalty yüzdesine göre anlık hak ediş hesaplama.",
      },
      {
        title: "6 Kurallı Gerçek Zamanlı Suistimal (Fraud) Tespit Motoru",
        detail:
          "Yüksek iptal oranı, fiş basımı sonrası iptal (post-print void), aşırı indirim, vardiya nakit açığı, gece geç saat iptali ve olağandışı nakit kasa çıkışlarını otomatik yakalayıp önem derecesine göre (critical/high/medium) raporlar.",
      },
      {
        title: "48 Granüler Yetki & 8 Hazır Rol Matrisi (RBAC)",
        detail:
          "Her personele rol şablonu atamanın ötesinde, tekil yetki verme (grant), yetki alma (revoke), maksimum indirim yüzdesi (maxDiscountPct) ve maksimum tekil iptal tutarı (maxCancelAmount) tanımlama.",
      },
      {
        title: "Canlı Vardiya, Kritik Stok & Personel Performans Nabzı",
        detail:
          "Her şubede şu an hangi vardiyanın açık olduğunu, içerideki açık masaların toplam tutarını (openChecksTotal), kritik seviyenin altına düşen hammaddeleri ve garson bazlı satış/iptal karnesini canlı izleme.",
      },
    ],
    technicalHighlights: [
      "100 şube, 2.000 masa ve 10.000 kapanmış siparişi < 100ms içinde konsolide eden bellek içi gruplama mimarisi",
      "200 eşzamanlı anomali taramasını tek DB sorgusunda birleştiren In-Flight Scan Coalescing",
      "@BossOnly dekoratörü ile şube müdürlerinin bile erişemediği üst düzey yönetim izolasyonu",
      "Kredi kartı ile yapılan masraf kayıtlarını nakit kasa çıkış anomalisinden (UNUSUAL_CASH_OUT) hariç tutan akıllı filtre",
    ],
    keyEndpointsOrEvents: [
      "GET /restaurant/boss/overview?branchId=ALL",
      "GET /restaurant/fraud/alerts & POST /scan",
      "PATCH /restaurant/staff/:id/permissions",
      "GET /restaurant/permissions/catalog (48 Permissions)",
    ],
    livePreviewMetrics: [
      { label: "Granüler Yetki Kodu", value: "48 İzin", sub: "8 Rol + Grant/Revoke + Limit" },
      { label: "Suistimal Kural Motoru", value: "6 Kural", sub: "Post-Print Void & Nakit Açığı" },
      { label: "100 Şube Konsolidasyonu", value: "77 ms", sub: "Doğrulanmış Ölçek Performansı" },
    ],
  },
  {
    id: "menu",
    name: "Corder QR Dijital Menü",
    badge: "Müşteri Deneyimi & Anlık Çağrı",
    port: "Port 3002",
    role: "Restoran Misafirleri / Masa Müşterileri",
    deployTarget: "Cloudflare Pages (Ultra Hızlı Statik + Edge)",
    tagline: "Uygulama indirmeden masa QR koduyla menü inceleme, garson çağırma ve hesap isteme.",
    summary:
      "Masadaki QR kod okutulduğunda restoranın kimliğine ve seçtiği görsel şablona göre açılan dijital menüdür. Müşteri tek dokunuşla garson çağırabilir veya hesap isteyebilir; çağrı hem kasaya sesli bildirim hem de garsonun telefonuna Title Case formatlı Web Push olarak düşer.",
    coreCapabilities: [
      {
        title: "Çoklu Görsel Tema & Zengin Ürün Kartları",
        detail:
          "Restoranın marka kimliğine göre özelleştirilebilen menü şablonları, yüksek çözünürlüklü WebP görseller, hazırlama süresi, kalori, acılık derecesi ve alerjen etiketleri.",
      },
      {
        title: "Masa Bazlı Anlık Garson Çağrısı",
        detail:
          "QR kod içindeki masa kimliğiyle tek tuşla garson çağırma; tekrar eden spam çağrıları birleştiren (idempotent) sunucu koruması ve kasa/terminal ekranlarında canlı onaylama.",
      },
      {
        title: "Akıllı Görünürlük ve Stok Filtresi",
        detail:
          "Stokta tükenen veya showInMenu=false olarak işaretlenen dahili operasyon ürünlerini müşteri menüsünden otomatik gizler, aktif kampanyaları öne çıkarır.",
      },
    ],
    technicalHighlights: [
      "Herhangi bir üyelik veya uygulama indirme gerektirmeyen sıfır sürtünmeli deneyim",
      "WebP otomatik görsel optimizasyonu ve CDN önbellekleme uyumu",
      "Title Case (🔔 B1 (Bahçe) - Garson Çağrısı) standartlaştırılmış bildirim üretimi",
    ],
    keyEndpointsOrEvents: [
      "GET /menu/:slug (Public Tenant Menu)",
      "POST /menu/:slug/waiter-call",
      "WS Event: waiter-call:created -> Panel & Terminal",
    ],
    livePreviewMetrics: [
      { label: "Açılış Süresi", value: "< 300 ms", sub: "Sıfır KurulumStatik Edge Dağıtım" },
      { label: "Garson Çağrı İletimi", value: "Gerçek Zamanlı", sub: "Socket.IO + VAPID Web Push" },
      { label: "Menü Filtreleme", value: "Dinamik", sub: "Stok & showInMenu Kontrolü" },
    ],
  },
  {
    id: "admin",
    name: "Corder Platform Admin",
    badge: "SaaS & 360° Canlı Destek Merkezi",
    port: "Port 3003",
    role: "Corder SaaS Platform Yöneticisi & Destek Ekibi",
    deployTarget: "Cloudflare Pages",
    tagline: "2 aşamalı kriptografik giriş, franchise ağacı, 25-30 tahsilat otomasyonu ve canlı teşhis.",
    summary:
      "Tüm restoranların, Boss hesaplarının, franchise markalarının, abonelik tahsilatlarının ve donanım tokenlarının yönetildiği merkezi SaaS yönetim panelidir. 360° Canlı Destek ekranıyla bir restoranın yazıcılarından açık vardiyasına kadar tüm teknik durumu tek bakışta incelenir.",
    coreCapabilities: [
      {
        title: "İki Aşamalı Kriptografik Yönetici Girişi",
        detail:
          "1. adımda yönetici e-postası ve parola (PLATFORM_ADMIN_PASSWORD), 2. adımda bağımsız yüksek entropili Auth Kodu (PLATFORM_ADMIN_AUTH_CODE) doğrulaması; timingSafeEqual ile zamanlama saldırısı koruması.",
      },
      {
        title: "25-30 Abonelik Tahsilat & Otomatik Askıya Alma Motoru",
        detail:
          "Her ayın 25-30'u arası tahsilat penceresi, çoklu ay peşin ödeme paketleri, geçmiş ödenmemiş dönem takibi ve ödeme yapmayan işletmelerin yeni ayın 1'inde otomatik erişim askıya alınması.",
      },
      {
        title: "360° Canlı Şube Teşhisi (Live Diagnostics)",
        detail:
          "Restoranın anlık aktif masa sayısı, basılmayı bekleyen mutfak fişleri, tanımlı termal yazıcıların durumu, açık kasa vardiyası, cari alacak toplamı ve son denetim kayıtlarını tek ekranda görüntüleme.",
      },
      {
        title: "Kiracı Bazlı (@<slug>.corder.app) Kimlik & Token Yönetimi",
        detail:
          "Restoran oluşturulurken otomatik DNS uyumlu slug ve <kullanıcı>@<restoran>.corder.app kurumsal e-posta üretimi, Print-Agent donanım tokenı yenileme ve Boss-Şube hiyerarşisi bağlama.",
      },
    ],
    technicalHighlights: [
      "10.000 restoran, 50 marka ve 20.000 ödeme kaydını < 600ms içinde zenginleştiren O(1) Map indeksleme",
      "N+1 sorgu üretmeden 10.000 aktif restoranın abonelik durumunu toplu değerlendiren billing motoru",
      "Step-1 challenge token ile Step-2 JWT oturum tokenının kriptografik ayrımı",
    ],
    keyEndpointsOrEvents: [
      "POST /platform/auth/verify-credentials & /login",
      "GET /platform/support/restaurants/:id/diagnostics",
      "POST /platform/billing/restaurants/:id/payments",
      "POST /platform/billing/suspend-unpaid",
    ],
    livePreviewMetrics: [
      { label: "Kimlik Doğrulama", value: "2 Aşamalı", sub: "Parola + Bağımsız Auth Kodu" },
      { label: "10.000 Şube Sorgusu", value: "459 ms", sub: "Sıfır N+1 Bellek İçi İndeksleme" },
      { label: "Tahsilat Döngüsü", value: "25 - 30", sub: "Çoklu Ay & Otomatik Askı Motoru" },
    ],
  },
  {
    id: "print-agent",
    name: "Corder Print-Agent",
    badge: "Donanım & ESC/POS Yazıcı Köprüsü",
    port: "Yerel Servis",
    role: "Restoran POS Bilgisayarı (Windows / Linux Arka Plan Servisi)",
    deployTarget: "Yerel Node.js / Windows Spooler & Raw TCP 9100",
    tagline: "Tarayıcı kapalı olsa bile mutfak, bar, adisyon ve X/Z raporlarını sıfır kayıpla basar.",
    summary:
      "Buluttaki Corder API ile restoranın yerel ağındaki USB, Ethernet (TCP/IP 9100) veya Bluetooth termal yazıcıları birbirine bağlayan yerleşik servistir. Hem gerçek zamanlı Socket.IO hem de periyodik HTTP Polling fallback kullanarak internet dalgalanmalarında dahi tek bir mutfak fişinin kaybolmamasını garanti eder.",
    coreCapabilities: [
      {
        title: "Çift Kanallı Sıfır Kayıp Mimarisi (Socket.IO + HTTP Fallback)",
        detail:
          "Sipariş anında WebSocket üzerinden milisaniyeler içinde yazıcıya ulaşır. Bağlantı anlık kopsa bile agent yeniden bağlandığında basılmamış mutfak siparişlerini ve fiş işlerini HTTP üzerinden çekip basar ve onaylar.",
      },
      {
        title: "Departman & Kategori Bazlı Akıllı Yönlendirme",
        detail:
          "Aynı siparişteki kebap/mutfak ürünlerini Mutfak Yazıcısına, içecekleri Bar Yazıcısına, tatlıları Tatlı Departmanına otomatik ayırarak ilgili termal yazıcıya yönlendirir.",
      },
      {
        title: "Mutfak Fişi, İptal Fişi, Adisyon ve X/Z Kasa Raporu",
        detail:
          "Yeni sipariş fişi, ürün iptal edildiğinde kırmızı/uyarı başlıklı Mutfak İptal Fişi (kitchen_cancel), müşteri adisyonu (split/consolidated), nakit çekmecesi açma komutu (ESC/POS pulse) ve X/Z vardiya raporlarını 80mm/58mm formatında basar.",
      },
    ],
    technicalHighlights: [
      "Türkçe karakter (CP857 / Windows-1254 / UTF-8) tam uyumlu ESC/POS byte dizisi üretimi",
      "Windows Raw Printer Spooler (winspool.drv) ve doğrudan TCP Socket (Port 9100) desteği",
      "Bellek içi Tekrarlama Koruması (Deduplication Cache) + DB kitchen_ticket_printed_at mühürlemesi",
    ],
    keyEndpointsOrEvents: [
      "WS Handshake: /ws (auth.token = PRINT_AGENT_TOKEN)",
      "GET /restaurant/print-agent/pending-kitchen-orders",
      "PATCH /restaurant/print-agent/orders/:id/kitchen-printed",
      "GET & PATCH /restaurant/print-agent/pending-print-jobs",
    ],
    livePreviewMetrics: [
      { label: "Teslimat Garantisi", value: "En Az 1 Kez", sub: "WS + HTTP Polling Çift Kanal" },
      { label: "Fiş Tekrarlama", value: "%0", sub: "Atomik printed_at + Dedup Cache" },
      { label: "Desteklenen Çıktı", value: "4 Fiş Tipi", sub: "Mutfak, İptal, Adisyon, X/Z Rapor" },
    ],
  },
  {
    id: "backend",
    name: "Corder Core Backend API",
    badge: "NestJS 10 + PostgreSQL 16 Çekirdek",
    port: "Port 4000",
    role: "Tüm Uygulamaların Merkezi İş Mantığı, Güvenlik ve Veri Katmanı",
    deployTarget: "Docker Compose (Nginx + NestJS + İzole PostgreSQL 16)",
    tagline: "35 Entity, 21 Migration, Pessimistic Locking ve 128 otomatik testle zırhlı çekirdek.",
    summary:
      "Domain-Driven Design (DDD) prensipleriyle ayrıştırılmış Policy, Use-Case ve Application servislerinden oluşan modüler monolit çekirdektir. Çok kiracılı (multi-tenant) veri izolasyonu, kuruş bazlı finansal doğrulama, RBAC yetki denetimi ve gerçek zamanlı WebSocket odalarını tek merkezden yönetir.",
    coreCapabilities: [
      {
        title: "Sıkı Multi-Tenant İzolasyon & Default-Deny Güvenlik",
        detail:
          "Her sorgu restaurant_id ile izole edilir. PanelRootGuard açıkça izin tanımlanmamış hiçbir endpoint'e geçiş vermez (Default-Deny); şube personeli yalnızca kendi şubesinin yetkili olduğu verisine erişir.",
      },
      {
        title: "Pessimistic Write & Advisory Lock Eşzamanlılık Motoru",
        detail:
          "Kasa vardiyası açma/kapatma, hesap kapatma ve kısmi ürün transferlerinde PostgreSQL SELECT ... FOR UPDATE (pessimistic_write) kilidi kullanarak çift tahsilat veya yarış durumlarını veritabanı seviyesinde engeller.",
      },
      {
        title: "Deterministik Metin Normalizasyonu (Lowercase DB / Title Case UI)",
        detail:
          "Veritabanına yazılan tüm serbest metinler (masa, bölüm, ürün, personel, cari adları) deterministik küçük harfle saklanır; dışarıya (API, Web Push, Termal Fiş, Denetim İzi) Türkçe uyumlu Title Case ile sunulur.",
      },
      {
        title: "İzole Docker Ağ Topolojisi",
        detail:
          "PostgreSQL 16 dış dünyaya (0.0.0.0) hiçbir port açmaz; yalnızca Docker iç ağındaki (corder_internal) API konteyneri erişebilir. Dış trafik yalnızca Nginx reverse proxy üzerinden karşılanır.",
      },
    ],
    technicalHighlights: [
      "35 TypeORM Entity ve yukarı/aşağı (up/down) tam doğrulanmış 21 veritabanı migration'ı",
      "GlobalExceptionFilter ile PostgreSQL 23505/23503/22P02 hatalarını sızıntısız 409/400 HTTP yanıtlarına dönüştürme",
      "46 test süitinde 128 birim, entegrasyon ve 10.000+ restoran ölçek testi",
    ],
    keyEndpointsOrEvents: [
      "GET /health & GET /health/ready (DB Readiness Probe)",
      "PlatformModule · RestaurantModule · MenuModule · OrdersGateway",
      "21 Deterministik TypeORM Migration + 35 Domain Entity",
    ],
    livePreviewMetrics: [
      { label: "Veritabanı Şeması", value: "35 Tablo", sub: "21 Doğrulanmış Migration" },
      { label: "Otomatik Test Süiti", value: "128 Test", sub: "46 Süit · 0 Hata" },
      { label: "Ağ Topolojisi", value: "İzole DB", sub: "Dış Portsuz Docker İç Ağı" },
    ],
  },
]

