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

  basePower: number;              // MW at 100% clock
  powerExponent: number;          // overclock power scaling exponent

  inputSlots: number;
  outputSlots: number;
  fluidInputs: number;
  fluidOutputs: number;

  compatibleRecipes: string[];    // populated dynamically from RECIPES

  footprint: { width: number; length: number };  // in foundations
}

// Build recipe compatibility maps from the RECIPES array
function buildRecipeMap(): Record<string, string[]> {
  // Use Object.create(null) to avoid prototype collisions (like "constructor")
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
    key: 'miner_mk1',
    label: 'Miner Mk.1',
    icon: 'miner_mk1.webp',
    category: 'extraction',
    basePower: 5,
    powerExponent: 1.321928,
    inputSlots: 0,
    outputSlots: 1,
    fluidInputs: 0,
    fluidOutputs: 0,
    compatibleRecipes: [],  // miners use resource nodes, not crafting recipes
    footprint: { width: 5, length: 6 },
  },
  miner_mk2: {
    key: 'miner_mk2',
    label: 'Miner Mk.2',
    icon: 'miner_mk2.webp',
    category: 'extraction',
    basePower: 12,
    powerExponent: 1.321928,
    inputSlots: 0,
    outputSlots: 1,
    fluidInputs: 0,
    fluidOutputs: 0,
    compatibleRecipes: [],
    footprint: { width: 5, length: 6 },
  },
  miner_mk3: {
    key: 'miner_mk3',
    label: 'Miner Mk.3',
    icon: 'miner_mk3.webp',
    category: 'extraction',
    basePower: 30,
    powerExponent: 1.321928,
    inputSlots: 0,
    outputSlots: 1,
    fluidInputs: 0,
    fluidOutputs: 0,
    compatibleRecipes: [],
    footprint: { width: 5, length: 6 },
  },
  water_extractor: {
    key: 'water_extractor',
    label: 'Water Extractor',
    icon: 'water_extractor.webp',
    category: 'extraction',
    basePower: 20,
    powerExponent: 1.321928,
    inputSlots: 0,
    outputSlots: 0,
    fluidInputs: 0,
    fluidOutputs: 1,
    compatibleRecipes: [],
    footprint: { width: 5, length: 8 },
  },
  oil_extractor: {
    key: 'oil_extractor',
    label: 'Oil Extractor',
    icon: 'oil_extractor.webp',
    category: 'extraction',
    basePower: 40,
    powerExponent: 1.321928,
    inputSlots: 0,
    outputSlots: 0,
    fluidInputs: 0,
    fluidOutputs: 1,
    compatibleRecipes: [],
    footprint: { width: 5, length: 8 },
  },
  resource_well_pressurizer: {
    key: 'resource_well_pressurizer',
    label: 'Resource Well Pressurizer',
    icon: 'resource_well_pressurizer.webp',
    category: 'extraction',
    basePower: 150,
    powerExponent: 1.321928,
    inputSlots: 0,
    outputSlots: 0,
    fluidInputs: 0,
    fluidOutputs: 1,
    compatibleRecipes: [],
    footprint: { width: 5, length: 5 },
  },

  // ─── Smelting ───────────────────────────────────
  smelter: {
    key: 'smelter',
    label: 'Smelter',
    icon: 'smelter.webp',
    category: 'smelting',
    basePower: 4,
    powerExponent: 1.321928,
    inputSlots: 1,
    outputSlots: 1,
    fluidInputs: 0,
    fluidOutputs: 0,
    compatibleRecipes: recipesFor('smelter'),
    footprint: { width: 3, length: 4 },
  },
  foundry: {
    key: 'foundry',
    label: 'Foundry',
    icon: 'foundry.webp',
    category: 'smelting',
    basePower: 16,
    powerExponent: 1.321928,
    inputSlots: 2,
    outputSlots: 1,
    fluidInputs: 0,
    fluidOutputs: 0,
    compatibleRecipes: recipesFor('foundry'),
    footprint: { width: 5, length: 5 },
  },

  // ─── Production ─────────────────────────────────
  constructor: {
    key: 'constructor',
    label: 'Constructor',
    icon: 'constructor.webp',
    category: 'production',
    basePower: 4,
    powerExponent: 1.321928,
    inputSlots: 1,
    outputSlots: 1,
    fluidInputs: 0,
    fluidOutputs: 0,
    compatibleRecipes: recipesFor('constructor'),
    footprint: { width: 4, length: 5 },
  },
  assembler: {
    key: 'assembler',
    label: 'Assembler',
    icon: 'assembler.webp',
    category: 'production',
    basePower: 15,
    powerExponent: 1.321928,
    inputSlots: 2,
    outputSlots: 1,
    fluidInputs: 0,
    fluidOutputs: 0,
    compatibleRecipes: recipesFor('assembler'),
    footprint: { width: 5, length: 8 },
  },
  manufacturer: {
    key: 'manufacturer',
    label: 'Manufacturer',
    icon: 'manufacturer.webp',
    category: 'production',
    basePower: 55,
    powerExponent: 1.321928,
    inputSlots: 4,
    outputSlots: 1,
    fluidInputs: 0,
    fluidOutputs: 0,
    compatibleRecipes: recipesFor('manufacturer'),
    footprint: { width: 9, length: 9 },
  },
  packager: {
    key: 'packager',
    label: 'Packager',
    icon: 'packager.webp',
    category: 'production',
    basePower: 10,
    powerExponent: 1.321928,
    inputSlots: 1,
    outputSlots: 1,
    fluidInputs: 1,
    fluidOutputs: 1,
    compatibleRecipes: recipesFor('packager'),
    footprint: { width: 4, length: 4 },
  },

  // ─── Refining ───────────────────────────────────
  refinery: {
    key: 'refinery',
    label: 'Refinery',
    icon: 'refinery.webp',
    category: 'refining',
    basePower: 30,
    powerExponent: 1.321928,
    inputSlots: 1,
    outputSlots: 1,
    fluidInputs: 1,
    fluidOutputs: 1,
    compatibleRecipes: recipesFor('refinery'),
    footprint: { width: 5, length: 10 },
  },
  blender: {
    key: 'blender',
    label: 'Blender',
    icon: 'blender.webp',
    category: 'refining',
    basePower: 75,
    powerExponent: 1.321928,
    inputSlots: 2,
    outputSlots: 1,
    fluidInputs: 2,
    fluidOutputs: 1,
    compatibleRecipes: recipesFor('blender'),
    footprint: { width: 9, length: 9 },
  },
  particle_accelerator: {
    key: 'particle_accelerator',
    label: 'Particle Accelerator',
    icon: 'particle_accelerator.webp',
    category: 'refining',
    basePower: 500,          // average; actual range 250–1500 varies by recipe
    powerExponent: 1.321928,
    inputSlots: 2,
    outputSlots: 1,
    fluidInputs: 1,
    fluidOutputs: 0,
    compatibleRecipes: recipesFor('particle_accelerator'),
    footprint: { width: 12, length: 19 },
  },
  converter: {
    key: 'converter',
    label: 'Converter',
    icon: 'converter.webp',
    category: 'refining',
    basePower: 400,
    powerExponent: 1.321928,
    inputSlots: 2,
    outputSlots: 2,
    fluidInputs: 0,
    fluidOutputs: 0,
    compatibleRecipes: recipesFor('converter'),
    footprint: { width: 8, length: 8 },
  },
  quantum_encoder: {
    key: 'quantum_encoder',
    label: 'Quantum Encoder',
    icon: 'quantum_encoder.webp',
    category: 'refining',
    basePower: 1000,         // average; actual range 0–2000
    powerExponent: 1.321928,
    inputSlots: 2,
    outputSlots: 2,
    fluidInputs: 2,
    fluidOutputs: 0,
    compatibleRecipes: recipesFor('quantum_encoder'),
    footprint: { width: 12, length: 19 },
  },

  // ─── Power ──────────────────────────────────────
  biomass_burner: {
    key: 'biomass_burner',
    label: 'Biomass Burner',
    icon: 'biomass_burner.webp',
    category: 'power',
    basePower: -30,  // negative = generates power
    powerExponent: 1.0,
    inputSlots: 1,
    outputSlots: 0,
    fluidInputs: 0,
    fluidOutputs: 0,
    compatibleRecipes: [],
    footprint: { width: 4, length: 4 },
  },
  coal_generator: {
    key: 'coal_generator',
    label: 'Coal Generator',
    icon: 'coal_generator.webp',
    category: 'power',
    basePower: -75,
    powerExponent: 1.0,
    inputSlots: 1,
    outputSlots: 0,
    fluidInputs: 1,
    fluidOutputs: 0,
    compatibleRecipes: [],
    footprint: { width: 5, length: 8 },
  },
  fuel_generator: {
    key: 'fuel_generator',
    label: 'Fuel Generator',
    icon: 'fuel_generator.webp',
    category: 'power',
    basePower: -250,
    powerExponent: 1.0,
    inputSlots: 0,
    outputSlots: 0,
    fluidInputs: 1,
    fluidOutputs: 0,
    compatibleRecipes: [],
    footprint: { width: 5, length: 10 },
  },
  nuclear_power_plant: {
    key: 'nuclear_power_plant',
    label: 'Nuclear Power Plant',
    icon: 'nuclear_power_plant.webp',
    category: 'power',
    basePower: -2500,
    powerExponent: 1.0,
    inputSlots: 1,
    outputSlots: 1,
    fluidInputs: 1,
    fluidOutputs: 0,
    compatibleRecipes: [],
    footprint: { width: 19, length: 19 },
  },
  geothermal_generator: {
    key: 'geothermal_generator',
    label: 'Geothermal Generator',
    icon: 'geothermal_generator.webp',
    category: 'power',
    basePower: -200,
    powerExponent: 1.0,
    inputSlots: 0,
    outputSlots: 0,
    fluidInputs: 0,
    fluidOutputs: 0,
    compatibleRecipes: [],
    footprint: { width: 5, length: 5 },
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

/** Calculate power consumption at a given overclock percentage */
export function calcPowerAtOverclock(basePower: number, exponent: number, overclock: number): number {
  return basePower * Math.pow(overclock, exponent);
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

/** Category display labels */
export const CATEGORY_LABELS: Record<MachineCategory, string> = {
  extraction: 'Extraction',
  smelting: 'Smelting',
  production: 'Production',
  refining: 'Refining',
  power: 'Power Generation',
  logistics: 'Logistics',
};
