-- Canonical Database Backfill & Normalization Script
-- Ensures historical rows in orders, order_items, completed_orders, cash_shifts,
-- cash_transactions, stock_movements, ledger_entries, restaurant_audit_logs,
-- fraud_alerts, tables, restaurants, restaurant_staff, and root_admins match
-- the current schema, canonical actor names, and lowercase storage standard
-- without requiring backward-compatibility fallback shims in application code.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.tr_norm(val text) RETURNS text AS $$
BEGIN
  IF val IS NULL THEN RETURN NULL; END IF;
  RETURN lower(replace(translate(regexp_replace(btrim(val), '\s+', ' ', 'g'), 'İIŞĞÜÖÇ', 'iışğüöç'), chr(775), ''));
END;
$$ LANGUAGE plpgsql;

-- 1. Normalize root_admins, products, categories, restaurant_staff
UPDATE root_admins SET name = pg_temp.tr_norm(name) WHERE name IS DISTINCT FROM pg_temp.tr_norm(name);
UPDATE products SET name = pg_temp.tr_norm(name) WHERE name IS DISTINCT FROM pg_temp.tr_norm(name);
UPDATE categories SET name = pg_temp.tr_norm(name) WHERE name IS DISTINCT FROM pg_temp.tr_norm(name);
UPDATE restaurant_staff SET name = pg_temp.tr_norm(name) WHERE name IS DISTINCT FROM pg_temp.tr_norm(name);

-- 2. Ensure canonical @<slug>.corder.app format on device & staff credentials
UPDATE restaurants
SET print_agent_username = lower(btrim(print_agent_username)) || '@' || lower(btrim(slug)) || '.corder.app'
WHERE print_agent_username IS NOT NULL
  AND btrim(print_agent_username) <> ''
  AND position('@' in print_agent_username) = 0;

UPDATE restaurants
SET terminal_email = lower(btrim(terminal_email)) || '@' || lower(btrim(slug)) || '.corder.app'
WHERE terminal_email IS NOT NULL
  AND btrim(terminal_email) <> ''
  AND position('@' in terminal_email) = 0;

UPDATE restaurant_staff s
SET email = lower(btrim(s.email)) || '@' || lower(btrim(r.slug)) || '.corder.app'
FROM restaurants r
WHERE s.restaurant_id = r.id
  AND s.email IS NOT NULL
  AND btrim(s.email) <> ''
  AND position('@' in s.email) = 0;

-- 3. Remove legacy post-print-void fraud alerts that lack orderCreatedAt evidence
DELETE FROM fraud_alerts
WHERE (evidence->>'sourceKey') LIKE 'post-print-void:%'
  AND NOT (evidence ? 'orderCreatedAt');

-- 4. Backfill missing orders.user_id from restaurant_staff and root_admins, then normalize user_display_name
UPDATE orders o
SET user_id = s.id
FROM restaurant_staff s
WHERE o.user_id IS NULL
  AND o.restaurant_id = s.restaurant_id
  AND pg_temp.tr_norm(o.user_display_name) = pg_temp.tr_norm(s.name);

UPDATE orders o
SET user_id = ra.id
FROM root_admins ra
JOIN restaurants r
  ON r.id = ra.restaurant_id
  OR r.root_admin_id = ra.id
  OR EXISTS (
    SELECT 1 FROM boss_restaurants br WHERE br.boss_id = ra.id AND br.restaurant_id = r.id
  )
  OR (ra.boss_tier = 'brand_owner' AND ra.brand_name IS NOT NULL AND lower(btrim(r.brand_name)) = lower(btrim(ra.brand_name)))
WHERE o.user_id IS NULL
  AND o.restaurant_id = r.id
  AND pg_temp.tr_norm(o.user_display_name) = pg_temp.tr_norm(ra.name);

UPDATE orders
SET user_display_name = pg_temp.tr_norm(user_display_name)
WHERE user_display_name IS DISTINCT FROM pg_temp.tr_norm(user_display_name);

-- 5. Discover historical actor name aliases (e.g. renamed Boss or Staff member) from ID-linked records
CREATE TEMP TABLE actor_current_directory ON COMMIT DROP AS
SELECT id::text AS actor_id, restaurant_id, pg_temp.tr_norm(name) AS current_name
FROM restaurant_staff
UNION
SELECT ra.id::text AS actor_id, r.id AS restaurant_id, pg_temp.tr_norm(ra.name) AS current_name
FROM root_admins ra
JOIN restaurants r
  ON r.id = ra.restaurant_id
  OR r.root_admin_id = ra.id
  OR EXISTS (
    SELECT 1 FROM boss_restaurants br WHERE br.boss_id = ra.id AND br.restaurant_id = r.id
  )
  OR (ra.boss_tier = 'brand_owner' AND ra.brand_name IS NOT NULL AND lower(btrim(r.brand_name)) = lower(btrim(ra.brand_name)));

