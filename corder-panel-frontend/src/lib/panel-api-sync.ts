import { useEffect, useRef } from "react"
import {
  itemCountsTowardBill,
  type PanelTable,
  type PanelOrder,
  type PanelCategory,
  type PanelProduct,
  type PanelSection,
  type PanelUser,
  type CashShift,
  type ClosedTable,
  type Payment,
  type CashTransaction,
  type OpenAccount,
  type Campaign,
  type StockMaterial,
  type Supplier,
  type StockMovement,
  type PurchaseOrder,
  type InventoryCount,
  type LedgerCustomer,
} from "./panel-types"
import type { OrderDto, CategoryDto, ProductDto, ShiftDto, CompletedOrderDto, CashTransactionDto, OpenAccountDto, CampaignDto, StockMaterialDto, SupplierDto, StockMovementDto, PurchaseOrderDto, InventoryCountDto, LedgerCustomerDto } from "./api"
import { api, getBase } from "./api"

export function mapOpenAccountDtoToPanel(a: OpenAccountDto): OpenAccount {
  return {
    id: a.id,
    customerName: a.customerName,
    customerPhone: a.customerPhone ?? undefined,
    amount: a.amount,
    paidAmount: a.paidAmount,
    status: a.status as OpenAccount["status"],
    description: a.description,
    createdBy: a.createdBy,
    createdAt: new Date(a.createdAt),
    paidAt: a.paidAt ? new Date(a.paidAt) : undefined,
    items: (a.items ?? []).map((i) => ({
      id: i.id,
      productId: i.productId ?? undefined,
      productName: i.productName,
      quantity: i.quantity,
      price: i.price,
      note: i.note ?? undefined,
    })),
    payments: (a.payments ?? []).map((p) => ({
      id: p.id,
      amount: p.amount,
      receivedBy: p.receivedBy,
      receivedByUserId: p.receivedByUserId ?? undefined,
      note: p.note ?? undefined,
      createdAt: new Date(p.createdAt),
    })),
  }
}

export function mapShiftDtoToPanel(dto: ShiftDto): CashShift {
  return {
    id: dto.id,
    openedBy: dto.openedBy,
    closedBy: dto.closedBy ?? undefined,
    openedAt: new Date(dto.openedAt),
    closedAt: dto.closedAt ? new Date(dto.closedAt) : undefined,
    openingBalance: dto.openingBalance,
    closingBalance: dto.closingBalance ?? undefined,
    status: dto.status === "closed" ? "closed" : "open",
    cashIn: dto.cashIn ?? 0,
    cashOut: dto.cashOut ?? 0,
    totalRevenue: dto.totalRevenue ?? 0,
    totalNakit: dto.totalNakit ?? 0,
    totalKart: dto.totalKart ?? 0,
    totalYemekKarti: dto.totalYemekKarti ?? 0,
    totalMultinet: dto.totalMultinet ?? 0,
    transactionCount: dto.transactionCount ?? 0,
    notes: dto.notes ?? undefined,
  }
}

