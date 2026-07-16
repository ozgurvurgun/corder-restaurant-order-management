import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';
import { StockMaterialsService } from '../application/stock-materials.service';
import { SuppliersService } from '../application/suppliers.service';
import { StockMovementsService } from '../application/stock-movements.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { PurchaseOrdersService } from '../application/purchase-orders.service';
import { InventoryCountsService } from '../application/inventory-counts.service';

@Controller('restaurant')
@UseGuards(RestaurantJwtGuard)
export class StockController {
  constructor(
    private readonly materials: StockMaterialsService,
    private readonly suppliers: SuppliersService,
    private readonly movements: StockMovementsService,
    private readonly purchaseOrders: PurchaseOrdersService,
    private readonly inventoryCounts: InventoryCountsService,
  ) {}

  // ---- Materials ----

  @Get('stock/materials')
  listMaterials(@RestaurantId() restaurantId: string) {
    return this.materials.list(restaurantId);
  }

  @Post('stock/materials')
  createMaterial(
    @RestaurantId() restaurantId: string,
    @Body()
    body: {
      name: string;
      unit: string;
      currentStock?: number;
      minStock?: number;
      costPerUnit: number;
      supplierId?: string;
      category?: string;
    },
  ) {
    return this.materials.create(restaurantId, body);
  }

  @Patch('stock/materials/:id')
  updateMaterial(
    @RestaurantId() restaurantId: string,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      unit?: string;
      currentStock?: number;
      minStock?: number;
      costPerUnit?: number;
      supplierId?: string | null;
      category?: string;
    },
  ) {
    return this.materials.update(restaurantId, id, body);
  }

  @Delete('stock/materials/:id')
  deleteMaterial(@RestaurantId() restaurantId: string, @Param('id') id: string) {
    return this.materials.remove(restaurantId, id);
  }

  // ---- Suppliers ----

  @Get('suppliers')
  listSuppliers(@RestaurantId() restaurantId: string) {
    return this.suppliers.list(restaurantId);
  }

  @Post('suppliers')
  createSupplier(@RestaurantId() restaurantId: string, @Body() body: CreateSupplierDto) {
    return this.suppliers.create(restaurantId, body);
  }

  @Patch('suppliers/:id')
  updateSupplier(
    @RestaurantId() restaurantId: string,
    @Param('id') id: string,
    @Body() body: UpdateSupplierDto,
  ) {
    return this.suppliers.update(restaurantId, id, body);
  }

  @Delete('suppliers/:id')
  deleteSupplier(@RestaurantId() restaurantId: string, @Param('id') id: string) {
    return this.suppliers.remove(restaurantId, id);
  }

  // ---- Movements ----

  @Get('stock/movements')
  listMovements(
    @RestaurantId() restaurantId: string,
    @Query('limit') limit?: string,
  ) {
    const take = limit ? Number(limit) : 200;
    return this.movements.list(restaurantId, take);
  }

  @Post('stock/movements')
  createMovement(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { name: string },
    @Body()
    body: {
      materialId: string;
      materialName?: string;
      type: 'in' | 'out' | 'waste' | 'count-adjustment';
      quantity: number;
      unitCost?: number;
      totalCost?: number;
      supplierId?: string;
      reason?: string;
      createdBy?: string;
    },
  ) {
    return this.movements.create(restaurantId, {
      ...body,
      createdBy: body.createdBy ?? user.name,
    });
  }

  // ---- Purchase Orders ----

  @Get('purchase-orders')
  listPurchaseOrders(@RestaurantId() restaurantId: string) {
    return this.purchaseOrders.list(restaurantId);
  }

  @Post('purchase-orders')
  createPurchaseOrder(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { name: string },
    @Body()
    body: {
      supplierId: string;
      supplierName: string;
      items: {
        materialId: string;
        materialName: string;
        quantity: number;
        unitCost: number;
      }[];
      notes?: string;
      status?: 'draft' | 'ordered';
    },
  ) {
    return this.purchaseOrders.create(restaurantId, {
      ...body,
      createdBy: user.name,
    });
  }

  @Post('purchase-orders/:id/receive')
  receivePurchaseOrder(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { name: string },
    @Param('id') id: string,
  ) {
    return this.purchaseOrders.markReceived(restaurantId, id, user.name);
  }

  // ---- Inventory Counts ----

  @Get('inventory-counts')
  listInventoryCounts(@RestaurantId() restaurantId: string) {
    return this.inventoryCounts.list(restaurantId);
  }

  @Post('inventory-counts')
  startInventoryCount(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { name: string },
  ) {
    return this.inventoryCounts.start(restaurantId, user.name);
  }

  @Post('inventory-counts/:id/items')
  updateInventoryItem(
    @RestaurantId() restaurantId: string,
    @Param('id') id: string,
    @Body() body: { materialId: string; actual: number },
  ) {
    return this.inventoryCounts.updateItem(
      restaurantId,
      id,
      body.materialId,
      body.actual,
    );
  }

  @Post('inventory-counts/:id/complete')
  completeInventoryCount(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { name: string },
    @Param('id') id: string,
  ) {
    return this.inventoryCounts.complete(restaurantId, id, user.name);
  }
}

