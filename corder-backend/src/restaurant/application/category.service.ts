import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CategoryEntity } from '../domain/category.entity';
import { CreateCategoryDto } from '../api/dto/create-category.dto';
import { UpdateCategoryDto } from '../api/dto/update-category.dto';
import { ReorderCategoriesDto } from '../api/dto/reorder-categories.dto';
import { normalizeStorageText } from '../../common/text/text-normalizer';

function toSlug(name: string): string {
  const slug = name
    .trim()
    .replace(/\u0130/g, 'i')
    .replace(/I/g, 'i')
    .replace(/\u0131/g, 'i')
    .replace(/\u011e/g, 'g')
    .replace(/\u011f/g, 'g')
    .replace(/\u00dc/g, 'u')
    .replace(/\u00fc/g, 'u')
    .replace(/\u015e/g, 's')
    .replace(/\u015f/g, 's')
    .replace(/\u00d6/g, 'o')
    .replace(/\u00f6/g, 'o')
    .replace(/\u00c7/g, 'c')
    .replace(/\u00e7/g, 'c')
    .toLowerCase()
    .replace(/\u0307/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (!slug) {
    throw new BadRequestException(
      'Category name must contain at least one letter or number',
    );
  }
  return slug;
}

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly repo: Repository<CategoryEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async findByRestaurant(restaurantId: string): Promise<CategoryEntity[]> {
    return this.repo.find({
      where: { restaurantId },
      order: { order: 'ASC', name: 'ASC' },
    });
  }

  async findOne(id: string, restaurantId: string): Promise<CategoryEntity> {
    const c = await this.repo.findOne({ where: { id, restaurantId } });
    if (!c) throw new NotFoundException('Category not found');
    return c;
  }

  private async assertParent(
    restaurantId: string,
    parentId: string | null,
  ): Promise<void> {
    if (!parentId) return;
    const p = await this.repo.findOne({
      where: { id: parentId, restaurantId },
    });
    if (!p) throw new NotFoundException('Parent category not found');
  }

  private async slugInUse(
    restaurantId: string,
    parentId: string | null,
    slug: string,
    excludeId?: string,
  ): Promise<boolean> {
    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.restaurant_id = :restaurantId', { restaurantId })
      .andWhere('c.slug = :slug', { slug });
    if (parentId) {
      qb.andWhere('c.parent_id = :parentId', { parentId });
    } else {
      qb.andWhere('c.parent_id IS NULL');
    }
    if (excludeId) {
      qb.andWhere('c.id != :excludeId', { excludeId });
    }
    return (await qb.getCount()) > 0;
  }

  private async nextOrder(
    restaurantId: string,
    parentId: string | null,
  ): Promise<number> {
    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.restaurant_id = :restaurantId', { restaurantId })
      .select('MAX(c.order)', 'max');
    if (parentId) {
      qb.andWhere('c.parent_id = :parentId', { parentId });
    } else {
      qb.andWhere('c.parent_id IS NULL');
    }
    const row = await qb.getRawOne<{ max: string | number | null }>();
    return Number(row?.max ?? 0) + 1;
  }

  private async wouldCreateCycle(
    restaurantId: string,
    categoryId: string,
    newParentId: string | null,
  ): Promise<boolean> {
    if (!newParentId) return false;
    let cur: string | null = newParentId;
    const seen = new Set<string>();
    while (cur) {
      if (cur === categoryId) return true;
      if (seen.has(cur)) return true;
      seen.add(cur);
      const node = await this.repo.findOne({
        where: { id: cur, restaurantId },
      });
      if (!node) break;
      cur = node.parentId ?? null;
    }
    return false;
  }

  async create(
    restaurantId: string,
    dto: CreateCategoryDto,
  ): Promise<CategoryEntity> {
    const parentId = dto.parentId?.trim() || null;
    await this.assertParent(restaurantId, parentId);
    const name = normalizeStorageText(dto.name);
    const slug = toSlug(name);
    if (await this.slugInUse(restaurantId, parentId, slug)) {
      throw new ConflictException('Category slug already exists in this group');
    }
    const order = dto.order ?? (await this.nextOrder(restaurantId, parentId));
    const entity = this.repo.create({
      restaurantId,
      parentId,
      name,
      slug,
      showInTerminal: dto.showInTerminal ?? true,
      showInMenu: dto.showInMenu ?? true,
      showInQuickSale: dto.showInQuickSale ?? true,
      order,
    });
    return this.repo.save(entity);
  }

  async update(
    id: string,
    restaurantId: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryEntity> {
    const entity = await this.findOne(id, restaurantId);
    if (dto.parentId !== undefined) {
      const raw = dto.parentId?.trim() || null;
      if (raw === id) {
        throw new BadRequestException('Category cannot be its own parent');
      }
      await this.assertParent(restaurantId, raw);
      if (await this.wouldCreateCycle(restaurantId, id, raw)) {
        throw new BadRequestException('Circular category parent');
      }
      entity.parentId = raw;
    }
    if (dto.name !== undefined) {
      entity.name = normalizeStorageText(dto.name);
      entity.slug = toSlug(entity.name);
    }
    if (dto.showInTerminal !== undefined) {
      entity.showInTerminal = dto.showInTerminal;
    }
    if (dto.showInMenu !== undefined) entity.showInMenu = dto.showInMenu;
    if (dto.showInQuickSale !== undefined) {
      entity.showInQuickSale = dto.showInQuickSale;
    }
    if (dto.order !== undefined) entity.order = dto.order;
    const effectiveParent = entity.parentId ?? null;
    if (
      await this.slugInUse(
        restaurantId,
        effectiveParent,
        entity.slug,
        entity.id,
      )
    ) {
      throw new ConflictException('Category slug already exists in this group');
    }
    return this.repo.save(entity);
  }

  async remove(id: string, restaurantId: string): Promise<void> {
    const entity = await this.findOne(id, restaurantId);
    await this.repo.remove(entity);
  }

  async reorder(
    restaurantId: string,
    dto: ReorderCategoriesDto,
  ): Promise<CategoryEntity[]> {
    const ids = [...new Set(dto.ids)];
    if (!ids.length) return this.findByRestaurant(restaurantId);
    const first = await this.repo.findOne({
      where: { id: ids[0], restaurantId },
    });
    if (!first) throw new NotFoundException('Category not found');
    let expectedParent: string | null;
    if (dto.parentId === undefined) {
      expectedParent = first.parentId ?? null;
    } else if (dto.parentId === null || dto.parentId === '') {
      expectedParent = null;
    } else {
      expectedParent = dto.parentId;
    }
    await this.assertParent(restaurantId, expectedParent);
    for (const cid of ids) {
      const c = await this.repo.findOne({ where: { id: cid, restaurantId } });
      if (!c) throw new NotFoundException('Category not found');
      const p = c.parentId ?? null;
      if (p !== expectedParent) {
        throw new BadRequestException(
          'All categories must share the same parent',
        );
      }
    }
    await this.dataSource.transaction(async (em) => {
      for (let i = 0; i < ids.length; i++) {
        await em.update(
          CategoryEntity,
          { id: ids[i], restaurantId },
          { order: i + 1 },
        );
      }
    });
    return this.findByRestaurant(restaurantId);
  }
}
