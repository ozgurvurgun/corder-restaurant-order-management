export interface ArchitectureWorkflowStep {
  step: string
  actor: string
  title: string
  description: string
  technicalGuarantee: string
}

export interface ArchitectureWorkflow {
  id: string
  title: string
  subtitle: string
  badge: string
  steps: ArchitectureWorkflowStep[]
}

export const ARCHITECTURE_WORKFLOWS: ArchitectureWorkflow[] = [
  {
    id: "business-day-shift",
    title: "1. SOD/EOD İş Günü & Akıllı Otomatik Vardiya Kapanış Mimarisi",
    subtitle:
      "Gece 04:00 - 07:00'ye kadar hizmet veren restoranlarda gece servisini bölmeyen, açık masaları koruyan kurumsal POS gün sonu motoru.",
    badge: "ShiftAutoClosePolicy & İş Günü",
    steps: [
      {
        step: "01",
        actor: "Ayarlar & İş Günü Sınırı",
        title: "Takvim Günü (00:00) Yerine İş Günü (SOD/EOD) Başlangıcı",
        description:
          "Restoranın Otomatik Gün Sonu saati sabah kuşağındaysa (00:00 - 11:59, örn. 04:00 veya 07:00), İş Günü (Bugün ve Dün) gece yarısı 00:00'da değil, restoranın gün sonu saatinde başlar ve ertesi gün aynı saate kadar 24 saat sürer.",
        technicalGuarantee:
          "Cumartesi gecesi 00:00 - 06:30 arasında kapanan masalar Pazar sabahı Bugün cirosuna karışmaz; eksiksiz olarak Cumartesi iş gününe ve vardiyasına yazılır.",
      },
      {
        step: "02",
        actor: "CashShiftService",
        title: "Canlı Aktivite & Açık Masa Taraması (getShiftActivitySnapshot)",
        description:
          "Her 60 saniyede bir ve kasa sorgularında sistem yalnızca kasa hareketlerine değil; aktif siparişlere (orders.updated_at), kapanan adisyonlara (completed_orders.closed_at) ve içerideki açık masa sayısına (openTablesCount) bakar.",
        technicalGuarantee:
          "En az 2 saatlik vardiya yaşı kuralı (MIN_SHIFT_AGE_BEFORE_AUTO_CLOSE_MS) sayesinde gün sonuna 30 dk kala erken açılan sabah vardiyası yanlışlıkla kapatılmaz.",
      },
      {
        step: "03",
        actor: "ShiftAutoClosePolicy",
        title: "Açık Masa Varken 45 Dk Servis Koruması / Masa Yokken 15 Dk Kapanış",
        description:
          "Gün sonu saati geldiğinde içeride açık masa varsa (openTablesCount > 0), garson veya kasa işlem yaptığı sürece vardiya asla bölünmez; tam 45 dk hareketsizlik beklenir. Tüm masalar boşsa (openTablesCount === 0) son işlemden 15 dk sonra kasa otomatik kapatılır.",
        technicalGuarantee:
          "Gece servisinin ortasında kasa kapanıp garsonların yeni vardiya açmak zorunda kalması tamamen engellenir.",
      },
      {
        step: "04",
        actor: "Rollover Snapshot Motoru",
        title: "Açık Masaların Zorla Kapatılmadan Yeni Vardiyaya Devri",
        description:
          "Personel sabah çıkarken içeride açık masa bırakıp kasayı kapatmayı unutmuşsa, 45 dk tam sessizlik sonrası vardiya otomatik kapanır; açık masalar kapatılmaz, anlık tutar ve kalem fotoğrafları (carriedOverTablesSnapshot) Z raporuna işlenip yeni vardiyaya devredilir.",
        technicalGuarantee:
          "Beklenen nakit (Açılış + Nakit Giriş - Nakit Çıkış) otomatik kapanış bakiyesi olarak mühürlenir ve denetim izine (shift_auto_closed) kaydedilir.",
      },
    ],
  },
  {
    id: "financial-settlement",
    title: "2. Kuruş (Minor Units) Tahsilat, Reçete Stok & Geriye Dönük Mutabakat",
    subtitle:
      "Parçalı ödemelerden kapanmış adisyon düzenlemesine kadar 0 kuruş sapma ile çalışan atomik finans ve stok motoru.",
    badge: "CheckSettlementPolicy & BOM",
    steps: [
      {
        step: "01",
        actor: "CloseCheckUseCase",
        title: "Pessimistic Write Kilidi & Tam Sayı Kuruş (Minor Units) Hesabı",
        description:
          "Hesap kapatılırken masa, aktif siparişler ve açık kasa vardiyası PostgreSQL SELECT ... FOR UPDATE (pessimistic_write) ile kilitlenir. Tüm satır fiyat, indirim ve parçalı ödeme tutarları tam sayı kuruşa (Math.round(v * 100)) çevrilir.",
        technicalGuarantee:
          "IEEE-754 kayan nokta yuvarlama hatası (0.1 + 0.2 !== 0.3) oluşmaz; parçalı ödeme toplamı net tutara kuruşu kuruşuna eşit değilse işlem reddedilir.",
      },
      {
        step: "02",
        actor: "Partial & Split Konsolidasyon",
        title: "Çok Adımlı Kısmi Ödemelerin Tek Adisyonda Birleştirilmesi",
        description:
          "Bir masada önce 3 ürün nakit, kalan ürünler kredi kartı ve cari (açık hesap) ile ödenirse; sistem ayrı ayrı adisyon satırları şişirmek yerine masa tamamen kapandığında tüm tahsilatları tek CompletedOrder kaydında split detaylarıyla birleştirir.",
        technicalGuarantee:
          "Kapanan masa sayısı (totalTables) ile gerçek masa oturumu birebir örtüşür; mutfak fişi sayısı (totalOrders) ayrı takip edilir.",
      },
      {
        step: "03",
        actor: "RecipeStockPolicy",
        title: "Birim Dönüşümlü Otomatik Reçete (BOM) Stok Düşümü",
        description:
          "Satılan her ürünün reçetesindeki hammaddeler (ör. 180 gr kıyma -> 0.18 kg, 250 ml süt -> 0.25 lt) depo birimine otomatik dönüştürülerek stoktan düşülür ve StockMovement kaydı üretilir.",
        technicalGuarantee:
          "İptal edilen veya ikram dışı silinen kalemler stoktan düşülmez; satın alma (PO) girişlerinde ağırlıklı hareketli ortalama maliyet güncellenir.",
      },
      {
        step: "04",
        actor: "CompletedOrdersService",
        title: "Kapanmış Adisyon Düzenlendiğinde 4'lü Atomik Geriye Dönük Mutabakat",
        description:
          "Yetkili yönetici kapanmış bir adisyonun ödeme yöntemini (ör. Nakit -> Kredi Kartı veya Cari) ya da ürün adedini düzeltirse; 1) Kasa vardiyası (açık veya kapalı), 2) CashTransaction kaydı, 3) Cari müşteri borç kaydı ve 4) Reçete stok farkı aynı transaction içinde güncellenir.",
        technicalGuarantee:
          "Her düzenleme öncesi ve sonrası farklarıyla CompletedOrderEditLog tablosuna değiştirilemez denetim izi olarak yazılır.",
      },
    ],
  },
  {
    id: "order-print-pipeline",
    title: "3. Saha Sipariş, Masa Kilidi, Web Push & Çift Kanallı Termal Yazdırma",
    subtitle:
      "Garson terminalinden mutfak yazıcısına ve müşteri telefonundan garsonun cebine uzanan gerçek zamanlı olay mimarisi.",
    badge: "OrdersGateway & Print-Agent",
    steps: [
      {
        step: "01",
        actor: "Garson Terminali",
        title: "Geofence Doğrulaması, Masa Kilidi & Sıralı Sipariş Numarası",
        description:
          "Garson PIN ile giriş yapıp masayı seçtiğinde konum çiti (Geofence) ve masa oturum kilidi doğrulanır. Sipariş kaydedilirken pg_advisory_xact_lock ile o güne ait benzersiz YYMMDD-NNN sipariş numarası üretilir.",
        technicalGuarantee:
          "Aynı milisaniyede 50 garson sipariş gönderse bile hiçbir sipariş numarası çakışmaz ve aynı masaya çift adisyon açılmaz.",
      },
      {
        step: "02",
        actor: "OrdersGateway (Socket.IO)",
        title: "Kiracı İzolasyonlu WebSocket Yayını & Departman Ayrıştırma",
        description:
          "Sipariş oluştuğu anda yalnızca o restoranın Socket.IO odasına (restaurant:<id>) order:created ve orders:updated olayları yayınlanır. Ürünlerin kategori kimlikleri mutfak, bar veya fırın yazıcılarına eşlenir.",
        technicalGuarantee:
          "Farklı restoranların WebSocket odaları JWT ve Print-Agent token doğrulamasıyla birbirinden tamamen izoledir.",
      },
      {
        step: "03",
        actor: "Corder Print-Agent",
        title: "ESC/POS Termal Basım + HTTP Polling Sıfır Kayıp Koruması",
        description:
          "Restorandaki yerel Print-Agent işi alır almaz Türkçe karakter uyumlu ESC/POS komutlarıyla 80mm yazıcıdan mutfak fişini basar ve kitchen-printed onayı gönderir. İnternet koparsa bağlantı geldiği an bekleyen işleri HTTP ile çekip basar.",
        technicalGuarantee:
          "kitchen_ticket_printed_at veritabanı mühürü ve bellek içi deduplication önbelleği sayesinde hiçbir fiş ne kaybolur ne de mükerrer basılır.",
      },
      {
        step: "04",
        actor: "WebPushService",
        title: "RFC 8291 (aes128gcm) Şifreli Garson Çağrı Bildirimi",
        description:
          "Müşteri QR menüden garson çağırdığında veya mutfak bildirimi oluştuğunda, SSRF korumalı WebPushService P-256 VAPID anahtarlarıyla mesajı şifreleyerek Apple/Google push servisleri üzerinden garsonun kilitli ekranına iletir.",
        technicalGuarantee:
          "Özel ağ IP'lerine (127.0.0.1, 10.x, 192.168.x, 169.254.x) yönelik sahte push endpoint'leri SSRF filtresiyle reddedilir.",
      },
    ],
  },
  {
    id: "fraud-rbac-security",
    title: "4. 48 Yetkili RBAC, Suistimal (Fraud) Radarı & Savunma Derinliği",
    subtitle:
      "Kasa kaçaklarını, fiş basımı sonrası iptalleri ve yetkisiz işlemleri anında yakalayan kurumsal güvenlik katmanı.",
    badge: "FraudRulesPolicy & PanelRootGuard",
    steps: [
      {
        step: "01",
        actor: "PanelRootGuard",
        title: "Default-Deny (Varsayılan Red) & 48 Granüler Yetki Denetimi",
        description:
          "Her API endpoint'i @BossOnly, @RequirePermissions veya @AllowStaffWithoutPermissions dekoratörü taşımak zorundadır. Dekoratörü olmayan hiçbir endpoint çalışmaz. Personelin rol şablonu + bireysel grant/revoke + sayısal limitleri anlık hesaplanır.",
        technicalGuarantee:
          "İndirim yetkisi %10 olan bir kasiyer %15 indirim göndermeye çalışırsa CheckSettlementPolicy isteği sunucu katmanında reddeder.",
      },
      {
        step: "02",
        actor: "FraudRulesPolicy",
        title: "6 Kurallı Suistimal ve Anomali Motoru",
        description:
          "1) Yüksek İptal Oranı, 2) Fiş Basımı Sonrası Ürün İptali (Post-Print Void), 3) Aşırı İndirim, 4) Vardiya Nakit Kasa Açığı, 5) Gece Geç Saat İptali, 6) Olağandışı Nakit Kasa Çıkışı (kredi kartı harcamaları hariç) kuralları sürekli değerlendirilir.",
        technicalGuarantee:
          "Her anomali kanıt metadatası, finansal etki tutarı (amountImpact) ve ilgili personel bilgisiyle Boss paneline düşer.",
      },
      {
        step: "03",
        actor: "In-Flight Coalescing",
        title: "Yüksek Yoğunlukta Birleştirilmiş Anomali Taraması",
        description:
          "Aynı restoranda saniyede yüzlerce işlem gerçekleştiğinde FraudDetectionService eşzamanlı tarama isteklerini tek bir veritabanı sorgusunda birleştirir (coalescing) ve mevcut açık uyarıları mükerrer kayıt açmadan günceller.",
        technicalGuarantee:
          "200 eşzamanlı anomali tetiklemesi veritabanında yalnızca 1 tarama yürüterek < 20ms içinde tamamlanır.",
      },
      {
        step: "04",
        actor: "TextNormalizer & Audit",
        title: "Evrensel Unicode Metin Standardı & Değiştirilemez Denetim İzi",
        description:
          "Veritabanına yazılan tüm isimler normalizeStorageText ile küçük harfe, kullanıcıya gösterilen tüm başlıklar formatTitleCase('tr') ile Türkçe Baş Harf Düzenine çevrilir. Tüm kritik aksiyonlar RestaurantAuditLog tablosuna kaydedilir.",
        technicalGuarantee:
          "Farklı cihazlardan girilen 'b1', 'B1', 'bahçe' gibi kayıtlar her ekranda, bildirimde ve termal fişte tutarlı 'B1 (Bahçe)' olarak görünür.",
      },
    ],
  },
]

