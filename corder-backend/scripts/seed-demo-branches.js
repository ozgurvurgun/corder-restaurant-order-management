/**
 * Branch-level demo seeding helpers (menu, campaigns, tables, active orders)
 * Used by scripts/seed-demo.js.
 */
const { seedShiftsAndCompletedOrders } = require('./seed-demo-operations');
const {
  seedLedgerAndOpenAccounts,
  seedPrintersAndAuditLogs,
  seedStockAndLedger,
} = require('./seed-demo-inventory');

async function seedMenuForRestaurant(client, restaurantId, matMap = {}) {
  await client.query(`DELETE FROM categories WHERE restaurant_id = $1::uuid`, [restaurantId]);
  await client.query(`DELETE FROM campaigns WHERE restaurant_id = $1::uuid`, [restaurantId]);

  const catRows = await client.query(
    `
    INSERT INTO categories (id, restaurant_id, name, slug, "order", show_in_terminal, show_in_menu, show_in_quick_sale)
    VALUES
    (gen_random_uuid(), $1::uuid, 'Burgerler', 'burgerler', 1, true, true, true),
    (gen_random_uuid(), $1::uuid, 'Steak & Izgara', 'steak-izgara', 2, true, true, true),
    (gen_random_uuid(), $1::uuid, 'Başlangıçlar & Atıştırmalıklar', 'baslangiclar', 3, true, true, true),
    (gen_random_uuid(), $1::uuid, 'Makarnalar & Salatalar', 'makarnalar-salatalar', 4, true, true, true),
    (gen_random_uuid(), $1::uuid, 'Tatlılar', 'tatlilar', 5, true, true, true),
    (gen_random_uuid(), $1::uuid, 'İçecekler', 'icecekler', 6, true, true, true)
    RETURNING id, name;
  `,
    [restaurantId],
  );

  const catMap = {};
  for (const row of catRows.rows) {
    catMap[row.name] = row.id;
  }

  const burgerRecipe =
    matMap['Dana Burger Kıyması (%20 Yağlı)'] && matMap['Brioche Burger Ekmeği']
      ? JSON.stringify([
          {
            materialId: matMap['Dana Burger Kıyması (%20 Yağlı)'],
            materialName: 'Dana Burger Kıyması (%20 Yağlı)',
            quantity: 0.18,
            unit: 'kg',
          },
          {
            materialId: matMap['Brioche Burger Ekmeği'],
            materialName: 'Brioche Burger Ekmeği',
            quantity: 1,
            unit: 'adet',
          },
        ])
      : null;

  const steakRecipe = matMap['Dana Antrikot & Bonfile']
    ? JSON.stringify([
        {
          materialId: matMap['Dana Antrikot & Bonfile'],
          materialName: 'Dana Antrikot & Bonfile',
          quantity: 0.45,
          unit: 'kg',
        },
      ])
    : null;

  await client.query(
    `
    INSERT INTO products (id, category_id, name, description, price, cost_price, image_url, in_stock, "order", ingredients)
    VALUES
    (gen_random_uuid(), $1::uuid, 'Corder Special Burger', '180gr dana köfte, füme et, karamelize soğan, cheddar peyniri, trüflü mayonez ve patates kızartması', 340.00, 110.00, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', true, 1, $7::jsonb),
    (gen_random_uuid(), $1::uuid, 'Trüflü Smash Burger', 'Çift smash köfte (2x90gr), çift cheddar, trüf aioli sos, turşu ve kızarmış soğan', 320.00, 95.00, 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=800&q=80', true, 2, $7::jsonb),
    (gen_random_uuid(), $1::uuid, 'Crispy Hot Chicken Burger', 'Özel baharatlarla marine edilmiş çıtır tavuk göğsü, coleslaw, sriracha mayo', 280.00, 75.00, 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=800&q=80', true, 3, NULL),

    (gen_random_uuid(), $2::uuid, 'Dallas Steak (450g)', '28 gün dinlendirilmiş kemikli antrikot, ızgara kuşkonmaz ve taze baharatlı tereyağı ile', 790.00, 290.00, 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80', true, 1, $8::jsonb),
    (gen_random_uuid(), $2::uuid, 'Lokum Bonfile (250g)', 'Közlenmiş arpacık soğan, bebek patates ve demi-glace sos ile', 680.00, 240.00, 'https://images.unsplash.com/photo-1558030006-450675393462?w=800&q=80', true, 2, NULL),
    (gen_random_uuid(), $2::uuid, 'Kuzu Pirzola', 'Kekikli taze patates püresi ve ızgara biber ile', 620.00, 210.00, 'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=800&q=80', true, 3, NULL),
    (gen_random_uuid(), $2::uuid, 'Wagyu Ribeye Steak (350g)', 'Özel mermer dokulu Japon Wagyu antrikot (Günlük sınırlı stok)', 1450.00, 680.00, 'https://images.unsplash.com/photo-1615937657715-bc7b4b7962c1?w=800&q=80', false, 4, NULL),

    (gen_random_uuid(), $3::uuid, 'Trüflü Parmesanlı Patates', 'Kızarmış patates dilimleri, trüf yağı, rendelenmiş parmesan ve dip sos', 160.00, 35.00, 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800&q=80', true, 1, NULL),
    (gen_random_uuid(), $3::uuid, 'Çıtır Mozzarella Çubukları', 'Ev yapımı marinara sos eşliğinde 6 adet çıtır mozzarella', 190.00, 50.00, 'https://images.unsplash.com/photo-1531749668029-2db88e4276c7?w=800&q=80', true, 2, NULL),
    (gen_random_uuid(), $3::uuid, 'Buffalo Wings (8 Adet)', 'Özel acı sos, kereviz sapları ve blue cheese dip sos', 240.00, 70.00, 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=800&q=80', true, 3, NULL),
    (gen_random_uuid(), $3::uuid, 'Nachos Supreme', 'Guacamole, ekşi krema, salsa, jalapeno ve erimiş cheddar soslu mısır cipsi', 260.00, 65.00, 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=800&q=80', true, 4, NULL),

    (gen_random_uuid(), $4::uuid, 'Fettuccine Alfredo', 'Kuşbaşı tavuk dilimleri, taze mantar, parmesan ve krema sos', 290.00, 75.00, 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=800&q=80', true, 1, NULL),
    (gen_random_uuid(), $4::uuid, 'Acılı Penne Arrabiata', 'Közlenmiş domates sos, taze fesleğen, acı biber ve parmesan', 240.00, 55.00, 'https://images.unsplash.com/photo-1621996346565-e3d5d6281298?w=800&q=80', true, 2, NULL),
    (gen_random_uuid(), $4::uuid, 'Izgara Tavuklu Sezar Salata', 'Romen marul, ızgara tavuk göğsü, kruton, parmesan ve sezar sos', 270.00, 70.00, 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=800&q=80', true, 3, NULL),

    (gen_random_uuid(), $5::uuid, 'San Sebastian Cheesecake', 'Belçika sütlü çikolata sosu ile', 195.00, 45.00, 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=800&q=80', true, 1, NULL),
    (gen_random_uuid(), $5::uuid, 'Sıcak Çikolatalı Sufle', 'Vanilyalı dondurma eşliğinde', 185.00, 40.00, 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&q=80', true, 2, NULL),

    (gen_random_uuid(), $6::uuid, 'Ev Yapımı Nane Limonata', 'Taze nane yaprakları ve limon dilimleri ile', 95.00, 15.00, 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=800&q=80', true, 1, NULL),
    (gen_random_uuid(), $6::uuid, 'Coca-Cola Zero (330ml)', 'Kutu', 65.00, 22.00, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=800&q=80', true, 2, NULL),
    (gen_random_uuid(), $6::uuid, 'San Pellegrino (250ml)', 'Doğal maden suyu', 75.00, 25.00, 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=800&q=80', true, 3, NULL),
    (gen_random_uuid(), $6::uuid, 'Espresso / Americano', 'İtalyan çekirdek kahve', 80.00, 12.00, 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80', true, 4, NULL),
    (gen_random_uuid(), $6::uuid, 'Geleneksel Türk Kahvesi', 'Lokum ve su eşliğinde', 70.00, 10.00, 'https://images.unsplash.com/photo-1578374173705-969cbe6f2d6b?w=800&q=80', true, 5, NULL);
  `,
    [
      catMap['Burgerler'],
      catMap['Steak & Izgara'],
      catMap['Başlangıçlar & Atıştırmalıklar'],
      catMap['Makarnalar & Salatalar'],
      catMap['Tatlılar'],
      catMap['İçecekler'],
      burgerRecipe,
      steakRecipe,
    ],
  );

  await client.query(
    `
    INSERT INTO campaigns (
      id, restaurant_id, title, description, image_url, discount_percent,
      original_price, discounted_price, valid_until, is_active, "order"
    ) VALUES
    (
      gen_random_uuid(), $1::uuid, 'İkili Gurme Burger & Patates Menüsü',
      '2 Adet Corder Special Burger + Trüflü Parmesanlı Patates + 2 Adet Ev Yapımı Limonata',
      'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=900&q=80',
      20, 1030.00, 824.00, NOW() + INTERVAL '30 days', true, 1
    ),
    (
      gen_random_uuid(), $1::uuid, 'Steakhouse Akşam Yemeği Seçkisi (2 Kişilik)',
      'Dallas Steak (450g) + Lokum Bonfile (250g) + Nachos Supreme + 2 San Sebastian Cheesecake',
      'https://images.unsplash.com/photo-1544025162-d76694265947?w=900&q=80',
      15, 2120.00, 1802.00, NOW() + INTERVAL '21 days', true, 2
    ),
    (
      gen_random_uuid(), $1::uuid, 'Tatlı & Kahve Keyif Saati (14:00 - 18:00)',
      'San Sebastian Cheesecake veya Sıcak Çikolatalı Sufle yanında Americano / Türk Kahvesi',
      'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=900&q=80',
      25, 275.00, 206.00, NOW() + INTERVAL '45 days', true, 3
    );
  `,
    [restaurantId],
  );

  return catMap;
}

