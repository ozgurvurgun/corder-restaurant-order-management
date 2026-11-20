import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { normalizeStorageText } from './text-normalizer';

export interface SyncActorNameChangeParams {
  restaurantIds: string[];
  actorId: string;
  oldName?: string | null;
  newName?: string | null;
}

@Injectable()
export class ActorNameSyncService {
  constructor(private readonly dataSource: DataSource) {}

  private async syncByActorId(
    em: EntityManager,
    newNorm: string,
    actorId: string,
    restIds: string[],
  ): Promise<void> {
    if (!actorId) return;
    if (restIds.length > 0) {
      await em.query(
        `UPDATE orders SET user_display_name = $1 WHERE user_id = $2::uuid AND restaurant_id = ANY($3::uuid[]) AND user_display_name IS DISTINCT FROM $1`,
        [newNorm, actorId, restIds],
      );
      await em.query(
        `UPDATE tables SET session_staff_name = $1 WHERE session_staff_id = $2::uuid AND restaurant_id = ANY($3::uuid[]) AND session_staff_name IS DISTINCT FROM $1`,
        [newNorm, actorId, restIds],
      );
      await em.query(
        `UPDATE ledger_entries SET received_by = $1 WHERE received_by_user_id = $2 AND restaurant_id = ANY($3::uuid[]) AND received_by IS DISTINCT FROM $1`,
        [newNorm, actorId, restIds],
      );
      await em.query(
        `UPDATE open_account_payments oap SET received_by = $1 FROM open_accounts oa WHERE oap.open_account_id = oa.id AND oap.received_by_user_id = $2 AND oa.restaurant_id = ANY($3::uuid[]) AND oap.received_by IS DISTINCT FROM $1`,
        [newNorm, actorId, restIds],
      );
      await em.query(
        `UPDATE restaurant_audit_logs SET user_name = $1 WHERE user_id = $2 AND restaurant_id = ANY($3::uuid[]) AND user_name IS DISTINCT FROM $1`,
        [newNorm, actorId, restIds],
      );
      await em.query(
        `UPDATE fraud_alerts SET actor_name = $1 WHERE actor_id = $2::uuid AND restaurant_id = ANY($3::uuid[]) AND actor_name IS DISTINCT FROM $1`,
        [newNorm, actorId, restIds],
      );
      return;
    }

    await em.query(
      `UPDATE orders SET user_display_name = $1 WHERE user_id = $2::uuid AND user_display_name IS DISTINCT FROM $1`,
      [newNorm, actorId],
    );
    await em.query(
      `UPDATE tables SET session_staff_name = $1 WHERE session_staff_id = $2::uuid AND session_staff_name IS DISTINCT FROM $1`,
      [newNorm, actorId],
    );
    await em.query(
      `UPDATE ledger_entries SET received_by = $1 WHERE received_by_user_id = $2 AND received_by IS DISTINCT FROM $1`,
      [newNorm, actorId],
    );
    await em.query(
      `UPDATE open_account_payments SET received_by = $1 WHERE received_by_user_id = $2 AND received_by IS DISTINCT FROM $1`,
      [newNorm, actorId],
    );
    await em.query(
      `UPDATE restaurant_audit_logs SET user_name = $1 WHERE user_id = $2 AND user_name IS DISTINCT FROM $1`,
      [newNorm, actorId],
    );
    await em.query(
      `UPDATE fraud_alerts SET actor_name = $1 WHERE actor_id = $2::uuid AND actor_name IS DISTINCT FROM $1`,
      [newNorm, actorId],
    );
  }

  private async syncActiveOrdersAndTablesByOldName(
    em: EntityManager,
    newNorm: string,
    restIds: string[],
    oldNorm: string,
  ): Promise<void> {
    await em.query(
      `UPDATE orders SET user_display_name = $1 WHERE restaurant_id = ANY($2::uuid[]) AND LOWER(BTRIM(user_display_name)) = $3`,
      [newNorm, restIds, oldNorm],
    );
    await em.query(
      `UPDATE tables SET session_staff_name = $1 WHERE restaurant_id = ANY($2::uuid[]) AND LOWER(BTRIM(session_staff_name)) = $3`,
      [newNorm, restIds, oldNorm],
    );
    await em.query(
      `UPDATE tables SET discount = jsonb_set(discount, '{appliedBy}', to_jsonb($1::text)) WHERE restaurant_id = ANY($2::uuid[]) AND discount IS NOT NULL AND LOWER(BTRIM(discount->>'appliedBy')) = $3`,
      [newNorm, restIds, oldNorm],
    );
    await em.query(
      `UPDATE order_items oi SET cancelled_by = $1 FROM orders o WHERE oi.order_id = o.id AND o.restaurant_id = ANY($2::uuid[]) AND LOWER(BTRIM(oi.cancelled_by)) = $3`,
      [newNorm, restIds, oldNorm],
    );
  }

