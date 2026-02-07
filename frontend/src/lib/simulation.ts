import type { ProjectData, SimulationResult, ItemSimResult, Bottleneck, Suggestion, Recipe } from '@/types'
import recipesData from '@/data/recipes.json'

const recipes: Recipe[] = recipesData.recipes
const rawMaterials: Set<string> = new Set(recipesData.raw_materials)
const machineData: Record<string, { power_mw: number }> = recipesData.machines

// Build lookup maps
const recipeByOutput = new Map<string, Recipe>()
recipes.forEach(recipe => {
  recipe.outputs.forEach(output => {
    recipeByOutput.set(output.item, recipe)
  })
})

/**
 * Calculate output per minute for a single machine
 */
function calculateOutputPerMachine(recipe: Recipe, overclock: number = 1.0): number {
  const cyclesPerMinute = (60 / recipe.craft_time_sec) * overclock
  const outputPerCycle = recipe.outputs[0]?.amount ?? 1
  return cyclesPerMinute * outputPerCycle
}

/**
 * Calculate input consumption per minute for a single machine
 */
function calculateInputsPerMachine(recipe: Recipe, overclock: number = 1.0): Map<string, number> {
  const cyclesPerMinute = (60 / recipe.craft_time_sec) * overclock
  const inputs = new Map<string, number>()
  
  recipe.inputs.forEach(input => {
    inputs.set(input.item, input.amount * cyclesPerMinute)
  })
  
  return inputs
}

/**
 * Build dependency graph from automated items
 * @internal Reserved for future graph-based simulation
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _buildDependencyGraph(items: Record<string, { automated: boolean; machines: number; overclock: number }>): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>() // item -> items it depends on
  
  Object.keys(items).forEach(itemKey => {
    if (!items[itemKey].automated) return
    
    const recipe = recipeByOutput.get(itemKey)
    if (!recipe) return
    
    const deps = new Set<string>()
    recipe.inputs.forEach(input => {
      if (!rawMaterials.has(input.item)) {
        deps.add(input.item)
      }
    })
    
    graph.set(itemKey, deps)
  })
  
  return graph
}

/**
 * Topological sort for dependency graph
 * @internal Reserved for future graph-based simulation
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _topologicalSort(graph: Map<string, Set<string>>): string[] {
  const visited = new Set<string>()
  const result: string[] = []
  
  function visit(node: string) {
    if (visited.has(node)) return
    visited.add(node)
    
    const deps = graph.get(node)
    if (deps) {
      deps.forEach(dep => visit(dep))
    }
    
    result.push(node)
  }
  
  graph.forEach((_, node) => visit(node))
  
  return result
}

/**
 * Run production simulation
 */
