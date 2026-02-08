// Production simulation engine
// Supports both:
//  1. Legacy item-based simulation (backward compatible)
//  2. New graph-based machine simulation
//
// Runs entirely client-side. Computes output/min, detects bottlenecks,
// checks belt/pipe limits, and generates improvement suggestions.

import { RECIPES, ITEMS, getRecipeForItem, type Recipe } from "@/data/recipes";
import { MACHINES, BELT_LIMITS, calcPowerAtOverclock } from "@/data/machines";
import type {
  MachineInstance,
  ConnectionPoint,
  FactorySimulationResult,
  SimulationNode,
  SimulationWarning,
  FactorySuggestion,
} from "@/types/factory";

// ═══════════════════════════════════════════════════════════════
// LEGACY ITEM-BASED SIMULATION (backward compatible)
// ═══════════════════════════════════════════════════════════════

/** Return the full list of recipes */
export function getRecipes(): Recipe[] {
  return RECIPES;
}

export interface SimulationInput {
  automated: boolean;
  machines: number;
  overclock: number;
}

export interface NodeResult {
  itemKey: string;
  label: string;
  recipe: Recipe | undefined;
  supplyRate: number;
  demandRate: number;
  surplus: number;
  ratio: number;
  isBottleneck: boolean;
  isRawResource: boolean;
  machines: number;
  overclock: number;
}

export interface Suggestion {
  type: "add_machines" | "automate_upstream" | "increase_overclock";
  itemKey: string;
  label: string;
  message: string;
  impact: string;
  priority: number;
  extraMachines?: number;
  targetOverclock?: number;
}

export interface SimulationResult {
  nodes: Record<string, NodeResult>;
  bottlenecks: NodeResult[];
  suggestions: Suggestion[];
  totalAutomated: number;
  totalItems: number;
}

/**
 * Calculate output per minute for a single recipe+machine setup.
 */
export function calcOutputPerMin(
  recipe: Recipe,
  machines: number,
  overclock: number,
  outputIndex: number = 0
): number {
  const cyclesPerMin = (60 / recipe.craft_time) * overclock;
  const outputPerMachine = cyclesPerMin * recipe.outputs[outputIndex].amount;
  return outputPerMachine * machines;
}

/**
 * Calculate input consumption per minute for a recipe+machine setup.
 */
export function calcInputPerMin(
  recipe: Recipe,
  machines: number,
  overclock: number,
  inputIndex: number
): number {
  const cyclesPerMin = (60 / recipe.craft_time) * overclock;
  const inputPerMachine = cyclesPerMin * recipe.inputs[inputIndex].amount;
  return inputPerMachine * machines;
}

/**
 * Run full production simulation on the given item states (legacy).
 */
export function simulate(
  items: Record<string, SimulationInput>
): SimulationResult {
  const nodes: Record<string, NodeResult> = Object.create(null);
  const automatedKeys = Object.keys(items).filter((k) => items[k].automated);

  // Step 1: Calculate supply rate for each automated item
  for (const key of automatedKeys) {
    const item = items[key];
    const recipe = getRecipeForItem(key);
    const info = ITEMS[key];
    const isRaw = info?.category === "resource";

    let supplyRate = 0;
    if (recipe && !isRaw) {
      supplyRate = calcOutputPerMin(recipe, item.machines, item.overclock);
    } else if (isRaw) {
      supplyRate = item.machines * 60 * item.overclock;
    }

    nodes[key] = {
      itemKey: key,
      label: info?.label ?? key,
      recipe,
      supplyRate,
      demandRate: 0,
      surplus: 0,
      ratio: 1,
      isBottleneck: false,
      isRawResource: isRaw,
      machines: item.machines,
      overclock: item.overclock,
    };
  }

  // Step 2: Calculate demand rate for each item based on downstream consumers
  for (const key of automatedKeys) {
    const recipe = nodes[key]?.recipe;
    if (!recipe) continue;

    const item = items[key];
    const cyclesPerMin = (60 / recipe.craft_time) * item.overclock;

    for (const input of recipe.inputs) {
      const inputDemand = cyclesPerMin * input.amount * item.machines;

      if (nodes[input.item]) {
        nodes[input.item].demandRate += inputDemand;
      } else {
        const inputInfo = ITEMS[input.item];
        nodes[input.item] = {
          itemKey: input.item,
          label: inputInfo?.label ?? input.item,
          recipe: getRecipeForItem(input.item),
          supplyRate: 0,
          demandRate: inputDemand,
          surplus: 0,
          ratio: 0,
          isBottleneck: true,
          isRawResource: inputInfo?.category === "resource",
          machines: 0,
          overclock: 1,
        };
      }
    }
  }

  // Step 3: Calculate surplus and ratio
  for (const node of Object.values(nodes)) {
    if (node.demandRate > 0) {
      node.surplus = node.supplyRate - node.demandRate;
      node.ratio = node.supplyRate / node.demandRate;
      node.isBottleneck = node.ratio < 0.99;
    } else {
      node.surplus = node.supplyRate;
      node.ratio = Infinity;
      node.isBottleneck = false;
    }
  }

  // Step 4: Sort bottlenecks by severity
  const bottlenecks = Object.values(nodes)
    .filter((n) => n.isBottleneck)
    .sort((a, b) => a.ratio - b.ratio);

  // Step 5: Generate suggestions
  const suggestions = generateSuggestions(nodes, items);

  return {
    nodes,
    bottlenecks,
    suggestions,
    totalAutomated: automatedKeys.length,
    totalItems: Object.keys(ITEMS).length,
  };
}