  private async syncCompletedOrdersByOldName(
    em: EntityManager,
    newNorm: string,
    restIds: string[],
    oldNorm: string,
    actorId: string,
  ): Promise<void> {
    await em.query(
      `UPDATE completed_orders SET waiter = $1 WHERE restaurant_id = ANY($2::uuid[]) AND LOWER(BTRIM(waiter)) = $3`,
      [newNorm, restIds, oldNorm],
    );
    await em.query(
      `UPDATE completed_orders SET closed_by = $1 WHERE restaurant_id = ANY($2::uuid[]) AND LOWER(BTRIM(closed_by)) = $3`,
      [newNorm, restIds, oldNorm],
    );
    await em.query(
      `UPDATE completed_orders SET payment_discount = jsonb_set(payment_discount, '{appliedBy}', to_jsonb($1::text)) WHERE restaurant_id = ANY($2::uuid[]) AND payment_discount IS NOT NULL AND LOWER(BTRIM(payment_discount->>'appliedBy')) = $3`,
      [newNorm, restIds, oldNorm],
    );
    await em.query(
      `UPDATE completed_orders SET payment_snapshot = jsonb_set(payment_snapshot, '{processedBy}', to_jsonb($1::text)) WHERE restaurant_id = ANY($2::uuid[]) AND payment_snapshot IS NOT NULL AND LOWER(BTRIM(payment_snapshot->>'processedBy')) = $3`,
      [newNorm, restIds, oldNorm],
    );
    await em.query(
      `UPDATE completed_orders SET payment_snapshot = jsonb_set(payment_snapshot, '{discount,appliedBy}', to_jsonb($1::text)) WHERE restaurant_id = ANY($2::uuid[]) AND (payment_snapshot->'discount') IS NOT NULL AND LOWER(BTRIM(payment_snapshot->'discount'->>'appliedBy')) = $3`,
      [newNorm, restIds, oldNorm],
    );
    await em.query(
      `UPDATE completed_orders co
       SET orders_snapshot = (
         SELECT COALESCE(jsonb_agg(
           CASE
             WHEN ($4 <> '' AND (ord->>'userId') = $4) OR LOWER(BTRIM(ord->>'userName')) = $3
             THEN jsonb_set(ord, '{userName}', to_jsonb($1::text))
             ELSE ord
           END || jsonb_build_object(
             'items',
             COALESCE((
               SELECT jsonb_agg(
                 CASE
                   WHEN itm ? 'cancelledBy' AND LOWER(BTRIM(itm->>'cancelledBy')) = $3
                   THEN jsonb_set(itm, '{cancelledBy}', to_jsonb($1::text))
                   ELSE itm
                 END
               )
               FROM jsonb_array_elements(COALESCE(ord->'items', '[]'::jsonb)) AS itm
             ), '[]'::jsonb)
           )
         ), '[]'::jsonb)
         FROM jsonb_array_elements(co.orders_snapshot) AS ord
       )
       WHERE co.restaurant_id = ANY($2::uuid[])
         AND jsonb_typeof(co.orders_snapshot) = 'array'
         AND EXISTS (
           SELECT 1
           FROM jsonb_array_elements(co.orders_snapshot) AS ord
           WHERE ($4 <> '' AND (ord->>'userId') = $4)
              OR LOWER(BTRIM(ord->>'userName')) = $3
              OR EXISTS (
                SELECT 1
                FROM jsonb_array_elements(COALESCE(ord->'items', '[]'::jsonb)) AS itm
                WHERE itm ? 'cancelledBy' AND LOWER(BTRIM(itm->>'cancelledBy')) = $3
              )
         )`,
      [newNorm, restIds, oldNorm, actorId],
    );
  }

