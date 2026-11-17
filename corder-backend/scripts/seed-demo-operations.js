/**
 * Operational demo data seeder for Corder branches:
 * - Completed orders (today across multiple hours, yesterday, earlier this week) with full item & payment snapshots
 * - Open & closed cash shifts + cash transactions (sales, cash-in, cash-out)
 */
const { randomUUID } = require('crypto');

function buildOrderSnapshot(tableId, userId, userName, openedAt, closedAt, lines) {
  return [
    {
      id: randomUUID(),
      tableId,
      userId,
      userName,
      status: 'closed',
      createdAt: openedAt.toISOString(),
      updatedAt: closedAt.toISOString(),
      items: lines.map((line) => ({
        id: randomUUID(),
        productId: line.product.id,
        productName: line.product.name,
        price: Number(line.product.price),
        quantity: line.quantity,
        ...(line.note ? { note: line.note } : {}),
        status: line.status || 'served',
        createdAt: openedAt.toISOString(),
        ...(line.cancelReason ? { cancelReason: line.cancelReason } : {}),
        ...(line.cancelledBy ? { cancelledBy: line.cancelledBy } : {}),
        ...(line.cancelledAt ? { cancelledAt: line.cancelledAt.toISOString() } : {}),
      })),
    },
  ];
}

function buildPaymentSnapshot(params) {
  return {
    id: randomUUID(),
    tableId: params.tableId,
    tableName: params.tableName,
    orderIds: params.orderIds,
    amount: params.netAmount,
    method: params.method,
    ...(params.splitDetails ? { splitDetails: params.splitDetails } : {}),
    ...(params.discount ? { discount: params.discount } : {}),
    ...(params.tip > 0 ? { tip: params.tip } : {}),
    ...(params.ledgerCustomerId
      ? {
          ledgerCustomerId: params.ledgerCustomerId,
          ledgerCustomerName: params.ledgerCustomerName,
        }
      : {}),
    processedBy: params.processedBy,
    createdAt: params.closedAt.toISOString(),
  };
}

