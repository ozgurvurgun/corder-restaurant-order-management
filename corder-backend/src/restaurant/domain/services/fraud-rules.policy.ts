import { FraudAlertSeverity, FraudRuleCode } from '../fraud-alert.entity';
import { OrderEntity } from '../order.entity';
import { OrderItemEntity } from '../order-item.entity';
import { TableEntity } from '../table.entity';
import { CompletedOrderEntity } from '../completed-order.entity';
import { CashShiftEntity } from '../cash-shift.entity';
import { CashTransactionEntity } from '../cash-transaction.entity';
import { PrintJobEntity } from '../print-job.entity';
import { AuditLogEntity } from '../audit-log.entity';
import { fromMinorUnits, toMinorUnits } from '../../../common/money/minor-units';
import { formatTitleCase, normalizeStorageText } from '../../../common/text/text-normalizer';

const PAYMENT_METHOD_TR: Record<string, string> = {
  cash: 'Nakit',
  'credit-card': 'Kredi Kartı',
  'meal-card': 'Yemek Kartı',
  multinet: 'Multinet',
  split: 'Çoklu Ödeme',
  ledger: 'Cari',
  complimentary: 'İkram',
};

function formatDisplayLabel(raw: string | null | undefined, fallback = ''): string {
  const norm = normalizeStorageText(raw || '');
  if (!norm) return fallback;
  if (norm === 'walk-in sale') return 'Hızlı Satış';
  if (norm === 'register') return 'Kasa';
  return formatTitleCase(norm, 'tr') || fallback;
}

function formatMethodTr(method: string | null | undefined): string {
  const clean = (method || '').trim().toLowerCase();
  return PAYMENT_METHOD_TR[clean] || formatDisplayLabel(clean, clean);
}

export interface CreateFraudAlertInput {
  restaurantId: string;
  ruleCode: FraudRuleCode;
  severity: FraudAlertSeverity;
  riskScore: number;
  title: string;
  description: string;
  actorName?: string | null;
  actorId?: string | null;
  tableName?: string | null;
  amountImpact?: number;
  sourceKey: string;
  evidence?: Record<string, unknown>;
}

export interface FraudAnomalyScanContext {
  restaurantId: string;
  tables: TableEntity[];
  orders: OrderEntity[];
  orderItems: OrderItemEntity[];
  completedOrders: CompletedOrderEntity[];
  shifts: CashShiftEntity[];
  cashTxs: CashTransactionEntity[];
  printJobs: PrintJobEntity[];
  audits: AuditLogEntity[];
}

/** Permanent UTC+3 offset for Europe/Istanbul (Turkey). */
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;