  private async syncFinancialAndAuditByOldName(
    em: EntityManager,
    newNorm: string,
    restIds: string[],
    oldNorm: string,
  ): Promise<void> {
    await em.query(
      `UPDATE cash_shifts SET opened_by = $1 WHERE restaurant_id = ANY($2::uuid[]) AND LOWER(BTRIM(opened_by)) = $3`,
      [newNorm, restIds, oldNorm],
    );
    await em.query(
      `UPDATE cash_shifts SET closed_by = $1 WHERE restaurant_id = ANY($2::uuid[]) AND LOWER(BTRIM(closed_by)) = $3`,
      [newNorm, restIds, oldNorm],
    );
    await em.query(
      `UPDATE cash_transactions SET created_by = $1 WHERE restaurant_id = ANY($2::uuid[]) AND LOWER(BTRIM(created_by)) = $3`,
      [newNorm, restIds, oldNorm],
    );
    await em.query(
      `UPDATE stock_movements SET created_by = $1 WHERE restaurant_id = ANY($2::uuid[]) AND LOWER(BTRIM(created_by)) = $3`,
      [newNorm, restIds, oldNorm],
    );
    await em.query(
      `UPDATE ledger_entries SET received_by = $1 WHERE restaurant_id = ANY($2::uuid[]) AND LOWER(BTRIM(received_by)) = $3`,
      [newNorm, restIds, oldNorm],
    );
    await em.query(
      `UPDATE open_accounts SET created_by = $1 WHERE restaurant_id = ANY($2::uuid[]) AND LOWER(BTRIM(created_by)) = $3`,
      [newNorm, restIds, oldNorm],
    );
    await em.query(
      `UPDATE open_account_payments oap SET received_by = $1 FROM open_accounts oa WHERE oap.open_account_id = oa.id AND oa.restaurant_id = ANY($2::uuid[]) AND LOWER(BTRIM(oap.received_by)) = $3`,
      [newNorm, restIds, oldNorm],
    );
    await em.query(
      `UPDATE inventory_counts SET counted_by = $1 WHERE restaurant_id = ANY($2::uuid[]) AND LOWER(BTRIM(counted_by)) = $3`,
      [newNorm, restIds, oldNorm],
    );
    await em.query(
      `UPDATE purchase_orders SET created_by = $1 WHERE restaurant_id = ANY($2::uuid[]) AND LOWER(BTRIM(created_by)) = $3`,
      [newNorm, restIds, oldNorm],
    );
    await em.query(
      `UPDATE restaurant_audit_logs SET user_name = $1 WHERE restaurant_id = ANY($2::uuid[]) AND LOWER(BTRIM(user_name)) = $3`,
      [newNorm, restIds, oldNorm],
    );
    await em.query(
      `UPDATE fraud_alerts SET actor_name = $1 WHERE restaurant_id = ANY($2::uuid[]) AND LOWER(BTRIM(actor_name)) = $3`,
      [newNorm, restIds, oldNorm],
    );
    await em.query(
      `UPDATE fraud_alerts SET resolved_by = $1 WHERE restaurant_id = ANY($2::uuid[]) AND LOWER(BTRIM(resolved_by)) = $3`,
      [newNorm, restIds, oldNorm],
    );
  }

  async syncActorNameChange(params: SyncActorNameChangeParams): Promise<void> {
    const oldNorm = params.oldName ? normalizeStorageText(params.oldName) : '';
    const newNorm = params.newName ? normalizeStorageText(params.newName) : '';
    if (!newNorm || oldNorm === newNorm) {
      return;
    }

    const actorId = (params.actorId || '').trim();
    const restIds = Array.from(
      new Set((params.restaurantIds ?? []).map((id) => id?.trim()).filter(Boolean)),
    );

    await this.dataSource.transaction(async (em) => {
      await this.syncByActorId(em, newNorm, actorId, restIds);
      if (!oldNorm || restIds.length === 0) return;
      await this.syncActiveOrdersAndTablesByOldName(em, newNorm, restIds, oldNorm);
      await this.syncCompletedOrdersByOldName(em, newNorm, restIds, oldNorm, actorId);
      await this.syncFinancialAndAuditByOldName(em, newNorm, restIds, oldNorm);
    });
  }
}