CREATE TEMP TABLE actor_name_aliases ON COMMIT DROP AS
WITH raw_observations AS (
  SELECT o.restaurant_id, o.user_id::text AS actor_id, pg_temp.tr_norm(o.user_display_name) AS old_name
  FROM orders o
  WHERE o.user_id IS NOT NULL AND o.user_display_name IS NOT NULL
  UNION
  SELECT co.restaurant_id, (ord->>'userId') AS actor_id, pg_temp.tr_norm(ord->>'userName') AS old_name
  FROM completed_orders co,
       jsonb_array_elements(CASE WHEN jsonb_typeof(co.orders_snapshot) = 'array' THEN co.orders_snapshot ELSE '[]'::jsonb END) AS ord
  WHERE (ord->>'userId') IS NOT NULL AND (ord->>'userName') IS NOT NULL
  UNION
  SELECT al.restaurant_id, al.user_id AS actor_id, pg_temp.tr_norm(al.user_name) AS old_name
  FROM restaurant_audit_logs al
  WHERE al.user_id IS NOT NULL AND al.user_name IS NOT NULL
  UNION
  SELECT fa.restaurant_id, fa.actor_id::text AS actor_id, pg_temp.tr_norm(fa.actor_name) AS old_name
  FROM fraud_alerts fa
  WHERE fa.actor_id IS NOT NULL AND fa.actor_name IS NOT NULL
  UNION
  SELECT le.restaurant_id, le.received_by_user_id AS actor_id, pg_temp.tr_norm(le.received_by) AS old_name
  FROM ledger_entries le
  WHERE le.received_by_user_id IS NOT NULL AND le.received_by IS NOT NULL
)
SELECT DISTINCT
  d.restaurant_id,
  d.actor_id,
  obs.old_name,
  d.current_name
FROM raw_observations obs
JOIN actor_current_directory d
  ON d.actor_id = obs.actor_id
WHERE obs.old_name IS NOT NULL
  AND obs.old_name <> ''
  AND d.current_name IS NOT NULL
  AND d.current_name <> ''
  AND obs.old_name <> d.current_name;

-- 6. Sync direct ID-referenced actor names to current canonical names
UPDATE orders o
SET user_display_name = d.current_name
FROM actor_current_directory d
WHERE o.user_id::text = d.actor_id
  AND o.restaurant_id = d.restaurant_id
  AND o.user_display_name IS DISTINCT FROM d.current_name;

UPDATE tables t
SET session_staff_name = d.current_name
FROM actor_current_directory d
WHERE t.session_staff_id::text = d.actor_id
  AND t.restaurant_id = d.restaurant_id
  AND t.session_staff_name IS DISTINCT FROM d.current_name;

UPDATE ledger_entries le
SET received_by = d.current_name
FROM actor_current_directory d
WHERE le.received_by_user_id = d.actor_id
  AND le.restaurant_id = d.restaurant_id
  AND le.received_by IS DISTINCT FROM d.current_name;

UPDATE restaurant_audit_logs al
SET user_name = d.current_name
FROM actor_current_directory d
WHERE al.user_id = d.actor_id
  AND al.restaurant_id = d.restaurant_id
  AND al.user_name IS DISTINCT FROM d.current_name;

UPDATE fraud_alerts fa
SET actor_name = d.current_name
FROM actor_current_directory d
WHERE fa.actor_id::text = d.actor_id
  AND fa.restaurant_id = d.restaurant_id
  AND fa.actor_name IS DISTINCT FROM d.current_name;

-- 7. Normalize order_items, cash_shifts, cash_transactions, stock_movements, ledger_entries, audit_logs, fraud_alerts
UPDATE order_items
SET status = 'ledger', cancel_reason = NULL
WHERE status = 'cancelled' AND (cancel_reason = 'Assigned to ledger' OR cancel_reason LIKE 'Cari%');

UPDATE order_items
SET product_name = pg_temp.tr_norm(product_name)
WHERE product_name IS DISTINCT FROM pg_temp.tr_norm(product_name);

UPDATE order_items
SET cancelled_by = pg_temp.tr_norm(cancelled_by)
WHERE cancelled_by IS NOT NULL AND cancelled_by IS DISTINCT FROM pg_temp.tr_norm(cancelled_by);