export function mapCompletedOrderDtoToClosedTable(dto: CompletedOrderDto): ClosedTable {
  const orders: PanelOrder[] = dto.orders.map((o) => ({
    id: o.id,
    tableId: o.tableId,
    userId: o.userId,
    userName: o.userName?.trim() || undefined,
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      price: i.price,
      quantity: i.quantity,
      note: i.note,
      status: i.status as PanelOrder["items"][0]["status"],
      createdAt: new Date(i.createdAt),
      cancelReason: i.cancelReason,
      cancelledBy: i.cancelledBy,
      cancelledAt: i.cancelledAt ? new Date(i.cancelledAt) : undefined,
    })),
    status: o.status as PanelOrder["status"],
    createdAt: new Date(o.createdAt),
    updatedAt: new Date(o.updatedAt),
    mergedFrom: o.mergedFrom,
  }))

  const payment: Payment = {
    id: dto.payment.id,
    tableId: dto.payment.tableId,
    tableName: dto.payment.tableName,
    orderIds: dto.payment.orderIds,
    amount: dto.payment.amount,
    method: dto.payment.method as Payment["method"],
    splitDetails: dto.payment.splitDetails,
    discount: dto.payment.discount
      ? {
          type: dto.payment.discount.type,
          value: dto.payment.discount.value,
          reason: dto.payment.discount.reason,
        }
      : undefined,
    tip: dto.payment.tip,
    processedBy: dto.payment.processedBy,
    createdAt: new Date(dto.payment.createdAt),
    ...(dto.payment.ledgerCustomerId || dto.payment.ledgerCustomerName
      ? {
          ledgerCustomerId: dto.payment.ledgerCustomerId,
          ledgerCustomerName: dto.payment.ledgerCustomerName,
        }
      : {}),
  }

  return {
    id: dto.id,
    tableName: dto.tableName,
    section: dto.section,
    waiter: dto.waiter,
    orders,
    payment,
    totalAmount: dto.totalAmount,
    discountAmount: dto.discountAmount,
    netAmount: dto.netAmount,
    closedBy: dto.closedBy,
    openedAt: new Date(dto.openedAt),
    closedAt: new Date(dto.closedAt),
  }
}

function mapOrderItem(i: OrderDto["items"][0]): PanelOrder["items"][0] {
  return {
    id: i.id,
    productId: i.productId,
    productName: i.productName,
    price: i.price,
    quantity: i.quantity,
    note: i.note,
    status: (i.status as PanelOrder["items"][0]["status"]) || "sent",
    createdAt: new Date(i.createdAt),
    cancelReason: i.cancelReason,
    cancelledBy: i.cancelledBy,
    cancelledAt: i.cancelledAt ? new Date(i.cancelledAt) : undefined,
  }
}

function mapOrder(o: OrderDto): PanelOrder {
  return {
    id: o.id,
    tableId: o.tableId,
    userId: o.userId ?? "",
    userName: o.userName?.trim() || undefined,
    items: o.items.map(mapOrderItem),
    status: (o.status as PanelOrder["status"]) || "active",
    createdAt: new Date(o.createdAt),
    updatedAt: new Date(o.updatedAt),
    mergedFrom: o.mergedFrom ?? undefined,
  }
}

export function mapApiOrdersToPanel(orders: OrderDto[]): PanelOrder[] {
  return orders.map(mapOrder)
}

/** On API refresh, preserve client-only discount / split-bill fields (backend does not know these). */
export function mergeTablesPreserveClientFields(prev: PanelTable[], next: PanelTable[]): PanelTable[] {
  return next.map((nt) => {
    const old = prev.find((p) => p.id === nt.id)
    const occupied = nt.status === "occupied" || (nt.orderCount ?? 0) > 0
    if (!old || !occupied) return nt
    return {
      ...nt,
      ...(old.discount ? { discount: old.discount } : {}),
      ...(old.splitInfo ? { splitInfo: old.splitInfo } : {}),
    }
  })
}

/** Waiter name from staff (userId) on active orders; reflects the person selected on the terminal into the panel. */
export function resolveStaffNameForTable(
  tableId: string,
  orders: PanelOrder[],
  staffUsers: PanelUser[],
): string | undefined {
  const active = orders.filter((o) => o.tableId === tableId && o.status === "active")
  if (active.length === 0) return undefined
  const sorted = [...active].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  for (const o of sorted) {
    const fromApi = o.userName?.trim()
    if (fromApi) return fromApi
    const uid = o.userId?.trim()
    if (!uid) continue
    const name = staffUsers.find((u) => u.id === uid)?.name
    if (name) return name
  }
  return undefined
}

