import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductEntity } from '../domain/product.entity';
import { CategoryEntity } from '../domain/category.entity';
import { CreateProductDto } from '../api/dto/create-product.dto';
import { UpdateProductDto } from '../api/dto/update-product.dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly repo: Repository<ProductEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categoryRepo: Repository<CategoryEntity>,
  ) {}

  async findByRestaurant(restaurantId: string): Promise<ProductEntity[]> {
    return this.repo
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.category', 'c')
      .where('c.restaurant_id = :restaurantId', { restaurantId })
      .orderBy('c.order', 'ASC')
      .addOrderBy('p.order', 'ASC')
      .addOrderBy('p.name', 'ASC')
      .getMany();
  }

  async findOne(id: string, restaurantId: string): Promise<ProductEntity> {
    const p = await this.repo
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.category', 'c')
      .where('p.id = :id', { id })
      .andWhere('c.restaurant_id = :restaurantId', { restaurantId })
      .getOne();
    if (!p) throw new NotFoundException('Product not found');
    return p;
  }

  private normalizeIngredients(
    raw: { materialId: string; quantity: number }[] | null | undefined,
  ): { materialId: string; quantity: number }[] | null {
    if (raw == null) return null;
    const out: { materialId: string; quantity: number }[] = [];
    for (const row of raw) {
      if (!row?.materialId) continue;
      const q = Number(row.quantity);
      if (!Number.isFinite(q) || q <= 0) continue;
      out.push({ materialId: String(row.materialId).trim(), quantity: q });
    }
    return out.length ? out : null;
  }

  async create(restaurantId: string, dto: CreateProductDto): Promise<ProductEntity> {
    const cat = await this.categoryRepo.findOne({ where: { id: dto.categoryId, restaurantId } });
    if (!cat) throw new NotFoundException('Category not found');
    const entity = new ProductEntity();
    entity.categoryId = dto.categoryId;
    entity.name = dto.name.trim();
    entity.description = dto.description?.trim() ?? null;
    entity.price = dto.price;
    entity.imageUrl = dto.imageUrl ?? null;
    entity.inStock = dto.inStock ?? true;
    entity.order = dto.order ?? 0;
    entity.ingredients = this.normalizeIngredients(dto.ingredients ?? null);
    const saved = await this.repo.save(entity);
    return this.findOne(saved.id, restaurantId);
  }

  async update(id: string, restaurantId: string, dto: UpdateProductDto): Promise<ProductEntity> {
    const entity = await this.findOne(id, restaurantId);
    if (dto.name !== undefined) entity.name = dto.name.trim();
    if (dto.description !== undefined) entity.description = dto.description?.trim() ?? null;
    if (dto.price !== undefined) entity.price = dto.price;
    if (dto.imageUrl !== undefined) entity.imageUrl = dto.imageUrl;
    if (dto.inStock !== undefined) entity.inStock = dto.inStock;
    if (dto.order !== undefined) entity.order = dto.order;
    if (dto.ingredients !== undefined) {
      entity.ingredients = this.normalizeIngredients(dto.ingredients);
    }
    await this.repo.save(entity);
    return this.findOne(id, restaurantId);
  }

  async remove(id: string, restaurantId: string): Promise<void> {
    const entity = await this.findOne(id, restaurantId);
    await this.repo.remove(entity);
  }

  async reorder(restaurantId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    // Ensure products belong to this restaurant via category join
    const products = await this.repo
      .createQueryBuilder('p')
      .innerJoin('p.category', 'c')
      .where('c.restaurant_id = :restaurantId', { restaurantId })
      .andWhere('p.id IN (:...ids)', { ids })
      .getMany();
    const existingIds = new Set(products.map((p) => p.id));
    const orderedIds = ids.filter((id) => existingIds.has(id));
    await Promise.all(
      orderedIds.map((id, index) =>
        this.repo.update({ id }, { order: index + 1 }),
      ),
    );
  }
}
