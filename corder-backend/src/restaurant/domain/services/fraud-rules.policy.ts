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

    const voidStatsByActor = new Map<
      string,
      { count: number; amountMinor: number; tables: Set<string>; itemNames: string[] }
    >();

    for (const item of orderItems) {
      if (item.status !== 'cancelled') continue;
      const ord = orderById.get(item.orderId);
      if (!ord) continue;
      const tbl = tableById.get(ord.tableId);
      const tableName = tbl?.name || ord.tableId;
      const lineAmount = fromMinorUnits(
        toMinorUnits(item.price || 0) * Math.max(1, Number(item.quantity || 1)),
      );
      const actorName =
        item.cancelledBy?.trim() || ord.userDisplayName?.trim() || 'Personel';
      const cancelledAt = item.cancelledAt ?? ord.updatedAt ?? ord.createdAt;

      const priorReceipt = printJobs.find((pj) => {
        if (pj.createdAt > cancelledAt) return false;
        const pOrd = (pj.payload as { order?: Record<string, unknown> })?.order;
        if (!pOrd) return false;
        return (
          pOrd.tableId === ord.tableId ||
          pOrd.orderId === ord.id ||
          (typeof pOrd.tableName === 'string' && pOrd.tableName === tableName)
        );
      });

      if (priorReceipt) {
        out.push({
          restaurantId,
          ruleCode: 'POST_PRINT_VOID_OR_DISCOUNT',
          severity: 'critical',
          riskScore: 92,
          title: 'Hesap Fişi Basıldıktan Sonra Ürün İptali',
          description: `${tableName} masasında adisyon fişi basıldıktan sonra "${item.productName}" (${item.quantity} adet, ${lineAmount} TL) iptal edildi.`,
          actorName,
          actorId: ord.userId,
          tableName,
          amountImpact: lineAmount,
          sourceKey: `post-print-void:${item.id}`,
          evidence: {
            itemId: item.id,
            orderId: ord.id,
            productName: item.productName,
            quantity: item.quantity,
            cancelReason: item.cancelReason,
            receiptJobId: priorReceipt.id,
            receiptPrintedAt: priorReceipt.createdAt.toISOString(),
          },
        });
      }

      if (ord.mergedFrom) {
        out.push({
          restaurantId,
          ruleCode: 'TRANSFER_THEN_VOID',
          severity: 'high',
          riskScore: 82,
          title: 'Masa Taşıma / Aktarım Sonrası Ürün İptali',
          description: `"${ord.mergedFrom}" masasından "${tableName}" masasına aktarılan "${item.productName}" (${item.quantity} adet, ${lineAmount} TL) kısa süre sonra iptal edildi.`,
          actorName,
          actorId: ord.userId,
          tableName,
          amountImpact: lineAmount,
          sourceKey: `transfer-void:${item.id}`,
          evidence: {
            itemId: item.id,
            orderId: ord.id,
            fromTable: ord.mergedFrom,
            toTable: tableName,
            productName: item.productName,
            cancelReason: item.cancelReason,
          },
        });
      }

      const cur = voidStatsByActor.get(actorName) ?? {
        count: 0,
        amountMinor: 0,
        tables: new Set<string>(),
        itemNames: [],
      };
      cur.count += Math.max(1, Number(item.quantity || 1));
      cur.amountMinor += toMinorUnits(lineAmount);
      cur.tables.add(tableName);
      if (cur.itemNames.length < 5) cur.itemNames.push(item.productName);
      voidStatsByActor.set(actorName, cur);
    }

    const dayKey = new Date().toISOString().slice(0, 10);
    for (const [actorName, stat] of voidStatsByActor.entries()) {
      if (stat.count >= 3 || stat.amountMinor >= 75_000) {
        const impact = fromMinorUnits(stat.amountMinor);
        out.push({
          restaurantId,
          ruleCode: 'EXCESSIVE_VOID_PATTERN',
          severity: stat.amountMinor >= 150_000 ? 'critical' : 'high',
          riskScore: stat.amountMinor >= 150_000 ? 88 : 78,
          title: `Yüksek Ürün İptal Yoğunluğu (${actorName})`,
          description: `${actorName} tarafından toplam ${stat.count} adet ürün (${impact} TL) iptal edildi (${Array.from(stat.tables).slice(0, 4).join(', ')}).`,
          actorName,
          tableName: Array.from(stat.tables)[0] ?? null,
          amountImpact: impact,
          sourceKey: `excessive-void:${actorName.toLowerCase()}:${dayKey}`,
          evidence: {
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
        out.push({
          restaurantId,
          ruleCode: 'CLOSED_CHECK_DOWNGRADE',
          severity: 'critical',
          riskScore: 90,
          title: 'Kapanmış Adisyonda Tutar Düşürme / Ödeme Değişikliği',
          description: `${meta.tableName || 'Masa'} kapanmış adisyonu ${audit.userName} tarafından düzenlendi (${prevMethod} ${prevNet} TL -> ${nextMethod} ${nextNet} TL).`,
          actorName: audit.userName,
          actorId: audit.userId,
          tableName: meta.tableName || null,
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
        out.push({
          restaurantId,
          ruleCode: 'CASH_DRAWER_DISCREPANCY',
          severity: shortage >= 250 ? 'critical' : 'high',
          riskScore: shortage >= 250 ? 91 : 85,
          title: `Vardiya Kapanışında Kasa Nakit Açığı (-${shortage} TL)`,
          description: `${shift.closedBy || shift.openedBy} tarafından kapatılan vardiyada beklenen nakit ${fromMinorUnits(expectedMinor)} TL iken sayılan ${fromMinorUnits(closingMinor)} TL (-${shortage} TL açık).`,
          actorName: shift.closedBy || shift.openedBy,
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
      const amt = Number(tx.amount || 0);
      if (amt >= 1000) {
        out.push({
          restaurantId,
          ruleCode: 'UNUSUAL_CASH_OUT',
          severity: amt >= 2500 ? 'high' : 'medium',
          riskScore: amt >= 2500 ? 80 : 72,
          title: `Yüksek Tutarlı Kasadan Nakit Çıkışı (${amt} TL)`,
          description: `${tx.createdBy} tarafından "${tx.description}" açıklamasıyla kasadan ${amt} TL nakit çıkış kaydı girildi.`,
          actorName: tx.createdBy,
          amountImpact: amt,
          sourceKey: `unusual-cash-out:${tx.id}`,
          evidence: {
            transactionId: tx.id,
            shiftId: tx.shiftId,
            type: tx.type,
            amount: amt,
            description: tx.description,
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
        const appliedBy =
          (co.paymentDiscount as { appliedBy?: string } | null)?.appliedBy ||
          co.closedBy ||
          co.waiter;
        out.push({
          restaurantId,
          ruleCode: 'BOUNDARY_DISCOUNT_ABUSE',
          severity: pct >= 50 ? 'high' : 'medium',
          riskScore: pct >= 50 ? 79 : 68,
          title:
            pct >= 100
              ? `Tam İkram (%100 İndirim) Kapatılan Hesap (${co.tableName})`
              : `Yüksek Oranlı İndirim (%${pct} - ${discAmt} TL)`,
          description: `${co.tableName} masasında ${fromMinorUnits(totalMinor)} TL tutarındaki hesaba %${pct} (${discAmt} TL) indirim/ikram uygulandı.`,
          actorName: appliedBy,
          tableName: co.tableName,
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
