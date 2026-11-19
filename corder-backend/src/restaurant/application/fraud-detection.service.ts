import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, MoreThanOrEqual, Repository } from 'typeorm';
import {
  FraudAlertEntity,
  FraudAlertStatus,
} from '../domain/fraud-alert.entity';
import { OrderEntity } from '../domain/order.entity';
import { OrderItemEntity } from '../domain/order-item.entity';
import { TableEntity } from '../domain/table.entity';
import { CompletedOrderEntity } from '../domain/completed-order.entity';
import { CashShiftEntity } from '../domain/cash-shift.entity';
import { CashTransactionEntity } from '../domain/cash-transaction.entity';
import { PrintJobEntity } from '../domain/print-job.entity';
import { AuditLogEntity } from '../domain/audit-log.entity';
import {
  CreateFraudAlertInput,
  FraudRulesPolicy,
} from '../domain/services/fraud-rules.policy';
import { OrdersGateway } from '../api/orders.gateway';
import { fromMinorUnits, toMinorUnits } from '../../common/money/minor-units';

export type { CreateFraudAlertInput };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class FraudDetectionService {
  constructor(
    @InjectRepository(FraudAlertEntity)
    private readonly alertRepo: Repository<FraudAlertEntity>,
    private readonly dataSource: DataSource,
    private readonly ordersGateway: OrdersGateway,
  ) {}

  async recordAlertIfNew(
    input: CreateFraudAlertInput,
    existingSourceKeys?: Set<string>,
  ): Promise<FraudAlertEntity | null> {
    const sourceKey = input.sourceKey.trim();
    if (!sourceKey) return null;
    if (existingSourceKeys?.has(sourceKey)) return null;

    if (!existingSourceKeys) {
      const existing = await this.alertRepo
        .createQueryBuilder('a')
        .where('a.restaurant_id = :restaurantId', {
          restaurantId: input.restaurantId,
        })
        .andWhere(`a.evidence ->> 'sourceKey' = :sourceKey`, { sourceKey })
        .getOne();
      if (existing) return null;
    }

    const safeActorId =
      input.actorId && UUID_RE.test(input.actorId.trim())
        ? input.actorId.trim()
        : null;
    const saved = await this.alertRepo.save(
      this.alertRepo.create({
        restaurantId: input.restaurantId,
        ruleCode: input.ruleCode,
        severity: input.severity,
        riskScore: Math.min(100, Math.max(1, Math.round(input.riskScore))),
        title: input.title.slice(0, 255),
        description: input.description,
        actorName: input.actorName?.trim().slice(0, 160) || null,
        actorId: safeActorId,
        tableName: input.tableName?.trim().slice(0, 120) || null,
        amountImpact: fromMinorUnits(
          Math.max(0, toMinorUnits(input.amountImpact || 0)),
        ),
        status: 'open',
        evidence: {
          ...(input.evidence ?? {}),
          sourceKey,
        },
      }),
    );

    existingSourceKeys?.add(sourceKey);
    this.ordersGateway.emitFraudAlert(
      input.restaurantId,
      this.serializeAlert(saved),
    );
    return saved;
  }

  async analyzeRestaurantAnomalies(restaurantId: string): Promise<number> {
    const em = this.dataSource.manager;
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const [
      existingAlerts,
      tables,
      orders,
      completedOrders,
      shifts,
      cashTxs,
      printJobs,
      audits,
    ] = await Promise.all([
      this.alertRepo.find({
        where: { restaurantId },
        select: ['id', 'evidence'],
      }),
      em.find(TableEntity, { where: { restaurantId } }),
      em.find(OrderEntity, {
        where: { restaurantId, createdAt: MoreThanOrEqual(since) },
      }),
      em.find(CompletedOrderEntity, {
        where: { restaurantId, closedAt: MoreThanOrEqual(since) },
        order: { closedAt: 'DESC' },
        take: 300,
      }),
      em.find(CashShiftEntity, {
        where: { restaurantId, openedAt: MoreThanOrEqual(since) },
        order: { openedAt: 'DESC' },
        take: 60,
      }),
      em.find(CashTransactionEntity, {
        where: { restaurantId, createdAt: MoreThanOrEqual(since) },
        order: { createdAt: 'DESC' },
        take: 300,
      }),
      em.find(PrintJobEntity, {
        where: {
          restaurantId,
          printType: 'receipt',
          createdAt: MoreThanOrEqual(since),
        },
        order: { createdAt: 'ASC' },
        take: 400,
      }),
      em.find(AuditLogEntity, {
        where: {
          restaurantId,
          action: 'completed_order_updated',
          createdAt: MoreThanOrEqual(since),
        },
        order: { createdAt: 'DESC' },
        take: 100,
      }),
    ]);

    const existingKeys = new Set<string>();
    for (const a of existingAlerts) {
      const sk = (a.evidence as { sourceKey?: string } | undefined)?.sourceKey;
      if (typeof sk === 'string' && sk) existingKeys.add(sk);
    }

    const orderIds = orders.map((o) => o.id);
    const orderItems = orderIds.length
      ? await em.find(OrderItemEntity, { where: { orderId: In(orderIds) } })
      : [];

    const candidateInputs = FraudRulesPolicy.evaluateAnomalies({
      restaurantId,
      tables,
      orders,
      orderItems,
      completedOrders,
      shifts,
      cashTxs,
      printJobs,
      audits,
    });

    let createdCount = 0;
    for (const input of candidateInputs) {
      const created = await this.recordAlertIfNew(input, existingKeys);
      if (created) createdCount += 1;
    }
    return createdCount;
  }

  async listForRestaurant(
    restaurantId: string,
    opts?: { status?: string; runScan?: boolean },
  ) {
    if (opts?.runScan !== false) {
      await this.analyzeRestaurantAnomalies(restaurantId);
    }
    const rawAlerts = await this.alertRepo.find({
      where: { restaurantId },
      order: { createdAt: 'DESC' },
      take: 300,
    });
    const allAlerts = rawAlerts.filter((a) => a.status !== 'deleted');
    const filtered =
      opts?.status && opts.status !== 'all'
        ? allAlerts.filter((a) => a.status === opts.status)
        : allAlerts;

    return {
      alerts: filtered.map((a) => this.serializeAlert(a)),
      summary: this.computeSummary(allAlerts),
    };
  }

  async listForBranches(
    branchIds: string[],
    branchNameById: Map<string, string>,
  ) {
    if (branchIds.length === 0) {
      return { alerts: [], summary: this.computeSummary([]) };
    }
    await Promise.all(
      branchIds.map((id) =>
        this.analyzeRestaurantAnomalies(id).catch(() => 0),
      ),
    );
    const rawAlerts = await this.alertRepo.find({
      where: { restaurantId: In(branchIds) },
      order: { createdAt: 'DESC' },
      take: 400,
    });
    const allAlerts = rawAlerts.filter((a) => a.status !== 'deleted');
    return {
      alerts: allAlerts.map((a) => ({
        ...this.serializeAlert(a),
        branchName: branchNameById.get(a.restaurantId) ?? '',
      })),
      summary: this.computeSummary(allAlerts),
    };
  }

  async deleteAlerts(
    allowedRestaurantIds: string | string[],
    opts: { ids?: string[]; deleteAll?: boolean; onlyResolved?: boolean },
  ): Promise<{ ok: true; deletedCount: number }> {
    const restIds = Array.isArray(allowedRestaurantIds)
      ? allowedRestaurantIds
      : [allowedRestaurantIds];
    if (restIds.length === 0) return { ok: true, deletedCount: 0 };

    const rows = await this.alertRepo.find({
      where: {
        restaurantId: In(restIds),
        ...(opts.ids && opts.ids.length > 0 ? { id: In(opts.ids) } : {}),
      },
    });
    const targets = rows.filter((r) => {
      if (r.status === 'deleted') return false;
      if (opts.onlyResolved) {
        return r.status === 'resolved' || r.status === 'false_positive';
      }
      if (opts.deleteAll) return true;
      return Boolean(opts.ids && opts.ids.includes(r.id));
    });
    if (targets.length === 0) return { ok: true, deletedCount: 0 };
    for (const t of targets) {
      t.status = 'deleted';
    }
    await this.alertRepo.save(targets);
    return { ok: true, deletedCount: targets.length };
  }

  async updateStatus(
    id: string,
    allowedRestaurantIds: string | string[],
    dto: { status: FraudAlertStatus; resolutionNote?: string },
    actorName: string,
  ) {
    const ids = Array.isArray(allowedRestaurantIds)
      ? allowedRestaurantIds
      : [allowedRestaurantIds];
    const alert = await this.alertRepo.findOne({
      where: { id, restaurantId: In(ids) },
    });
    if (!alert) {
      throw new NotFoundException('Fraud alert not found');
    }

    alert.status = dto.status;
    if (dto.resolutionNote !== undefined) {
      alert.resolutionNote = dto.resolutionNote?.trim() || null;
    }
    if (dto.status === 'resolved' || dto.status === 'false_positive') {
      alert.resolvedBy = actorName.trim() || 'Manager';
      alert.resolvedAt = new Date();
    } else {
      alert.resolvedBy = null;
      alert.resolvedAt = null;
    }
    const saved = await this.alertRepo.save(alert);
    return this.serializeAlert(saved);
  }

  computeSummary(alerts: FraudAlertEntity[]) {
    let openCount = 0;
    let investigatingCount = 0;
    let resolvedCount = 0;
    let falsePositiveCount = 0;
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    let activeAmountMinor = 0;
    let maxRisk = 0;

    for (const a of alerts) {
      if (a.status === 'open') openCount += 1;
      else if (a.status === 'investigating') investigatingCount += 1;
      else if (a.status === 'resolved') resolvedCount += 1;
      else if (a.status === 'false_positive') falsePositiveCount += 1;

      if (a.status === 'open' || a.status === 'investigating') {
        if (a.severity === 'critical') criticalCount += 1;
        else if (a.severity === 'high') highCount += 1;
        else if (a.severity === 'medium') mediumCount += 1;
        else lowCount += 1;
        activeAmountMinor += toMinorUnits(a.amountImpact || 0);
        if (a.riskScore > maxRisk) maxRisk = a.riskScore;
      }
    }

    return {
      openCount,
      investigatingCount,
      resolvedCount,
      falsePositiveCount,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      totalAmountImpact: fromMinorUnits(activeAmountMinor),
      overallRiskScore: maxRisk,
    };
  }

  serializeAlert(a: FraudAlertEntity) {
    const impact = Number(a.amountImpact || 0);
    return {
      id: a.id,
      restaurantId: a.restaurantId,
      ruleCode: a.ruleCode,
      severity: a.severity,
      riskScore: a.riskScore,
      title: a.title,
      description: a.description,
      actorName: a.actorName,
      actorId: a.actorId,
      tableName: a.tableName,
      amountImpact: impact,
      status: a.status,
      resolutionNote: a.resolutionNote,
      resolvedBy: a.resolvedBy,
      resolvedAt: a.resolvedAt ? a.resolvedAt.toISOString() : null,
      evidence: a.evidence ?? {},
      createdAt: a.createdAt.toISOString(),
    };
  }
}
