export const PERMISSION_CATEGORIES = [
  'orders_tables',
  'discounts',
  'billing_cash',
  'ledger',
  'catalog',
  'inventory',
  'reports_system',
] as const;

export type PermissionCategory = (typeof PERMISSION_CATEGORIES)[number];
export type PermissionScope = 'terminal' | 'panel' | 'both';

export interface PermissionDefinition {
  key: PermissionKey;
  category: PermissionCategory;
  title: string;
  description: string;
  scope: PermissionScope;
  isCritical?: boolean;
}

export const PERMISSION_KEYS = [
  'order.view',
  'order.create',
  'order.add_note',
  'order.print_receipt',
  'table.move',
  'order.move_items',
  'order.cancel_item',
  'table.force_unlock',
  'order.quick_sale',
  'discount.apply_percent',
  'discount.apply_amount',
  'discount.complimentary',
  'discount.remove',
  'billing.close_check',
  'billing.split_bill',
  'billing.edit_completed_order',
  'cash.view',
  'cash.shift_open',
  'cash.shift_close',
  'cash.transaction_in',
  'cash.transaction_out',
  'cash.view_history',
  'ledger.view',
  'ledger.assign_order',
  'ledger.revert_item',
  'ledger.manage_customers',
  'ledger.collect_payment',
  'catalog.view',
  'catalog.manage_products',
  'catalog.change_price',
  'catalog.toggle_stock',
  'catalog.manage_categories',
  'catalog.manage_campaigns',
  'inventory.view',
  'inventory.manage_materials',
  'inventory.stock_movement',
  'inventory.manage_suppliers',
  'inventory.count_adjust',
  'reports.view_operational',
  'reports.view_financial',
  'reports.view_staff_performance',
  'reports.view_audit_logs',
  'security.view_fraud_alerts',
  'security.manage_fraud_alerts',
  'staff.view',
  'staff.manage',
  'roles.manage',
  'system.manage_tables',
  'system.manage_printers',
  'system.manage_settings',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_CATEGORY_META: Record<
  PermissionCategory,
  { title: string; description: string }
> = {
  orders_tables: {
    title: 'Masa & Sipariş Operasyonları',
    description: 'Terminal ve panel üzerinden sipariş alma, masa taşıma, kalem aktarma ve iptal yetkileri',
  },
  discounts: {
    title: 'İskonto & İkram Yetkileri',
    description: 'Yüzdesel indirim, tutar indirimi, tam ikram ve maksimum indirim limitleri',
  },
  billing_cash: {
    title: 'Hesap Kesme, Ödeme & Kasa',
    description: 'Adisyon kapatma, hesap bölme, kasa vardiyası açma/kapama ve nakit giriş/çıkış yetkileri',
  },
  ledger: {
    title: 'Cari & Veresiye (Açık Hesap)',
    description: 'Hesabı cariye atma, cari müşteri oluşturma ve açık hesap tahsilat yetkileri',
  },
  catalog: {
    title: 'Menü, Ürün, Fiyat & Kampanya',
    description: 'Ürün ekleme/düzenleme, fiyat değiştirme, stokta var/tükendi durumu ve kampanya yönetimi',
  },
  inventory: {
    title: 'Stok, Reçete, Tedarik & Sayım',
    description: 'Hammadde tanımlama, stok giriş/çıkış/fire, tedarikçi ve envanter sayım farkı onaylama',
  },
  reports_system: {
    title: 'Raporlama, Personel & Sistem',
    description: 'Ciro raporları, denetim (audit) kayıtları, personel/rol yönetimi ve restoran ayarları',
  },
};

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  { key: 'order.view', category: 'orders_tables', title: 'Masaları ve Adisyonları Görüntüleme', description: 'Salon/masa durumlarını ve açık adisyon içeriklerini görüntüleyebilir.', scope: 'both' },
  { key: 'order.create', category: 'orders_tables', title: 'Yeni Sipariş / Adisyon Açma', description: 'Masaya yeni adisyon açabilir ve mevcut adisyona ürün ekleyebilir.', scope: 'both' },
  { key: 'order.add_note', category: 'orders_tables', title: 'Sipariş Notu Ekleme', description: 'Sipariş kalemlerine mutfak/hazırlık notu ekleyebilir.', scope: 'both' },
  { key: 'order.print_receipt', category: 'orders_tables', title: 'Adisyon / Ara Hesap Fişi Yazdırma', description: 'Yazıcıdan masa veya adisyon bilgi fişi yazdırabilir.', scope: 'both' },
  { key: 'table.move', category: 'orders_tables', title: 'Masa Taşıma ve Birleştirme', description: 'Açık bir masanın tüm adisyonlarını başka bir masaya taşıyabilir veya birleştirebilir.', scope: 'both', isCritical: true },
  { key: 'order.move_items', category: 'orders_tables', title: 'Ürün / Kalem Taşıma', description: 'Adisyon içindeki seçili ürünleri başka bir masaya aktarabilir.', scope: 'both', isCritical: true },
  { key: 'order.cancel_item', category: 'orders_tables', title: 'Sipariş Kalemi İptal Etme (Zayi/İptal)', description: 'Onaylanmış adisyon kalemini sebep belirterek iptal edebilir (mutfak iptal fişi üretir).', scope: 'both', isCritical: true },
  { key: 'table.force_unlock', category: 'orders_tables', title: 'Başka Personelin Masa Kilidini Açma', description: 'Başka bir garsonun işlem yaptığı kilitli masanın oturum kilidini devralabilir.', scope: 'both', isCritical: true },
  { key: 'order.quick_sale', category: 'orders_tables', title: 'Hızlı Satış / Paket Satış', description: 'Masa açmadan hızlı satış (gel-al / tezgah satışı) gerçekleştirebilir.', scope: 'panel' },
  { key: 'discount.apply_percent', category: 'discounts', title: 'Yüzdesel (%) İskonto Uygulama', description: 'Belirlenen maksimum yüzde limiti dahilinde yüzdesel indirim uygulayabilir.', scope: 'both', isCritical: true },
  { key: 'discount.apply_amount', category: 'discounts', title: 'Tutar Bazlı (₺) İskonto Uygulama', description: 'Belirlenen maksimum tutar limiti dahilinde TL bazlı indirim uygulayabilir.', scope: 'both', isCritical: true },
  { key: 'discount.complimentary', category: 'discounts', title: 'Tam İkram (%100) Uygulama', description: 'Hesabı veya ürünü müşteri/patron ikramı olarak %100 ücretsiz kapatabilir.', scope: 'both', isCritical: true },
  { key: 'discount.remove', category: 'discounts', title: 'Uygulanan İndirimi Kaldırma', description: 'Masaya tanımlanmış mevcut indirimi iptal edip tam fiyata döndürebilir.', scope: 'both' },
  { key: 'billing.close_check', category: 'billing_cash', title: 'Hesap Kesme ve Ödeme Alma', description: 'Nakit, kredi kartı, yemek kartı veya Multinet ile adisyon kapatabilir.', scope: 'both', isCritical: true },
  { key: 'billing.split_bill', category: 'billing_cash', title: 'Hesap Bölme / Parçalı Ödeme', description: 'Hesabı kişi sayısına veya seçili ürünlere göre bölerek parçalı tahsilat alabilir.', scope: 'panel' },
  { key: 'billing.edit_completed_order', category: 'billing_cash', title: 'Kapanmış Adisyonu Geçmişe Dönük Düzenleme', description: 'Tamamlanmış siparişlerin ödeme yöntemini veya kaydını sonradan değiştirebilir.', scope: 'panel', isCritical: true },
  { key: 'cash.view', category: 'billing_cash', title: 'Kasa Durumunu Görüntüleme', description: 'Aktif kasa vardiyasını ve anlık kasa toplamlarını görüntüleyebilir.', scope: 'panel' },
  { key: 'cash.shift_open', category: 'billing_cash', title: 'Kasa Vardiyası (Gün Başı) Açma', description: 'Açılış bakiyesi girerek yeni kasa vardiyası başlatabilir.', scope: 'panel', isCritical: true },
  { key: 'cash.shift_close', category: 'billing_cash', title: 'Kasa Vardiyası (Gün Sonu / Z) Kapatma', description: 'Sayım tutarı girerek aktif kasa vardiyasını kapatabilir.', scope: 'panel', isCritical: true },
  { key: 'cash.transaction_in', category: 'billing_cash', title: 'Kasaya Manuel Nakit Girişi', description: 'Satış dışı kasaya nakit/bozuk para girişi kaydedebilir.', scope: 'panel' },
  { key: 'cash.transaction_out', category: 'billing_cash', title: 'Kasadan Nakit Çıkış / Gider Yazma', description: 'Kasadan masraf, tedarikçi ödemesi veya avans nakit çıkışı yapabilir.', scope: 'panel', isCritical: true },
  { key: 'cash.view_history', category: 'billing_cash', title: 'Geçmiş Kasa Vardiyalarını Görme', description: 'Kapanmış vardiyaları, kasa farklarını ve geçmiş hareket dökümünü inceleyebilir.', scope: 'panel' },
  { key: 'ledger.view', category: 'ledger', title: 'Cari ve Açık Hesapları Görüntüleme', description: 'Cari müşteri bakiyelerini ve açık hesap listesini görüntüleyebilir.', scope: 'panel' },
  { key: 'ledger.assign_order', category: 'ledger', title: 'Hesabı veya Kalemi Cariye / Veresiyeye Atma', description: 'Adisyonun tamamını veya seçili kalemleri cari müşteri hesabına borç yazabilir.', scope: 'panel', isCritical: true },
  { key: 'ledger.revert_item', category: 'ledger', title: 'Cariden Satırı Adisyona Geri Alma', description: 'Cariye aktarılmış bir adisyon kalemini tekrar masaya geri döndürebilir.', scope: 'panel', isCritical: true },
  { key: 'ledger.manage_customers', category: 'ledger', title: 'Cari Müşteri / Açık Hesap Tanımlama', description: 'Yeni cari müşteri kartı veya açık hesap oluşturabilir.', scope: 'panel' },
  { key: 'ledger.collect_payment', category: 'ledger', title: 'Cari / Açık Hesap Tahsilatı Alma', description: 'Cari müşterilerden veya açık hesaplardan borç tahsilatı kaydedebilir.', scope: 'panel', isCritical: true },
  { key: 'catalog.view', category: 'catalog', title: 'Ürün ve Kategorileri Görüntüleme', description: 'Menüdeki kategori, ürün ve reçete tanımlarını görüntüleyebilir.', scope: 'panel' },
  { key: 'catalog.manage_products', category: 'catalog', title: 'Ürün Ekleme, Düzenleme ve Silme', description: 'Yeni ürün ekleyebilir, ürün açıklaması, görseli ve reçetesini düzenleyebilir veya silebilir.', scope: 'panel' },
  { key: 'catalog.change_price', category: 'catalog', title: 'Ürün Fiyatlarını Değiştirme', description: 'Menüdeki ürünlerin satış fiyatlarını güncelleyebilir.', scope: 'panel', isCritical: true },
  { key: 'catalog.toggle_stock', category: 'catalog', title: 'Ürün Stokta Var / Tükendi Durumu', description: 'Ürünü geçici olarak tükendi (satışa kapalı) veya satışa açık olarak işaretleyebilir.', scope: 'panel' },
  { key: 'catalog.manage_categories', category: 'catalog', title: 'Kategori Yönetimi ve Sıralama', description: 'Kategori ekleyebilir, düzenleyebilir, sıralamasını değiştirebilir ve silebilir.', scope: 'panel' },
  { key: 'catalog.manage_campaigns', category: 'catalog', title: 'Kampanya ve Promosyon Yönetimi', description: 'Dijital menü ve restoran kampanyalarını oluşturabilir ve yönetebilir.', scope: 'panel' },
  { key: 'inventory.view', category: 'inventory', title: 'Stok ve Hammadde Durumunu Görme', description: 'Hammadde miktarlarını, kritik stok uyarılarını ve stok hareketlerini görüntüleyebilir.', scope: 'panel' },
  { key: 'inventory.manage_materials', category: 'inventory', title: 'Hammadde Kartı Ekleme / Düzenleme', description: 'Yeni stok malzemesi tanımlayabilir, birim maliyet ve kritik stok seviyesini değiştirebilir.', scope: 'panel' },
  { key: 'inventory.stock_movement', category: 'inventory', title: 'Stok Giriş / Çıkış ve Fire İşleme', description: 'Manuel stok girişi, çıkışı ve fire/zayi düşümü yapabilir.', scope: 'panel', isCritical: true },
  { key: 'inventory.manage_suppliers', category: 'inventory', title: 'Tedarikçi ve Satın Alma (PO) Yönetimi', description: 'Tedarikçi ekleyebilir ve satın alma siparişlerini oluşturup teslim alabilir.', scope: 'panel' },
  { key: 'inventory.count_adjust', category: 'inventory', title: 'Envanter Sayımı ve Stok Farkı Onaylama', description: 'Fiziksel stok sayımı kaydedip mevcut stok miktarlarını sayım sonucuna eşitleyebilir.', scope: 'panel', isCritical: true },
  { key: 'reports.view_operational', category: 'reports_system', title: 'Operasyonel Satış ve Ürün Raporları', description: 'Tamamlanan sipariş listesini ve ürün/kategori satış adetlerini görüntüleyebilir.', scope: 'panel' },
  { key: 'reports.view_financial', category: 'reports_system', title: 'Finansal Ciro, Kâr ve Ödeme Raporları', description: 'Toplam ciro, ödeme tipi dağılımı, iskonto toplamları ve finansal analizleri görebilir.', scope: 'panel', isCritical: true },
  { key: 'reports.view_staff_performance', category: 'reports_system', title: 'Personel Performans Raporları', description: 'Garson ve kasiyer bazlı satış, iptal ve işlem performans metriklerini görebilir.', scope: 'panel' },
  { key: 'reports.view_audit_logs', category: 'reports_system', title: 'Denetim Kayıtlarını (Audit Log) Görme', description: 'İptal, masa taşıma, fiyat değişimi ve kritik sistem hareket kayıtlarını inceleyebilir.', scope: 'panel', isCritical: true },
  { key: 'security.view_fraud_alerts', category: 'reports_system', title: 'Güvenlik & Suistimal Uyarılarını Görme', description: 'Anomali tespiti, şüpheli iptal/iskonto desenleri ve kasa farkı uyarılarını görüntüleyebilir.', scope: 'panel', isCritical: true },
  { key: 'security.manage_fraud_alerts', category: 'reports_system', title: 'Güvenlik & Suistimal Uyarılarını Yönetme', description: 'Suistimal ve kayıp önleme uyarılarını inceleyebilir, çözümleyebilir veya yanlış alarm olarak işaretleyebilir.', scope: 'panel', isCritical: true },
  { key: 'staff.view', category: 'reports_system', title: 'Personel Listesini Görüntüleme', description: 'Şubedeki personel ve kullanıcı listesini görüntüleyebilir.', scope: 'panel' },
  { key: 'staff.manage', category: 'reports_system', title: 'Personel / Kullanıcı Oluşturma ve Düzenleme', description: 'Yeni personel ekleyebilir, PIN/parola sıfırlayabilir ve aktif/pasif yapabilir.', scope: 'panel', isCritical: true },
  { key: 'roles.manage', category: 'reports_system', title: 'Rolleri ve Yetki Kısıtlamalarını Yönetme', description: 'Rol şablonlarını, yetki matrisini ve iskonto limitlerini yapılandırabilir.', scope: 'panel', isCritical: true },
  { key: 'system.manage_tables', category: 'reports_system', title: 'Masa ve Salon / Bölge Yönetimi', description: 'Yeni masa ve salon bölgesi ekleyebilir, düzenleyebilir ve silebilir.', scope: 'panel' },
  { key: 'system.manage_printers', category: 'reports_system', title: 'Yazıcı ve Mutfak Fişi Ayarları', description: 'Termal yazıcıları ve kategori bazlı mutfak yazdırma yönlendirmelerini yönetebilir.', scope: 'panel' },
  { key: 'system.manage_settings', category: 'reports_system', title: 'Restoran Genel Ayarları', description: 'Restoran iletişim bilgileri, vergi no, sosyal medya ve çalışma saatlerini düzenleyebilir.', scope: 'panel' },
];

const PERMISSION_SET = new Set<string>(PERMISSION_KEYS);

export function isValidPermissionKey(key: string): key is PermissionKey {
  return PERMISSION_SET.has(key);
}

export function sanitizePermissionKeys(input: unknown): PermissionKey[] {
  if (!Array.isArray(input)) return [];
  const unique = new Set<PermissionKey>();
  for (const item of input) {
    if (typeof item === 'string' && isValidPermissionKey(item)) {
      unique.add(item);
    }
  }
  return Array.from(unique);
}

export * from './role-templates.catalog';
