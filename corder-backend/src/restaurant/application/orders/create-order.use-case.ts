import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OrderEntity } from '../../domain/order.entity';
import { OrderItemEntity } from '../../domain/order-item.entity';
import { TableEntity } from '../../domain/table.entity';
import { RestaurantStaffEntity } from '../../domain/restaurant-staff.entity';
import { ProductEntity } from '../../domain/product.entity';
import { CreateOrderDto } from '../../api/dto/create-order.dto';
import { OrdersGateway } from '../../api/orders.gateway';
import { CashShiftService } from '../cash-shift.service';
import { TableService } from '../table.service';
import { OrderQueryService } from './order-query.service';
import { fromMinorUnits, toMinorUnits } from '../../../common/money/minor-units';
import { normalizeStorageText } from '../../../common/text/text-normalizer';

@Injectable()
export class CreateOrderUseCase {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(TableEntity)
    private readonly tableRepo: Repository<TableEntity>,
    @InjectRepository(RestaurantStaffEntity)
    private readonly staffRepo: Repository<RestaurantStaffEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    private readonly ordersGateway: OrdersGateway,
    private readonly cashShiftService: CashShiftService,
    private readonly tableService: TableService,
    private readonly orderQuery: OrderQueryService,
  ) {}

  private async resolveRestaurantProducts(
    restaurantId: string,
    productIds: string[],
  ): Promise<Map<string, ProductEntity>> {
    const uniqueIds = [...new Set(productIds)];
    const products = await this.productRepo.find({
      where: { id: In(uniqueIds) },
      relations: ['category'],
    });
    const productById = new Map<string, ProductEntity>();
    for (const product of products) {
      if (product.category?.restaurantId === restaurantId) {
        productById.set(product.id, product);
      }
    }
    for (const id of uniqueIds) {
      const prod = productById.get(id);
      if (!prod) {
        throw new BadRequestException('Product not found or does not belong to this restaurant');
      }
      if (prod.inStock === false) {
        throw new BadRequestException(`Product "${prod.name}" is out of stock`);
      }
      if (toMinorUnits(prod.price) < 0) {
        throw new BadRequestException(`Invalid price for product "${prod.name}"`);
      }
    }
    return productById;
  }

  async execute(
    restaurantId: string,
    dto: CreateOrderDto,
    actor?: { actorId?: string | null; staffId?: string | null; displayName?: string | null },
  ): Promise<Record<string, unknown>> {
    if (!dto.items?.length) {
      throw new BadRequestException('Order must contain at least one item');
    }
    const table = await this.tableRepo.findOne({
      where: { id: dto.tableId, restaurantId },
    });
    if (!table) throw new NotFoundException('Table not found');
    const staffId = actor?.staffId ?? null;
    this.tableService.assertStaffMayUseTable(table, staffId);
    await this.cashShiftService.requireCurrent(restaurantId);

    const productById = await this.resolveRestaurantProducts(
      restaurantId,
      dto.items.map((i) => i.productId),
    );
    const waiter = staffId
      ? await this.staffRepo.findOne({ where: { id: staffId, restaurantId } })
      : null;

    const { savedId, tableName } = await this.orderRepo.manager.transaction(async (em) => {
      const lockedTable = await em.findOne(TableEntity, {
        where: { id: dto.tableId, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedTable) throw new NotFoundException('Table not found');
      this.tableService.assertStaffMayUseTable(lockedTable, staffId);

      const txOrderRepo = em.getRepository(OrderEntity);
      const txItemRepo = em.getRepository(OrderItemEntity);
      const rawName = waiter?.name?.trim() || actor?.displayName?.trim() || '';
      const order = txOrderRepo.create({
        restaurantId,
        tableId: dto.tableId,
        userId: waiter ? waiter.id : (actor?.actorId ?? null),
        userDisplayName: rawName ? normalizeStorageText(rawName) : null,
        status: 'active',
      });
      const saved = await txOrderRepo.save(order);
      const items = dto.items.map((itemDto) => {
        const product = productById.get(itemDto.productId)!;
        return txItemRepo.create({
          orderId: saved.id,
          productId: product.id,
          productName: product.name,
          price: fromMinorUnits(toMinorUnits(product.price)),
          quantity: itemDto.quantity,
          note: itemDto.note?.trim() || undefined,
          status: 'sent',
        });
      });
      await txItemRepo.save(items);
      if (lockedTable.status === 'empty') {
        lockedTable.status = 'occupied';
        await em.save(TableEntity, lockedTable);
      }
      return { savedId: saved.id, tableName: lockedTable.name ?? null };
    });

    const serialized = await this.orderQuery.serializeOrderEntityById(savedId, restaurantId);
    const payload: Record<string, unknown> = {
      ...serialized,
      restaurantId,
      tableName,
      waiterName: (serialized.userName as string | null) ?? null,
    };
    const payloadItems = payload.items as
      | Array<{ productId?: string } & Record<string, unknown>>
      | undefined;
    if (payloadItems?.length) {
      for (const item of payloadItems) {
        const pid = item.productId;
        const prod = pid ? productById.get(pid) : undefined;
        if (prod) {
          item.categoryId = prod.categoryId;
        }
      }
    }
    this.ordersGateway.emitOrderCreated(restaurantId, payload);
    this.ordersGateway.emitOrdersUpdated(restaurantId);
    return serialized;
  }
}
