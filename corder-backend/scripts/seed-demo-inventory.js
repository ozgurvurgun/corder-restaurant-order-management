/**
 * Inventory, ledger, open-account, printer, and audit-log demo seeding helpers
 * Used by scripts/seed-demo-branches.js.
 */
const { randomUUID } = require('crypto');

async function seedLedgerAndOpenAccounts(client, restaurantId, ctx) {
  const { ledgerOrderRecords, ledgerCustomers, cashierName, cashierId, hoursAgo, daysAgo, pMap } = ctx;
  await client.query(`DELETE FROM ledger_entries WHERE restaurant_id = $1::uuid`, [restaurantId]);
  await client.query(`DELETE FROM open_accounts WHERE restaurant_id = $1::uuid`, [restaurantId]);

  for (const rec of ledgerOrderRecords) {
    await client.query(
      `
      INSERT INTO ledger_entries (
        id, restaurant_id, customer_id, entry_type, amount, description,
        table_id, table_name, completed_order_id, snapshot, received_by, received_by_user_id, created_at
      ) VALUES (
        gen_random_uuid(), $1::uuid, $2::uuid, 'debt', $3, $4,
        $5::uuid, $6, $7::uuid, $8::jsonb, $9, $10, $11
      );
    `,
      [
        restaurantId,
        rec.customer.id,
        rec.amount,
        `${rec.tableName} — Kurumsal Adisyon Cariye Aktarım`,
        rec.tableId,
        rec.tableName,
        rec.completedOrderId,
        JSON.stringify({ orders: rec.ordersSnapshot }),
        cashierName,
        cashierId,
        rec.closedAt,
      ],
    );
  }

  if (ledgerCustomers[0]) {
    await client.query(
      `
      INSERT INTO ledger_entries (
        id, restaurant_id, customer_id, entry_type, amount, description, received_by, received_by_user_id, created_at
      ) VALUES
      (gen_random_uuid(), $1::uuid, $2::uuid, 'debt', 4200.00, 'VIP Loca 2 — Klinik Yemeği Hesabı', $3, $4, $5),
      (gen_random_uuid(), $1::uuid, $2::uuid, 'payment', 1500.00, 'Nakit Ara Ödeme Tahsilatı (Nakit)', $3, $4, $6);
    `,
      [restaurantId, ledgerCustomers[0].id, cashierName, cashierId, daysAgo(3, 2), hoursAgo(3)],
    );
  }

  if (ledgerCustomers[1]) {
    await client.query(
      `
      INSERT INTO ledger_entries (
        id, restaurant_id, customer_id, entry_type, amount, description, received_by, received_by_user_id, created_at
      ) VALUES
      (gen_random_uuid(), $1::uuid, $2::uuid, 'debt', 3680.00, 'Salon 3 — Hukuk Bürosu Öğle Yemeği', $3, $4, $5),
      (gen_random_uuid(), $1::uuid, $2::uuid, 'payment', 1200.00, 'Kredi Kartı ile Kısmi Tahsilat (Kredi Kartı)', $3, $4, $6);
    `,
      [restaurantId, ledgerCustomers[1].id, cashierName, cashierId, daysAgo(2, 4), daysAgo(1, 2)],
    );
  }

  if (ledgerCustomers[2]) {
    await client.query(
      `
      INSERT INTO ledger_entries (
        id, restaurant_id, customer_id, entry_type, amount, description, received_by, received_by_user_id, created_at
      ) VALUES
      (gen_random_uuid(), $1::uuid, $2::uuid, 'debt', 2950.00, 'Teras 1 — Ajans Toplantı Yemeği', $3, $4, $5);
    `,
      [restaurantId, ledgerCustomers[2].id, cashierName, cashierId, daysAgo(1, 6)],
    );
  }

  const oa1Id = randomUUID();
  const oa2Id = randomUUID();
  await client.query(
    `
    INSERT INTO open_accounts (
      id, restaurant_id, customer_name, customer_phone, amount, paid_amount,
      status, description, created_by, created_at, paid_at
    ) VALUES
    ($1::uuid, $3::uuid, 'Mimar Sinan Proje Ofisi (Kaan Bey)', '+90 532 411 2233', 1840.00, 600.00, 'open', 'Teras 2 — Öğle toplantısı açık hesap', $4, $5, NULL),
    ($2::uuid, $3::uuid, 'Ecz. Elif Aydın (Moda Eczanesi)', '+90 533 611 9988', 960.00, 960.00, 'paid', 'Paket servis haftalık hesap kapama', $4, $6, $7);
  `,
    [oa1Id, oa2Id, restaurantId, cashierName, daysAgo(1, 3), daysAgo(4, 2), daysAgo(1, 1)],
  );

  const b1 = pMap['Corder Special Burger'];
  const s2 = pMap['Lokum Bonfile (250g)'];
  const dr1 = pMap['Ev Yapımı Nane Limonata'];
  if (b1 && s2 && dr1) {
    await client.query(
      `
      INSERT INTO open_account_items (id, open_account_id, product_id, product_name, quantity, price, sort_order)
      VALUES
      (gen_random_uuid(), $1::uuid, $3, $4, 2, $5, 0),
      (gen_random_uuid(), $1::uuid, $6, $7, 1, $8, 1),
      (gen_random_uuid(), $1::uuid, $9, $10, 5, $11, 2),
      (gen_random_uuid(), $2::uuid, $3, $4, 2, $5, 0),
      (gen_random_uuid(), $2::uuid, $9, $10, 2, $11, 1);
    `,
      [oa1Id, oa2Id, b1.id, b1.name, b1.price, s2.id, s2.name, s2.price, dr1.id, dr1.name, dr1.price],
    );
  }

  await client.query(
    `
    INSERT INTO open_account_payments (id, open_account_id, amount, received_by, received_by_user_id, note, created_at)
    VALUES
    (gen_random_uuid(), $1::uuid, 600.00, $3, $4, 'Nakit ön ödeme alındı (cash)', $5),
    (gen_random_uuid(), $2::uuid, 960.00, $3, $4, 'Tamamı kredi kartı ile tahsil edildi (credit-card)', $6);
  `,
    [oa1Id, oa2Id, cashierName, cashierId, hoursAgo(4), daysAgo(1, 1)],
  );
}

