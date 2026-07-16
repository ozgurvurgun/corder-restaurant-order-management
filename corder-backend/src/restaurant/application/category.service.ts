import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoryEntity } from '../domain/category.entity';
import { CreateCategoryDto } from '../api/dto/create-category.dto';
import { UpdateCategoryDto } from '../api/dto/update-category.dto';
import { ReorderCategoriesDto } from '../api/dto/reorder-categories.dto';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly repo: Repository<CategoryEntity>,
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

  private async assertParent(restaurantId: string, parentId: string | null): Promise<void> {
    if (!parentId) return;
    const p = await this.repo.findOne({ where: { id: parentId, restaurantId } });
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

  private async nextOrder(restaurantId: string, parentId: string | null): Promise<number> {
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

  private async wouldCreateCycle(categoryId: string, newParentId: string | null): Promise<boolean> {
    if (!newParentId) return false;
    let cur: string | null = newParentId;
    const seen = new Set<string>();
    while (cur) {
      if (cur === categoryId) return true;
      if (seen.has(cur)) return true;
      seen.add(cur);
      const node = await this.repo.findOne({ where: { id: cur } });
      if (!node) break;
      cur = node.parentId ?? null;
    }
    return false;
  }

  async create(restaurantId: string, dto: CreateCategoryDto): Promise<CategoryEntity> {
    const parentId = dto.parentId?.trim() || null;
    await this.assertParent(restaurantId, parentId);
    const slug = toSlug(dto.name);
    if (await this.slugInUse(restaurantId, parentId, slug)) {
      throw new ConflictException('Category slug already exists in this group');
    }
    const order = dto.order ?? (await this.nextOrder(restaurantId, parentId));
    const entity = this.repo.create({
      restaurantId,
      parentId,
      name: dto.name.trim(),
      slug,
      showInTerminal: dto.showInTerminal ?? true,
      showInMenu: dto.showInMenu ?? true,
      order,
    });
    return this.repo.save(entity);
  }

  async update(id: string, restaurantId: string, dto: UpdateCategoryDto): Promise<CategoryEntity> {
    const entity = await this.findOne(id, restaurantId);
    if (dto.parentId !== undefined) {
      const raw = dto.parentId?.trim() || null;
      if (raw === id) throw new BadRequestException('Category cannot be its own parent');
      await this.assertParent(restaurantId, raw);
      if (await this.wouldCreateCycle(id, raw)) {
        throw new BadRequestException('Circular category parent');
      }
      entity.parentId = raw;
    }
    if (dto.name !== undefined) {
      entity.name = dto.name.trim();
      entity.slug = toSlug(dto.name);
    }
    if (dto.showInTerminal !== undefined) entity.showInTerminal = dto.showInTerminal;
    if (dto.showInMenu !== undefined) entity.showInMenu = dto.showInMenu;
    if (dto.order !== undefined) entity.order = dto.order;
    const effectiveParent = entity.parentId ?? null;
    if (await this.slugInUse(restaurantId, effectiveParent, entity.slug, entity.id)) {
      throw new ConflictException('Category slug already exists in this group');
    }
    return this.repo.save(entity);
  }

  async remove(id: string, restaurantId: string): Promise<void> {
    const entity = await this.findOne(id, restaurantId);
    await this.repo.remove(entity);
  }

  async reorder(restaurantId: string, dto: ReorderCategoriesDto): Promise<void> {
    const ids = dto.ids;
    if (!ids.length) return;
    const first = await this.repo.findOne({ where: { id: ids[0], restaurantId } });
    if (!first) throw new NotFoundException('Category not found');
    let expectedParent: string | null;
    if (dto.parentId === undefined) {
      expectedParent = first.parentId ?? null;
    } else if (dto.parentId === null || dto.parentId === '') {
      expectedParent = null;
    } else {
      expectedParent = dto.parentId;
    }
    for (const cid of ids) {
      const c = await this.repo.findOne({ where: { id: cid, restaurantId } });
      if (!c) throw new NotFoundException('Category not found');
      const p = c.parentId ?? null;
      if (p !== expectedParent) {
        throw new BadRequestException('All categories must share the same parent');
      }
    }
    await Promise.all(
      ids.map((id, index) =>
        this.repo.update({ id, restaurantId }, { order: index + 1 }),
      ),
    );
  }
}
