// Project data types

export interface ItemData {
  label: string
  icon?: string
  automated: boolean
  machines: number
  overclock: number
}

export interface ProjectData {
  project_id: string
  name: string
  version: number
  last_updated: string
  assets_base_url?: string
  items: Record<string, ItemData>
}

export type SyncStatus = 'in_sync' | 'local_changes' | 'cloud_newer' | 'unknown'

export interface ProjectState {
  project: ProjectData | null
  cloudProject: ProjectData | null
  syncStatus: SyncStatus
  lastSyncedAt: string | null
  previousState: ProjectData | null // For undo
  isLoading: boolean
  error: string | null
}

// Simulation types
export interface SimulationResult {
  items: Record<string, ItemSimResult>
  bottlenecks: Bottleneck[]
  suggestions: Suggestion[]
  rawMaterials: Record<string, number>
}

export interface ItemSimResult {
  outputPerMin: number
  demandPerMin: number
  supplyPerMin: number
  isBottleneck: boolean
  isSurplus: boolean
  shortfall: number
  shortfallPercent: number
}

export interface Bottleneck {
  itemKey: string
  label: string
  shortfall: number
  shortfallPercent: number
  neededMachines: number
}

export interface Suggestion {
  type: 'add_machines' | 'automate_upstream' | 'increase_overclock'
  itemKey: string
  label: string
  message: string
  machinesNeeded?: number
  expectedGain?: number
}

// Recipe types
export interface Recipe {
  id: string
  label: string
  machine_type: string
  craft_time_sec: number
  outputs: RecipeIO[]
  inputs: RecipeIO[]
}

export interface RecipeIO {
  item: string
  amount: number
}
