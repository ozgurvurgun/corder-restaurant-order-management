import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BossOverviewService } from '../application/boss-overview.service';
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
  constructor(private readonly bossOverview: BossOverviewService) {}

  @Get('overview')
  getOverview(
    @RestaurantUser() user: { sub: string; role?: string; isBoss?: boolean },
    @Query('branchId') branchId?: string,
  ) {
    if (!user.isBoss && user.role !== 'root') {
      throw new ForbiddenException('Only Boss accounts can access the multi-branch overview');
    }
    return this.bossOverview.getOverview(user.sub, branchId);
  }

  @Get('sub-bosses')
  listSubBosses(
    @RestaurantUser() user: { sub: string; role?: string; isBoss?: boolean },
  ) {
    if (!user.isBoss && user.role !== 'root') {
      throw new ForbiddenException('Only Boss accounts can view branch bosses');
    }
    return this.bossOverview.listBranchBosses(user.sub);
  }

  @Post('sub-bosses')
  createOrAssignSubBoss(
    @RestaurantUser() user: { sub: string; role?: string; isBoss?: boolean },
    @Body() body: CreateSubBossDto,
  ) {
    if (!user.isBoss && user.role !== 'root') {
      throw new ForbiddenException('Only Boss accounts can assign branch bosses');
    }
    return this.bossOverview.createOrAssignBranchBoss(user.sub, body);
  }

  @Delete('sub-bosses/:subBossId/branch/:branchId')
  unlinkSubBoss(
    @RestaurantUser() user: { sub: string; role?: string; isBoss?: boolean },
    @Param('subBossId', ParseUUIDPipe) subBossId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ) {
    if (!user.isBoss && user.role !== 'root') {
      throw new ForbiddenException('Only Boss accounts can unlink branch bosses');
    }
    return this.bossOverview.unlinkBranchBoss(user.sub, subBossId, branchId);
  }

  @Post('sync-roles')
  syncRoles(
    @RestaurantUser() user: { sub: string; role?: string; isBoss?: boolean },
    @RestaurantId() currentRestaurantId: string,
    @Body() body?: SyncRolesDto,
  ) {
    if (!user.isBoss && user.role !== 'root') {
      throw new ForbiddenException('Only Boss accounts can synchronize roles across branches');
    }
    return this.bossOverview.syncRolesAcrossBranches(
      user.sub,
      body?.sourceRestaurantId || currentRestaurantId,
      body?.targetRestaurantIds,
    );
  }
}