function generateSuggestions(
  nodes: Record<string, NodeResult>,
  items: Record<string, SimulationInput>
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  for (const node of Object.values(nodes)) {
    if (!node.isBottleneck) continue;

    const shortfall = node.demandRate - node.supplyRate;
    const pctShortfall = node.demandRate > 0
      ? ((shortfall / node.demandRate) * 100).toFixed(0)
      : "100";

    if (node.machines === 0 && !node.isRawResource) {
      const recipe = node.recipe;
      if (recipe) {
        const outputPerMachine = calcOutputPerMin(recipe, 1, 1.0);
        const needed = Math.ceil(shortfall / outputPerMachine);
        const machineType = recipe.machine.replace(/_/g, " ");

        suggestions.push({
          type: "automate_upstream",
          itemKey: node.itemKey,
          label: node.label,
          message: `Automate ${node.label} upstream — current supply is manual, causing ${pctShortfall}% bottleneck.`,
          impact: `Add ${needed} ${machineType}${needed > 1 ? "s" : ""} for +${(outputPerMachine * needed).toFixed(1)}/min`,
          priority: shortfall,
          extraMachines: needed,
        });
      }
    } else if (node.supplyRate > 0) {
      const recipe = node.recipe;
      if (recipe) {
        const outputPerMachine = calcOutputPerMin(recipe, 1, node.overclock);
        const needed = Math.ceil(shortfall / outputPerMachine);
        const machineType = recipe.machine.replace(/_/g, " ");

        suggestions.push({
          type: "add_machines",
          itemKey: node.itemKey,
          label: node.label,
          message: `Add ${needed} ${machineType}${needed > 1 ? "s" : ""} for ${node.label} (adds +${(outputPerMachine * needed).toFixed(1)}/min).`,
          impact: `Resolves ${pctShortfall}% shortfall`,
          priority: shortfall,
          extraMachines: needed,
        });

        if (node.overclock < 2.5 && needed <= 2) {
          const targetOC = Math.min(2.5, node.overclock * (node.demandRate / node.supplyRate));
          const ocOutput = calcOutputPerMin(recipe, node.machines, targetOC);
          if (ocOutput >= node.demandRate) {
            suggestions.push({
              type: "increase_overclock",
              itemKey: node.itemKey,
              label: node.label,
              message: `Increase ${node.label} overclock to ${(targetOC * 100).toFixed(0)}% instead of adding machines.`,
              impact: `Saves ${needed} machine${needed > 1 ? "s" : ""} but uses more power`,
              priority: shortfall * 0.8,
              targetOverclock: targetOC,
            });
          }
        }
      }
    }
  }

  return suggestions.sort((a, b) => b.priority - a.priority);
}


// ═══════════════════════════════════════════════════════════════
// NEW GRAPH-BASED MACHINE SIMULATION
// ═══════════════════════════════════════════════════════════════

/**
 * Build an adjacency map from machine connections.
 * Returns { machineId → [upstream machineIds] } and { machineId → [downstream machineIds] }
 */
function buildAdjacency(machines: MachineInstance[]): {
  upstream: Record<string, string[]>;
  downstream: Record<string, string[]>;
} {
  const upstream: Record<string, string[]> = Object.create(null);
  const downstream: Record<string, string[]> = Object.create(null);

  for (const m of machines) {
    upstream[m.id] = [];
    downstream[m.id] = [];
  }

  for (const m of machines) {
    for (const input of m.inputs) {
      if (input.connectedTo) {
        const srcId = input.connectedTo.machineId;
        if (!upstream[m.id].includes(srcId)) {
          upstream[m.id].push(srcId);
        }
        if (!downstream[srcId]) downstream[srcId] = [];
        if (!downstream[srcId].includes(m.id)) {
          downstream[srcId].push(m.id);
        }
      }
    }
  }

  return { upstream, downstream };
}

