import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FraudDetectionService } from '../application/fraud-detection.service';
import { FraudAlertStatus } from '../domain/fraud-alert.entity';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import {
  PanelRootGuard,
  RequirePermissions,
} from '../infrastructure/panel-root.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';

@Controller('restaurant/security/fraud-alerts')
@UseGuards(RestaurantJwtGuard, PanelRootGuard)
export class FraudAlertsController {
  constructor(private readonly fraudService: FraudDetectionService) {}

  @Get()
  @RequirePermissions(
    'security.view_fraud_alerts',
    'security.manage_fraud_alerts',
    'reports.view_audit_logs',
    'reports.view_financial',
  )
  list(
    @RestaurantId() restaurantId: string,
    @Query('status') status?: string,
  ) {
    return this.fraudService.listForRestaurant(restaurantId, {
      status,
      runScan: true,
    });
  }

  @Post('scan')
  @RequirePermissions(
    'security.view_fraud_alerts',
    'security.manage_fraud_alerts',
    'reports.view_audit_logs',
    'reports.view_financial',
  )
  async scan(@RestaurantId() restaurantId: string) {
    const newAlertsCount =
      await this.fraudService.analyzeRestaurantAnomalies(restaurantId);
    const result = await this.fraudService.listForRestaurant(restaurantId, {
      runScan: false,
    });
    return {
      ok: true,
      newAlertsCount,
      ...result,
    };
  }

  @Patch(':id')
  @RequirePermissions(
    'security.manage_fraud_alerts',
    'security.view_fraud_alerts',
    'reports.view_audit_logs',
  )
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { name?: string },
    @Body()
    body: {
      status: FraudAlertStatus;
      resolutionNote?: string;
    },
  ) {
    return this.fraudService.updateStatus(
      id,
      restaurantId,
      body,
      user?.name || 'Yönetici',
    );
  }

  @Delete(':id')
  @RequirePermissions(
    'security.manage_fraud_alerts',
    'security.view_fraud_alerts',
    'reports.view_audit_logs',
  )
  removeOne(
    @Param('id', ParseUUIDPipe) id: string,
    @RestaurantId() restaurantId: string,
  ) {
    return this.fraudService.deleteAlerts(restaurantId, { ids: [id] });
  }

  @Post('bulk-delete')
  @RequirePermissions(
    'security.manage_fraud_alerts',
    'security.view_fraud_alerts',
    'reports.view_audit_logs',
  )
  bulkDelete(
    @RestaurantId() restaurantId: string,
    @Body()
    body: {
      ids?: string[];
      deleteAll?: boolean;
      onlyResolved?: boolean;
    },
  ) {
    return this.fraudService.deleteAlerts(restaurantId, body || {});
  }
}