UPDATE order_items oi
SET cancelled_by = a.current_name
FROM orders o, actor_name_aliases a
WHERE oi.order_id = o.id
  AND o.restaurant_id = a.restaurant_id
  AND oi.cancelled_by = a.old_name;

UPDATE cash_shifts
SET opened_by = pg_temp.tr_norm(opened_by),
    closed_by = CASE WHEN closed_by IS NOT NULL THEN pg_temp.tr_norm(closed_by) ELSE NULL END
WHERE opened_by IS DISTINCT FROM pg_temp.tr_norm(opened_by)
   OR (closed_by IS NOT NULL AND closed_by IS DISTINCT FROM pg_temp.tr_norm(closed_by));

UPDATE cash_shifts cs
SET opened_by = a.current_name
FROM actor_name_aliases a
WHERE cs.restaurant_id = a.restaurant_id
  AND cs.opened_by = a.old_name
  AND cs.opened_by IS DISTINCT FROM a.current_name;

UPDATE cash_shifts cs
SET closed_by = a.current_name
FROM actor_name_aliases a
WHERE cs.restaurant_id = a.restaurant_id
  AND cs.closed_by = a.old_name
  AND cs.closed_by IS DISTINCT FROM a.current_name;

UPDATE cash_transactions
SET created_by = pg_temp.tr_norm(created_by)
WHERE created_by IS DISTINCT FROM pg_temp.tr_norm(created_by);

UPDATE cash_transactions ct
SET created_by = a.current_name
FROM actor_name_aliases a
WHERE ct.restaurant_id = a.restaurant_id
  AND ct.created_by = a.old_name
  AND ct.created_by IS DISTINCT FROM a.current_name;

UPDATE stock_movements
SET created_by = pg_temp.tr_norm(created_by)
WHERE created_by IS DISTINCT FROM pg_temp.tr_norm(created_by);

UPDATE stock_movements sm
SET created_by = a.current_name
FROM actor_name_aliases a
WHERE sm.restaurant_id = a.restaurant_id
  AND sm.created_by = a.old_name
  AND sm.created_by IS DISTINCT FROM a.current_name;

UPDATE ledger_entries
SET received_by = pg_temp.tr_norm(received_by)
WHERE received_by IS NOT NULL AND received_by IS DISTINCT FROM pg_temp.tr_norm(received_by);

UPDATE ledger_entries le
SET received_by = a.current_name
FROM actor_name_aliases a
WHERE le.restaurant_id = a.restaurant_id
  AND le.received_by = a.old_name
  AND le.received_by IS DISTINCT FROM a.current_name;

UPDATE open_accounts
SET created_by = pg_temp.tr_norm(created_by)
WHERE created_by IS DISTINCT FROM pg_temp.tr_norm(created_by);

UPDATE open_accounts oa
SET created_by = a.current_name
FROM actor_name_aliases a
WHERE oa.restaurant_id = a.restaurant_id
  AND oa.created_by = a.old_name
  AND oa.created_by IS DISTINCT FROM a.current_name;

UPDATE open_account_payments oap
SET received_by = d.current_name
FROM open_accounts oa, actor_current_directory d
WHERE oap.open_account_id = oa.id
  AND oap.received_by_user_id = d.actor_id
  AND oa.restaurant_id = d.restaurant_id
  AND oap.received_by IS DISTINCT FROM d.current_name;

UPDATE open_account_payments
SET received_by = pg_temp.tr_norm(received_by)
WHERE received_by IS DISTINCT FROM pg_temp.tr_norm(received_by);

UPDATE open_account_payments oap
SET received_by = a.current_name
FROM open_accounts oa, actor_name_aliases a
WHERE oap.open_account_id = oa.id
  AND oa.restaurant_id = a.restaurant_id
  AND oap.received_by = a.old_name
  AND oap.received_by IS DISTINCT FROM a.current_name;

UPDATE inventory_counts
SET counted_by = pg_temp.tr_norm(counted_by)
WHERE counted_by IS DISTINCT FROM pg_temp.tr_norm(counted_by);

UPDATE inventory_counts ic
SET counted_by = a.current_name
FROM actor_name_aliases a
WHERE ic.restaurant_id = a.restaurant_id
  AND ic.counted_by = a.old_name
  AND ic.counted_by IS DISTINCT FROM a.current_name;

UPDATE purchase_orders
SET created_by = pg_temp.tr_norm(created_by)
WHERE created_by IS DISTINCT FROM pg_temp.tr_norm(created_by);

UPDATE purchase_orders po
SET created_by = a.current_name
FROM actor_name_aliases a
WHERE po.restaurant_id = a.restaurant_id
  AND po.created_by = a.old_name
  AND po.created_by IS DISTINCT FROM a.current_name;

