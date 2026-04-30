// Machine database for Satisfactory 1.0
// Contains specs for all production machines including power, IO slots, and compatible recipes.

import type { MachineType } from '@/types/factory';
import { RECIPES } from './recipes';

export type MachineCategory = 'extraction' | 'smelting' | 'production' | 'refining' | 'power' | 'logistics';

export interface MachineInfo {
  key: MachineType;
  label: string;
  icon: string;
  category: MachineCategory;

  basePower: number;              // MW at 100% clock; negative = generates
  powerExponent: number;          // overclock power scaling exponent

  inputSlots: number;
  outputSlots: number;
  fluidInputs: number;
  fluidOutputs: number;

  /** Number of Somersloop slots available on this machine. 0 = not amplifiable. */
  somersloopSlots: number;

  compatibleRecipes: string[];    // populated dynamically from RECIPES

  footprint: { width: number; length: number };  // in foundations
}

// Build recipe compatibility maps from the RECIPES array
function buildRecipeMap(): Record<string, string[]> {
  const map: Record<string, string[]> = Object.create(null);
  for (const recipe of RECIPES) {
    const machine = recipe.machine;
    if (!map[machine]) map[machine] = [];
    map[machine].push(recipe.id);
  }
  return map;
}

const RECIPE_MAP = buildRecipeMap();

function recipesFor(machineKey: string): string[] {
  return RECIPE_MAP[machineKey] ?? [];
}

