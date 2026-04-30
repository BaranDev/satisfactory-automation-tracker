// Factory data model types for machine-based production system

export type MachineType =
  | 'miner_mk1' | 'miner_mk2' | 'miner_mk3'
  | 'smelter' | 'foundry'
  | 'constructor' | 'assembler' | 'manufacturer'
  | 'refinery' | 'blender' | 'packager'
  | 'particle_accelerator' | 'converter' | 'quantum_encoder'
  | 'water_extractor' | 'oil_extractor' | 'resource_well_pressurizer'
  | 'coal_generator' | 'fuel_generator' | 'nuclear_power_plant'
  | 'geothermal_generator' | 'biomass_burner'
  | 'item_source';

export type NodePurity = 'impure' | 'normal' | 'pure';

export type BeltTier = 'belt_mk1' | 'belt_mk2' | 'belt_mk3' | 'belt_mk4' | 'belt_mk5' | 'belt_mk6';
export type PipeTier = 'pipe_mk1' | 'pipe_mk2';

export type FlowKind = 'item' | 'fluid';

/** A connection point on a machine (input or output slot) */
export interface ConnectionPoint {
  slot: number;
  kind: FlowKind;                      // item belt vs fluid pipe
  connectedTo: {
    machineId: string;
    slot: number;
  } | null;
  itemType: string | null;
  actualRate: number;                  // calculated items/min after simulation
  beltTier?: BeltTier;                 // for kind === 'item'
  pipeTier?: PipeTier;                 // for kind === 'fluid'
  /** Legacy/raw maxRate. Prefer beltTier/pipeTier; this is kept for backward compat. */
  maxRate?: number;
}

/** A placed machine instance in the factory */
export interface MachineInstance {
  id: string;
  machineType: MachineType;
  recipe: string | null;               // recipe ID from recipes.ts; unused for extractors + power gens
  overclock: number;                   // 0.01 to 2.5
  position: { x: number; y: number };

  /** Extraction-only: which raw resource this miner/extractor pulls. */
  extractionItem?: string | null;
  /** Extraction-only: node purity multiplier (impure 0.5, normal 1.0, pure 2.0). */
  nodePurity?: NodePurity;

  /** Number of Somersloops installed (production amplifier). */
  somersloops?: number;

  /** ItemSource only: items/min the user feeds in manually. */
  sourceRate?: number;

  inputs: ConnectionPoint[];
  outputs: ConnectionPoint[];
}

/** A reusable module (group of connected machines) */
export interface FactoryModule {
  id: string;
  name: string;
  description?: string;
  machines: MachineInstance[];
  exposedInputs: { slot: number; machineId: string; label: string }[];
  exposedOutputs: { slot: number; machineId: string; label: string }[];
}

/** The full factory state */
export interface Factory {
  id: string;
  name: string;
  machines: MachineInstance[];
  modules: FactoryModule[];
  moduleInstances: { moduleId: string; position: { x: number; y: number } }[];
}

// ─── Simulation result types ────────────────────────────────

export interface SimulationWarning {
  type:
    | 'bottleneck'
    | 'belt_limit'
    | 'pipe_limit'
    | 'power'
    | 'no_recipe'
    | 'no_resource'
    | 'disconnected'
    | 'wrong_item'
    | 'kind_mismatch'
    | 'cycle';
  message: string;
  severity: 'error' | 'warning' | 'info';
  machineId?: string;
}

export interface SimulationNode {
  machineId: string;
  recipe: string | null;

  theoreticalOutput: number;
  actualOutput: number;
  inputSatisfaction: number;  // 0–1

  inputSlots: {
    item: string;
    needed: number;
    available: number;
    source: string | 'external';
  }[];

  outputSlots: {
    item: string;
    produced: number;
    consumed: number;
    surplus: number;
    destinations: string[];
  }[];

  powerDraw: number;          // positive = consumes, negative = generates
  warnings: SimulationWarning[];
}

export interface FactorySimulationResult {
  nodes: Record<string, SimulationNode>;

  totalPower: number;         // net (consumption − generation)
  totalConsumption: number;
  totalGeneration: number;
  totalItems: Record<string, { produced: number; consumed: number; net: number }>;

  externalInputs: { item: string; rate: number }[];
  finalOutputs: { item: string; rate: number }[];

  criticalIssues: SimulationWarning[];
  warnings: SimulationWarning[];
  suggestions: FactorySuggestion[];
}

export interface FactorySuggestion {
  type: 'add_machine' | 'change_overclock' | 'connect' | 'add_belt' | 'fix_recipe' | 'set_resource';
  message: string;
  impact: string;
  machineType?: MachineType;
  recipe?: string;
  machineId?: string;
  overclock?: number;
  count?: number;
  priority: number;
}