export function runSimulation(project: ProjectData): SimulationResult {
  const items = project.items
  const itemResults: Record<string, ItemSimResult> = {}
  const rawMaterialNeeds: Record<string, number> = {}
  
  // Calculate supply rates for all automated items
  const supplyRates = new Map<string, number>()
  
  Object.entries(items).forEach(([itemKey, item]) => {
    if (!item.automated) return
    
    const recipe = recipeByOutput.get(itemKey)
    if (!recipe) return
    
    const outputPerMachine = calculateOutputPerMachine(recipe, item.overclock)
    const totalOutput = outputPerMachine * item.machines
    
    supplyRates.set(itemKey, totalOutput)
  })
  
  // Calculate demand rates (what consumers need)
  const demandRates = new Map<string, number>()
  
  Object.entries(items).forEach(([itemKey, item]) => {
    if (!item.automated) return
    
    const recipe = recipeByOutput.get(itemKey)
    if (!recipe) return
    
    const inputsPerMachine = calculateInputsPerMachine(recipe, item.overclock)
    
    inputsPerMachine.forEach((amountPerMin, inputItem) => {
      const totalDemand = amountPerMin * item.machines
      
      if (rawMaterials.has(inputItem)) {
        rawMaterialNeeds[inputItem] = (rawMaterialNeeds[inputItem] || 0) + totalDemand
      } else {
        demandRates.set(inputItem, (demandRates.get(inputItem) || 0) + totalDemand)
      }
    })
  })
  
  // Calculate results for each automated item
  Object.entries(items).forEach(([itemKey, item]) => {
    if (!item.automated) return
    
    const supply = supplyRates.get(itemKey) || 0
    const demand = demandRates.get(itemKey) || 0
    
    const shortfall = Math.max(0, demand - supply)
    const shortfallPercent = demand > 0 ? (shortfall / demand) * 100 : 0
    
    itemResults[itemKey] = {
      outputPerMin: supply,
      demandPerMin: demand,
      supplyPerMin: supply,
      isBottleneck: shortfall > 0,
      isSurplus: supply > demand && demand > 0,
      shortfall,
      shortfallPercent, 
    }
  })
  
  // Find bottlenecks (top 3)
  const bottlenecks: Bottleneck[] = Object.entries(itemResults)
    .filter(([, result]) => result.isBottleneck)
    .map(([itemKey, result]) => {
      const recipe = recipeByOutput.get(itemKey)
      const outputPerMachine = recipe 
        ? calculateOutputPerMachine(recipe, items[itemKey]?.overclock || 1.0)
        : 1
      
      return {
        itemKey,
        label: items[itemKey]?.label || itemKey,
        shortfall: result.shortfall,
        shortfallPercent: result.shortfallPercent,
        neededMachines: Math.ceil(result.shortfall / outputPerMachine),
      }
    })
    .sort((a, b) => b.shortfallPercent - a.shortfallPercent)
    .slice(0, 3)
  
  // Generate suggestions
  const suggestions: Suggestion[] = []
  
  // Suggestion: Add machines for bottlenecks
  bottlenecks.forEach(bottleneck => {
    const recipe = recipeByOutput.get(bottleneck.itemKey)
    if (!recipe) return
    
    const outputPerMachine = calculateOutputPerMachine(recipe, items[bottleneck.itemKey]?.overclock || 1.0)
    const machineName = getMachineName(recipe.machine_type)
    
    suggestions.push({
      type: 'add_machines',
      itemKey: bottleneck.itemKey,
      label: bottleneck.label,
      message: `Add ${bottleneck.neededMachines} ${machineName}(s) for ${bottleneck.label} (adds +${(outputPerMachine * bottleneck.neededMachines).toFixed(1)}/min)`,
      machinesNeeded: bottleneck.neededMachines,
      expectedGain: outputPerMachine * bottleneck.neededMachines,
    })
  })
  
  // Suggestion: Automate upstream items that have demand but aren't automated
  demandRates.forEach((demand, itemKey) => {
    if (!items[itemKey] || !items[itemKey].automated) {
      const recipe = recipeByOutput.get(itemKey)
      if (recipe) {
        const outputPerMachine = calculateOutputPerMachine(recipe, 1.0)
        const machinesNeeded = Math.ceil(demand / outputPerMachine)
        
        suggestions.push({
          type: 'automate_upstream',
          itemKey,
          label: recipe.label,
          message: `Automate ${recipe.label} upstream — current supply is manual, causing ${((demand / (demand + 0.001)) * 100).toFixed(0)}% demand gap. Need ~${machinesNeeded} ${getMachineName(recipe.machine_type)}(s).`,
          machinesNeeded,
        })
      }
    }
  })
  
  return {
    items: itemResults,
    bottlenecks,
    suggestions: suggestions.slice(0, 5), // Limit to 5 suggestions
    rawMaterials: rawMaterialNeeds,
  }
}

function getMachineName(machineType: string): string {
  const names: Record<string, string> = {
    smelter: 'Smelter',
    constructor: 'Constructor',
    assembler: 'Assembler',
    manufacturer: 'Manufacturer',
    foundry: 'Foundry',
    refinery: 'Refinery',
    packager: 'Packager',
    blender: 'Blender',
    particle_accelerator: 'Particle Accelerator',
  }
  return names[machineType] || machineType
}

/**
 * Get estimated power consumption for a configuration
 */
export function estimatePower(
  machineType: string, 
  machineCount: number, 
  overclock: number = 1.0
): number {
  const basePower = machineData[machineType]?.power_mw || 0
  // Power scales with overclock^1.6 (Satisfactory formula)
  return basePower * machineCount * Math.pow(overclock, 1.6)
}

/**
 * Get all recipes
 */
export function getRecipes(): Recipe[] {
  return recipes
}

/**
 * Check if an item is a raw material
 */
export function isRawMaterial(itemKey: string): boolean {
  return rawMaterials.has(itemKey)
}

/**
 * Get recipe for an item
 */
export function getRecipeForItem(itemKey: string): Recipe | undefined {
  return recipeByOutput.get(itemKey)
}