export function mapApiTablesToPanel(
  apiTables: { id: string; name: string; section: string; status: string }[],
  orders: PanelOrder[],
  staffUsers: PanelUser[],
): PanelTable[] {
  const activeOrders = orders.filter((o) => o.status === "active")
  return apiTables.map((t) => {
    const tableOrders = activeOrders.filter((o) => o.tableId === t.id)
    const totalAmount = tableOrders.reduce(
      (sum, o) =>
        sum +
        o.items
          .filter(itemCountsTowardBill)
          .reduce((s, i) => s + i.price * i.quantity, 0),
      0
    )
    const orderCount = tableOrders.length
    const lastOrder = [...tableOrders].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )[0]
    const waiter = resolveStaffNameForTable(t.id, orders, staffUsers)
    return {
      id: t.id,
      name: t.name,
      section: t.section,
      status: orderCount > 0 ? "occupied" : "empty",
      totalAmount,
      orderCount,
      lastUpdated: lastOrder ? lastOrder.updatedAt : undefined,
      activeOrderId: lastOrder?.id,
      waiter,
    }
  })
}

export function mapApiCategoriesToPanel(cats: CategoryDto[]): PanelCategory[] {
  return cats.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    order: c.order,
    parentId: c.parentId?.trim() || undefined,
    showInTerminal: c.showInTerminal,
    showInMenu: c.showInMenu,
    showInQuickSale: true,
  }))
}

/** Depth-first list from root (for subcategories in the left menu). */
export function orderedCategoryList(cats: PanelCategory[]): PanelCategory[] {
  const byParent = new Map<string | undefined, PanelCategory[]>()
  for (const c of cats) {
    const k = c.parentId?.trim() || undefined
    if (!byParent.has(k)) byParent.set(k, [])
    byParent.get(k)!.push(c)
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
  }
  const walk = (parentId: string | undefined): PanelCategory[] => {
    const ch = byParent.get(parentId) ?? []
    return ch.flatMap((x) => [x, ...walk(x.id)])
  }
  return walk(undefined)
}

export function mapApiProductsToPanel(products: ProductDto[], materials: StockMaterial[] = []): PanelProduct[] {
  const matMap = new Map(materials.map((m) => [m.id, m]))
  return products.map((p) => {
    const ing = p.ingredients?.length
      ? p.ingredients.map((row) => ({
          materialId: row.materialId,
          quantity: Number(row.quantity),
          materialName: matMap.get(row.materialId)?.name ?? "",
          unit: matMap.get(row.materialId)?.unit ?? "adet",
        }))
      : undefined
    return {
      id: p.id,
      name: p.name,
      price: Number(p.price),
      categoryId: p.categoryId,
      inStock: p.inStock,
      description: p.description ?? undefined,
      image: p.imageUrl ?? undefined,
      ...(ing?.length ? { ingredients: ing } : {}),
    }
  })
}

export function deriveSectionsFromTables(
  apiTables: { id: string; name: string; section: string }[]
): PanelSection[] {
  const names = Array.from(new Set(apiTables.map((t) => t.section).filter(Boolean)))
  return names.map((name, i) => ({ id: `section-${i}`, name }))
}

function mapApiStaffToPanelUser(
  s: { id: string; name: string; email: string | null; role: string; phone?: string; isActive: boolean; createdAt: string }
): PanelUser {
  return {
    id: s.id,
    name: s.name,
    email: s.email ?? undefined,
    phone: s.phone,
    role: s.role as "garson" | "mudur" | "kasiyer",
    active: s.isActive,
    createdAt: new Date(s.createdAt),
  }
}

