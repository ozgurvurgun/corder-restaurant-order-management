import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompletedOrderEditHistory1760000014000
  implements MigrationInterface
{
  name = 'AddCompletedOrderEditHistory1760000014000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "completed_orders"
      ADD COLUMN IF NOT EXISTS "edit_history" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);

    await queryRunner.query(`
      UPDATE "completed_orders" co
      SET "edit_history" = sub.history
      FROM (
        SELECT
          (al.metadata->>'completedOrderId')::uuid AS completed_order_id,
          jsonb_agg(
            jsonb_build_object(
              'id', al.id::text,
              'editedAt', to_char(al.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
              'editedBy', al.user_name,
              'editedByUserId', al.user_id,
              'previousTotalAmount', COALESCE((al.metadata->>'previousNetAmount')::numeric, co_inner.total_amount),
              'nextTotalAmount', COALESCE((al.metadata->>'nextNetAmount')::numeric, co_inner.total_amount),
              'previousDiscountAmount', co_inner.discount_amount,
              'nextDiscountAmount', co_inner.discount_amount,
              'previousNetAmount', COALESCE((al.metadata->>'previousNetAmount')::numeric, co_inner.net_amount),
              'nextNetAmount', COALESCE((al.metadata->>'nextNetAmount')::numeric, co_inner.net_amount),
              'previousMethod', COALESCE(al.metadata->>'previousMethod', co_inner.payment_method),
              'nextMethod', COALESCE(al.metadata->>'nextMethod', co_inner.payment_method),
              'nextSplit', co_inner.payment_split,
              'changes', COALESCE(
                al.metadata->'changes',
                jsonb_build_array(
                  jsonb_build_object(
                    'type', 'payment_method_changed',
                    'previousMethod', COALESCE(al.metadata->>'previousMethod', co_inner.payment_method),
                    'nextMethod', COALESCE(al.metadata->>'nextMethod', co_inner.payment_method),
                    'nextSplit', co_inner.payment_split
                  ),
                  jsonb_build_object(
                    'type', 'net_amount_changed',
                    'previousTotalAmount', COALESCE((al.metadata->>'previousNetAmount')::numeric, co_inner.total_amount),
                    'nextTotalAmount', COALESCE((al.metadata->>'nextNetAmount')::numeric, co_inner.total_amount),
                    'previousNetAmount', COALESCE((al.metadata->>'previousNetAmount')::numeric, co_inner.net_amount),
                    'nextNetAmount', COALESCE((al.metadata->>'nextNetAmount')::numeric, co_inner.net_amount)
                  )
                )
              )
            )
            ORDER BY al.created_at ASC
          ) AS history
        FROM "restaurant_audit_logs" al
        INNER JOIN "completed_orders" co_inner
          ON co_inner.id::text = al.metadata->>'completedOrderId'
        WHERE al.action = 'completed_order_updated'
          AND al.metadata ? 'completedOrderId'
        GROUP BY (al.metadata->>'completedOrderId')::uuid
      ) sub
      WHERE co.id = sub.completed_order_id
        AND jsonb_array_length(co.edit_history) = 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "completed_orders"
      DROP COLUMN IF EXISTS "edit_history"
    `);
  }
}

