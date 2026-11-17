/**
 * Corder Comprehensive Realistic Demo Data Seeder
 * Reads DB connection parameters from .env / environment variables (defaults to localhost:5432).
 */
const { existsSync } = require('fs');
const { join } = require('path');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const {
  seedMenuForRestaurant,
  seedTablesAndOrders,
  seedStockAndLedger,
} = require('./seed-demo-branches');

const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envPath);
  } catch {
    // Ignore if already loaded
  }
}

async function seed() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT || 5432);
  const user = process.env.DB_USERNAME || 'corder';
  const password = process.env.DB_PASSWORD ?? 'corder_secret';
  const database = process.env.DB_NAME || 'corder';

  const client = new Client({
    host,
    port,
    user,
    password,
    database,
  });

  await client.connect();
  console.log(`Connected to PostgreSQL (${host}:${port}/${database})...`);

  try {
    await client.query('BEGIN');

    const saltRounds = 10;
    const adminPassHash = await bcrypt.hash('CorderAdmin2026!', saltRounds);
    const bossPassHash = await bcrypt.hash('Boss1234!', saltRounds);
    const staffPassHash = await bcrypt.hash('Staff1234!', saltRounds);
    const termPassHash = await bcrypt.hash('Term1234!', saltRounds);
    const printPassHash = await bcrypt.hash('Print1234!', saltRounds);

    const pin1234Hash = await bcrypt.hash('1234', saltRounds);
    const pin2222Hash = await bcrypt.hash('2222', saltRounds);
    const pin3333Hash = await bcrypt.hash('3333', saltRounds);
    const pin4444Hash = await bcrypt.hash('4444', saltRounds);

    // 1. Platform Admin
    await client.query(
      `
      INSERT INTO platform_admins (id, email, password_hash, name, created_at)
      VALUES ('38c4d132-aae7-477b-90d4-83468a3df0a3', 'admin@corder.com', $1, 'Corder Platform Super Admin', NOW())
      ON CONFLICT (email) DO UPDATE SET password_hash = $1, name = EXCLUDED.name;
    `,
      [adminPassHash],
    );
    console.log('✔ Platform Admin seeded: admin@corder.com');

    // 2. Platform Billing Config
    await client.query(`DELETE FROM platform_billing_configs`);
    await client.query(`
      INSERT INTO platform_billing_configs (
        id, receiver_name, iban, bank_name, collection_start_day, collection_end_day,
        support_phone, support_email, payment_instructions, updated_at
      ) VALUES (
        gen_random_uuid(),
        'Corder Yazılım ve Teknoloji A.Ş.',
        'TR33 0006 1005 1978 6457 8413 26',
        'Garanti BBVA - Levent Ticari Şubesi',
        25,
        30,
        '+90 850 305 0000',
        'fatura@corder.com',
        'Lütfen havale/EFT açıklama kısmına Restoran Adı ve Şube Kodunu yazınız.',
        NOW()
      );
    `);
    console.log('✔ Platform Billing Config seeded');

    // 3. Restaurants
    const branch1Id = '4283ed50-d9ee-4bdc-9372-1d7097be471a';
    const branch2Id = 'dc8a5fbf-0fa7-4339-832d-42c23c279442';
    const branch3Id = '57d31da5-96e4-47f3-9abc-2f06e2a9f303';

    const branch1PayHistory = JSON.stringify([
      {
        id: 'pay-kd-1',
        amount: 3500,
        period: '2026-10',
        paidAt: new Date(Date.now() - 32 * 86400 * 1000).toISOString(),
        recordedBy: 'admin@corder.com',
        note: 'Ekim 2026 EFT tahsilatı',
      },
      {
        id: 'pay-kd-2',
        amount: 3500,
        period: '2026-11',
        paidAt: new Date(Date.now() - 2 * 86400 * 1000).toISOString(),
        recordedBy: 'admin@corder.com',
        note: 'Kasım 2026 EFT tahsilatı',
      },
    ]);
    const branch2PayHistory = JSON.stringify([
      {
        id: 'pay-bs-1',
        amount: 3500,
        period: '2026-11',
        paidAt: new Date(Date.now() - 3 * 86400 * 1000).toISOString(),
        recordedBy: 'admin@corder.com',
        note: 'Kasım 2026 FAST ödemesi',
      },
    ]);

    await client.query(
      `
      INSERT INTO restaurants (
        id, name, slug, brand_name, branch_type, franchisee_company_name, royalty_rate,
        address, phone, email, status, monthly_fee, billing_status, is_access_suspended,
        last_payment_date, last_paid_period, payment_history,
        terminal_email, terminal_password_hash, print_agent_username, print_agent_password_hash, tax_id, working_hours
      ) VALUES 
      (
        $1::uuid, 'Corder Steakhouse — Kadıköy Merkez', 'corder-kadikoy', 'Corder Hospitality Group', 'company_owned', NULL, 0,
        'Caferağa Mah. Moda Cad. No: 42, Kadıköy, İstanbul', '+90 216 555 0101', 'kadikoy@corder.com', 'active', 3500.00, 'paid', false,
        NOW() - INTERVAL '2 days', '2026-11', $6::jsonb,
        'terminal.kadikoy@corder.com', $4, 'kadikoy-yazici', $5, '1234567890', '10:00 - 01:00'
      ),
      (
        $2::uuid, 'Corder Bistro — Beşiktaş Şube', 'corder-besiktas', 'Corder Hospitality Group', 'franchise', 'Boğaziçi Gurme Restoran Ltd. Şti.', 4.5,
        'Sinanpaşa Mah. Şair Nedim Cad. No: 18, Beşiktaş, İstanbul', '+90 212 555 0202', 'besiktas@corder.com', 'active', 3500.00, 'paid', false,
        NOW() - INTERVAL '3 days', '2026-11', $7::jsonb,
        'terminal.besiktas@corder.com', $4, 'besiktas-yazici', $5, '9876543210', '11:00 - 02:00'
      ),
      (
        $3::uuid, 'Corder Lounge — Nişantaşı Şube', 'corder-nisantasi', 'Corder Hospitality Group', 'franchise', 'Teşvikiye Gastronomi A.Ş.', 5.0,
        'Teşvikiye Mah. Abdi İpekçi Cad. No: 8, Şişli, İstanbul', '+90 212 555 0303', 'nisantasi@corder.com', 'active', 4500.00, 'pending', false,
        NOW() - INTERVAL '34 days', '2026-10', '[]'::jsonb,
        'terminal.nisantasi@corder.com', $4, 'nisantasi-yazici', $5, '5544332211', '12:00 - 03:00'
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, slug = EXCLUDED.slug, brand_name = EXCLUDED.brand_name, branch_type = EXCLUDED.branch_type,
        terminal_email = EXCLUDED.terminal_email, terminal_password_hash = EXCLUDED.terminal_password_hash,
        print_agent_username = EXCLUDED.print_agent_username, print_agent_password_hash = EXCLUDED.print_agent_password_hash,
        billing_status = EXCLUDED.billing_status, monthly_fee = EXCLUDED.monthly_fee,
        last_payment_date = EXCLUDED.last_payment_date, last_paid_period = EXCLUDED.last_paid_period,
        payment_history = EXCLUDED.payment_history;
    `,
      [branch1Id, branch2Id, branch3Id, termPassHash, printPassHash, branch1PayHistory, branch2PayHistory],
    );
    console.log('✔ Restaurants seeded (3 branches with subscription payment history)');

    // 4. Boss Accounts (root_admins)
    const brandOwnerBossId = '11111111-1111-4111-8111-111111111111';
    const franchiseBossId = '22222222-2222-4222-8222-222222222222';
    const regionalBossId = '33333333-3333-4333-8333-333333333333';

    await client.query(`DELETE FROM boss_restaurants`);
    await client.query(
      `
      INSERT INTO root_admins (id, email, password_hash, name, phone, boss_tier, brand_name, restaurant_id, is_active, created_at)
      VALUES
      (
        $1::uuid, 'patron@corder.com', $4, 'Serdar Kaya (Marka Sahibi)', '+90 532 100 2030',
        'brand_owner', 'Corder Hospitality Group', $5::uuid, true, NOW()
      ),
      (
        $2::uuid, 'besiktas.boss@corder.com', $4, 'Kemal Ergin (Beşiktaş Sahibi)', '+90 533 200 3040',
        'franchise_owner', 'Corder Hospitality Group', $6::uuid, true, NOW()
      ),
      (
        $3::uuid, 'bolge.muduru@corder.com', $4, 'Ece Tekin (Bölge Operasyon Müdürü)', '+90 535 300 4050',
        'regional_manager', 'Corder Hospitality Group', $5::uuid, true, NOW()
      )
      ON CONFLICT (email) DO UPDATE SET
        id = EXCLUDED.id,
        password_hash = EXCLUDED.password_hash,
        name = EXCLUDED.name,
        boss_tier = EXCLUDED.boss_tier,
        brand_name = EXCLUDED.brand_name,
        restaurant_id = EXCLUDED.restaurant_id,
        is_active = true;
    `,
      [brandOwnerBossId, franchiseBossId, regionalBossId, bossPassHash, branch1Id, branch2Id],
    );

    await client.query(
      `
      INSERT INTO boss_restaurants (id, boss_id, restaurant_id, title, created_at)
      VALUES
      (gen_random_uuid(), $1::uuid, $4::uuid, 'Kurucu & Yönetim Kurulu Başkanı', NOW()),
      (gen_random_uuid(), $1::uuid, $5::uuid, 'Kurucu & Yönetim Kurulu Başkanı', NOW()),
      (gen_random_uuid(), $1::uuid, $6::uuid, 'Kurucu & Yönetim Kurulu Başkanı', NOW()),
      (gen_random_uuid(), $2::uuid, $5::uuid, 'Franchise Ortağı / İşletmeci', NOW()),
      (gen_random_uuid(), $3::uuid, $4::uuid, 'Bölge Sorumlusu', NOW()),
      (gen_random_uuid(), $3::uuid, $6::uuid, 'Bölge Sorumlusu', NOW());
    `,
      [brandOwnerBossId, franchiseBossId, regionalBossId, branch1Id, branch2Id, branch3Id],
    );
    console.log('✔ Boss hierarchy seeded (Brand Owner, Franchise Owner, Regional Manager)');

    // 5. Staff Users (across all 3 branches)
    await client.query(
      `DELETE FROM restaurant_staff WHERE restaurant_id IN ($1::uuid, $2::uuid, $3::uuid)`,
      [branch1Id, branch2Id, branch3Id],
    );
    await client.query(
      `
      INSERT INTO restaurant_staff (
        id, restaurant_id, email, password_hash, pin_hash, name, role, phone,
        is_active, can_access_panel, can_access_terminal
      ) VALUES
      -- Branch 1 Staff (Kadikoy)
      (
        'aaa11111-1111-4111-8111-111111111111', $6::uuid, 'mudur.kadikoy@corder.com', $1, $2,
        'Murat Çetin (Şube Müdürü)', 'branch_manager', '+90 530 111 2233', true, true, true
      ),
      (
        'aaa22222-2222-4222-8222-222222222222', $6::uuid, 'kasiyer.kadikoy@corder.com', $1, $3,
        'Selin Yılmaz (Kasa Şefi)', 'cashier', '+90 530 222 3344', true, true, true
      ),
      (
        'aaa33333-3333-4333-8333-333333333333', $6::uuid, 'garson.kadikoy@corder.com', $1, $4,
        'Ahmet Demir (Şef Garson)', 'head_waiter', '+90 530 333 4455', true, false, true
      ),
      (
        'aaa44444-4444-4444-8444-444444444444', $6::uuid, 'garson2.kadikoy@corder.com', $1, $5,
        'Burak Çelik (Salon Garsonu)', 'waiter', '+90 530 444 5566', true, false, true
      ),
      -- Branch 2 Staff (Besiktas)
      (
        'bbb11111-1111-4111-8111-111111111111', $7::uuid, 'mudur.besiktas@corder.com', $1, $2,
        'Onur Yalçın (Şube Müdürü)', 'branch_manager', '+90 531 111 2233', true, true, true
      ),
      (
        'bbb22222-2222-4222-8222-222222222222', $7::uuid, 'kasiyer.besiktas@corder.com', $1, $3,
        'Zeynep Kara (Kasiyer)', 'cashier', '+90 531 222 3344', true, true, true
      ),
      (
        'bbb33333-3333-4333-8333-333333333333', $7::uuid, 'garson.besiktas@corder.com', $1, $4,
        'Caner Öz (Şef Garson)', 'head_waiter', '+90 531 333 4455', true, false, true
      ),
      (
        'bbb44444-4444-4444-8444-444444444444', $7::uuid, 'garson2.besiktas@corder.com', $1, $5,
        'Emre Koç (Salon Garsonu)', 'waiter', '+90 531 444 5566', true, false, true
      ),
      -- Branch 3 Staff (Nisantasi)
      (
        'ccc11111-1111-4111-8111-111111111111', $8::uuid, 'mudur.nisantasi@corder.com', $1, $2,
        'Hakan Soylu (Şube Müdürü)', 'branch_manager', '+90 532 111 2233', true, true, true
      ),
      (
        'ccc22222-2222-4222-8222-222222222222', $8::uuid, 'kasiyer.nisantasi@corder.com', $1, $3,
        'Deniz Arslan (Kasa Şefi)', 'cashier', '+90 532 222 3344', true, true, true
      ),
      (
        'ccc33333-3333-4333-8333-333333333333', $8::uuid, 'garson.nisantasi@corder.com', $1, $4,
        'Mert Aydın (Şef Garson)', 'head_waiter', '+90 532 333 4455', true, false, true
      );
    `,
      [staffPassHash, pin1234Hash, pin2222Hash, pin3333Hash, pin4444Hash, branch1Id, branch2Id, branch3Id],
    );
    console.log('✔ Staff users seeded across all 3 branches');

    // 6. Seed all 3 branches (Inventory, Menu, Campaigns, Tables, Active & Completed Orders, Shifts, Ledger, Open Accounts, Printers, Audit Logs)
    for (const bId of [branch1Id, branch2Id, branch3Id]) {
      const stockCtx = await seedStockAndLedger(client, bId);
      await seedMenuForRestaurant(client, bId, stockCtx.matMap);
      await seedTablesAndOrders(client, bId, stockCtx);
    }
    console.log('✔ Full operational data seeded across all 3 branches');

    await client.query('COMMIT');
    console.log('✨ All realistic demo data seeded successfully!');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    await client.end();
  }
}

seed().catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