UPDATE tables t
SET discount = jsonb_set(t.discount, '{appliedBy}', to_jsonb(pg_temp.tr_norm(t.discount->>'appliedBy')))
WHERE t.discount IS NOT NULL
  AND (t.discount->>'appliedBy') IS NOT NULL
  AND (t.discount->>'appliedBy') IS DISTINCT FROM pg_temp.tr_norm(t.discount->>'appliedBy');

UPDATE tables t
SET discount = jsonb_set(t.discount, '{appliedBy}', to_jsonb(a.current_name))
FROM actor_name_aliases a
WHERE t.restaurant_id = a.restaurant_id
  AND t.discount IS NOT NULL
  AND (t.discount->>'appliedBy') = a.old_name
  AND (t.discount->>'appliedBy') IS DISTINCT FROM a.current_name;

UPDATE restaurant_audit_logs
SET user_name = pg_temp.tr_norm(user_name)
WHERE user_name IS DISTINCT FROM pg_temp.tr_norm(user_name);

UPDATE restaurant_audit_logs al
SET user_name = a.current_name
FROM actor_name_aliases a
WHERE al.restaurant_id = a.restaurant_id
  AND al.user_name = a.old_name
  AND al.user_name IS DISTINCT FROM a.current_name;

UPDATE fraud_alerts
SET actor_name = CASE WHEN actor_name IS NOT NULL THEN pg_temp.tr_norm(actor_name) ELSE NULL END,
    resolved_by = CASE WHEN resolved_by IS NOT NULL THEN pg_temp.tr_norm(resolved_by) ELSE NULL END
WHERE (actor_name IS NOT NULL AND actor_name IS DISTINCT FROM pg_temp.tr_norm(actor_name))
   OR (resolved_by IS NOT NULL AND resolved_by IS DISTINCT FROM pg_temp.tr_norm(resolved_by));

UPDATE fraud_alerts fa
SET actor_name = a.current_name
FROM actor_name_aliases a
WHERE fa.restaurant_id = a.restaurant_id
  AND fa.actor_name = a.old_name
  AND fa.actor_name IS DISTINCT FROM a.current_name;

UPDATE fraud_alerts fa
SET resolved_by = a.current_name
FROM actor_name_aliases a
WHERE fa.restaurant_id = a.restaurant_id
  AND fa.resolved_by = a.old_name
  AND fa.resolved_by IS DISTINCT FROM a.current_name;

-- 8. Backfill completed_orders: normalize text and apply actor_name_aliases to waiter, closed_by, discounts, and orders_snapshot
CREATE OR REPLACE FUNCTION pg_temp.resolve_actor_name(p_rest_id uuid, p_actor_id text, p_raw_name text) RETURNS text AS $$
DECLARE
  v_norm text;
  v_mapped text;
BEGIN
  IF p_actor_id IS NOT NULL AND p_actor_id <> '' THEN
    SELECT d.current_name INTO v_mapped
    FROM actor_current_directory d
    WHERE d.restaurant_id = p_rest_id AND d.actor_id = p_actor_id
    LIMIT 1;
    IF v_mapped IS NOT NULL THEN
      RETURN v_mapped;
    END IF;
  END IF;

  v_norm := pg_temp.tr_norm(p_raw_name);
  IF v_norm IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT a.current_name INTO v_mapped
  FROM actor_name_aliases a
  WHERE a.restaurant_id = p_rest_id AND a.old_name = v_norm
  LIMIT 1;

  RETURN COALESCE(v_mapped, v_norm);
END;
$$ LANGUAGE plpgsql;