export function toIstanbulDayKey(date: Date): string {
  const shifted = new Date(date.getTime() + ISTANBUL_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

export class FraudRulesPolicy {
  static evaluateAnomalies(ctx: FraudAnomalyScanContext): CreateFraudAlertInput[] {
    const {
      restaurantId,
      tables,
      orders,
      orderItems,
      completedOrders,
      shifts,
      cashTxs,
      printJobs,
      audits,
    } = ctx;
    const tableById = new Map(tables.map((t) => [t.id, t]));
    const orderById = new Map(orders.map((o) => [o.id, o]));
    const out: CreateFraudAlertInput[] = [];

    const voidStatsByActorDay = new Map<
      string,
      {
        actorName: string;
        actorId: string | null;
        dayKey: string;
        count: number;
        amountMinor: number;
        tables: Set<string>;
        itemNames: string[];
      }
    >();

    for (const item of orderItems) {
      if (item.status !== 'cancelled') continue;
      const ord = orderById.get(item.orderId);
      if (!ord) continue;
      const tbl = tableById.get(ord.tableId);
      const tableName = formatDisplayLabel(tbl?.name, ord.tableId);
      const productName = formatDisplayLabel(item.productName, 'Ürün');
      const lineAmount = fromMinorUnits(
        toMinorUnits(item.price || 0) * Math.max(1, Number(item.quantity || 1)),
      );
      const actorName = formatDisplayLabel(
        item.cancelledBy?.trim() || ord.userDisplayName?.trim(),
        'Personel',
      );
      const cancelledAt = item.cancelledAt ?? ord.updatedAt ?? ord.createdAt;
      const cancelDayKey = toIstanbulDayKey(cancelledAt);

      const priorReceipt = printJobs.find((pj) => {
        if (pj.createdAt < ord.createdAt || pj.createdAt > cancelledAt) {
          return false;
        }
        if (cancelledAt.getTime() - pj.createdAt.getTime() > 2 * 60 * 60 * 1000) {
          return false;
        }
        const payloadObj = pj.payload as {
          isReprint?: boolean;
          shiftReport?: unknown;
          order?: Record<string, unknown>;
        };
        if (payloadObj?.shiftReport) return false;
        const pOrd = payloadObj?.order;
        if (!pOrd || pOrd.completedOrderId) return false;
        return pOrd.orderId === ord.id || pOrd.tableId === ord.tableId;
      });

      if (priorReceipt) {
        out.push({
          restaurantId,
          ruleCode: 'POST_PRINT_VOID_OR_DISCOUNT',
          severity: 'critical',
          riskScore: 92,
          title: 'Hesap Fişi Basıldıktan Sonra Ürün İptali',
          description: `${tableName} masasında adisyon fişi basıldıktan sonra "${productName}" (${item.quantity} adet, ${lineAmount} TL) iptal edildi.`,
          actorName,
          actorId: ord.userId,
          tableName,
          amountImpact: lineAmount,
          sourceKey: `post-print-void-v2:${item.id}`,
          evidence: {
            itemId: item.id,
            orderId: ord.id,
            orderCreatedAt: ord.createdAt.toISOString(),
            productName,
            quantity: item.quantity,
            cancelReason: item.cancelReason,
            receiptJobId: priorReceipt.id,
            receiptPrintedAt: priorReceipt.createdAt.toISOString(),
          },
        });
      }

      if (ord.mergedFrom) {
        const fromTableName = formatDisplayLabel(ord.mergedFrom, ord.mergedFrom);
        out.push({
          restaurantId,
          ruleCode: 'TRANSFER_THEN_VOID',
          severity: 'high',
          riskScore: 82,
          title: 'Masa Taşıma / Aktarım Sonrası Ürün İptali',
          description: `"${fromTableName}" masasından "${tableName}" masasına aktarılan "${productName}" (${item.quantity} adet, ${lineAmount} TL) kısa süre sonra iptal edildi.`,
          actorName,
          actorId: ord.userId,
          tableName,
          amountImpact: lineAmount,
          sourceKey: `transfer-void:${item.id}`,
          evidence: {
            itemId: item.id,
            orderId: ord.id,
            fromTable: fromTableName,
            toTable: tableName,
            productName,
            cancelReason: item.cancelReason,
          },
        });
      }

      const bucketKey = `${actorName.toLowerCase()}::${cancelDayKey}`;
      const cur = voidStatsByActorDay.get(bucketKey) ?? {
        actorName,
        actorId: ord.userId ?? null,
        dayKey: cancelDayKey,
        count: 0,
        amountMinor: 0,
        tables: new Set<string>(),
        itemNames: [],
      };
      cur.count += Math.max(1, Number(item.quantity || 1));
      cur.amountMinor += toMinorUnits(lineAmount);
      cur.tables.add(tableName);
      if (cur.itemNames.length < 5) cur.itemNames.push(productName);
      voidStatsByActorDay.set(bucketKey, cur);
    }

    for (const stat of voidStatsByActorDay.values()) {
      if (stat.count >= 3 || stat.amountMinor >= 75_000) {
        const impact = fromMinorUnits(stat.amountMinor);
        out.push({
          restaurantId,
          ruleCode: 'EXCESSIVE_VOID_PATTERN',
          severity: stat.amountMinor >= 150_000 ? 'critical' : 'high',
          riskScore: stat.amountMinor >= 150_000 ? 88 : 78,
          title: `Yüksek Ürün İptal Yoğunluğu (${stat.actorName})`,
          description: `${stat.actorName} tarafından ${stat.dayKey} gününde toplam ${stat.count} adet ürün (${impact} TL) iptal edildi (${Array.from(stat.tables).slice(0, 4).join(', ')}).`,
          actorName: stat.actorName,
          actorId: stat.actorId,
          tableName: Array.from(stat.tables)[0] ?? null,
          amountImpact: impact,
          sourceKey: `excessive-void:${stat.actorName.toLowerCase()}:${stat.dayKey}`,
          evidence: {
            dayKey: stat.dayKey,
            cancelledCount: stat.count,
            totalAmount: impact,
            sampleItems: stat.itemNames,
            tables: Array.from(stat.tables),
          },
        });
      }
    }

    for (const audit of audits) {
      const meta = (audit.metadata ?? {}) as {
        completedOrderId?: string;
        tableName?: string;
        previousMethod?: string;
        nextMethod?: string;
        previousNetAmount?: number;
        nextNetAmount?: number;
      };
      const prevNet = Number(meta.previousNetAmount ?? 0);
      const nextNet = Number(meta.nextNetAmount ?? 0);
      const prevMethod = String(meta.previousMethod ?? '');
      const nextMethod = String(meta.nextMethod ?? '');
      const netDrop = fromMinorUnits(
        Math.max(0, toMinorUnits(prevNet) - toMinorUnits(nextNet)),
      );
      const cashDowngraded =
        prevMethod === 'cash' &&
        (nextMethod === 'ledger' || nextMethod === 'complimentary' || netDrop > 0);

      if (netDrop > 0 || cashDowngraded) {
        const displayTable = formatDisplayLabel(meta.tableName, 'Masa');
        const displayActor = formatDisplayLabel(audit.userName, 'Personel');
        const prevMethodTr = formatMethodTr(prevMethod);
        const nextMethodTr = formatMethodTr(nextMethod);
        out.push({
          restaurantId,
          ruleCode: 'CLOSED_CHECK_DOWNGRADE',
          severity: 'critical',
          riskScore: 90,
          title: 'Kapanmış Adisyonda Tutar Düşürme / Ödeme Değişikliği',
          description: `${displayTable} kapanmış adisyonu ${displayActor} tarafından düzenlendi (${prevMethodTr} ${prevNet} TL -> ${nextMethodTr} ${nextNet} TL).`,
          actorName: displayActor,
          actorId: audit.userId,
          tableName: displayTable,
          amountImpact: netDrop > 0 ? netDrop : prevNet,
          sourceKey: `closed-check-downgrade:${audit.id}`,
          evidence: {
            auditId: audit.id,
            completedOrderId: meta.completedOrderId,
            previousMethod: prevMethod,
            nextMethod,
            previousNetAmount: prevNet,
            nextNetAmount: nextNet,
          },
        });
      }
    }

    for (const shift of shifts) {
      if (shift.status !== 'closed' || shift.closingBalance == null) continue;
      const expectedMinor =
        toMinorUnits(shift.openingBalance || 0) +
        toMinorUnits(shift.cashIn || 0) -
        toMinorUnits(shift.cashOut || 0);
      const closingMinor = toMinorUnits(shift.closingBalance);
      const diffMinor = closingMinor - expectedMinor;
      if (diffMinor < -2000) {
        const shortage = fromMinorUnits(Math.abs(diffMinor));
        const shiftActor = formatDisplayLabel(
          shift.closedBy || shift.openedBy,
          'Kasiyer',
        );
        out.push({
          restaurantId,
          ruleCode: 'CASH_DRAWER_DISCREPANCY',
          severity: shortage >= 250 ? 'critical' : 'high',
          riskScore: shortage >= 250 ? 91 : 85,
          title: `Vardiya Kapanışında Kasa Nakit Açığı (-${shortage} TL)`,
          description: `${shiftActor} tarafından kapatılan vardiyada beklenen nakit ${fromMinorUnits(expectedMinor)} TL iken sayılan ${fromMinorUnits(closingMinor)} TL (-${shortage} TL açık).`,
          actorName: shiftActor,
          amountImpact: shortage,
          sourceKey: `cash-discrepancy:${shift.id}`,
          evidence: {
            shiftId: shift.id,
            expectedCash: fromMinorUnits(expectedMinor),
            closingBalance: fromMinorUnits(closingMinor),
            shortage,
          },
        });
      }
    }

    for (const tx of cashTxs) {
      if (tx.type === 'cash-in' || tx.type === 'sale') continue;
      if (
        tx.type === 'expense' &&
        (tx.reference ?? '').trim().toLowerCase() === 'credit-card'
      ) {
        continue;
      }
      const amt = Number(tx.amount || 0);
      if (amt >= 1000) {
        const txActor = formatDisplayLabel(tx.createdBy, 'Kasiyer');
        const txDesc = formatDisplayLabel(tx.description, tx.description);
        out.push({
          restaurantId,
          ruleCode: 'UNUSUAL_CASH_OUT',
          severity: amt >= 2500 ? 'high' : 'medium',
          riskScore: amt >= 2500 ? 80 : 72,
          title: `Yüksek Tutarlı Kasadan Nakit Çıkışı (${amt} TL)`,
          description: `${txActor} tarafından "${txDesc}" açıklamasıyla kasadan ${amt} TL nakit çıkış kaydı girildi.`,
          actorName: txActor,
          amountImpact: amt,
          sourceKey: `unusual-cash-out:${tx.id}`,
          evidence: {
            transactionId: tx.id,
            shiftId: tx.shiftId,
            type: tx.type,
            amount: amt,
            description: txDesc,
          },
        });
      }
    }

    for (const co of completedOrders) {
      const totalMinor = toMinorUnits(co.totalAmount || 0);
      const discMinor = toMinorUnits(co.discountAmount || 0);
      if (totalMinor <= 0 || discMinor <= 0) continue;
      const pct = Math.round((discMinor * 100) / totalMinor);
      if (pct >= 30 || discMinor >= 50_000) {
        const discAmt = fromMinorUnits(discMinor);
        const appliedBy = formatDisplayLabel(
          (co.paymentDiscount as { appliedBy?: string } | null)?.appliedBy ||
            co.closedBy ||
            co.waiter,
          'Personel',
        );
        const coTable = formatDisplayLabel(co.tableName, 'Masa');
        out.push({
          restaurantId,
          ruleCode: 'BOUNDARY_DISCOUNT_ABUSE',
          severity: pct >= 50 ? 'high' : 'medium',
          riskScore: pct >= 50 ? 79 : 68,
          title:
            pct >= 100
              ? `Tam İkram (%100 İndirim) Kapatılan Hesap (${coTable})`
              : `Yüksek Oranlı İndirim (%${pct} - ${discAmt} TL)`,
          description: `${coTable} masasında ${fromMinorUnits(totalMinor)} TL tutarındaki hesaba %${pct} (${discAmt} TL) indirim/ikram uygulandı.`,
          actorName: appliedBy,
          tableName: coTable,
          amountImpact: discAmt,
          sourceKey: `boundary-discount:${co.id}`,
          evidence: {
            completedOrderId: co.id,
            totalAmount: Number(co.totalAmount),
            discountAmount: discAmt,
            discountPercent: pct,
          },
        });
      }
    }

    return out;
  }
}