export const MACHINES: Record<MachineType, MachineInfo> = {
  // ─── Extraction ─────────────────────────────────
  miner_mk1: {
    key: 'miner_mk1', label: 'Miner Mk.1', icon: 'miner_mk1.webp', category: 'extraction',
    basePower: 5, powerExponent: 1.321928,
    inputSlots: 0, outputSlots: 1, fluidInputs: 0, fluidOutputs: 0,
    somersloopSlots: 0, compatibleRecipes: [],
    footprint: { width: 5, length: 6 },
  },
  miner_mk2: {
    key: 'miner_mk2', label: 'Miner Mk.2', icon: 'miner_mk2.webp', category: 'extraction',
    basePower: 12, powerExponent: 1.321928,
    inputSlots: 0, outputSlots: 1, fluidInputs: 0, fluidOutputs: 0,
    somersloopSlots: 0, compatibleRecipes: [],
    footprint: { width: 5, length: 6 },
  },
  miner_mk3: {
    key: 'miner_mk3', label: 'Miner Mk.3', icon: 'miner_mk3.webp', category: 'extraction',
    basePower: 30, powerExponent: 1.321928,
    inputSlots: 0, outputSlots: 1, fluidInputs: 0, fluidOutputs: 0,
    somersloopSlots: 0, compatibleRecipes: [],
    footprint: { width: 5, length: 6 },
  },
  water_extractor: {
    key: 'water_extractor', label: 'Water Extractor', icon: 'water_extractor.webp', category: 'extraction',
    basePower: 20, powerExponent: 1.321928,
    inputSlots: 0, outputSlots: 0, fluidInputs: 0, fluidOutputs: 1,
    somersloopSlots: 0, compatibleRecipes: [],
    footprint: { width: 5, length: 8 },
  },
  oil_extractor: {
    key: 'oil_extractor', label: 'Oil Extractor', icon: 'oil_extractor.webp', category: 'extraction',
    basePower: 40, powerExponent: 1.321928,
    inputSlots: 0, outputSlots: 0, fluidInputs: 0, fluidOutputs: 1,
    somersloopSlots: 0, compatibleRecipes: [],
    footprint: { width: 5, length: 8 },
  },
  resource_well_pressurizer: {
    key: 'resource_well_pressurizer', label: 'Resource Well Pressurizer', icon: 'resource_well_pressurizer.webp', category: 'extraction',
    basePower: 150, powerExponent: 1.321928,
    inputSlots: 0, outputSlots: 0, fluidInputs: 0, fluidOutputs: 1,
    somersloopSlots: 0, compatibleRecipes: [],
    footprint: { width: 5, length: 5 },
  },

  // ─── Smelting ───────────────────────────────────
  smelter: {
    key: 'smelter', label: 'Smelter', icon: 'smelter.webp', category: 'smelting',
    basePower: 4, powerExponent: 1.321928,
    inputSlots: 1, outputSlots: 1, fluidInputs: 0, fluidOutputs: 0,
    somersloopSlots: 1, compatibleRecipes: recipesFor('smelter'),
    footprint: { width: 3, length: 4 },
  },
  foundry: {
    key: 'foundry', label: 'Foundry', icon: 'foundry.webp', category: 'smelting',
    basePower: 16, powerExponent: 1.321928,
    inputSlots: 2, outputSlots: 1, fluidInputs: 0, fluidOutputs: 0,
    somersloopSlots: 1, compatibleRecipes: recipesFor('foundry'),
    footprint: { width: 5, length: 5 },
  },

  // ─── Production ─────────────────────────────────
  constructor: {
    key: 'constructor', label: 'Constructor', icon: 'constructor.webp', category: 'production',
    basePower: 4, powerExponent: 1.321928,
    inputSlots: 1, outputSlots: 1, fluidInputs: 0, fluidOutputs: 0,
    somersloopSlots: 1, compatibleRecipes: recipesFor('constructor'),
    footprint: { width: 4, length: 5 },
  },
  assembler: {
    key: 'assembler', label: 'Assembler', icon: 'assembler.webp', category: 'production',
    basePower: 15, powerExponent: 1.321928,
    inputSlots: 2, outputSlots: 1, fluidInputs: 0, fluidOutputs: 0,
    somersloopSlots: 1, compatibleRecipes: recipesFor('assembler'),
    footprint: { width: 5, length: 8 },
  },
  manufacturer: {
    key: 'manufacturer', label: 'Manufacturer', icon: 'manufacturer.webp', category: 'production',
    basePower: 55, powerExponent: 1.321928,
    inputSlots: 4, outputSlots: 1, fluidInputs: 0, fluidOutputs: 0,
    somersloopSlots: 2, compatibleRecipes: recipesFor('manufacturer'),
    footprint: { width: 9, length: 9 },
  },
  packager: {
    key: 'packager', label: 'Packager', icon: 'packager.webp', category: 'production',
    basePower: 10, powerExponent: 1.321928,
    inputSlots: 1, outputSlots: 1, fluidInputs: 1, fluidOutputs: 1,
    somersloopSlots: 1, compatibleRecipes: recipesFor('packager'),
    footprint: { width: 4, length: 4 },
  },

  // ─── Refining ───────────────────────────────────
  refinery: {
    key: 'refinery', label: 'Refinery', icon: 'refinery.webp', category: 'refining',
    basePower: 30, powerExponent: 1.321928,
    inputSlots: 1, outputSlots: 1, fluidInputs: 1, fluidOutputs: 1,
    somersloopSlots: 2, compatibleRecipes: recipesFor('refinery'),
    footprint: { width: 5, length: 10 },
  },
  blender: {
    key: 'blender', label: 'Blender', icon: 'blender.webp', category: 'refining',
    basePower: 75, powerExponent: 1.321928,
    inputSlots: 2, outputSlots: 1, fluidInputs: 2, fluidOutputs: 1,
    somersloopSlots: 2, compatibleRecipes: recipesFor('blender'),
    footprint: { width: 9, length: 9 },
  },
  particle_accelerator: {
    key: 'particle_accelerator', label: 'Particle Accelerator', icon: 'particle_accelerator.webp', category: 'refining',
    basePower: 500, powerExponent: 1.321928,
    inputSlots: 2, outputSlots: 1, fluidInputs: 1, fluidOutputs: 0,
    somersloopSlots: 4, compatibleRecipes: recipesFor('particle_accelerator'),
    footprint: { width: 12, length: 19 },
  },
  converter: {
    key: 'converter', label: 'Converter', icon: 'converter.webp', category: 'refining',
    basePower: 400, powerExponent: 1.321928,
    inputSlots: 2, outputSlots: 2, fluidInputs: 0, fluidOutputs: 0,
    somersloopSlots: 4, compatibleRecipes: recipesFor('converter'),
    footprint: { width: 8, length: 8 },
  },
  quantum_encoder: {
    key: 'quantum_encoder', label: 'Quantum Encoder', icon: 'quantum_encoder.webp', category: 'refining',
    basePower: 1000, powerExponent: 1.321928,
    inputSlots: 2, outputSlots: 2, fluidInputs: 2, fluidOutputs: 0,
    somersloopSlots: 4, compatibleRecipes: recipesFor('quantum_encoder'),
    footprint: { width: 12, length: 19 },
  },

  // ─── Power ──────────────────────────────────────
  biomass_burner: {
    key: 'biomass_burner', label: 'Biomass Burner', icon: 'biomass_burner.webp', category: 'power',
    basePower: -30, powerExponent: 1.0,
    inputSlots: 1, outputSlots: 0, fluidInputs: 0, fluidOutputs: 0,
    somersloopSlots: 0, compatibleRecipes: [],
    footprint: { width: 4, length: 4 },
  },
  coal_generator: {
    key: 'coal_generator', label: 'Coal Generator', icon: 'coal_generator.webp', category: 'power',
    basePower: -75, powerExponent: 1.0,
    inputSlots: 1, outputSlots: 0, fluidInputs: 1, fluidOutputs: 0,
    somersloopSlots: 0, compatibleRecipes: [],
    footprint: { width: 5, length: 8 },
  },
  fuel_generator: {
    key: 'fuel_generator', label: 'Fuel Generator', icon: 'fuel_generator.webp', category: 'power',
    basePower: -250, powerExponent: 1.0,
    inputSlots: 0, outputSlots: 0, fluidInputs: 1, fluidOutputs: 0,
    somersloopSlots: 0, compatibleRecipes: [],
    footprint: { width: 5, length: 10 },
  },
  nuclear_power_plant: {
    key: 'nuclear_power_plant', label: 'Nuclear Power Plant', icon: 'nuclear_power_plant.webp', category: 'power',
    basePower: -2500, powerExponent: 1.0,
    inputSlots: 1, outputSlots: 1, fluidInputs: 1, fluidOutputs: 0,
    somersloopSlots: 0, compatibleRecipes: [],
    footprint: { width: 19, length: 19 },
  },
  geothermal_generator: {
    key: 'geothermal_generator', label: 'Geothermal Generator', icon: 'geothermal_generator.webp', category: 'power',
    basePower: -200, powerExponent: 1.0,
    inputSlots: 0, outputSlots: 0, fluidInputs: 0, fluidOutputs: 0,
    somersloopSlots: 0, compatibleRecipes: [],
    footprint: { width: 5, length: 5 },
  },

  // ─── Logistics / virtual ───────────────────────────────────────
  item_source: {
    key: 'item_source', label: 'Item Source', icon: 'package.webp', category: 'logistics',
    basePower: 0, powerExponent: 1.0,
    // Output slot kind is flipped at runtime (item vs fluid) based on the
    // selected `extractionItem` — start as a generic item slot; the store
    // rewrites it when the user picks a fluid.
    inputSlots: 0, outputSlots: 1, fluidInputs: 0, fluidOutputs: 0,
    somersloopSlots: 0, compatibleRecipes: [],
    footprint: { width: 1, length: 1 },
  },
};

