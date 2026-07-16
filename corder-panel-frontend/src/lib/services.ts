import type { OrderItem } from "./types"

// ==========================================
// Mock Service Layer
// Ready to be replaced with real API calls
// ==========================================

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const KitchenService = {
  async sendOrder(tableId: string, items: OrderItem[]): Promise<{ success: boolean }> {
    await delay(800)
    return { success: true }
  },
}

export const PrinterService = {
  async printReceipt(tableName: string, items: OrderItem[], total: number): Promise<{ success: boolean }> {
    await delay(600)
    return { success: true }
  },

  async printKitchenTicket(tableName: string, items: OrderItem[]): Promise<{ success: boolean }> {
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
