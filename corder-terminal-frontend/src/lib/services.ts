import { api, getToken } from "./api"

// ==========================================
// Mock Service Layer (kitchen); receipt via server + print-agent
// ==========================================

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const KitchenService = {
  async sendOrder(
    _tableId: string,
    _items: { productId: string; productName: string; price: number; quantity: number; note?: string }[],
  ): Promise<{ success: boolean }> {
    await delay(800)
    return { success: true }
  },
}

export const PrinterService = {
  /** All active checks for the table are merged on the server and sent to the printer via `order.print_job`. */
  async printReceipt(tableId: string): Promise<{ success: boolean }> {
    const token = getToken()
    if (!token) throw new Error("Oturum yok")
    await api.orders.printReceipt(token, { tableId })
    return { success: true }
  },

  async printKitchenTicket(
    _tableName: string,
    _items: { productId: string; productName: string; price: number; quantity: number; note?: string }[],
  ): Promise<{ success: boolean }> {
    await delay(400)
    return { success: true }
  },
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}
