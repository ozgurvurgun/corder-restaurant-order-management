export const PERMISSION_CATEGORY_LABELS: Record<
  string,
  { title: string; description: string }
> = {
  orders_tables: {
    title: "Masa & Sipariş Operasyonları",
    description:
      "Terminal ve panel üzerinden sipariş alma, masa taşıma, kalem aktarma ve iptal yetkileri",
  },
  discounts: {
    title: "İskonto & İkram Yetkileri",
    description:
      "Yüzdesel indirim, tutar indirimi, tam ikram ve maksimum indirim limitleri",
  },
  billing_cash: {
    title: "Hesap Kesme, Ödeme & Kasa",
    description:
      "Adisyon kapatma, hesap bölme, kasa vardiyası açma/kapama ve nakit giriş/çıkış yetkileri",
  },
  ledger: {
    title: "Cari & Veresiye (Açık Hesap)",
    description:
      "Hesabı cariye atma, cari müşteri oluşturma ve açık hesap tahsilat yetkileri",
  },
  catalog: {
    title: "Menü, Ürün, Fiyat & Kampanya",
    description:
      "Ürün ekleme/düzenleme, fiyat değiştirme, stokta var/tükendi durumu ve kampanya yönetimi",
  },
  inventory: {
    title: "Stok, Reçete, Tedarik & Sayım",
    description:
      "Hammadde tanımlama, stok giriş/çıkış/fire, tedarikçi ve envanter sayım farkı onaylama",
  },
  reports_system: {
    title: "Raporlama, Personel & Sistem",
    description:
      "Ciro raporları, denetim (audit) kayıtları, personel/rol yönetimi ve restoran ayarları",
  },
}

export const PERMISSION_LABELS: Record<
  string,
  { title: string; description: string }
