-- Canonical Database Backfill & Normalization Script
-- Ensures historical rows in orders, order_items, completed_orders, cash_shifts,
-- cash_transactions, restaurant_audit_logs, and root_admins match the current
-- schema and lowercase storage standard without requiring fallback shims in application code.

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

-- 2. Backfill missing orders.user_id from restaurant_staff and root_admins, then normalize user_display_name
UPDATE orders o
SET user_id = s.id
FROM restaurant_staff s
WHERE o.user_id IS NULL
  AND o.restaurant_id = s.restaurant_id
  AND pg_temp.tr_norm(o.user_display_name) = pg_temp.tr_norm(s.name);

UPDATE orders o
SET user_id = ra.id
FROM root_admins ra
WHERE o.user_id IS NULL
  AND pg_temp.tr_norm(o.user_display_name) = pg_temp.tr_norm(ra.name);

UPDATE orders
SET user_display_name = pg_temp.tr_norm(user_display_name)
WHERE user_display_name IS DISTINCT FROM pg_temp.tr_norm(user_display_name);

-- 3. Normalize order_items and migrate any legacy ledger-cancelled items to status = 'ledger'
UPDATE order_items
SET status = 'ledger', cancel_reason = NULL
WHERE status = 'cancelled' AND (cancel_reason = 'Assigned to ledger' OR cancel_reason LIKE 'Cari%');

UPDATE order_items
SET product_name = pg_temp.tr_norm(product_name)
WHERE product_name IS DISTINCT FROM pg_temp.tr_norm(product_name);

UPDATE order_items
SET cancelled_by = pg_temp.tr_norm(cancelled_by)
WHERE cancelled_by IS NOT NULL AND cancelled_by IS DISTINCT FROM pg_temp.tr_norm(cancelled_by);

-- 4. Normalize cash_shifts, cash_transactions, restaurant_audit_logs
UPDATE cash_shifts
SET opened_by = pg_temp.tr_norm(opened_by),
    closed_by = CASE WHEN closed_by IS NOT NULL THEN pg_temp.tr_norm(closed_by) ELSE NULL END;

UPDATE cash_transactions
SET created_by = pg_temp.tr_norm(created_by)
WHERE created_by IS DISTINCT FROM pg_temp.tr_norm(created_by);

UPDATE restaurant_audit_logs
SET user_name = pg_temp.tr_norm(user_name)
WHERE user_name IS DISTINCT FROM pg_temp.tr_norm(user_name);

-- 5. Backfill completed_orders: processedBy, discount.appliedBy, and orders_snapshot
UPDATE completed_orders co
SET
  waiter = pg_temp.tr_norm(co.waiter),
  closed_by = pg_temp.tr_norm(co.closed_by),
  payment_discount = CASE
    WHEN co.payment_discount IS NOT NULL
    THEN jsonb_set(
      co.payment_discount,
      '{appliedBy}',
      to_jsonb(pg_temp.tr_norm(COALESCE(co.payment_discount->>'appliedBy', co.closed_by)))
    )
    ELSE NULL
  END,
  payment_snapshot = CASE
    WHEN (co.payment_snapshot->'discount') IS NOT NULL
    THEN jsonb_set(
      jsonb_set(
        co.payment_snapshot,
        '{processedBy}',
        to_jsonb(pg_temp.tr_norm(co.closed_by))
      ),
      '{discount,appliedBy}',
      to_jsonb(pg_temp.tr_norm(COALESCE(co.payment_snapshot->'discount'->>'appliedBy', co.closed_by)))
    )
    ELSE jsonb_set(
      co.payment_snapshot,
      '{processedBy}',
      to_jsonb(pg_temp.tr_norm(co.closed_by))
    )
  END,
  orders_snapshot = (
    SELECT jsonb_agg(
      jsonb_set(
        ord,
        '{userName}',
        to_jsonb(pg_temp.tr_norm(ord->>'userName'))
      ) || jsonb_build_object(
        'items',
        COALESCE((
          SELECT jsonb_agg(
            CASE
              WHEN itm ? 'cancelledBy' AND (itm->>'cancelledBy') IS NOT NULL
              THEN jsonb_set(itm, '{cancelledBy}', to_jsonb(pg_temp.tr_norm(itm->>'cancelledBy')))
              ELSE itm
            END
          )
          FROM jsonb_array_elements(ord->'items') AS itm
        ), '[]'::jsonb)
      )
    )
    FROM jsonb_array_elements(co.orders_snapshot) AS ord
  );

COMMIT;

