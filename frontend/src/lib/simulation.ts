// Production simulation engine
// Runs entirely client-side. Computes output/min for automated items,
// detects bottlenecks, and generates improvement suggestions.

import { RECIPES, ITEMS, getRecipeForItem, type Recipe } from "@/data/recipes";

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
  supplyRate: number;     // items/min produced by assigned machines
  demandRate: number;     // items/min required by downstream consumers
  surplus: number;        // supply - demand (negative = bottleneck)
  ratio: number;          // supply / demand (< 1 = bottleneck)
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
  priority: number; // higher = more urgent
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
 * Run full production simulation on the given item states.
 */
export function simulate(
  items: Record<string, SimulationInput>
): SimulationResult {
  const nodes: Record<string, NodeResult> = {};
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
      // Raw resources: assume infinite supply from miners
      // Use machines * 60 as a rough "miner output" (Mk1 = 60/min, Mk2 = 120, Mk3 = 240)
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
        // Item is consumed but not automated — create a "missing" node
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
      node.isBottleneck = node.ratio < 0.99; // small tolerance
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
      // Not automated at all
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
      // Automated but insufficient
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

        // Also suggest overclock if adding 1-2 machines would suffice at higher OC
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
              priority: shortfall * 0.8, // slightly lower priority
              targetOverclock: targetOC,
            });
          }
        }
      }
    }
  }

  return suggestions.sort((a, b) => b.priority - a.priority);
}