async function seedTablesAndOrders(client, restaurantId, stockCtx = {}) {
  await client.query(`DELETE FROM tables WHERE restaurant_id = $1::uuid`, [restaurantId]);

  const tRows = await client.query(
    `
    INSERT INTO tables (id, restaurant_id, name, section, status, discount, split_info)
    VALUES
    (gen_random_uuid(), $1::uuid, 'Salon 1', 'Salon', 'empty', NULL, NULL),
    (gen_random_uuid(), $1::uuid, 'Salon 2', 'Salon', 'occupied', NULL, NULL),
    (gen_random_uuid(), $1::uuid, 'Salon 3', 'Salon', 'occupied', NULL, NULL),
    (gen_random_uuid(), $1::uuid, 'Salon 4', 'Salon', 'empty', NULL, NULL),
    (gen_random_uuid(), $1::uuid, 'Salon 5', 'Salon', 'checkout', NULL, NULL),
    (gen_random_uuid(), $1::uuid, 'Bahçe 1', 'Bahçe', 'occupied', NULL, NULL),
    (gen_random_uuid(), $1::uuid, 'Bahçe 2', 'Bahçe', 'empty', NULL, NULL),
    (gen_random_uuid(), $1::uuid, 'Bahçe 3', 'Bahçe', 'occupied', NULL, NULL),
    (gen_random_uuid(), $1::uuid, 'Teras 1', 'Teras', 'occupied', NULL, NULL),
    (gen_random_uuid(), $1::uuid, 'Teras 2', 'Teras', 'empty', NULL, NULL),
    (gen_random_uuid(), $1::uuid, 'VIP Loca 1', 'VIP', 'occupied', NULL, NULL),
    (gen_random_uuid(), $1::uuid, 'VIP Loca 2', 'VIP', 'empty', NULL, NULL)
    RETURNING id, name, section;
  `,
    [restaurantId],
  );

  const tableMap = {};
  for (const t of tRows.rows) tableMap[t.name] = t.id;

  const prods = await client.query(
    `
    SELECT p.id, p.name, p.price FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE c.restaurant_id = $1::uuid
  `,
    [restaurantId],
  );
  const pMap = {};
  for (const p of prods.rows) pMap[p.name] = p;

  const staffRes = await client.query(
    `SELECT id, name, role FROM restaurant_staff WHERE restaurant_id = $1::uuid ORDER BY created_at ASC`,
    [restaurantId],
  );
  const waiters = staffRes.rows.filter((s) => s.role === 'waiter' || s.role === 'head_waiter');
  const cashier = staffRes.rows.find((s) => s.role === 'cashier') || staffRes.rows[0];
  const manager = staffRes.rows.find((s) => s.role === 'branch_manager') || staffRes.rows[0];
  const waiterId = waiters[0]?.id || null;
  const waiterName = waiters[0]?.name || 'Ahmet Demir (Şef Garson)';
  const waiter2Id = waiters[1]?.id || waiterId;
  const waiter2Name = waiters[1]?.name || waiterName;

  const insertActiveOrder = async (tableName, uid, uname, minsAgo, items) => {
    if (!tableMap[tableName]) return;
    const oRes = await client.query(
      `
      INSERT INTO orders (id, restaurant_id, table_id, user_id, user_display_name, status, kitchen_ticket_printed_at, created_at, updated_at)
      VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, 'active', NOW() - ($5 || ' minutes')::interval, NOW() - ($5 || ' minutes')::interval, NOW())
      RETURNING id;
    `,
      [restaurantId, tableMap[tableName], uid, uname, String(minsAgo)],
    );
    const orderId = oRes.rows[0].id;
    for (const item of items) {
      if (!item.p) continue;
      await client.query(
        `
        INSERT INTO order_items (id, order_id, product_id, product_name, price, quantity, note, status, cancel_reason, cancelled_by, cancelled_at, created_at)
        VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW() - ($11 || ' minutes')::interval)
      `,
        [
          orderId,
          item.p.id,
          item.p.name,
          item.p.price,
          item.qty,
          item.note || null,
          item.status || 'served',
          item.cancelReason || null,
          item.cancelledBy || null,
          item.cancelledAt || null,
          String(Math.max(1, minsAgo - 2)),
        ],
      );
    }
  };

  await insertActiveOrder('Salon 2', waiterId, waiterName, 35, [
    { p: pMap['Corder Special Burger'], qty: 2, note: 'Orta pişmiş, soğanlar ekstra karamelize', status: 'served' },
    { p: pMap['Coca-Cola Zero (330ml)'], qty: 2, note: 'Buzlu ve limonlu', status: 'served' },
    { p: pMap['Trüflü Parmesanlı Patates'], qty: 1, note: 'Dip sos bol olsun', status: 'served' },
  ]);

  await insertActiveOrder('Salon 3', waiterId, waiterName, 50, [
    { p: pMap['Dallas Steak (450g)'], qty: 1, note: 'Orta az (Medium Rare)', status: 'served' },
    { p: pMap['Lokum Bonfile (250g)'], qty: 1, note: 'İyi pişmiş (Well Done)', status: 'served' },
    { p: pMap['Ev Yapımı Nane Limonata'], qty: 2, status: 'served' },
    { p: pMap['San Sebastian Cheesecake'], qty: 2, note: 'Çikolata soslu', status: 'preparing' },
  ]);
  await client.query(`UPDATE tables SET split_info = $1::jsonb WHERE id = $2::uuid`, [
    JSON.stringify({
      type: 'person',
      personCount: 3,
      perPersonAmount: 683.33,
      paidShares: [
        {
          shareIndex: 1,
          method: 'credit-card',
          amount: 683.33,
          paidAt: new Date().toISOString(),
        },
      ],
    }),
    tableMap['Salon 3'],
  ]);

  await insertActiveOrder('Salon 5', waiter2Id, waiter2Name, 42, [
    { p: pMap['Kuzu Pirzola'], qty: 2, note: 'Kekik bol olsun', status: 'served' },
    { p: pMap['Izgara Tavuklu Sezar Salata'], qty: 1, status: 'served' },
    { p: pMap['San Pellegrino (250ml)'], qty: 2, status: 'served' },
    { p: pMap['Geleneksel Türk Kahvesi'], qty: 2, note: 'Orta şekerli', status: 'served' },
  ]);

  await insertActiveOrder('Bahçe 1', waiter2Id, waiter2Name, 22, [
    { p: pMap['Trüflü Smash Burger'], qty: 2, status: 'preparing' },
    { p: pMap['Nachos Supreme'], qty: 1, note: 'Jalapeno ayrı tabakta', status: 'served' },
    { p: pMap['San Pellegrino (250ml)'], qty: 2, note: 'Soğuk', status: 'served' },
  ]);
  await client.query(`UPDATE tables SET discount = $1::jsonb WHERE id = $2::uuid`, [
    JSON.stringify({ type: 'percent', value: 10, reason: 'Müdür İndirimi' }),
    tableMap['Bahçe 1'],
  ]);

  await insertActiveOrder('Bahçe 3', waiterId, waiterName, 18, [
    { p: pMap['Crispy Hot Chicken Burger'], qty: 2, status: 'served' },
    { p: pMap['Buffalo Wings (8 Adet)'], qty: 1, note: 'Ekstra blue cheese sos', status: 'served' },
    { p: pMap['Ev Yapımı Nane Limonata'], qty: 2, status: 'served' },
  ]);

  await insertActiveOrder('Teras 1', waiter2Id, waiter2Name, 14, [
    { p: pMap['Fettuccine Alfredo'], qty: 2, note: 'Tavuk bol olsun', status: 'preparing' },
    { p: pMap['Sıcak Çikolatalı Sufle'], qty: 2, note: 'Yemekten sonra çıksın', status: 'pending' },
    {
      p: pMap['Acılı Penne Arrabiata'],
      qty: 1,
      status: 'cancelled',
      cancelReason: 'Misafir acısız makarna istedi',
      cancelledBy: waiter2Name,
      cancelledAt: new Date(Date.now() - 8 * 60 * 1000),
    },
  ]);

  await insertActiveOrder('VIP Loca 1', waiterId, waiterName, 28, [
    { p: pMap['Dallas Steak (450g)'], qty: 2, note: 'Medium', status: 'served' },
    { p: pMap['Lokum Bonfile (250g)'], qty: 1, note: 'Medium rare', status: 'served' },
    { p: pMap['Çıtır Mozzarella Çubukları'], qty: 2, status: 'served' },
    { p: pMap['San Sebastian Cheesecake'], qty: 3, status: 'preparing' },
    { p: pMap['Espresso / Americano'], qty: 3, status: 'pending' },
  ]);

  const opSummary = await seedShiftsAndCompletedOrders(client, restaurantId, {
    pMap,
    tableMap,
    waiters,
    cashier,
    manager,
    ledgerCustomers: stockCtx.ledgerCustomers || [],
  });

  await seedLedgerAndOpenAccounts(client, restaurantId, {
    ...opSummary,
    pMap,
    ledgerCustomers: stockCtx.ledgerCustomers || [],
  });

  await seedPrintersAndAuditLogs(client, restaurantId, {
    manager,
    cashier,
    waiters,
    hoursAgo: opSummary.hoursAgo,
  });
}

module.exports = {
  seedMenuForRestaurant,
  seedTablesAndOrders,
  seedStockAndLedger,
};