export interface DomainSchemaGroup {
  domain: string
  entityCount: number
  entities: string[]
  purpose: string
}

export const DATABASE_SCHEMA_GROUPS: DomainSchemaGroup[] = [
  {
    domain: "Platform, Kiracı (Tenant), Boss & Abonelik",
    entityCount: 5,
    entities: [
      "RestaurantEntity",
      "BossUserEntity",
      "BossRestaurantLinkEntity",
      "FranchiseBrandEntity",
      "SubscriptionPaymentEntity",
    ],
    purpose:
      "Çok kiracılı restoran kayıtları, SOD/EOD gün sonu ayarları, Geofence koordinatları, franchise marka royalty oranları, çoklu Boss-Şube sahiplik bağları ve 25-30 abonelik tahsilat dönemleri.",
  },
  {
    domain: "Salon, Masa, Sipariş & Kapanmış Adisyon",
    entityCount: 7,
    entities: [
      "SectionEntity",
      "TableEntity",
      "OrderEntity",
      "OrderItemEntity",
      "CompletedOrderEntity",
      "CompletedOrderEditLogEntity",
      "WaiterCallEntity",
    ],
    purpose:
      "Bölüm ve masa oturum kilitleri (lockedByStaffId), aktif siparişler, kalem durumları (preparing/served/cancelled/ledger), kapanmış adisyon snapshot'ları, geriye dönük düzenleme denetim kayıtları ve QR garson çağrıları.",
  },
  {
    domain: "Kasa Vardiyası, Nakit Akışı & Cari Defter (Ledger)",
    entityCount: 5,
    entities: [
      "CashShiftEntity",
      "CashTransactionEntity",
      "LedgerCustomerEntity",
      "LedgerEntryEntity",
      "OpenAccountEntity",
    ],
    purpose:
      "Kasa açılış/kapanış bakiyeleri, otomatik gün sonu ve devreden açık masa fotoğrafları (carriedOverTablesSnapshot), nakit/kart gider hareketleri ve müşteri cari borç/tahsilat defteri.",
  },
  {
    domain: "Katalog, Menü, Reçete & Kampanya",
    entityCount: 4,
    entities: [
      "CategoryEntity",
      "ProductEntity",
      "CampaignEntity",
      "MenuThemeConfig",
    ],
    purpose:
      "Kategori ve ürün tanımları, JSONB reçete (BOM) malzeme listeleri, showInMenu görünürlük bayrakları, zaman/koşul bazlı kampanyalar ve QR menü şablon ayarları.",
  },
  {
    domain: "Reçete Stok, Tedarikçi, Satın Alma (PO) & Envanter Sayımı",
    entityCount: 6,
    entities: [
      "StockMaterialEntity",
      "StockMovementEntity",
      "SupplierEntity",
      "PurchaseOrderEntity",
      "InventoryCountEntity",
      "InventoryCountItemEntity",
    ],
    purpose:
      "Hammadde stok seviyeleri, ağırlıklı hareketli ortalama birim maliyetler, tedarikçi kartları, satın alma siparişleri ve fiziksel stok sayım varyansları.",
  },
  {
    domain: "Personel, 48 RBAC Yetki, Bildirim, Yazıcı & Suistimal (Fraud)",
    entityCount: 8,
    entities: [
      "RestaurantStaffEntity",
      "AuditLogEntity",
      "FraudAlertEntity",
      "PanelNotificationEntity",
      "WebPushSubscriptionEntity",
      "PrinterConfigEntity",
      "PrinterDepartmentEntity",
      "PrintJobEntity",
    ],
    purpose:
      "Personel PIN/rol/grant/revoke yetkileri, indirim ve iptal limitleri, 6 kurallı fraud uyarıları, VAPID Web Push abonelikleri ve Print-Agent termal yazdırma kuyruğu.",
  },
]

