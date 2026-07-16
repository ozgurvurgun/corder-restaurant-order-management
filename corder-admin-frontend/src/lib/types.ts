export interface PlatformAdmin {
  id: string
  email: string
  name: string
  role: "super"
}

export interface Restaurant {
  id: string
  name: string
  slug: string
  address?: string
  phone?: string
  email?: string
  logo?: string
  status: "active" | "inactive"
  createdAt: string
  rootAdminId?: string
  /** Terminal login email (independent of root admin). */
  terminalEmail?: string | null
  /** Restaurant-scoped static token for print-agent. */
  printAgentToken?: string | null
}

export interface RootAdminCreateInput {
  name: string
  email: string
  password: string
}

export interface RootAdmin {
  id: string
  restaurantId: string
  email: string
  name: string
  passwordHint?: string
  createdAt: string
}
