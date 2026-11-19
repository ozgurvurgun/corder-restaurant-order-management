import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BossOverviewService } from '../application/boss-overview.service';
import { BossHierarchyService } from '../application/boss-hierarchy.service';
import { FraudDetectionService } from '../application/fraud-detection.service';
import { FraudAlertStatus } from '../domain/fraud-alert.entity';
import { SyncRolesDto } from './dto/sync-roles.dto';
import { CreateSubBossDto } from './dto/create-sub-boss.dto';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { BossOnly, PanelRootGuard } from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';

@Controller('restaurant/boss')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
@BossOnly()
export class BossController {
  constructor(
    private readonly bossOverview: BossOverviewService,
    private readonly bossHierarchy: BossHierarchyService,
    private readonly fraudService: FraudDetectionService,
  ) {}

  private assertBossActor(user: { role?: string; isBoss?: boolean }, message: string): void {
    if (!user.isBoss && user.role !== 'root') {
      throw new ForbiddenException(message);
    }
  }

  @Get('overview')
  getOverview(
    @RestaurantUser() user: { sub: string; role?: string; isBoss?: boolean },
    @Query('branchId') branchId?: string,
  ) {
    this.assertBossActor(user, 'Only Boss accounts can access the multi-branch overview');
    return this.bossOverview.getOverview(user.sub, branchId);
  }

  @Get('sub-bosses')
  listSubBosses(
    @RestaurantUser() user: { sub: string; role?: string; isBoss?: boolean },
  ) {
    this.assertBossActor(user, 'Only Boss accounts can view branch bosses');
    return this.bossHierarchy.listBranchBosses(user.sub);
  }

  @Post('sub-bosses')
  createOrAssignSubBoss(
    @RestaurantUser() user: { sub: string; role?: string; isBoss?: boolean },
    @Body() body: CreateSubBossDto,
  ) {
    this.assertBossActor(user, 'Only Boss accounts can assign branch bosses');
    return this.bossHierarchy.createOrAssignBranchBoss(user.sub, body);
  }

  @Delete('sub-bosses/:subBossId/branch/:branchId')
  unlinkSubBoss(
    @RestaurantUser() user: { sub: string; role?: string; isBoss?: boolean },
    @Param('subBossId', ParseUUIDPipe) subBossId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ) {
    this.assertBossActor(user, 'Only Boss accounts can unlink branch bosses');
    return this.bossHierarchy.unlinkBranchBoss(user.sub, subBossId, branchId);
  }

  @Post('sync-roles')
  syncRoles(
    @RestaurantUser() user: { sub: string; role?: string; isBoss?: boolean },
    @RestaurantId() currentRestaurantId: string,
    @Body() body?: SyncRolesDto,
  ) {
    this.assertBossActor(user, 'Only Boss accounts can synchronize roles across branches');
    return this.bossHierarchy.syncRolesAcrossBranches(
      user.sub,
      body?.sourceRestaurantId || currentRestaurantId,
      body?.targetRestaurantIds,
    );
  }

  @Get('fraud-alerts')
  async listFraudAlerts(
    @RestaurantUser() user: { sub: string; role?: string; isBoss?: boolean },
    @Query('branchId') branchId?: string,
  ) {
    this.assertBossActor(user, 'Only Boss accounts can access multi-branch fraud alerts');
    const ownedBranches = await this.bossHierarchy.loadBossOwnedBranches(user.sub);
    const targetBranches =
      branchId && branchId !== 'ALL'
        ? ownedBranches.filter((b) => b.id === branchId)
        : ownedBranches;
    const branchNameById = new Map(ownedBranches.map((b) => [b.id, b.name]));
    return this.fraudService.listForBranches(
      targetBranches.map((b) => b.id),
      branchNameById,
    );
  }

  @Patch('fraud-alerts/:id')
  async updateFraudAlert(
    @RestaurantUser()
    user: { sub: string; name?: string; role?: string; isBoss?: boolean },
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      status: FraudAlertStatus;
      resolutionNote?: string;
    },
  ) {
    this.assertBossActor(user, 'Only Boss accounts can update multi-branch fraud alerts');
    const ownedBranches = await this.bossHierarchy.loadBossOwnedBranches(user.sub);
    return this.fraudService.updateStatus(
      id,
      ownedBranches.map((b) => b.id),
      body,
      user.name || 'Boss',
    );
  }

  @Delete('fraud-alerts/:id')
  async deleteFraudAlert(
    @RestaurantUser()
    user: { sub: string; role?: string; isBoss?: boolean },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.assertBossActor(user, 'Only Boss accounts can delete fraud alerts');
    const ownedBranches = await this.bossHierarchy.loadBossOwnedBranches(user.sub);
    return this.fraudService.deleteAlerts(
      ownedBranches.map((b) => b.id),
      { ids: [id] },
    );
  }

  @Post('fraud-alerts/bulk-delete')
  async bulkDeleteFraudAlerts(
    @RestaurantUser()
    user: { sub: string; role?: string; isBoss?: boolean },
    @Body()
    body: {
      ids?: string[];
      deleteAll?: boolean;
      onlyResolved?: boolean;
      branchId?: string;
    },
  ) {
    this.assertBossActor(user, 'Only Boss accounts can bulk-delete fraud alerts');
    const ownedBranches = await this.bossHierarchy.loadBossOwnedBranches(user.sub);
    const targetBranches =
      body?.branchId && body.branchId !== 'ALL'
        ? ownedBranches.filter((b) => b.id === body.branchId)
        : ownedBranches;
    return this.fraudService.deleteAlerts(
      targetBranches.map((b) => b.id),
      body || {},
    );
  }
}
