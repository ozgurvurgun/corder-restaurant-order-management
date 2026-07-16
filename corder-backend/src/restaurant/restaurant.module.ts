import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RootAdminEntity } from '../platform/domain/root-admin.entity';
import { RestaurantEntity } from '../platform/domain/restaurant.entity';
import { TableEntity } from './domain/table.entity';
import { OrderEntity } from './domain/order.entity';
import { OrderItemEntity } from './domain/order-item.entity';
import { CategoryEntity } from './domain/category.entity';
import { ProductEntity } from './domain/product.entity';
import { RestaurantStaffEntity } from './domain/restaurant-staff.entity';
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
import { BackupRecordEntity } from './domain/backup-record.entity';
import { RestaurantAuthService } from './application/restaurant-auth.service';
import { CashShiftService } from './application/cash-shift.service';
import { CashTransactionsService } from './application/cash-transactions.service';
import { OpenAccountsService } from './application/open-accounts.service';
import { LedgerService } from './application/ledger.service';
import { StaffService } from './application/staff.service';
import { TableService } from './application/table.service';
import { OrderService } from './application/order.service';
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
import { BackupsService } from './application/backups.service';
import { RestaurantAuthController } from './api/restaurant-auth.controller';
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
import { StockController } from './api/stock.controller';
import { TechnicalController } from './api/technical.controller';
import { RestaurantSettingsController } from './api/restaurant-settings.controller';
import { OrdersGateway } from './api/orders.gateway';
import { PrintAgentController } from './api/print-agent.controller';
import { PrintAgentGuard } from './infrastructure/print-agent.guard';
import { PanelRootGuard } from './infrastructure/panel-root.guard';
import { RestaurantJwtStrategy } from './infrastructure/restaurant-jwt.strategy';
import { R2UploadService } from './infrastructure/r2-upload.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RootAdminEntity,
      RestaurantEntity,
      RestaurantStaffEntity,
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
      BackupRecordEntity,
    ]),
    PassportModule.register({ defaultStrategy: 'restaurant-jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '7d') },
      }),
    }),
  ],
  controllers: [
    RestaurantAuthController,
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
    StockController,
    TechnicalController,
    RestaurantSettingsController,
    PrintAgentController,
  ],
  providers: [
    RestaurantAuthService,
    StaffService,
    TableService,
    OrderService,
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
    BackupsService,
    R2UploadService,
    PrintAgentGuard,
    PanelRootGuard,
  ],
  exports: [RestaurantAuthService, TableService, OrderService, CategoryService, ProductService, CashShiftService],
})
export class RestaurantModule {}
