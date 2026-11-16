import type { MenuCategoryTree, OrderDto, RawTableDto } from "./api"
import type {
  OrderItemStatus,
  OrderStatus,
  TableStatus,
  TerminalCategory,
  TerminalOrder,
  TerminalOrderItem,
  TerminalProduct,
  TerminalTable,
} from "./types"

const SESSION_LOCK_STALE_MS = 120_000

export function extractTableNumber(name: string, fallbackIndex = 0): number {
  const match = name.match(/\d+/)
  return match ? Number.parseInt(match[0], 10) : fallbackIndex + 1
}

function countSubtreeProducts(node: MenuCategoryTree): number {
  const childCount = (node.children ?? []).reduce(
    (sum, child) => sum + countSubtreeProducts(child),
    0
  )
  return node.products.length + childCount
}

export function mapMenuTreeToCategoriesAndProducts(
  roots: MenuCategoryTree[]
): {
  categories: TerminalCategory[]
  products: TerminalProduct[]
} {
  const categories: TerminalCategory[] = []
  const products: TerminalProduct[] = []

  const walk = (nodes: MenuCategoryTree[], parentId: string | null) => {
    nodes.forEach((node, index) => {
      categories.push({
        id: node.id,
        name: node.name,
        productCount: countSubtreeProducts(node),
        parentId,
        sortOrder: index,
      })

      for (const product of node.products) {
        products.push({
          id: product.id,
          name: product.name,
          price: product.price,
          categoryId: node.id,
          description: product.description,
          imageUrl: product.imageUrl,
          isAvailable: product.inStock,
        })
      }

      if (node.children && node.children.length > 0) {
        walk(node.children, node.id)
      }
    })
  }

  walk(roots, null)
  return { categories, products }
}

export function calculateOrderItemsTotal(items: TerminalOrderItem[]): number {
  return items
    .filter((item) => item.status !== "cancelled")
    .reduce((sum, item) => sum + item.product.price * item.quantity, 0)
}

export function mapOrderDtoToTerminalOrder(
  dto: OrderDto,
  rawTables: RawTableDto[],
  productsById?: Map<string, TerminalProduct>
): TerminalOrder {
  const matchedTable = rawTables.find((table) => table.id === dto.tableId)
  const tableName = matchedTable?.name ?? dto.tableId
  const tableNumber = extractTableNumber(tableName, 0)

  const items: TerminalOrderItem[] = dto.items.map((item) => {
    const product: TerminalProduct = productsById?.get(item.productId) ?? {
      id: item.productId,
      name: item.productName,
      price: item.price,
      categoryId: "",
      isAvailable: true,
    }
    return {
      id: item.id,
      product: {
        ...product,
        name: item.productName || product.name,
        price: item.price,
      },
      quantity: item.quantity,
      note: item.note,
      status: (item.status as OrderItemStatus) || "sent",
      requiresManagerApproval: item.status !== "pending",
    }
  })

  return {
    id: dto.id,
    tableId: dto.tableId,
    tableName,
    tableNumber,
    items,
    waiterId: dto.userId ?? "",
    waiterName: dto.userName?.trim() || "",
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    status: (dto.status as OrderStatus) || "active",
    totalAmount: calculateOrderItemsTotal(items),
    mergedFrom: dto.mergedFrom ?? undefined,
  }
}

function resolveTableStatus(
  rawStatus: string,
  hasActiveOrders: boolean
): TableStatus {
  if (rawStatus === "reserved") return "reserved"
  if (!hasActiveOrders) return "empty"
  if (rawStatus === "checkout" || rawStatus === "bill-requested") {
    return "bill-requested"
  }
  return "occupied"
}

export function mapTablesWithOrders(
  rawTables: RawTableDto[],
  orders: TerminalOrder[]
): TerminalTable[] {
  const activeOrders = orders.filter((order) => order.status === "active")

  return rawTables.map((rawTable, index) => {
    const tableOrders = activeOrders.filter(
      (order) => order.tableId === rawTable.id
    )
    const currentTotal = tableOrders.reduce(
      (sum, order) => sum + calculateOrderItemsTotal(order.items),
      0
    )

    const sortedByUpdated = [...tableOrders].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    const sortedByCreated = [...tableOrders].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    const latestOrder = sortedByUpdated[0]
    const earliestOrder = sortedByCreated[0]
    const activeWaiter = latestOrder?.waiterName?.trim() || undefined

    const sessionStaffId = rawTable.sessionStaffId?.trim()
    const lockedAt = rawTable.sessionLockedAt
      ? new Date(rawTable.sessionLockedAt)
      : null
    const isStaleLock =
      !lockedAt || Date.now() - lockedAt.getTime() > SESSION_LOCK_STALE_MS
    const hasActiveLock = Boolean(sessionStaffId && !isStaleLock)

    return {
      id: rawTable.id,
      number: extractTableNumber(rawTable.name, index),
      name: rawTable.name,
      capacity: rawTable.capacity ?? 4,
      status: resolveTableStatus(rawTable.status, tableOrders.length > 0),
      section: rawTable.section,
      openedAt: latestOrder?.updatedAt ?? earliestOrder?.createdAt,
      guestCount: tableOrders.length > 0 ? 1 : undefined,
      activeWaiter,
      currentTotal,
      lockedByStaffId: hasActiveLock ? sessionStaffId : undefined,
      lockedByStaffName: hasActiveLock
        ? rawTable.sessionStaffName?.trim() || "Garson"
        : undefined,
    }
  })
}

export function upsertCartItem(
  cart: TerminalOrderItem[],
  product: TerminalProduct,
  quantity = 1,
  note?: string
): TerminalOrderItem[] {
  const existing = cart.find((item) => item.product.id === product.id)
  if (existing) {
    return cart.map((item) =>
      item.product.id === product.id
        ? { ...item, quantity: item.quantity + quantity }
        : item
    )
  }
  return [
    ...cart,
    {
      id: `cart-${product.id}-${Date.now()}`,
      product,
      quantity,
      note,
      status: "pending",
    },
  ]
}
