import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RootAdminEntity } from '../platform/domain/root-admin.entity';
import { BossRestaurantEntity } from '../platform/domain/boss-restaurant.entity';
import { RestaurantEntity } from '../platform/domain/restaurant.entity';
import { PlatformBillingConfigEntity } from '../platform/domain/platform-billing-config.entity';
import { RestaurantSubscriptionPaymentEntity } from '../platform/domain/restaurant-subscription-payment.entity';
import { PlatformNotificationEntity } from '../platform/domain/platform-notification.entity';
import { TableEntity } from './domain/table.entity';
import { OrderEntity } from './domain/order.entity';
import { OrderItemEntity } from './domain/order-item.entity';
import { CategoryEntity } from './domain/category.entity';
import { ProductEntity } from './domain/product.entity';
import { RestaurantStaffEntity } from './domain/restaurant-staff.entity';
import { RestaurantRoleEntity } from './domain/restaurant-role.entity';
import { CashShiftEntity } from './domain/cash-shift.entity';
import { CashTransactionEntity } from './domain/cash-transaction.entity';
import { OpenAccountEntity } from './domain/open-account.entity';
import { OpenAccountItemEntity } from './domain/open-account-item.entity';
import { OpenAccountPaymentEntity } from './domain/open-account-payment.entity';
import { LedgerCustomerEntity } from './domain/ledger-customer.entity';
import { LedgerEntryEntity } from './domain/ledger-entry.entity';
import { CompletedOrderEntity } from './domain/completed-order.entity';
import { CampaignEntity } from './domain/campaign.entity';
import { StockMaterialEntity } from './domain/stock-material.entity';
import { SupplierEntity } from './domain/supplier.entity';
import { StockMovementEntity } from './domain/stock-movement.entity';
import { PurchaseOrderEntity } from './domain/purchase-order.entity';
import { InventoryCountEntity } from './domain/inventory-count.entity';
import { PrinterConfigEntity } from './domain/printer-config.entity';
import { AuditLogEntity } from './domain/audit-log.entity';
import { PrintJobEntity } from './domain/print-job.entity';
import { FraudAlertEntity } from './domain/fraud-alert.entity';
import { WaiterCallEntity } from './domain/waiter-call.entity';
import { RestaurantAuthService } from './application/restaurant-auth.service';
import { RestaurantSessionValidatorService } from './application/restaurant-session-validator.service';
import { RolesService } from './application/roles.service';
import { BossOverviewService } from './application/boss-overview.service';
import { BossHierarchyService } from './application/boss-hierarchy.service';
import { FraudDetectionService } from './application/fraud-detection.service';
import { CashShiftService } from './application/cash-shift.service';
import { CashTransactionsService } from './application/cash-transactions.service';
import { OpenAccountsService } from './application/open-accounts.service';
import { LedgerService } from './application/ledger.service';
import { StaffService } from './application/staff.service';
import { StaffSessionService } from './application/staff-session.service';
import { TableService } from './application/table.service';
import { OrderService } from './application/order.service';
import { OrderQueryService } from './application/orders/order-query.service';
import { CreateOrderUseCase } from './application/orders/create-order.use-case';
import { TransferOrderUseCase } from './application/orders/transfer-order.use-case';
import { CancelOrderItemUseCase } from './application/orders/cancel-order-item.use-case';
import { OrderLedgerUseCase } from './application/orders/order-ledger.use-case';
import { CloseCheckUseCase } from './application/orders/close-check.use-case';
import { PrintReceiptUseCase } from './application/orders/print-receipt.use-case';
import { CategoryService } from './application/category.service';
import { ProductService } from './application/product.service';
import { CompletedOrdersService } from './application/completed-orders.service';
import { CampaignService } from './application/campaign.service';
import { StockMaterialsService } from './application/stock-materials.service';
import { SuppliersService } from './application/suppliers.service';
import { StockMovementsService } from './application/stock-movements.service';
import { PurchaseOrdersService } from './application/purchase-orders.service';
import { InventoryCountsService } from './application/inventory-counts.service';
import { RestaurantSettingsService } from './application/restaurant-settings.service';
import { PrintersService } from './application/printers.service';
import { AuditLogsService } from './application/audit-logs.service';
import { RestaurantAuthController } from './api/restaurant-auth.controller';
import { RolesController } from './api/roles.controller';
import { BossController } from './api/boss.controller';
import { TablesController } from './api/tables.controller';
import { OrdersController } from './api/orders.controller';
import { CategoriesController } from './api/categories.controller';
import { ProductsController } from './api/products.controller';
import { UploadController } from './api/upload.controller';
import { StaffController } from './api/staff.controller';
import { ShiftsController } from './api/shifts.controller';
import { CompletedOrdersController } from './api/completed-orders.controller';
import { CashTransactionsController } from './api/cash-transactions.controller';
import { OpenAccountsController } from './api/open-accounts.controller';
import { LedgerController } from './api/ledger.controller';
import { CampaignsController } from './api/campaigns.controller';
import { StockMaterialsController } from './api/stock-materials.controller';
import { StockMovementsController } from './api/stock-movements.controller';
import { SuppliersController } from './api/suppliers.controller';
import { PurchaseOrdersController } from './api/purchase-orders.controller';
import { InventoryCountsController } from './api/inventory-counts.controller';
import { PrintersController } from './api/printers.controller';
import { AuditLogsController } from './api/audit-logs.controller';
import { RestaurantSettingsController } from './api/restaurant-settings.controller';
import { RestaurantMenuController } from './api/restaurant-menu.controller';
import { OrdersGateway } from './api/orders.gateway';
import { PrintAgentController } from './api/print-agent.controller';
import { FraudAlertsController } from './api/fraud-alerts.controller';
import { NotificationsController } from './api/notifications.controller';
import { MenuModule } from '../menu/menu.module';
import { PrintAgentGuard } from './infrastructure/print-agent.guard';
import { PanelRootGuard } from './infrastructure/panel-root.guard';
import { RestaurantJwtStrategy } from './infrastructure/restaurant-jwt.strategy';
import { R2UploadService } from './infrastructure/r2-upload.service';
import {
  DEFAULT_JWT_EXPIRES_IN,
  requireConfigSecret,
} from '../common/security/env.validation';
import { ActorNameSyncService } from '../common/text/actor-name-sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RootAdminEntity,
      BossRestaurantEntity,
      RestaurantEntity,
      PlatformBillingConfigEntity,
      RestaurantSubscriptionPaymentEntity,
      PlatformNotificationEntity,
      RestaurantStaffEntity,
      RestaurantRoleEntity,
      TableEntity,
      OrderEntity,
      OrderItemEntity,
      CategoryEntity,
      ProductEntity,
      CashShiftEntity,
      CashTransactionEntity,
      OpenAccountEntity,
      OpenAccountItemEntity,
      OpenAccountPaymentEntity,
      LedgerCustomerEntity,
      LedgerEntryEntity,
      CompletedOrderEntity,
      CampaignEntity,
      StockMaterialEntity,
      SupplierEntity,
      StockMovementEntity,
      PurchaseOrderEntity,
      InventoryCountEntity,
      PrinterConfigEntity,
      AuditLogEntity,
      PrintJobEntity,
      FraudAlertEntity,
      WaiterCallEntity,
    ]),
    forwardRef(() => MenuModule),
    PassportModule.register({ defaultStrategy: 'restaurant-jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: requireConfigSecret(config, 'JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', DEFAULT_JWT_EXPIRES_IN) },
      }),
    }),
  ],
  controllers: [
    RestaurantAuthController,
    RolesController,
    BossController,
    TablesController,
    OrdersController,
    CategoriesController,
    ProductsController,
    UploadController,
    StaffController,
    ShiftsController,
    CompletedOrdersController,
    CashTransactionsController,
    OpenAccountsController,
    LedgerController,
    CampaignsController,
    StockMaterialsController,
    StockMovementsController,
    SuppliersController,
    PurchaseOrdersController,
    InventoryCountsController,
    PrintersController,
    AuditLogsController,
    RestaurantSettingsController,
    RestaurantMenuController,
    PrintAgentController,
    FraudAlertsController,
    NotificationsController,
  ],
  providers: [
    RestaurantAuthService,
    RestaurantSessionValidatorService,
    RolesService,
    BossHierarchyService,
    BossOverviewService,
    FraudDetectionService,
    StaffService,
    StaffSessionService,
    TableService,
    OrderService,
    OrderQueryService,
    CreateOrderUseCase,
    TransferOrderUseCase,
    CancelOrderItemUseCase,
    OrderLedgerUseCase,
    CloseCheckUseCase,
    PrintReceiptUseCase,
    CategoryService,
    ProductService,
    CashShiftService,
    CashTransactionsService,
    OpenAccountsService,
    LedgerService,
    CampaignService,
    CompletedOrdersService,
    RestaurantJwtStrategy,
    OrdersGateway,
    StockMaterialsService,
    SuppliersService,
    StockMovementsService,
    PurchaseOrdersService,
    InventoryCountsService,
    RestaurantSettingsService,
    PrintersService,
    AuditLogsService,
    R2UploadService,
    ActorNameSyncService,
    PrintAgentGuard,
    PanelRootGuard,
  ],
  exports: [
    RestaurantAuthService,
    RolesService,
    TableService,
    OrderService,
    CategoryService,
    ProductService,
    CashShiftService,
    FraudDetectionService,
    PrintersService,
    OrdersGateway,
    ActorNameSyncService,
  ],
})
export class RestaurantModule {}