/**
 * Topological sort of machines (Kahn's algorithm).
 * Machines with no upstream dependencies come first.
 */
function topologicalSort(
  machines: MachineInstance[],
  upstream: Record<string, string[]>
): string[] {
  const inDegree: Record<string, number> = Object.create(null);
  for (const m of machines) {
    inDegree[m.id] = (upstream[m.id] ?? []).length;
  }

  const queue: string[] = [];
  for (const m of machines) {
    if (inDegree[m.id] === 0) queue.push(m.id);
  }

  const sorted: string[] = [];
  const machineMap = new Map(machines.map(m => [m.id, m]));

  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(id);

    const machine = machineMap.get(id);
    if (!machine) continue;

    // For each output connection, reduce downstream inDegree
    for (const output of machine.outputs) {
      if (output.connectedTo) {
        const downId = output.connectedTo.machineId;
        inDegree[downId]--;
        if (inDegree[downId] === 0) {
          queue.push(downId);
        }
      }
    }
  }

  // If we didn't sort all machines, there's a cycle — add remaining
  for (const m of machines) {
    if (!sorted.includes(m.id)) {
      sorted.push(m.id);
    }
  }

  return sorted;
}

/**
 * Run graph-based factory simulation on placed machines.
 */
export function simulateFactory(machines: MachineInstance[]): FactorySimulationResult {
  if (machines.length === 0) {
    return {
      nodes: {},
      totalPower: 0,
      totalItems: {},
      externalInputs: [],
      finalOutputs: [],
      criticalIssues: [],
      warnings: [],
      suggestions: [],
    };
  }

  const machineMap = new Map(machines.map(m => [m.id, m]));
  const { upstream, downstream } = buildAdjacency(machines);
  const sortedIds = topologicalSort(machines, upstream);

  const nodes: Record<string, SimulationNode> = Object.create(null);
  // Track what each machine produces and what's available on each output
  const outputAvailable: Record<string, Record<number, { item: string; rate: number }>> = Object.create(null);

  // Initialize nodes
  for (const m of machines) {
    const recipe = m.recipe ? RECIPES.find(r => r.id === m.recipe) : null;
    const machineInfo = MACHINES[m.machineType];

    nodes[m.id] = {
      machineId: m.id,
      recipe: m.recipe,
      theoreticalOutput: 0,
      actualOutput: 0,
      inputSatisfaction: 1,
      inputSlots: [],
      outputSlots: [],
      powerDraw: 0,
      warnings: [],
    };

    outputAvailable[m.id] = {};

    // No recipe configured
    if (!recipe && machineInfo && machineInfo.category !== 'extraction' && machineInfo.category !== 'power') {
      nodes[m.id].warnings.push({
        type: 'no_recipe',
        message: `${machineInfo.label} has no recipe selected.`,
        severity: 'error',
        machineId: m.id,
      });
    }
  }

  // Forward pass: traverse in topological order
  for (const id of sortedIds) {
    const machine = machineMap.get(id);
    if (!machine) continue;

    const recipe = machine.recipe ? RECIPES.find(r => r.id === machine.recipe) : null;
    const machineInfo = MACHINES[machine.machineType];
    const node = nodes[id];

    if (!machineInfo) continue;

    // Handle extraction machines (miners, water extractors, etc.)
    if (machineInfo.category === 'extraction') {
      // Miners output based on their base rate * overclock
      const baseRate = machine.machineType === 'miner_mk1' ? 60
        : machine.machineType === 'miner_mk2' ? 120
        : machine.machineType === 'miner_mk3' ? 240
        : machine.machineType === 'water_extractor' ? 120
        : machine.machineType === 'oil_extractor' ? 120
        : 60;

      const outputRate = baseRate * machine.overclock;
      node.theoreticalOutput = outputRate;
      node.actualOutput = outputRate;
      node.inputSatisfaction = 1;

      // Determine output item from first connected output
      const outputItem = machine.outputs[0]?.itemType ?? 'unknown';
      node.outputSlots = [{
        item: outputItem,
        produced: outputRate,
        consumed: 0,
        surplus: outputRate,
        destinations: [],
      }];

      outputAvailable[id][0] = { item: outputItem, rate: outputRate };

      // Power
      node.powerDraw = calcPowerAtOverclock(
        Math.abs(machineInfo.basePower),
        machineInfo.powerExponent,
        machine.overclock
      );
      continue;
    }

    // Handle power generators
    if (machineInfo.category === 'power') {
      node.powerDraw = machineInfo.basePower; // negative = generates
      continue;
    }

    // Production machine with recipe
    if (!recipe) continue;

    const cyclesPerMin = (60 / recipe.craft_time) * machine.overclock;

    // Calculate theoretical output
    node.theoreticalOutput = cyclesPerMin * (recipe.outputs[0]?.amount ?? 0);

    // Determine input satisfaction
    let minSatisfaction = 1;
    const inputSlots: SimulationNode['inputSlots'] = [];

    for (let i = 0; i < recipe.inputs.length; i++) {
      const recipeInput = recipe.inputs[i];
      const needed = cyclesPerMin * recipeInput.amount;
      let available = 0;
      let source: string | 'external' = 'external';

      // Check if this input slot has a connection
      const conn: ConnectionPoint | undefined = machine.inputs[i];
      if (conn?.connectedTo) {
        const srcId = conn.connectedTo.machineId;
        const srcSlot = conn.connectedTo.slot;
        const srcOutput = outputAvailable[srcId]?.[srcSlot];
        if (srcOutput) {
          available = srcOutput.rate;
          source = srcId;

          // Consume from the source's available output
          // Check belt limit
          const beltLimit = conn.maxRate || BELT_LIMITS.belt_mk5;
          available = Math.min(available, beltLimit);

          if (available < needed && srcOutput.rate >= needed) {
            node.warnings.push({
              type: 'belt_limit',
              message: `Belt to ${machineInfo.label} for ${recipeInput.item.replace(/_/g, ' ')} is saturated (${beltLimit}/min limit).`,
              severity: 'warning',
              machineId: id,
            });
          }
        }
      }

      const satisfaction = needed > 0 ? Math.min(1, available / needed) : 1;
      if (satisfaction < minSatisfaction) {
        minSatisfaction = satisfaction;
      }

      inputSlots.push({
        item: recipeInput.item,
        needed,
        available,
        source,
      });
    }

    node.inputSatisfaction = minSatisfaction;
    node.inputSlots = inputSlots;

    // Calculate actual output limited by input satisfaction
    node.actualOutput = node.theoreticalOutput * minSatisfaction;

    // Build output slots
    const outputSlots: SimulationNode['outputSlots'] = [];
    for (let i = 0; i < recipe.outputs.length; i++) {
      const recipeOutput = recipe.outputs[i];
      const produced = cyclesPerMin * recipeOutput.amount * minSatisfaction;

      outputSlots.push({
        item: recipeOutput.item,
        produced,
        consumed: 0,
        surplus: produced,
        destinations: [],
      });

      outputAvailable[id][i] = { item: recipeOutput.item, rate: produced };
    }
    node.outputSlots = outputSlots;

    // Power
    node.powerDraw = calcPowerAtOverclock(
      Math.abs(machineInfo.basePower),
      machineInfo.powerExponent,
      machine.overclock
    );

    // Bottleneck warning
    if (minSatisfaction < 0.99) {
      node.warnings.push({
        type: 'bottleneck',
        message: `${machineInfo.label} is starved — only ${(minSatisfaction * 100).toFixed(0)}% input satisfaction.`,
        severity: 'warning',
        machineId: id,
      });
    }

    // Disconnected inputs
    for (let i = 0; i < recipe.inputs.length; i++) {
      if (!machine.inputs[i]?.connectedTo) {
        node.warnings.push({
          type: 'disconnected',
          message: `${machineInfo.label} input slot ${i} (${recipe.inputs[i].item.replace(/_/g, ' ')}) is not connected.`,
          severity: 'info',
          machineId: id,
        });
      }
    }
  }

  // Second pass: mark consumed amounts on output slots
  for (const machine of machines) {
    for (const input of machine.inputs) {
      if (input.connectedTo && input.itemType) {
        const srcNode = nodes[input.connectedTo.machineId];
        if (srcNode) {
          const outputSlot = srcNode.outputSlots[input.connectedTo.slot];
          if (outputSlot) {
            const recipe = machine.recipe ? RECIPES.find(r => r.id === machine.recipe) : null;
            if (recipe) {
              const inputDef = recipe.inputs.find(ri => ri.item === input.itemType);
              if (inputDef) {
                const cyclesPerMin = (60 / recipe.craft_time) * machine.overclock;
                const consumed = cyclesPerMin * inputDef.amount * nodes[machine.id].inputSatisfaction;
                outputSlot.consumed += consumed;
                outputSlot.surplus = outputSlot.produced - outputSlot.consumed;
                outputSlot.destinations.push(machine.id);
              }
            }
          }
        }
      }
    }
  }

  // Aggregate factory-wide stats
  let totalPower = 0;
  const totalItems: Record<string, { produced: number; consumed: number; net: number }> = {};
  const allWarnings: SimulationWarning[] = [];
  const criticalIssues: SimulationWarning[] = [];

  for (const node of Object.values(nodes)) {
    totalPower += node.powerDraw;

    for (const os of node.outputSlots) {
      if (!totalItems[os.item]) totalItems[os.item] = { produced: 0, consumed: 0, net: 0 };
      totalItems[os.item].produced += os.produced;
    }
    for (const is_ of node.inputSlots) {
      if (!totalItems[is_.item]) totalItems[is_.item] = { produced: 0, consumed: 0, net: 0 };
      totalItems[is_.item].consumed += is_.needed * (node.inputSatisfaction);
    }

    for (const w of node.warnings) {
      if (w.severity === 'error') criticalIssues.push(w);
      else allWarnings.push(w);
    }
  }

  // Calculate net
  for (const item of Object.values(totalItems)) {
    item.net = item.produced - item.consumed;
  }

  // External inputs (consumed but not produced)
  const externalInputs = Object.entries(totalItems)
    .filter(([, v]) => v.net < -0.01)
    .map(([item, v]) => ({ item, rate: Math.abs(v.net) }))
    .sort((a, b) => b.rate - a.rate);

  // Final outputs (produced but not consumed)
  const finalOutputs = Object.entries(totalItems)
    .filter(([, v]) => v.net > 0.01)
    .map(([item, v]) => ({ item, rate: v.net }))
    .sort((a, b) => b.rate - a.rate);

  // Generate suggestions for the new system
  const suggestions = generateFactorySuggestions(machines, nodes);

  return {
    nodes,
    totalPower,
    totalItems,
    externalInputs,
    finalOutputs,
    criticalIssues,
    warnings: allWarnings,
    suggestions,
  };
}