export function usePanelApiSync(
  token: string | null,
  setTables: (v: PanelTable[] | ((prev: PanelTable[]) => PanelTable[])) => void,
  setOrders: (v: PanelOrder[] | ((prev: PanelOrder[]) => PanelOrder[])) => void,
  setCategories: (v: PanelCategory[] | ((prev: PanelCategory[]) => PanelCategory[])) => void,
  setProducts: (v: PanelProduct[] | ((prev: PanelProduct[]) => PanelProduct[])) => void,
  setSections: (v: PanelSection[] | ((prev: PanelSection[]) => PanelSection[])) => void,
  setUsers: (v: PanelUser[] | ((prev: PanelUser[]) => PanelUser[])) => void,
  setCashShifts: (v: CashShift[] | ((prev: CashShift[]) => CashShift[])) => void,
  setClosedTables: (v: ClosedTable[] | ((prev: ClosedTable[]) => ClosedTable[])) => void,
  setStockMaterials?: (v: StockMaterial[] | ((prev: StockMaterial[]) => StockMaterial[])) => void,
  setSuppliers?: (v: Supplier[] | ((prev: Supplier[]) => Supplier[])) => void,
  setStockMovements?: (v: StockMovement[] | ((prev: StockMovement[]) => StockMovement[])) => void,
  setPurchaseOrders?: (v: PurchaseOrder[] | ((prev: PurchaseOrder[]) => PurchaseOrder[])) => void,
  setInventoryCounts?: (v: InventoryCount[] | ((prev: InventoryCount[]) => InventoryCount[])) => void,
  setCashTransactions?: (v: CashTransaction[] | ((prev: CashTransaction[]) => CashTransaction[])) => void,
  setOpenAccounts?: (v: OpenAccount[] | ((prev: OpenAccount[]) => OpenAccount[])) => void,
  setCampaigns?: (v: Campaign[] | ((prev: Campaign[]) => Campaign[])) => void,
  setLedgerCustomers?: (v: LedgerCustomer[] | ((prev: LedgerCustomer[]) => LedgerCustomer[])) => void,
) {
  const socketRef = useRef<{ disconnect: () => void } | null>(null)
  const loadRef = useRef<() => Promise<void>>(null!)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    const load = async () => {
      try {
        const [apiTables, ordersRes, categoriesRes, productsRes, staffRes, currentShiftRes, shiftsListRes, completedOrdersRes, openAccountsRes, ledgerCustomersRes, campaignsRes, materialsRes, suppliersRes, movementsRes, purchaseOrdersRes, inventoryCountsRes] = await Promise.all([
          api.tables.list(token),
          api.orders.list(token),
          api.categories.list(token),
          api.products.list(token),
          api.staff.list(token),
          api.shifts.getCurrent(token),
          api.shifts.list(token),
          api.completedOrders.list(token, { limit: 500 }),
          api.openAccounts.list(token),
          api.ledgerCustomers.list(token).catch((e) => {
            console.error("ledger-customers load:", e)
            return [] as LedgerCustomerDto[]
          }),
          api.campaigns.list(token),
          api.stock.materials.list(token),
          api.stock.suppliers.list(token).catch((e) => {
            console.error("suppliers load:", e)
            return [] as SupplierDto[]
          }),
          api.stock.movements.list(token, 200),
          api.stock.purchaseOrders.list(token),
          api.stock.inventoryCounts.list(token),
        ])
        if (cancelled) return
        const orders = mapApiOrdersToPanel(ordersRes)
        const users = staffRes.map(mapApiStaffToPanelUser)
        const categories = mapApiCategoriesToPanel(categoriesRes)
        const mats: StockMaterial[] = (materialsRes as StockMaterialDto[]).map((m) => ({
          id: m.id,
          name: m.name,
          unit: m.unit as StockMaterial["unit"],
          currentStock: Number(m.currentStock),
          minStock: Number(m.minStock),
          costPerUnit: Number(m.costPerUnit),
          supplierId: m.supplierId ?? undefined,
          category: m.category,
          lastUpdated: new Date(m.updatedAt),
        }))
        const products = mapApiProductsToPanel(productsRes, mats)
        const tables = mapApiTablesToPanel(apiTables, orders, users)
        const sections = deriveSectionsFromTables(apiTables)
        const shifts = currentShiftRes
          ? [mapShiftDtoToPanel(currentShiftRes), ...shiftsListRes.filter((s) => s.id !== currentShiftRes.id).map(mapShiftDtoToPanel)]
          : shiftsListRes.map(mapShiftDtoToPanel)
        const closedTables = completedOrdersRes.map(mapCompletedOrderDtoToClosedTable)
        const openAccounts: OpenAccount[] = (openAccountsRes as OpenAccountDto[]).map(mapOpenAccountDtoToPanel)
        setOrders(orders)
        setCategories(categories)
        setProducts(products)
        setTables((prev) => mergeTablesPreserveClientFields(prev, tables))
        setSections(sections)
        setUsers(users)
        setCashShifts(shifts)
        setClosedTables(closedTables)
        if (setStockMaterials) {
          setStockMaterials(mats)
        }
        if (setSuppliers) {
          const sups: Supplier[] = (suppliersRes as SupplierDto[]).map((s) => ({
            id: s.id,
            name: s.name,
            contactPerson: s.contactPerson ?? undefined,
            phone: s.phone ?? undefined,
            email: s.email ?? undefined,
            address: s.address ?? undefined,
            notes: s.notes ?? undefined,
            active: s.active,
          }))
          setSuppliers(sups)
        }
        if (setStockMovements) {
          const mvs: StockMovement[] = (movementsRes as StockMovementDto[]).map((mv) => ({
            id: mv.id,
            materialId: mv.materialId,
            materialName: mv.materialName,
            type: mv.type,
            quantity: Number(mv.quantity),
            previousStock: Number(mv.previousStock),
            newStock: Number(mv.newStock),
            unitCost: mv.unitCost != null ? Number(mv.unitCost) : undefined,
            totalCost: mv.totalCost != null ? Number(mv.totalCost) : undefined,
            supplierId: mv.supplierId ?? undefined,
            reason: mv.reason ?? undefined,
            createdBy: mv.createdBy,
            createdAt: new Date(mv.createdAt),
          }))
          setStockMovements(mvs)
        }
        if (setPurchaseOrders) {
          const pos: PurchaseOrder[] = (purchaseOrdersRes as PurchaseOrderDto[]).map((po) => ({
            id: po.id,
            supplierId: po.supplierId,
            supplierName: po.supplierName,
            items: po.items.map((it) => ({
              materialId: it.materialId,
              materialName: it.materialName,
              quantity: it.quantity,
              unitCost: it.unitCost,
            })),
            totalAmount: Number(po.totalAmount),
            status: po.status,
            notes: po.notes ?? undefined,
            createdBy: po.createdBy,
            createdAt: new Date(po.createdAt),
            receivedAt: po.receivedAt ? new Date(po.receivedAt) : undefined,
          }))
          setPurchaseOrders(pos)
        }
        if (setInventoryCounts) {
          const ics: InventoryCount[] = (inventoryCountsRes as InventoryCountDto[]).map((ic) => ({
            id: ic.id,
            date: new Date(ic.date),
            countedBy: ic.countedBy,
            items: ic.items.map((item) => ({
              materialId: item.materialId,
              materialName: item.materialName,
              expectedStock: item.expectedStock,
              actualStock: item.actualStock,
              difference: item.difference,
            })),
            status: ic.status,
            notes: ic.notes ?? undefined,
          }))
          setInventoryCounts(ics)
        }
        if (setOpenAccounts) setOpenAccounts(openAccounts)
        if (setLedgerCustomers) {
          const ledgerList: LedgerCustomer[] = (ledgerCustomersRes as LedgerCustomerDto[]).map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone ?? undefined,
            notes: c.notes ?? undefined,
            balance: Number(c.balance),
            periodNet: c.periodNet != null ? Number(c.periodNet) : undefined,
            createdAt: new Date(c.createdAt),
          }))
          setLedgerCustomers(ledgerList)
        }
        if (setCampaigns) {
          const campaigns: Campaign[] = (campaignsRes as CampaignDto[]).map((c) => ({
            id: c.id,
            title: c.title,
            description: c.description ?? undefined,
            image: c.imageUrl,
            discountPercent: c.discountPercent ?? undefined,
            originalPrice: c.originalPrice != null ? Number(c.originalPrice) : undefined,
            discountedPrice: c.discountedPrice != null ? Number(c.discountedPrice) : undefined,
            validUntil: c.validUntil ? new Date(c.validUntil) : undefined,
            isActive: c.isActive,
            order: c.order,
            createdAt: new Date(c.createdAt),
          }))
          setCampaigns(campaigns)
        }

        if (setCashTransactions) {
          const shiftId = currentShiftRes?.id
          if (shiftId) {
            try {
              const cashTxRes = await api.cashTransactions.list(token, shiftId)
              const cashTransactions: CashTransaction[] = (cashTxRes as CashTransactionDto[]).map((t) => ({
                id: t.id,
                shiftId: t.shiftId,
                type: t.type,
                amount: t.amount,
                description: t.description,
                reference: t.reference ?? undefined,
                createdBy: t.createdBy,
                createdAt: new Date(t.createdAt),
              }))
              setCashTransactions(cashTransactions)
            } catch (e) {
              console.error("Load cash transactions error:", e)
            }
          }
        }
      } catch (e) {
        console.error("Panel API load error:", e)
      }
    }
    loadRef.current = load
    load()
    return () => {
      cancelled = true
    }
  }, [
    token,
    setTables,
    setOrders,
    setCategories,
    setProducts,
    setSections,
    setUsers,
    setCashShifts,
    setClosedTables,
    setOpenAccounts,
    setLedgerCustomers,
    setStockMaterials,
    setSuppliers,
    setStockMovements,
    setPurchaseOrders,
    setInventoryCounts,
    setCashTransactions,
    setCampaigns,
  ])

  useEffect(() => {
    if (!token) return
    const onVis = () => {
      if (document.visibilityState === "visible") void loadRef.current?.()
    }
    const onOnline = () => void loadRef.current?.()
    document.addEventListener("visibilitychange", onVis)
    window.addEventListener("online", onOnline)
    return () => {
      document.removeEventListener("visibilitychange", onVis)
      window.removeEventListener("online", onOnline)
    }
  }, [token])

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      return
    }
    const baseUrl = getBase()
    if (!baseUrl) return
    let cancelled = false
    import("socket.io-client").then(({ io }) => {
      if (cancelled) return
      const socket = io(baseUrl, {
        path: "/ws",
        auth: { token },
        transports: ["websocket", "polling"],
        reconnectionAttempts: Infinity,
        reconnectionDelayMax: 10000,
        timeout: 20000,
      })
      socketRef.current = socket
      socket.on("order:created", (payload: OrderDto) => {
        const mapped = mapOrder(payload)
        setOrders((prev) => {
          if (prev.some((o) => o.id === mapped.id)) return prev
          const lineTotal = mapped.items
            .filter(itemCountsTowardBill)
            .reduce((s, i) => s + i.price * i.quantity, 0)
          setTables((pt) =>
            pt.map((t) =>
              t.id === mapped.tableId
                ? {
                    ...t,
                    status: "occupied" as const,
                    totalAmount: (t.totalAmount || 0) + lineTotal,
                    orderCount: t.orderCount + 1,
                    lastUpdated: mapped.updatedAt,
                    activeOrderId: mapped.id,
                  }
                : t,
            ),
          )
          return [mapped, ...prev]
        })
      })
      socket.on("orders:moved", () => {
        loadRef.current?.()
      })
      socket.on("orders:updated", () => {
        loadRef.current?.()
      })
      socket.on("reconnect", () => void loadRef.current?.())
    })
    return () => {
      cancelled = true
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [token, setOrders, setTables])
}
