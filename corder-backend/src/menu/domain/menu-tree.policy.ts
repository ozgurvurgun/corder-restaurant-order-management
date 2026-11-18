import { CategoryEntity } from '../../restaurant/domain/category.entity';
import { ProductEntity } from '../../restaurant/domain/product.entity';

export interface MenuProductRow {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  inStock: boolean;
}

export interface MenuCategoryTreeDto {
  id: string;
  name: string;
  slug: string;
  products: MenuProductRow[];
  children: MenuCategoryTreeDto[];
}

export function isCampaignValidNow(
  validUntil: Date | null | undefined,
  now: Date,
): boolean {
  if (!validUntil) return true;
  const ts = validUntil.getTime();
  if (Number.isNaN(ts)) return false;
  if (
    validUntil.getUTCHours() === 0 &&
    validUntil.getUTCMinutes() === 0 &&
    validUntil.getUTCSeconds() === 0 &&
    validUntil.getUTCMilliseconds() === 0
  ) {
    const endOfDayIstanbulMs = ts + (21 * 3600 * 1000 - 1);
    return endOfDayIstanbulMs >= now.getTime();
  }
  return ts >= now.getTime();
}

export function resolveVisibleCategoryIds(
  allCats: CategoryEntity[],
  forTerminal: boolean,
): { visibleIds: Set<string>; roots: CategoryEntity[]; productCategoryIds: string[] } {
  const catById = new Map(allCats.map((c) => [c.id, c]));
  const isFlagEnabled = (c: CategoryEntity) =>
    forTerminal ? Boolean(c.showInTerminal) : Boolean(c.showInMenu);

  const isCategoryVisible = (c: CategoryEntity): boolean => {
    let cur: CategoryEntity | undefined = c;
    const visited = new Set<string>();
    while (cur) {
      if (visited.has(cur.id)) return false;
      visited.add(cur.id);
      if (!isFlagEnabled(cur)) return false;
      cur = cur.parentId ? catById.get(cur.parentId) : undefined;
    }
    return true;
  };

  const visibleIds = new Set(allCats.filter(isCategoryVisible).map((c) => c.id));
  const roots = allCats
    .filter(
      (c) => visibleIds.has(c.id) && (!c.parentId || !catById.has(c.parentId)),
    )
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  const productCategoryIds = new Set<string>();
  const walkCollect = (c: CategoryEntity) => {
    if (!visibleIds.has(c.id)) return;
    productCategoryIds.add(c.id);
    for (const ch of allCats) {
      if (ch.parentId === c.id && visibleIds.has(ch.id)) {
        walkCollect(ch);
      }
    }
  };
  roots.forEach(walkCollect);

  return {
    visibleIds,
    roots,
    productCategoryIds: [...productCategoryIds],
  };
}

export function buildMenuCategoryTree(
  allCats: CategoryEntity[],
  visibleIds: Set<string>,
  roots: CategoryEntity[],
  products: ProductEntity[],
): MenuCategoryTreeDto[] {
  const productsByCatId = new Map<string, MenuProductRow[]>();
  for (const p of products) {
    const list = productsByCatId.get(p.categoryId) ?? [];
    list.push({
      id: p.id,
      name: p.name,
      description: p.description ?? undefined,
      price: Number(p.price),
      imageUrl: p.imageUrl ?? undefined,
      inStock: p.inStock,
    });
    productsByCatId.set(p.categoryId, list);
  }

  const buildNode = (c: CategoryEntity): MenuCategoryTreeDto => {
    const children = allCats
      .filter((ch) => ch.parentId === c.id && visibleIds.has(ch.id))
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
      .map(buildNode);
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      products: productsByCatId.get(c.id) ?? [],
      children,
    };
  };

  return roots.map(buildNode);
}