> = {
  "order.view": {
    title: "Masaları ve Adisyonları Görüntüleme",
    description: "Salon/masa durumlarını ve açık adisyon içeriklerini görüntüleyebilir.",
  },
  "order.create": {
    title: "Yeni Sipariş / Adisyon Açma",
    description: "Masaya yeni adisyon açabilir ve mevcut adisyona ürün ekleyebilir.",
  },
  "order.add_note": {
    title: "Sipariş Notu Ekleme",
    description: "Sipariş kalemlerine mutfak/hazırlık notu ekleyebilir.",
  },
  "order.print_receipt": {
    title: "Adisyon / Ara Hesap Fişi Yazdırma",
    description: "Yazıcıdan masa veya adisyon bilgi fişi yazdırabilir.",
  },
  "table.move": {
    title: "Masa Taşıma ve Birleştirme",
    description: "Açık bir masanın tüm adisyonlarını başka bir masaya taşıyabilir veya birleştirebilir.",
  },
  "order.move_items": {
    title: "Ürün / Kalem Taşıma",
    description: "Adisyon içindeki seçili ürünleri başka bir masaya aktarabilir.",
  },
  "order.cancel_item": {
    title: "Sipariş Kalemi İptal Etme (Zayi/İptal)",
    description: "Onaylanmış adisyon kalemini sebep belirterek iptal edebilir (mutfak iptal fişi üretir).",
  },
  "table.force_unlock": {
    title: "Başka Personelin Masa Kilidini Açma",
    description: "Başka bir garsonun işlem yaptığı kilitli masanın oturum kilidini devralabilir.",
  },
  "order.quick_sale": {
    title: "Hızlı Satış / Paket Satış",
    description: "Masa açmadan hızlı satış (gel-al / tezgah satışı) gerçekleştirebilir.",
  },
  "discount.apply_percent": {
    title: "Yüzdesel (%) İskonto Uygulama",
    description: "Belirlenen maksimum yüzde limiti dahilinde yüzdesel indirim uygulayabilir.",
  },
  "discount.apply_amount": {
    title: "Tutar Bazlı (₺) İskonto Uygulama",
    description: "Belirlenen maksimum tutar limiti dahilinde TL bazlı indirim uygulayabilir.",
  },
  "discount.complimentary": {
    title: "Tam İkram (%100) Uygulama",
    description: "Hesabı veya ürünü müşteri/patron ikramı olarak %100 ücretsiz kapatabilir.",
  },
  "discount.remove": {
    title: "Uygulanan İndirimi Kaldırma",
    description: "Masaya tanımlanmış mevcut indirimi iptal edip tam fiyata döndürebilir.",
  },
  "billing.close_check": {
    title: "Hesap Kesme ve Ödeme Alma",
    description: "Nakit, kredi kartı, yemek kartı veya Multinet ile adisyon kapatabilir.",
  },
  "billing.split_bill": {
    title: "Hesap Bölme / Parçalı Ödeme",
    description: "Hesabı kişi sayısına veya seçili ürünlere göre bölerek parçalı tahsilat alabilir.",
  },
  "billing.edit_completed_order": {
    title: "Kapanmış Adisyonu Geçmişe Dönük Düzenleme",
    description: "Tamamlanmış siparişlerin ödeme yöntemini veya kaydını sonradan değiştirebilir.",
  },
  "cash.view": {
    title: "Kasa Durumunu Görüntüleme",
    description: "Aktif kasa vardiyasını ve anlık kasa toplamlarını görüntüleyebilir.",
  },
  "cash.shift_open": {
    title: "Kasa Vardiyası (Gün Başı) Açma",
    description: "Açılış bakiyesi girerek yeni kasa vardiyası başlatabilir.",
  },
  "cash.shift_close": {
    title: "Kasa Vardiyası (Gün Sonu / Z) Kapatma",
    description: "Sayım tutarı girerek aktif kasa vardiyasını kapatabilir.",
  },
  "cash.transaction_in": {
    title: "Kasaya Manuel Nakit Girişi",
    description: "Satış dışı kasaya nakit/bozuk para girişi kaydedebilir.",
  },
  "cash.transaction_out": {
    title: "Kasadan Nakit Çıkış / Gider Yazma",
    description: "Kasadan masraf, tedarikçi ödemesi veya avans nakit çıkışı yapabilir.",
  },
  "cash.view_history": {
    title: "Geçmiş Kasa Vardiyalarını Görme",
    description: "Kapanmış vardiyaları, kasa farklarını ve geçmiş hareket dökümünü inceleyebilir.",
  },
  "ledger.view": {
    title: "Cari ve Açık Hesapları Görüntüleme",
    description: "Cari müşteri bakiyelerini ve açık hesap listesini görüntüleyebilir.",
  },
  "ledger.assign_order": {
    title: "Hesabı veya Kalemi Cariye / Veresiyeye Atma",
    description: "Adisyonun tamamını veya seçili kalemleri cari müşteri hesabına borç yazabilir.",
  },
  "ledger.revert_item": {
    title: "Cariden Satırı Adisyona Geri Alma",
    description: "Cariye aktarılmış bir adisyon kalemini tekrar masaya geri döndürebilir.",
  },
  "ledger.manage_customers": {
    title: "Cari Müşteri / Açık Hesap Tanımlama",
    description: "Yeni cari müşteri kartı veya açık hesap oluşturabilir.",
  },
  "ledger.collect_payment": {
    title: "Cari / Açık Hesap Tahsilatı Alma",
    description: "Cari müşterilerden veya açık hesaplardan borç tahsilatı kaydedebilir.",
  },
  "catalog.view": {
    title: "Ürün ve Kategorileri Görüntüleme",
    description: "Menüdeki kategori, ürün ve reçete tanımlarını görüntüleyebilir.",
  },
  "catalog.manage_products": {
    title: "Ürün Ekleme, Düzenleme ve Silme",
    description: "Yeni ürün ekleyebilir, ürün açıklaması, görseli ve reçetesini düzenleyebilir veya silebilir.",
  },
  "catalog.change_price": {
    title: "Ürün Fiyatlarını Değiştirme",
    description: "Menüdeki ürünlerin satış fiyatlarını güncelleyebilir.",
  },
  "catalog.toggle_stock": {
    title: "Ürün Stokta Var / Tükendi Durumu",
    description: "Ürünü geçici olarak tükendi (satışa kapalı) veya satışa açık olarak işaretleyebilir.",
  },
  "catalog.manage_categories": {
    title: "Kategori Yönetimi ve Sıralama",
    description: "Kategori ekleyebilir, düzenleyebilir, sıralamasını değiştirebilir ve silebilir.",
  },
  "catalog.manage_campaigns": {
    title: "Kampanya ve Promosyon Yönetimi",
    description: "Dijital menü ve restoran kampanyalarını oluşturabilir ve yönetebilir.",
  },
  "inventory.view": {
    title: "Stok ve Hammadde Durumunu Görme",
    description: "Hammadde miktarlarını, kritik stok uyarılarını ve stok hareketlerini görüntüleyebilir.",
  },
  "inventory.manage_materials": {
    title: "Hammadde Kartı Ekleme / Düzenleme",
    description: "Yeni stok malzemesi tanımlayabilir, birim maliyet ve kritik stok seviyesini değiştirebilir.",
  },
  "inventory.stock_movement": {
    title: "Stok Giriş / Çıkış ve Fire İşleme",
    description: "Manuel stok girişi, çıkışı ve fire/zayi düşümü yapabilir.",
  },
  "inventory.manage_suppliers": {
    title: "Tedarikçi ve Satın Alma (PO) Yönetimi",
    description: "Tedarikçi ekleyebilir ve satın alma siparişlerini oluşturup teslim alabilir.",
  },
  "inventory.count_adjust": {
    title: "Envanter Sayımı ve Stok Farkı Onaylama",
    description: "Fiziksel stok sayımı kaydedip mevcut stok miktarlarını sayım sonucuna eşitleyebilir.",
  },
  "reports.view_operational": {
    title: "Operasyonel Satış ve Ürün Raporları",
    description: "Tamamlanan sipariş listesini ve ürün/kategori satış adetlerini görüntüleyebilir.",
  },
  "reports.view_financial": {
    title: "Finansal Ciro, Kâr ve Ödeme Raporları",
    description: "Toplam ciro, ödeme tipi dağılımı, iskonto toplamları ve finansal analizleri görebilir.",
  },
  "reports.view_staff_performance": {
    title: "Personel Performans Raporları",
    description: "Garson ve kasiyer bazlı satış, iptal ve işlem performans metriklerini görebilir.",
  },
  "reports.view_audit_logs": {
    title: "Denetim Kayıtlarını (Audit Log) Görme",
    description: "İptal, masa taşıma, fiyat değişimi ve kritik sistem hareket kayıtlarını inceleyebilir.",
  },
  "security.view_fraud_alerts": {
    title: "Güvenlik & Suistimal Uyarılarını Görme",
    description: "Anomali tespiti, şüpheli iptal/iskonto desenleri ve kasa farkı uyarılarını görüntüleyebilir.",
  },
  "security.manage_fraud_alerts": {
    title: "Güvenlik & Suistimal Uyarılarını Yönetme",
    description: "Suistimal ve kayıp önleme uyarılarını inceleyebilir, çözümleyebilir veya yanlış alarm olarak işaretleyebilir.",
  },
  "staff.view": {
    title: "Personel Listesini Görüntüleme",
    description: "Şubedeki personel ve kullanıcı listesini görüntüleyebilir.",
  },
  "staff.manage": {
    title: "Personel / Kullanıcı Oluşturma ve Düzenleme",
    description: "Yeni personel ekleyebilir, PIN/parola sıfırlayabilir ve aktif/pasif yapabilir.",
  },
  "roles.manage": {
    title: "Rolleri ve Yetki Kısıtlamalarını Yönetme",
    description: "Rol şablonlarını, yetki matrisini ve iskonto limitlerini yapılandırabilir.",
  },
  "system.manage_tables": {
    title: "Masa ve Salon / Bölge Yönetimi",
    description: "Yeni masa ve salon bölgesi ekleyebilir, düzenleyebilir ve silebilir.",
  },
  "system.manage_printers": {
    title: "Yazıcı ve Mutfak Fişi Ayarları",
    description: "Termal yazıcıları ve kategori bazlı mutfak yazdırma yönlendirmelerini yönetebilir.",
  },
  "system.manage_settings": {
    title: "Restoran Genel Ayarları",
    description: "Restoran iletişim bilgileri, vergi no, sosyal medya ve çalışma saatlerini düzenleyebilir.",
  },
}

