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
  /** Terminal login email (independent of boss). */
  terminalEmail?: string | null
  /** Print Agent desktop login username. */
  printAgentUsername?: string | null
}

export interface BossBranchSummary {
  id: string
  name: string
  slug: string
  status: string
}

export interface RootAdmin {
  id: string
  restaurantId: string | null
  email: string
  name: string
  phone?: string | null
  isActive?: boolean
  restaurants?: BossBranchSummary[]
  createdAt: string
}

export type BossUser = RootAdmin
