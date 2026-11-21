import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ProductEntity } from '../domain/product.entity';
import { CategoryEntity } from '../domain/category.entity';
import { StockMaterialEntity } from '../domain/stock-material.entity';
import { RecipeStockPolicy } from '../domain/services/recipe-stock.policy';
import { CreateProductDto } from '../api/dto/create-product.dto';
import { UpdateProductDto } from '../api/dto/update-product.dto';
import { ProductIngredientInputDto } from '../api/dto/product-ingredient-input.dto';
import { normalizeStorageText } from '../../common/text/text-normalizer';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly repo: Repository<ProductEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categoryRepo: Repository<CategoryEntity>,
    @InjectRepository(StockMaterialEntity)
    private readonly materialRepo: Repository<StockMaterialEntity>,
    private readonly dataSource: DataSource,
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

  private async normalizeIngredients(
    restaurantId: string,
    raw: ProductIngredientInputDto[] | null | undefined,
  ): Promise<{ materialId: string; quantity: number; unit?: string }[] | null> {
    if (raw == null || raw.length === 0) return null;
    const candidateRows: { materialId: string; quantity: number; unit?: string }[] = [];
    for (const row of raw) {
      const materialId = typeof row?.materialId === 'string' ? row.materialId.trim() : '';
      if (!materialId) continue;
      const q = Number(row.quantity);
      if (!Number.isFinite(q) || q <= 0) continue;
      const unit = row.unit?.trim() || undefined;
      candidateRows.push({ materialId, quantity: q, ...(unit ? { unit } : {}) });
    }
    if (!candidateRows.length) return null;

    const uniqueMaterialIds = [...new Set(candidateRows.map((r) => r.materialId))];
    const materials = await this.materialRepo.find({
      where: { id: In(uniqueMaterialIds), restaurantId },
    });
    if (materials.length !== uniqueMaterialIds.length) {
      throw new BadRequestException(
        'One or more recipe materials do not exist or do not belong to this restaurant.',
      );
    }
    const materialById = new Map(materials.map((m) => [m.id, m]));

    const mergedByMaterial = new Map<
      string,
      { materialId: string; quantity: number; unit?: string }
    >();
    for (const row of candidateRows) {
      const mat = materialById.get(row.materialId)!;
      RecipeStockPolicy.assertUnitsCompatible(row.unit, mat.unit, mat.name);

      const existing = mergedByMaterial.get(row.materialId);
      if (existing) {
        const targetUnit = existing.unit ?? mat.unit;
        const converted = RecipeStockPolicy.convertQuantity(
          row.quantity,
          row.unit ?? mat.unit,
          targetUnit,
        );
        existing.quantity = Number((existing.quantity + converted).toFixed(4));
      } else {
        const qty = Number(row.quantity.toFixed(4));
        if (qty > 0) {
          mergedByMaterial.set(row.materialId, {
            materialId: row.materialId,
            quantity: qty,
            ...(row.unit ? { unit: row.unit } : {}),
          });
        }
      }
    }

    const out = [...mergedByMaterial.values()].filter((r) => r.quantity > 0);
    return out.length ? out : null;
  }

  private normalizeCalories(raw: number | null | undefined): number | null {
    if (raw == null) return null;
    const num = Math.round(Number(raw));
    return Number.isFinite(num) && num > 0 ? num : null;
  }

  private normalizeAllergens(raw: string[] | null | undefined): string[] | null {
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const unique = [
      ...new Set(
        raw
          .map((item) => (typeof item === 'string' ? normalizeStorageText(item) : ''))
          .filter(Boolean),
      ),
    ];
    return unique.length > 0 ? unique : null;
  }

  private async nextOrderInCategory(categoryId: string): Promise<number> {
    const row = await this.repo
      .createQueryBuilder('p')
      .where('p.category_id = :categoryId', { categoryId })
      .select('MAX(p.order)', 'max')
      .getRawOne<{ max: string | number | null }>();
    return Number(row?.max ?? 0) + 1;
  }

  async create(restaurantId: string, dto: CreateProductDto): Promise<ProductEntity> {
    const cat = await this.categoryRepo.findOne({
      where: { id: dto.categoryId, restaurantId },
    });
    if (!cat) throw new NotFoundException('Category not found');
    const name = normalizeStorageText(dto.name);
    if (!name) throw new BadRequestException('Product name cannot be empty');

    const entity = new ProductEntity();
    entity.categoryId = dto.categoryId;
    entity.name = name;
    entity.description = dto.description?.trim() || null;
    entity.price = Number(Number(dto.price).toFixed(2));
    entity.costPrice =
      dto.costPrice != null ? Number(Number(dto.costPrice).toFixed(2)) : null;
    entity.imageUrl = dto.imageUrl?.trim() || null;
    entity.inStock = dto.inStock ?? true;
    entity.showInMenu = dto.showInMenu ?? true;
    entity.order = dto.order ?? (await this.nextOrderInCategory(dto.categoryId));
    entity.ingredients = await this.normalizeIngredients(
      restaurantId,
      dto.ingredients ?? null,
    );
    entity.calories = this.normalizeCalories(dto.calories);
    entity.allergens = this.normalizeAllergens(dto.allergens);
    const saved = await this.repo.save(entity);
    return this.findOne(saved.id, restaurantId);
  }

  async update(
    id: string,
    restaurantId: string,
    dto: UpdateProductDto,
  ): Promise<ProductEntity> {
    const entity = await this.findOne(id, restaurantId);
    if (dto.categoryId !== undefined && dto.categoryId !== entity.categoryId) {
      const cat = await this.categoryRepo.findOne({
        where: { id: dto.categoryId, restaurantId },
      });
      if (!cat) throw new NotFoundException('Category not found');
      entity.categoryId = dto.categoryId;
    }
    if (dto.name !== undefined) {
      const name = normalizeStorageText(dto.name);
      if (!name) throw new BadRequestException('Product name cannot be empty');
      entity.name = name;
    }
    if (dto.description !== undefined) {
      entity.description = dto.description?.trim() || null;
    }
    if (dto.price !== undefined) {
      entity.price = Number(Number(dto.price).toFixed(2));
    }
    if (dto.costPrice !== undefined) {
      entity.costPrice =
        dto.costPrice != null ? Number(Number(dto.costPrice).toFixed(2)) : null;
    }
    if (dto.imageUrl !== undefined) {
      entity.imageUrl = dto.imageUrl?.trim() || null;
    }
    if (dto.inStock !== undefined) entity.inStock = dto.inStock;
    if (dto.showInMenu !== undefined) entity.showInMenu = dto.showInMenu;
    if (dto.order !== undefined) entity.order = dto.order;
    if (dto.ingredients !== undefined) {
      entity.ingredients = await this.normalizeIngredients(
        restaurantId,
        dto.ingredients,
      );
    }
    if (dto.calories !== undefined) {
      entity.calories = this.normalizeCalories(dto.calories);
    }
    if (dto.allergens !== undefined) {
      entity.allergens = this.normalizeAllergens(dto.allergens);
    }
    await this.repo.save(entity);
    return this.findOne(id, restaurantId);
  }

  async remove(id: string, restaurantId: string): Promise<void> {
    const entity = await this.findOne(id, restaurantId);
    await this.repo.remove(entity);
  }

  async reorder(restaurantId: string, ids: string[]): Promise<ProductEntity[]> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) {
      return this.findByRestaurant(restaurantId);
    }
    await this.dataSource.transaction(async (em) => {
      const txRepo =
        typeof em.getRepository === 'function'
          ? em.getRepository(ProductEntity)
          : this.repo;
      const products = await txRepo
        .createQueryBuilder('p')
        .innerJoin('p.category', 'c')
        .where('c.restaurant_id = :restaurantId', { restaurantId })
        .andWhere('p.id IN (:...ids)', { ids: uniqueIds })
        .getMany();
      const existingIds = new Set(products.map((p) => p.id));
      const orderedIds = uniqueIds.filter((id) => existingIds.has(id));
      for (let i = 0; i < orderedIds.length; i++) {
        await em.update(ProductEntity, { id: orderedIds[i] }, { order: i + 1 });
      }
    });
    return this.findByRestaurant(restaurantId);
  }
}
