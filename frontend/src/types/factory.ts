// Factory data model types for machine-based production system

export type MachineType =
  | 'miner_mk1' | 'miner_mk2' | 'miner_mk3'
  | 'smelter' | 'foundry'
  | 'constructor' | 'assembler' | 'manufacturer'
  | 'refinery' | 'blender' | 'packager'
  | 'particle_accelerator' | 'converter' | 'quantum_encoder'
  | 'water_extractor' | 'oil_extractor' | 'resource_well_pressurizer'
  | 'coal_generator' | 'fuel_generator' | 'nuclear_power_plant'
  | 'geothermal_generator' | 'biomass_burner';

/** A connection point on a machine (input or output slot) */
export interface ConnectionPoint {
  slot: number;
  connectedTo: {
    machineId: string;
    slot: number;
  } | null;
  itemType: string | null;
  actualRate: number;  // calculated items/min after simulation
  maxRate: number;     // belt/pipe throughput limit
}

/** A placed machine instance in the factory */
export interface MachineInstance {
  id: string;
  machineType: MachineType;
  recipe: string | null;        // recipe ID from recipes.ts
  overclock: number;            // 0.01 to 2.5
  position: { x: number; y: number };

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
  type: 'bottleneck' | 'belt_limit' | 'power' | 'no_recipe' | 'disconnected' | 'wrong_item';
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

  powerDraw: number;
  warnings: SimulationWarning[];
}

export interface FactorySimulationResult {
  nodes: Record<string, SimulationNode>;

  totalPower: number;
  totalItems: Record<string, { produced: number; consumed: number; net: number }>;

  externalInputs: { item: string; rate: number }[];
  finalOutputs: { item: string; rate: number }[];

  criticalIssues: SimulationWarning[];
  warnings: SimulationWarning[];
  suggestions: FactorySuggestion[];
}

export interface FactorySuggestion {
  type: 'add_machine' | 'change_overclock' | 'connect' | 'add_belt' | 'fix_recipe';
  message: string;
  impact: string;
  machineType?: MachineType;
  recipe?: string;
  machineId?: string;
  overclock?: number;
  count?: number;
  priority: number;
}