function generateFactorySuggestions(
  machines: MachineInstance[],
  nodes: Record<string, SimulationNode>
): FactorySuggestion[] {
  const suggestions: FactorySuggestion[] = [];

  for (const machine of machines) {
    const node = nodes[machine.id];
    if (!node) continue;
    const machineInfo = MACHINES[machine.machineType];
    if (!machineInfo) continue;

    // Suggest recipe if not set
    if (!node.recipe && machineInfo.category !== 'extraction' && machineInfo.category !== 'power') {
      suggestions.push({
        type: 'fix_recipe',
        message: `Set a recipe for ${machineInfo.label}.`,
        impact: 'Machine is idle without a recipe.',
        machineId: machine.id,
        priority: 100,
      });
      continue;
    }

    // Suggest overclock reduction if over 100% and has surplus output
    if (machine.overclock > 1.01) {
      for (const os of node.outputSlots) {
        if (os.surplus > os.produced * 0.3) {
          suggestions.push({
            type: 'change_overclock',
            message: `Reduce overclock on ${machineInfo.label} — ${os.item.replace(/_/g, ' ')} has ${os.surplus.toFixed(1)}/min surplus.`,
            impact: `Save power by reducing from ${(machine.overclock * 100).toFixed(0)}% to 100%.`,
            machineId: machine.id,
            overclock: 1.0,
            priority: 20,
          });
        }
      }
    }

    // Suggest adding machines for starved inputs
    if (node.inputSatisfaction < 0.99 && node.inputSatisfaction > 0) {
      for (const is_ of node.inputSlots) {
        if (is_.available < is_.needed && is_.source === 'external') {
          const deficit = is_.needed - is_.available;
          const recipe = getRecipeForItem(is_.item);
          if (recipe) {
            const outputPerMachine = calcOutputPerMin(recipe, 1, 1.0);
            const count = Math.ceil(deficit / outputPerMachine);
            const mt = recipe.machine as keyof typeof MACHINES;
            suggestions.push({
              type: 'add_machine',
              message: `Add ${count} ${recipe.machine.replace(/_/g, ' ')}(s) producing ${is_.item.replace(/_/g, ' ')} to supply ${machineInfo.label}.`,
              impact: `+${(outputPerMachine * count).toFixed(1)}/min ${is_.item.replace(/_/g, ' ')}`,
              machineType: MACHINES[mt] ? mt : undefined,
              recipe: recipe.id,
              count,
              priority: deficit,
            });
          }
        }
      }
    }
  }

  return suggestions.sort((a, b) => b.priority - a.priority);
}