WITH computed_completed_orders AS (
  SELECT
    co.id,
    pg_temp.resolve_actor_name(co.restaurant_id, NULL, co.waiter) AS next_waiter,
    pg_temp.resolve_actor_name(co.restaurant_id, NULL, co.closed_by) AS next_closed_by,
    CASE
      WHEN co.payment_discount IS NOT NULL
      THEN jsonb_set(
        co.payment_discount,
        '{appliedBy}',
        to_jsonb(pg_temp.resolve_actor_name(co.restaurant_id, NULL, COALESCE(co.payment_discount->>'appliedBy', co.closed_by)))
      )
      ELSE NULL
    END AS next_payment_discount,
    CASE
      WHEN (co.payment_snapshot->'discount') IS NOT NULL
      THEN jsonb_set(
        jsonb_set(
          co.payment_snapshot,
          '{processedBy}',
          to_jsonb(pg_temp.resolve_actor_name(co.restaurant_id, NULL, co.closed_by))
        ),
        '{discount,appliedBy}',
        to_jsonb(pg_temp.resolve_actor_name(co.restaurant_id, NULL, COALESCE(co.payment_snapshot->'discount'->>'appliedBy', co.closed_by)))
      )
      ELSE jsonb_set(
        co.payment_snapshot,
        '{processedBy}',
        to_jsonb(pg_temp.resolve_actor_name(co.restaurant_id, NULL, co.closed_by))
      )
    END AS next_payment_snapshot,
    (
      SELECT COALESCE(jsonb_agg(
        jsonb_set(
          ord,
          '{userName}',
          to_jsonb(pg_temp.resolve_actor_name(co.restaurant_id, ord->>'userId', ord->>'userName'))
        ) || jsonb_build_object(
          'items',
          COALESCE((
            SELECT jsonb_agg(
              CASE
                WHEN itm ? 'cancelledBy' AND (itm->>'cancelledBy') IS NOT NULL
                THEN jsonb_set(itm, '{cancelledBy}', to_jsonb(pg_temp.resolve_actor_name(co.restaurant_id, NULL, itm->>'cancelledBy')))
                ELSE itm
              END
            )
            FROM jsonb_array_elements(COALESCE(ord->'items', '[]'::jsonb)) AS itm
          ), '[]'::jsonb)
        )
      ), '[]'::jsonb)
      FROM jsonb_array_elements(co.orders_snapshot) AS ord
    ) AS next_orders_snapshot
  FROM completed_orders co
  WHERE jsonb_typeof(co.orders_snapshot) = 'array'
)
UPDATE completed_orders co
SET
  waiter = c.next_waiter,
  closed_by = c.next_closed_by,
  payment_discount = c.next_payment_discount,
  payment_snapshot = c.next_payment_snapshot,
  orders_snapshot = c.next_orders_snapshot
FROM computed_completed_orders c
WHERE co.id = c.id
  AND (
    co.waiter IS DISTINCT FROM c.next_waiter
    OR co.closed_by IS DISTINCT FROM c.next_closed_by
    OR co.payment_discount IS DISTINCT FROM c.next_payment_discount
    OR co.payment_snapshot IS DISTINCT FROM c.next_payment_snapshot
    OR co.orders_snapshot IS DISTINCT FROM c.next_orders_snapshot
  );

-- 9. Translate seeded English system role names & descriptions in restaurant_roles to canonical Turkish
UPDATE restaurant_roles
SET
  name = CASE key
    WHEN 'branch_manager' THEN 'Şube Müdürü'
    WHEN 'shift_supervisor' THEN 'Vardiya Amiri / Şef'
    WHEN 'cashier' THEN 'Kasiyer'
    WHEN 'head_waiter' THEN 'Şef Garson'
    WHEN 'waiter' THEN 'Garson'
    WHEN 'runner' THEN 'Komi / Stajyer'
    WHEN 'inventory_manager' THEN 'Depo & Stok Sorumlusu'
    WHEN 'accountant' THEN 'Muhasebe & Finans'
    ELSE name
  END,
  description = CASE key
    WHEN 'branch_manager' THEN 'Tüm şube operasyonları, finansal yönetim, stok ve personel üzerinde tam yetki'
    WHEN 'shift_supervisor' THEN 'Salon, kasa, iskonto, iptal ve vardiya operasyonlarını yönetir'
    WHEN 'cashier' THEN 'Kasa vardiyası, tahsilat, adisyon kapatma, cari ve açık hesap işlemleri'
    WHEN 'head_waiter' THEN 'Salon operasyonları, masa taşıma, ürün iptali ve sınırlı iskonto yetkisi'
    WHEN 'waiter' THEN 'El terminali ve panel üzerinden masa açma, sipariş alma ve adisyon yazdırma'
    WHEN 'runner' THEN 'Sadece masa görüntüleme, sipariş ekleme ve garson çağrısı yanıtlama yetkisi'
    WHEN 'inventory_manager' THEN 'Hammadde, reçete, tedarikçi, satın alma ve stok sayım işlemleri'
    WHEN 'accountant' THEN 'Ciro, kasa, cari hesap, stok maliyet ve denetim raporlarını inceleme yetkisi'
    ELSE description
  END
WHERE is_system = true
  AND key IN ('branch_manager', 'shift_supervisor', 'cashier', 'head_waiter', 'waiter', 'runner', 'inventory_manager', 'accountant')
  AND name IN ('Branch Manager', 'Shift Supervisor', 'Cashier', 'Head Waiter', 'Waiter', 'Runner', 'Runner / Busser', 'Inventory Manager', 'Accountant');

COMMIT;