export const SYSTEM_ROLE_LABELS: Record<
  string,
  { name: string; description: string }
> = {
  boss: {
    name: "İşletme Sahibi (Boss)",
    description: "Tüm şubeler ve aksiyonlar üzerinde tam yetkili işletme sahibi.",
  },
  root: {
    name: "İşletme Sahibi (Boss)",
    description: "Tüm şubeler ve aksiyonlar üzerinde tam yetkili işletme sahibi.",
  },
  branch_manager: {
    name: "Şube Müdürü",
    description: "Şube içi tüm operasyon, kasa, menü, stok, personel ve yetki süreçlerini yönetir.",
  },
  manager: {
    name: "Şube Müdürü",
    description: "Şube içi tüm operasyon, kasa, menü, stok, personel ve yetki süreçlerini yönetir.",
  },
  shift_supervisor: {
    name: "Vardiya Amiri / Şef",
    description: "Saha operasyonunu, masa/ürün taşımalarını, iptalleri, kasayı ve günlük akışı denetler.",
  },
  cashier: {
    name: "Kasiyer",
    description: "Kasa vardiyası, hesap kesme, parçalı tahsilat, hızlı satış ve cari tahsilat işlemlerini yapar.",
  },
  head_waiter: {
    name: "Şef Garson",
    description: "Terminalden sipariş alır, masa ve kalem taşıma, ürün iptali ve sınırlı iskonto yapabilir.",
  },
  waiter: {
    name: "Garson",
    description: "Terminalden masa açar, sipariş girer, masa/kalem taşır ve ara hesap fişi yazdırır.",
  },
  runner: {
    name: "Komi / Stajyer",
    description: "Sadece masaları görüntüler ve yeni sipariş kalemi ekleyebilir; taşıma ve iptal yapamaz.",
  },
  inventory_manager: {
    name: "Depo & Stok Sorumlusu",
    description: "Hammadde, stok giriş/çıkış/fire, tedarikçi, satın alma ve envanter sayımlarını yönetir.",
  },
  accountant: {
    name: "Muhasebe & Finans",
    description: "Finansal raporları, kasa geçmişini, cari hesapları, stokları ve denetim kayıtlarını inceler.",
  },
}

export function getCategoryLabel(
  categoryKey: string,
  fallback?: { title: string; description: string }
): { title: string; description: string } {
  return (
    PERMISSION_CATEGORY_LABELS[categoryKey] ??
    fallback ?? { title: categoryKey, description: "" }
  )
}

export function getPermissionLabel(
  permKey: string,
  fallback?: { title: string; description: string }
): { title: string; description: string } {
  return (
    PERMISSION_LABELS[permKey] ??
    fallback ?? { title: permKey, description: "" }
  )
}

export function getRoleDisplayName(
  roleKey: string,
  fallbackName?: string | null
): string {
  return SYSTEM_ROLE_LABELS[roleKey]?.name ?? fallbackName ?? roleKey
}