/** Get all machines in a category */
export function getMachinesByCategory(): Record<MachineCategory, MachineInfo[]> {
  const groups: Record<string, MachineInfo[]> = Object.create(null);
  for (const machine of Object.values(MACHINES)) {
    if (!groups[machine.category]) groups[machine.category] = [];
    groups[machine.category].push(machine);
  }
  return groups as Record<MachineCategory, MachineInfo[]>;
}

/** Get the MachineInfo for a recipe's machine type string */
export function getMachineForRecipe(machineType: string): MachineInfo | undefined {
  return Object.values(MACHINES).find(m => m.key === machineType);
}

/** Calculate power consumption with overclock + somersloop production-amplifier formula.
 *  power = basePower × (1 + slots/maxSlots)² × clock^exponent
 *  Returns same sign as basePower (negative = generation). */
export function calcPowerAtOverclock(
  basePower: number,
  exponent: number,
  overclock: number,
  somersloops: number = 0,
  somersloopSlots: number = 0,
): number {
  const ampFactor = somersloopSlots > 0 ? Math.pow(1 + somersloops / somersloopSlots, 2) : 1;
  return basePower * ampFactor * Math.pow(overclock, exponent);
}

/** Production multiplier from somersloops. Output is multiplied by (1 + slots/maxSlots). */
export function somersloopOutputMultiplier(somersloops: number, somersloopSlots: number): number {
  if (somersloopSlots <= 0 || somersloops <= 0) return 1;
  return 1 + somersloops / somersloopSlots;
}