async function seedShiftsAndCompletedOrders(client, restaurantId, context) {
  const { pMap, tableMap, waiters, cashier, manager, ledgerCustomers } = context;
  const now = new Date();
  const hoursAgo = (h) => new Date(now.getTime() - h * 3600 * 1000);
  const daysAgo = (d, hOffset = 0) => new Date(now.getTime() - (d * 24 + hOffset) * 3600 * 1000);

  await client.query(`DELETE FROM cash_transactions WHERE restaurant_id = $1::uuid`, [restaurantId]);
  await client.query(`DELETE FROM cash_shifts WHERE restaurant_id = $1::uuid`, [restaurantId]);
  await client.query(`DELETE FROM completed_orders WHERE restaurant_id = $1::uuid`, [restaurantId]);

  const b1 = pMap['Corder Special Burger'];
  const b2 = pMap['Trüflü Smash Burger'];
  const b3 = pMap['Crispy Hot Chicken Burger'];
  const s1 = pMap['Dallas Steak (450g)'];
  const s2 = pMap['Lokum Bonfile (250g)'];
  const s3 = pMap['Kuzu Pirzola'];
  const a1 = pMap['Trüflü Parmesanlı Patates'];
  const a2 = pMap['Çıtır Mozzarella Çubukları'];
  const a3 = pMap['Buffalo Wings (8 Adet)'];
  const a4 = pMap['Nachos Supreme'];
  const m1 = pMap['Fettuccine Alfredo'];
  const m2 = pMap['Acılı Penne Arrabiata'];
  const m3 = pMap['Izgara Tavuklu Sezar Salata'];
  const d1 = pMap['San Sebastian Cheesecake'];
  const d2 = pMap['Sıcak Çikolatalı Sufle'];
  const dr1 = pMap['Ev Yapımı Nane Limonata'];
  const dr2 = pMap['Coca-Cola Zero (330ml)'];
  const dr3 = pMap['San Pellegrino (250ml)'];
  const dr4 = pMap['Espresso / Americano'];
  const dr5 = pMap['Geleneksel Türk Kahvesi'];

  const w1 = waiters[0] || { id: randomUUID(), name: 'Ahmet Demir (Şef Garson)' };
  const w2 = waiters[1] || w1;
  const cashierName = cashier?.name || 'Selin Yılmaz (Kasa Şefi)';
  const cashierId = cashier?.id || randomUUID();
  const managerName = manager?.name || 'Murat Çetin (Şube Müdürü)';
  const vipCust1 = ledgerCustomers[0];
  const vipCust2 = ledgerCustomers[1];

  const checkSpecs = [
    {
      tableName: 'Salon 1',
      section: 'Salon',
      waiter: w1,
      openedAt: hoursAgo(6.5),
      closedAt: hoursAgo(5.8),
      method: 'credit-card',
      tip: 60,
      discount: null,
      lines: [
        { product: b1, quantity: 2, note: 'Orta pişmiş' },
        { product: a1, quantity: 1 },
        { product: dr1, quantity: 2 },
        { product: dr4, quantity: 2 },
      ],
    },
    {
      tableName: 'Bahçe 2',
      section: 'Bahçe',
      waiter: w2,
      openedAt: hoursAgo(5.4),
      closedAt: hoursAgo(4.6),
      method: 'cash',
      tip: 0,
      discount: { type: 'percent', value: 10, reason: 'Öğle Menüsü Kampanyası' },
      lines: [
        { product: m1, quantity: 2 },
        { product: m3, quantity: 1 },
        { product: a2, quantity: 1 },
        { product: dr2, quantity: 3 },
        { product: d1, quantity: 2 },
      ],
    },
    {
      tableName: 'Teras 2',
      section: 'Teras',
      waiter: w1,
      openedAt: hoursAgo(4.5),
      closedAt: hoursAgo(3.5),
      method: 'split',
      tip: 150,
      discount: null,
      splitRatio: [
        { method: 'credit-card', share: 0.6 },
        { method: 'cash', share: 0.4 },
      ],
      lines: [
        { product: s1, quantity: 2, note: 'Medium rare' },
        { product: s2, quantity: 1, note: 'Medium' },
        { product: a4, quantity: 1 },
        { product: dr3, quantity: 3 },
        { product: d2, quantity: 3 },
        {
          product: b3,
          quantity: 1,
          status: 'cancelled',
          cancelReason: 'Misafir tercihini değiştirdi (Steak seçti)',
          cancelledBy: managerName,
          cancelledAt: hoursAgo(4.2),
        },
      ],
    },
    {
      tableName: 'Salon 4',
      section: 'Salon',
      waiter: w2,
      openedAt: hoursAgo(3.4),
      closedAt: hoursAgo(2.7),
      method: 'meal-card',
      tip: 0,
      discount: null,
      lines: [
        { product: b2, quantity: 2 },
        { product: b3, quantity: 1 },
        { product: a3, quantity: 1 },
        { product: dr1, quantity: 3 },
      ],
    },
    {
      tableName: 'Bahçe 3',
      section: 'Bahçe',
      waiter: w1,
      openedAt: hoursAgo(2.6),
      closedAt: hoursAgo(1.8),
      method: 'multinet',
      tip: 40,
      discount: null,
      lines: [
        { product: s3, quantity: 2 },
        { product: m2, quantity: 1 },
        { product: dr2, quantity: 3 },
        { product: dr5, quantity: 3 },
      ],
    },
    {
      tableName: 'VIP Loca 1',
      section: 'VIP',
      waiter: w1,
      openedAt: hoursAgo(2.1),
      closedAt: hoursAgo(1.1),
      method: 'ledger',
      ledgerCustomer: vipCust1,
      tip: 0,
      discount: { type: 'amount', value: 200, reason: 'Kurumsal VIP İndirimi' },
      lines: [
        { product: s1, quantity: 2 },
        { product: s2, quantity: 2 },
        { product: a1, quantity: 2 },
        { product: a4, quantity: 1 },
        { product: d1, quantity: 4 },
        { product: dr3, quantity: 4 },
      ],
    },
    {
      tableName: 'Salon 5',
      section: 'Salon',
      waiter: w2,
      openedAt: hoursAgo(1.4),
      closedAt: hoursAgo(0.6),
      method: 'credit-card',
      tip: 80,
      discount: null,
      lines: [
        { product: b1, quantity: 3 },
        { product: a2, quantity: 2 },
        { product: dr1, quantity: 3 },
        { product: d2, quantity: 2 },
      ],
    },
    {
      tableName: 'Hızlı Satış',
      section: 'Kasa',
      waiter: { id: cashierId, name: cashierName },
      openedAt: hoursAgo(0.4),
      closedAt: hoursAgo(0.35),
      method: 'cash',
      tip: 0,
      discount: null,
      lines: [
        { product: b2, quantity: 1, note: 'Paket servis' },
        { product: a1, quantity: 1 },
        { product: dr2, quantity: 1 },
      ],
    },
    {
      tableName: 'Salon 2',
      section: 'Salon',
      waiter: w1,
      openedAt: daysAgo(1, 5),
      closedAt: daysAgo(1, 4),
      method: 'credit-card',
      tip: 90,
      discount: null,
      isHistorical: true,
      lines: [
        { product: s1, quantity: 2 },
        { product: b1, quantity: 2 },
        { product: a4, quantity: 1 },
        { product: d1, quantity: 3 },
        { product: dr1, quantity: 4 },
      ],
    },
    {
      tableName: 'Bahçe 1',
      section: 'Bahçe',
      waiter: w2,
      openedAt: daysAgo(1, 3),
      closedAt: daysAgo(1, 2),
      method: 'cash',
      tip: 50,
      discount: null,
      isHistorical: true,
      lines: [
        { product: s2, quantity: 2 },
        { product: m1, quantity: 2 },
        { product: a3, quantity: 2 },
        { product: dr3, quantity: 4 },
      ],
    },
    {
      tableName: 'Teras 1',
      section: 'Teras',
      waiter: w1,
      openedAt: daysAgo(2, 4),
      closedAt: daysAgo(2, 3),
      method: 'credit-card',
      tip: 120,
      discount: null,
      isHistorical: true,
      lines: [
        { product: s1, quantity: 3 },
        { product: s3, quantity: 2 },
        { product: d2, quantity: 4 },
        { product: dr5, quantity: 5 },
      ],
    },
  ];

  let todayCash = 0;
  let todayCard = 0;
  let todayMeal = 0;
  let todayMultinet = 0;
  let todayRevenue = 0;
  let todayTxCount = 0;
  const cashSaleTxs = [];
  const ledgerOrderRecords = [];

  for (const spec of checkSpecs) {
    const validLines = spec.lines.filter((l) => l.product);
    if (!validLines.length) continue;

    const billableLines = validLines.filter((l) => (l.status || 'served') !== 'cancelled');
    const rawTotal = billableLines.reduce((acc, l) => acc + Number(l.product.price) * l.quantity, 0);
    let discountAmount = 0;
    if (spec.discount?.type === 'percent') {
      discountAmount = Number(((rawTotal * spec.discount.value) / 100).toFixed(2));
    } else if (spec.discount?.type === 'amount') {
      discountAmount = Math.min(rawTotal, spec.discount.value);
    }
    const netAmount = Number((rawTotal - discountAmount).toFixed(2));
    const tableId = tableMap[spec.tableName] || 'quick-sale';

    let splitDetails = null;
    if (spec.method === 'split' && spec.splitRatio) {
      const firstAmt = Number((netAmount * spec.splitRatio[0].share).toFixed(2));
      const secondAmt = Number((netAmount - firstAmt).toFixed(2));
      splitDetails = [
        { method: spec.splitRatio[0].method, amount: firstAmt },
        { method: spec.splitRatio[1].method, amount: secondAmt },
      ];
    }

    const ordersSnapshot = buildOrderSnapshot(
      tableId,
      spec.waiter.id,
      spec.waiter.name,
      spec.openedAt,
      spec.closedAt,
      validLines,
    );
    const paymentSnapshot = buildPaymentSnapshot({
      tableId,
      tableName: spec.tableName,
      orderIds: [ordersSnapshot[0].id],
      netAmount,
      method: spec.method,
      splitDetails,
      discount: spec.discount,
      tip: spec.tip,
      ledgerCustomerId: spec.ledgerCustomer?.id,
      ledgerCustomerName: spec.ledgerCustomer?.name,
      processedBy: cashierId,
      closedAt: spec.closedAt,
    });

    const coId = randomUUID();
    await client.query(
      `
      INSERT INTO completed_orders (
        id, restaurant_id, table_name, section, waiter, total_amount, discount_amount,
        net_amount, closed_by, opened_at, closed_at, payment_method, payment_split,
        payment_discount, payment_tip, orders_snapshot, payment_snapshot, created_at
      ) VALUES (
        $1::uuid, $2::uuid, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13::jsonb,
        $14::jsonb, $15, $16::jsonb, $17::jsonb, $11
      );
    `,
      [
        coId,
        restaurantId,
        spec.tableName,
        spec.section,
        spec.waiter.name,
        rawTotal,
        discountAmount,
        netAmount,
        cashierName,
        spec.openedAt,
        spec.closedAt,
        spec.method,
        splitDetails ? JSON.stringify(splitDetails) : null,
        spec.discount ? JSON.stringify(spec.discount) : null,
        spec.tip,
        JSON.stringify(ordersSnapshot),
        JSON.stringify(paymentSnapshot),
      ],
    );

    if (!spec.isHistorical) {
      todayRevenue += netAmount;
      todayTxCount += 1;
      if (spec.method === 'cash') {
        todayCash += netAmount;
        cashSaleTxs.push({ id: coId, tableName: spec.tableName, amount: netAmount, closedAt: spec.closedAt, isSplit: false });
      } else if (spec.method === 'credit-card') {
        todayCard += netAmount;
      } else if (spec.method === 'meal-card') {
        todayMeal += netAmount;
      } else if (spec.method === 'multinet') {
        todayMultinet += netAmount;
      } else if (spec.method === 'split' && splitDetails) {
        for (const s of splitDetails) {
          if (s.method === 'cash') {
            todayCash += s.amount;
            cashSaleTxs.push({ id: coId, tableName: spec.tableName, amount: s.amount, closedAt: spec.closedAt, isSplit: true });
          } else if (s.method === 'credit-card') {
            todayCard += s.amount;
          }
        }
      } else if (spec.method === 'ledger' && spec.ledgerCustomer) {
        ledgerOrderRecords.push({ completedOrderId: coId, customer: spec.ledgerCustomer, tableId: tableMap[spec.tableName] || null, tableName: spec.tableName, amount: netAmount, closedAt: spec.closedAt, ordersSnapshot });
      }
    }
  }

  const manualCashIn = 1500;
  const manualCashOut = 680;
  const openShiftId = randomUUID();
  const totalCashIn = Number((todayCash + manualCashIn).toFixed(2));

  await client.query(
    `
    INSERT INTO cash_shifts (
      id, restaurant_id, opened_by, opened_at, closed_at, closed_by, status, opening_balance, closing_balance,
      cash_in, cash_out, total_revenue, total_cash, total_card, total_meal_card,
      total_multinet, transaction_count, notes
    ) VALUES
    (
      $1::uuid, $2::uuid, $3, $4, NULL, NULL, 'open', 3500.00, NULL,
      $5, $6, $7, $8, $9, $10, $11, $12,
      'Sabah vardiyası açılışı — kasa bozuk para avansı kontrol edildi.'
    ),
    (
      gen_random_uuid(), $2::uuid, $3, $13, $14, $15, 'closed', 3000.00, 11420.00,
      9120.00, 700.00, 38450.00, 8120.00, 24130.00, 4200.00, 2000.00, 42,
      'Dün gece Z raporu alındı. Kasa tam mutabık.'
    ),
    (
      gen_random_uuid(), $2::uuid, $3, $16, $17, $15, 'closed', 3000.00, 9890.00,
      7450.00, 520.00, 34200.00, 6950.00, 22400.00, 3150.00, 1700.00, 37,
      'Önceki gün Z raporu alındı (-40 TL bozuk para farkı).'
    );
  `,
    [
      openShiftId,
      restaurantId,
      cashierName,
      hoursAgo(8),
      totalCashIn,
      manualCashOut,
      Number(todayRevenue.toFixed(2)),
      Number(todayCash.toFixed(2)),
      Number(todayCard.toFixed(2)),
      Number(todayMeal.toFixed(2)),
      Number(todayMultinet.toFixed(2)),
      todayTxCount + 3,
      daysAgo(1, 10),
      daysAgo(1, 0.5),
      managerName,
      daysAgo(2, 10),
      daysAgo(2, 0.5),
    ],
  );

  for (const sale of cashSaleTxs) {
    await client.query(
      `
      INSERT INTO cash_transactions (
        id, restaurant_id, shift_id, type, amount, description, reference, created_by, created_at
      ) VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 'sale', $3, $4, $5, $6, $7);
    `,
      [
        restaurantId,
        openShiftId,
        sale.amount,
        sale.isSplit ? `${sale.tableName} - Adisyon (Karma Nakit)` : `${sale.tableName} - Adisyon`,
        sale.id,
        cashierName,
        sale.closedAt,
      ],
    );
  }

  await client.query(
    `
    INSERT INTO cash_transactions (
      id, restaurant_id, shift_id, type, amount, description, reference, created_by, created_at
    ) VALUES
    (gen_random_uuid(), $1::uuid, $2::uuid, 'in', 1500.00, 'Dr. Selin Kaya — Cari Hesap Nakit Tahsilatı', 'CARI-TAHSILAT', $3, $4),
    (gen_random_uuid(), $1::uuid, $2::uuid, 'out', 430.00, 'Günlük Taze Buz & Limon Tedarik Ödemesi', 'FIS-8841', $3, $5),
    (gen_random_uuid(), $1::uuid, $2::uuid, 'out', 250.00, 'Mutfak Acil Sarf Malzeme / Kurye Nakit Ödemesi', 'FIS-8849', $3, $6);
  `,
    [restaurantId, openShiftId, cashierName, hoursAgo(3), hoursAgo(5), hoursAgo(2)],
  );

  return { ledgerOrderRecords, vipCust2, cashierName, cashierId, managerName, hoursAgo, daysAgo };
}

module.exports = {
  seedShiftsAndCompletedOrders,
};