async function seedPrintersAndAuditLogs(client, restaurantId, ctx) {
  const { manager, cashier, waiters, hoursAgo } = ctx;
  const managerName = manager?.name || 'Murat Çetin (Şube Müdürü)';
  const managerId = manager?.id || randomUUID();
  const cashierName = cashier?.name || 'Selin Yılmaz (Kasa Şefi)';
  const cashierId = cashier?.id || randomUUID();
  const waiterName = waiters[0]?.name || 'Ahmet Demir (Şef Garson)';
  const waiterId = waiters[0]?.id || randomUUID();

  await client.query(`DELETE FROM restaurant_printer_configs WHERE restaurant_id = $1::uuid`, [restaurantId]);
  await client.query(
    `
    INSERT INTO restaurant_printer_configs (
      id, restaurant_id, name, type, connection, ip_address, port, department, status, paper_width, auto_cut
    ) VALUES
    (gen_random_uuid(), $1::uuid, 'Kasa Adisyon Yazıcısı', 'thermal', 'network', '192.168.1.200', 9100, 'Kasa / Adisyon', 'online', 80, true),
    (gen_random_uuid(), $1::uuid, 'Sıcak Mutfak & Izgara Yazıcısı', 'kitchen', 'network', '192.168.1.201', 9100, 'Sıcak Mutfak', 'online', 80, true),
    (gen_random_uuid(), $1::uuid, 'Bar & Soğuk İçecek Yazıcısı', 'bar', 'network', '192.168.1.202', 9100, 'Bar', 'online', 80, true);
  `,
    [restaurantId],
  );

  await client.query(`DELETE FROM restaurant_audit_logs WHERE restaurant_id = $1::uuid`, [restaurantId]);
  await client.query(
    `
    INSERT INTO restaurant_audit_logs (
      id, restaurant_id, user_id, user_name, action, category, details, metadata, created_at
    ) VALUES
    (gen_random_uuid(), $1::uuid, $2, $3, 'Vardiya Açıldı', 'shift', 'Sabah vardiyası 3.500,00 TL açılış bakiyesi ile başlatıldı.', '{"openingBalance":3500}'::jsonb, $8),
    (gen_random_uuid(), $1::uuid, $4, $5, 'Sipariş Oluşturuldu', 'order', 'Salon 3 masasına 4 kalem yeni sipariş eklendi (2.050,00 TL).', '{"table":"Salon 3"}'::jsonb, $9),
    (gen_random_uuid(), $1::uuid, $6, $7, 'Masa İndirimi Uygulandı', 'payment', 'Bahçe 1 masasına %10 Müdür İndirimi tanımlandı.', '{"discountPercent":10}'::jsonb, $10),
    (gen_random_uuid(), $1::uuid, $6, $7, 'Sipariş Kalemi İptal Edildi', 'order', 'Teras 2 — Crispy Hot Chicken Burger iptal edildi (Sebep: Misafir Steak seçti).', '{"product":"Crispy Hot Chicken Burger"}'::jsonb, $11),
    (gen_random_uuid(), $1::uuid, $2, $3, 'Cari Tahsilat Alındı', 'cash-register', 'Dr. Selin Kaya cari hesabından 1.500,00 TL nakit tahsilat alındı.', '{"amount":1500,"method":"cash"}'::jsonb, $12),
    (gen_random_uuid(), $1::uuid, $6, $7, 'Stok Mal Kabulü', 'stock', 'Özkanlar Toptan Et tedarikçisinden 23.800,00 TL tutarında mal kabulü tamamlandı.', '{"supplier":"Özkanlar Toptan Et"}'::jsonb, $13),
    (gen_random_uuid(), $1::uuid, $6, $7, 'Ürün Stok Durumu Güncellendi', 'product', 'Wagyu Ribeye Steak (350g) ürünü Tükendi (86) olarak işaretlendi.', '{"inStock":false}'::jsonb, $14);
  `,
    [
      restaurantId,
      cashierId,
      cashierName,
      waiterId,
      waiterName,
      managerId,
      managerName,
      hoursAgo(8),
      hoursAgo(5),
      hoursAgo(4.2),
      hoursAgo(3.8),
      hoursAgo(3),
      hoursAgo(2.2),
      hoursAgo(1.1),
    ],
  );
}