/** Belt throughput limits (items/min) */
export const BELT_LIMITS = {
  belt_mk1: 60,
  belt_mk2: 120,
  belt_mk3: 270,
  belt_mk4: 480,
  belt_mk5: 780,
  belt_mk6: 1200,
} as const;

/** Pipe throughput limits (m3/min) */
export const PIPE_LIMITS = {
  pipe_mk1: 300,
  pipe_mk2: 600,
} as const;

/** Resource node purity multipliers */
export const NODE_PURITY = {
  impure: 0.5,
  normal: 1.0,
  pure: 2.0,
} as const;

/** Miner base output rates (items/min at 100% on normal node) */
export const MINER_BASE_RATES: Record<string, number> = {
  miner_mk1: 60,
  miner_mk2: 120,
  miner_mk3: 240,
};

/** Per-extractor list of valid extraction items.
 *  Used by the InspectorPanel to render the resource picker. */
export const EXTRACTABLE_RESOURCES: Record<string, readonly string[]> = {
  miner_mk1: ['iron_ore', 'copper_ore', 'limestone', 'coal', 'caterium_ore', 'raw_quartz', 'sulfur', 'bauxite', 'uranium', 'sam'],
  miner_mk2: ['iron_ore', 'copper_ore', 'limestone', 'coal', 'caterium_ore', 'raw_quartz', 'sulfur', 'bauxite', 'uranium', 'sam'],
  miner_mk3: ['iron_ore', 'copper_ore', 'limestone', 'coal', 'caterium_ore', 'raw_quartz', 'sulfur', 'bauxite', 'uranium', 'sam'],
  water_extractor: ['water'],
  oil_extractor: ['crude_oil'],
  resource_well_pressurizer: ['water', 'crude_oil', 'nitrogen_gas'],
};

/** Default extraction item per extractor (locked or first). */
export const DEFAULT_EXTRACTION_ITEM: Record<string, string | null> = {
  miner_mk1: null,
  miner_mk2: null,
  miner_mk3: null,
  water_extractor: 'water',
  oil_extractor: 'crude_oil',
  resource_well_pressurizer: null,
  item_source: null,
};

/** ItemSource default rate (items/min). */
export const DEFAULT_ITEM_SOURCE_RATE = 60;

/** Category display labels */
export const CATEGORY_LABELS: Record<MachineCategory, string> = {
  extraction: 'Extraction',
  smelting: 'Smelting',
  production: 'Production',
  refining: 'Refining',
  power: 'Power Generation',
  logistics: 'Logistics',
};