export const RBAC_PERMISSION_CATEGORIES = [
  {
    category: "Masa & Sipariş Operasyonu (10 Yetki)",
    codePrefix: "table.* / order.*",
    examples: [
      "table.view",
      "table.open",
      "table.move",
      "table.merge",
      "table.force_unlock",
      "order.create",
      "order.cancel_item",
      "order.print_receipt",
    ],
    limitSupport: "Maksimum tekil iptal tutarı (maxCancelAmount) ile sınırlandırılabilir.",
  },
  {
    category: "Tahsilat, İndirim & Geriye Dönük Düzenleme (8 Yetki)",
    codePrefix: "billing.*",
    examples: [
      "billing.close_check",
      "billing.apply_discount",
      "billing.complimentary",
      "billing.split_payment",
      "billing.edit_completed_order",
      "billing.view_completed_orders",
    ],
    limitSupport: "Maksimum indirim yüzdesi (maxDiscountPct) ile personel bazında kısıtlanabilir.",
  },
  {
    category: "Kasa Vardiyası & Cari Defter (9 Yetki)",
    codePrefix: "cash.* / ledger.*",
    examples: [
      "cash.view",
      "cash.shift_open",
      "cash.shift_close",
      "cash.transaction_in",
      "cash.transaction_out",
      "cash.view_history",
      "ledger.view",
      "ledger.manage_customers",
      "ledger.collect_payment",
    ],
    limitSupport: "Kasa beklenen nakit bakiyesini görme (cash.view_history) kasiyerlerden gizlenebilir (Kör Sayım).",
  },
  {
    category: "Katalog, Reçete Stok & Satın Alma (11 Yetki)",
    codePrefix: "catalog.* / stock.*",
    examples: [
      "catalog.manage_categories",
      "catalog.manage_products",
      "catalog.manage_campaigns",
      "stock.view",
      "stock.manage_materials",
      "stock.manage_suppliers",
      "stock.manage_purchase_orders",
      "stock.perform_count",
    ],
    limitSupport: "Depo sorumlusu yalnızca stok ve sayım ekranlarını görür, finansal ciroya erişemez.",
  },
  {
    category: "Raporlar, Personel, Yazıcı & Sistem Ayarları (10 Yetki)",
    codePrefix: "reports.* / staff.* / settings.*",
    examples: [
      "reports.view_financial",
      "reports.view_operational",
      "reports.view_staff_performance",
      "reports.view_audit_logs",
      "staff.view",
      "staff.manage",
      "settings.manage_printers",
      "settings.manage_restaurant",
    ],
    limitSupport: "Yetki matrisi düzenleme ve suistimal uyarıları yalnızca @BossOnly (Root Boss) erişimine açıktır.",
  },
]