async function seedStockAndLedger(client, restaurantId) {
  await client.query(`DELETE FROM inventory_counts WHERE restaurant_id = $1::uuid`, [restaurantId]);
  await client.query(`DELETE FROM purchase_orders WHERE restaurant_id = $1::uuid`, [restaurantId]);
  await client.query(`DELETE FROM stock_movements WHERE restaurant_id = $1::uuid`, [restaurantId]);
  await client.query(`DELETE FROM stock_materials WHERE restaurant_id = $1::uuid`, [restaurantId]);
  await client.query(`DELETE FROM suppliers WHERE restaurant_id = $1::uuid`, [restaurantId]);

  const supRows = await client.query(
    `
    INSERT INTO suppliers (
      id, restaurant_id, name, contact_person, phone, email, address, notes, active
    ) VALUES
    (
      gen_random_uuid(), $1::uuid, 'Özkanlar Toptan Et & Besicilik', 'Kemal Özkan',
      '+90 216 444 1122', 'siparis@ozkanlaret.com', 'Tuzla Deri OSB, İstanbul', 'Haftada iki gün Salı ve Cuma soğuk zincir teslimat', true
    ),
    (
      gen_random_uuid(), $1::uuid, 'Metro Grossmarket Kozyatağı', 'Kurumsal Satış Birimi',
      '+90 216 555 7788', 'kurumsal@metro-tr.com', 'Kozyatağı, Kadıköy, İstanbul', 'Genel kuru gıda, süt ürünleri ve ambalaj malzemeleri', true
    ),
    (
      gen_random_uuid(), $1::uuid, 'Boğaziçi İçecek & Kahve Dağıtım A.Ş.', 'Selim Aksoy',
      '+90 212 333 4455', 'sevkiyat@bogaziciicecek.com', 'Kağıthane, İstanbul', 'Meşrubat, maden suyu ve İtalyan çekirdek kahve', true
    )
    RETURNING id, name;
  `,
    [restaurantId],
  );
  const meatSupplierId = supRows.rows[0]?.id || null;
  const generalSupplierId = supRows.rows[1]?.id || null;
  const drinkSupplierId = supRows.rows[2]?.id || generalSupplierId;

  const matRows = await client.query(
    `
    INSERT INTO stock_materials (
      id, restaurant_id, name, unit, current_stock, min_stock, cost_per_unit, supplier_id, category
    ) VALUES
    (gen_random_uuid(), $1::uuid, 'Dana Antrikot & Bonfile', 'kg', 42.50, 15.00, 520.00, $2::uuid, 'Et & Şarküteri'),
    (gen_random_uuid(), $1::uuid, 'Dana Burger Kıyması (%20 Yağlı)', 'kg', 35.00, 10.00, 360.00, $2::uuid, 'Et & Şarküteri'),
    (gen_random_uuid(), $1::uuid, 'Kuzu Kafes & Pirzola', 'kg', 8.50, 12.00, 580.00, $2::uuid, 'Et & Şarküteri'),
    (gen_random_uuid(), $1::uuid, 'Brioche Burger Ekmeği', 'adet', 120.00, 30.00, 12.00, $3::uuid, 'Unlu Mamüller'),
    (gen_random_uuid(), $1::uuid, 'Dilimli Cheddar Peyniri', 'kg', 18.00, 5.00, 290.00, $3::uuid, 'Süt Ürünleri'),
    (gen_random_uuid(), $1::uuid, 'Krem Peynir (San Sebastian)', 'kg', 4.20, 8.00, 240.00, $3::uuid, 'Süt Ürünleri'),
    (gen_random_uuid(), $1::uuid, 'Dondurulmuş Parmak Patates', 'kg', 65.00, 20.00, 48.00, $3::uuid, 'Dondurulmuş'),
    (gen_random_uuid(), $1::uuid, 'İtalyan Espresso Çekirdeği', 'kg', 14.00, 4.00, 380.00, $4::uuid, 'Kahve & Çay'),
    (gen_random_uuid(), $1::uuid, 'Tam Yağlı Süt (Barista)', 'lt', 45.00, 15.00, 34.00, $3::uuid, 'Süt Ürünleri')
    RETURNING id, name, current_stock, cost_per_unit;
  `,
    [restaurantId, meatSupplierId, generalSupplierId, drinkSupplierId],
  );

  const matMap = {};
  const matList = matRows.rows;
  for (const m of matList) {
    matMap[m.name] = m.id;
  }

  const mSteak = matList[0];
  const mBurger = matList[1];
  const mLamb = matList[2];
  const mBun = matList[3];
  const mCheese = matList[5];

  await client.query(
    `
    INSERT INTO stock_movements (
      id, restaurant_id, material_id, material_name, type, quantity, previous_stock, new_stock,
      unit_cost, total_cost, supplier_id, reason, created_by, created_at
    ) VALUES
    (gen_random_uuid(), $1::uuid, $2::uuid, $3, 'in', 25.00, 22.00, 47.00, 520.00, 13000.00, $10::uuid, 'Haftalık soğuk zincir et teslimatı (İrsaliye #4412)', 'Murat Çetin (Şube Müdürü)', NOW() - INTERVAL '2 days'),
    (gen_random_uuid(), $1::uuid, $2::uuid, $3, 'out', 4.50, 47.00, 42.50, 520.00, 2340.00, NULL, 'Reçete satış düşümü — Dallas Steak & Bonfile', 'Sistem (Otomatik Reçete)', NOW() - INTERVAL '3 hours'),
    (gen_random_uuid(), $1::uuid, $4::uuid, $5, 'in', 30.00, 8.60, 38.60, 360.00, 10800.00, $10::uuid, 'Taze burger kıyması sevkiyatı', 'Murat Çetin (Şube Müdürü)', NOW() - INTERVAL '2 days'),
    (gen_random_uuid(), $1::uuid, $4::uuid, $5, 'out', 3.60, 38.60, 35.00, 360.00, 1296.00, NULL, 'Reçete satış düşümü — Corder Special & Smash Burger', 'Sistem (Otomatik Reçete)', NOW() - INTERVAL '2 hours'),
    (gen_random_uuid(), $1::uuid, $6::uuid, $7, 'waste', 1.20, 9.70, 8.50, 580.00, 696.00, NULL, 'Marine dolabı fire / kemik temizleme firesi', 'Murat Çetin (Şube Müdürü)', NOW() - INTERVAL '5 hours'),
    (gen_random_uuid(), $1::uuid, $8::uuid, $9, 'in', 150.00, 10.00, 160.00, 12.00, 1800.00, $11::uuid, 'Günlük taze brioche ekmek teslimatı', 'Selin Yılmaz (Kasa Şefi)', NOW() - INTERVAL '1 day');
  `,
    [
      restaurantId,
      mSteak.id,
      mSteak.name,
      mBurger.id,
      mBurger.name,
      mLamb.id,
      mLamb.name,
      mBun.id,
      mBun.name,
      meatSupplierId,
      generalSupplierId,
    ],
  );

  await client.query(
    `
    INSERT INTO purchase_orders (
      id, restaurant_id, supplier_id, supplier_name, items, total_amount, status, notes, created_by, created_at, received_at
    ) VALUES
    (
      gen_random_uuid(), $1::uuid, $2::uuid, 'Özkanlar Toptan Et & Besicilik',
      $4::jsonb, 23800.00, 'received', 'Salı sabahı soğuk zincir teslim alındı.', 'Murat Çetin (Şube Müdürü)', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'
    ),
    (
      gen_random_uuid(), $1::uuid, $3::uuid, 'Metro Grossmarket Kozyatağı',
      $5::jsonb, 6480.00, 'ordered', 'Cuma sabahı 09:00 sevkiyatı bekleniyor (Kritik stok takviyesi).', 'Murat Çetin (Şube Müdürü)', NOW() - INTERVAL '4 hours', NULL
    );
  `,
    [
      restaurantId,
      meatSupplierId,
      generalSupplierId,
      JSON.stringify([
        { materialId: mSteak.id, materialName: mSteak.name, quantity: 25, unitCost: 520 },
        { materialId: mBurger.id, materialName: mBurger.name, quantity: 30, unitCost: 360 },
      ]),
      JSON.stringify([
        { materialId: mCheese.id, materialName: mCheese.name, quantity: 15, unitCost: 240 },
        { materialId: mBun.id, materialName: mBun.name, quantity: 240, unitCost: 12 },
      ]),
    ],
  );

  await client.query(
    `
    INSERT INTO inventory_counts (
      id, restaurant_id, date, counted_by, items, status, notes, created_at
    ) VALUES
    (
      gen_random_uuid(), $1::uuid, NOW() - INTERVAL '1 day', 'Murat Çetin (Şube Müdürü)',
      $2::jsonb, 'completed', 'Haftalık soğuk hava deposu ve kuru depo sayımı tamamlandı.', NOW() - INTERVAL '1 day'
    );
  `,
    [
      restaurantId,
      JSON.stringify([
        { materialId: mSteak.id, materialName: mSteak.name, expectedStock: 43.0, actualStock: 42.5, difference: -0.5 },
        { materialId: mBurger.id, materialName: mBurger.name, expectedStock: 35.0, actualStock: 35.0, difference: 0 },
        { materialId: mBun.id, materialName: mBun.name, expectedStock: 122.0, actualStock: 120.0, difference: -2.0 },
      ]),
    ],
  );

  await client.query(`DELETE FROM ledger_customers WHERE restaurant_id = $1::uuid`, [restaurantId]);
  const custRows = await client.query(
    `
    INSERT INTO ledger_customers (
      id, restaurant_id, name, phone, notes
    ) VALUES
    (
      gen_random_uuid(), $1::uuid, 'Dr. Selin Kaya (Moda Polikliniği)', '+90 532 999 1122',
      'VIP Müşteri, her ay sonu havale veya nakit ile toplu öder. Kredi limiti 15.000 TL.'
    ),
    (
      gen_random_uuid(), $1::uuid, 'Av. Mehmet Demir (Demir Hukuk Bürosu)', '+90 533 888 3344',
      'Ofis öğle yemekleri ve müvekkil ağırlama hesabı. Kredi limiti 10.000 TL.'
    ),
    (
      gen_random_uuid(), $1::uuid, 'Kuzey Dijital Medya Ajansı (Bora Bey)', '+90 535 777 6655',
      'Ajans ekip yemekleri — 15 günde bir kredi kartı ile kapanır.'
    )
    RETURNING id, name, phone;
  `,
    [restaurantId],
  );

  return { matMap, ledgerCustomers: custRows.rows };
}

module.exports = {
  seedLedgerAndOpenAccounts,
  seedPrintersAndAuditLogs,
  seedStockAndLedger,
};

