// Production simulation engine
// Supports both:
//  1. Legacy item-based simulation (backward compatible)
//  2. New graph-based machine simulation
//
// Runs entirely client-side. Computes output/min, detects bottlenecks,
// checks belt/pipe limits, and generates improvement suggestions.

import { RECIPES, ITEMS, getRecipeForItem, type Recipe } from "@/data/recipes";
import {
  MACHINES,
  BELT_LIMITS,
  PIPE_LIMITS,
  NODE_PURITY,
  MINER_BASE_RATES,
  calcPowerAtOverclock,
  somersloopOutputMultiplier,
} from "@/data/machines";
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

export function calcOutputPerMin(
  recipe: Recipe,
  machines: number,
  overclock: number,
  outputIndex: number = 0,
): number {
  const cyclesPerMin = (60 / recipe.craft_time) * overclock;
  const outputPerMachine = cyclesPerMin * recipe.outputs[outputIndex].amount;
  return outputPerMachine * machines;
}

export function calcInputPerMin(
  recipe: Recipe,
  machines: number,
  overclock: number,
  inputIndex: number,
): number {
  const cyclesPerMin = (60 / recipe.craft_time) * overclock;
  const inputPerMachine = cyclesPerMin * recipe.inputs[inputIndex].amount;
  return inputPerMachine * machines;
}

export function simulate(items: Record<string, SimulationInput>): SimulationResult {
  const nodes: Record<string, NodeResult> = Object.create(null);
  const automatedKeys = Object.keys(items).filter(k => items[k].automated);

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

  const bottlenecks = Object.values(nodes)
    .filter(n => n.isBottleneck)
    .sort((a, b) => a.ratio - b.ratio);

  const suggestions = generateSuggestions(nodes);

  return {
    nodes,
    bottlenecks,
    suggestions,
    totalAutomated: automatedKeys.length,
    totalItems: Object.keys(ITEMS).length,
  };
}

function generateSuggestions(nodes: Record<string, NodeResult>): Suggestion[] {
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
        if (!upstream[m.id].includes(srcId)) upstream[m.id].push(srcId);
        if (!downstream[srcId]) downstream[srcId] = [];
        if (!downstream[srcId].includes(m.id)) downstream[srcId].push(m.id);
      }
    }
  }

  return { upstream, downstream };
}

interface TopoResult {
  sorted: string[];
  cycles: string[];   // ids that participate in a cycle
}

function topologicalSort(
  machines: MachineInstance[],
  upstream: Record<string, string[]>,
): TopoResult {
  const inDegree: Record<string, number> = Object.create(null);
  for (const m of machines) inDegree[m.id] = (upstream[m.id] ?? []).length;

  const queue: string[] = [];
  for (const m of machines) if (inDegree[m.id] === 0) queue.push(m.id);

  const sorted: string[] = [];
  const machineMap = new Map(machines.map(m => [m.id, m]));

  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(id);
    const machine = machineMap.get(id);
    if (!machine) continue;
    for (const output of machine.outputs) {
      if (output.connectedTo) {
        const downId = output.connectedTo.machineId;
        if (inDegree[downId] === undefined) continue;
        inDegree[downId]--;
        if (inDegree[downId] === 0) queue.push(downId);
      }
    }
  }

  const inSorted = new Set(sorted);
  const cycles: string[] = [];
  for (const m of machines) {
    if (!inSorted.has(m.id)) {
      sorted.push(m.id);
      cycles.push(m.id);
    }
  }
  return { sorted, cycles };
}

/** Build `recipe.inputs[i] → machine.inputs[slotIdx]` mapping.
 *  Greeny upstream recipes don't guarantee an `[items, fluids]` ordering
 *  matching our slot layout, and a recipe may have two same-kind inputs
 *  (e.g. Foundry: iron_ore + coal). Match by item key first, then fall
 *  back to the first unused slot of the same kind. Returns -1 if nothing
 *  matches. */
function mapRecipeIOToSlots(
  io: { item: string; amount: number; type?: "item" | "fluid" }[],
  slots: ConnectionPoint[],
): number[] {
  const used = new Set<number>();
  return io.map(entry => {
    const entryKind: "item" | "fluid" = entry.type ?? "item";
    // First pass: exact item match
    let idx = slots.findIndex(
      (slot, i) =>
        !used.has(i) && slot.kind === entryKind && slot.itemType === entry.item,
    );
    if (idx === -1) {
      idx = slots.findIndex(
        (slot, i) => !used.has(i) && slot.kind === entryKind,
      );
    }
    if (idx !== -1) used.add(idx);
    return idx;
  });
}

function maxRateForConnection(conn: ConnectionPoint): number {
  if (conn.kind === "fluid") {
    if (conn.pipeTier) return PIPE_LIMITS[conn.pipeTier];
    return conn.maxRate ?? PIPE_LIMITS.pipe_mk1;
  }
  if (conn.beltTier) return BELT_LIMITS[conn.beltTier];
  return conn.maxRate ?? BELT_LIMITS.belt_mk1;
}

function extractorRate(machine: MachineInstance): number {
  const purity = machine.nodePurity ?? "normal";
  const base = MINER_BASE_RATES[machine.machineType];
  if (typeof base === "number") {
    return base * NODE_PURITY[purity] * machine.overclock;
  }
  if (machine.machineType === "water_extractor") return 120 * machine.overclock;
  if (machine.machineType === "oil_extractor") return 120 * NODE_PURITY[purity] * machine.overclock;
  if (machine.machineType === "resource_well_pressurizer") {
    return 60 * NODE_PURITY[purity] * machine.overclock;
  }
  return 60 * machine.overclock;
}

export function simulateFactory(machines: MachineInstance[]): FactorySimulationResult {
  if (machines.length === 0) {
    return {
      nodes: {},
      totalPower: 0,
      totalConsumption: 0,
      totalGeneration: 0,
      totalItems: {},
      externalInputs: [],
      finalOutputs: [],
      criticalIssues: [],
      warnings: [],
      suggestions: [],
    };
  }

  const machineMap = new Map(machines.map(m => [m.id, m]));
  const { upstream } = buildAdjacency(machines);
  const { sorted: sortedIds, cycles } = topologicalSort(machines, upstream);

  const nodes: Record<string, SimulationNode> = Object.create(null);
  const outputAvailable: Record<string, Record<number, { item: string; rate: number }>> = Object.create(null);

  // Init nodes
  for (const m of machines) {
    const recipe = m.recipe ? RECIPES.find(r => r.id === m.recipe) ?? null : null;
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

    if (!machineInfo) continue;

    if (
      (machineInfo.category === "extraction" || m.machineType === "item_source") &&
      !m.extractionItem
    ) {
      nodes[m.id].warnings.push({
        type: "no_resource",
        message:
          m.machineType === "item_source"
            ? `${machineInfo.label} has no item selected.`
            : `${machineInfo.label} has no resource selected.`,
        severity: "error",
        machineId: m.id,
      });
    }

    if (
      !recipe &&
      machineInfo.category !== "extraction" &&
      machineInfo.category !== "power" &&
      m.machineType !== "item_source"
    ) {
      nodes[m.id].warnings.push({
        type: "no_recipe",
        message: `${machineInfo.label} has no recipe selected.`,
        severity: "error",
        machineId: m.id,
      });
    }
  }

  const cycleSet = new Set(cycles);
  // Cycle warnings — and skip those nodes from the forward pass entirely
  // so we don't pile a `disconnected`/`bottleneck` warning on top.
  for (const id of cycles) {
    nodes[id]?.warnings.push({
      type: "cycle",
      message: "Machine is part of a feedback loop — outputs may be inaccurate.",
      severity: "error",
      machineId: id,
    });
  }

  // Forward pass
  for (const id of sortedIds) {
    if (cycleSet.has(id)) continue;
    const machine = machineMap.get(id);
    if (!machine) continue;
    const recipe = machine.recipe ? RECIPES.find(r => r.id === machine.recipe) : null;
    const machineInfo = MACHINES[machine.machineType];
    const node = nodes[id];
    if (!machineInfo) continue;
    const somersloops = machine.somersloops ?? 0;

    // ─── Extraction + virtual item source ──────────
    if (
      machineInfo.category === "extraction" ||
      machine.machineType === "item_source"
    ) {
      const outputItem = machine.extractionItem ?? null;
      if (!outputItem) {
        node.theoreticalOutput = 0;
        node.actualOutput = 0;
        node.outputSlots = [];
        node.powerDraw = 0;
        continue;
      }

      const rate =
        machine.machineType === "item_source"
          ? (machine.sourceRate ?? 60) * machine.overclock
          : extractorRate(machine);
      node.theoreticalOutput = rate;
      node.actualOutput = rate;
      node.inputSatisfaction = 1;
      node.outputSlots = [{
        item: outputItem,
        produced: rate,
        consumed: 0,
        surplus: rate,
        destinations: [],
      }];
      outputAvailable[id][0] = { item: outputItem, rate };

      node.powerDraw =
        machine.machineType === "item_source"
          ? 0
          : calcPowerAtOverclock(
              Math.abs(machineInfo.basePower),
              machineInfo.powerExponent,
              machine.overclock,
              0, 0,                         // extractors do not amp
            );
      continue;
    }

    // ─── Power generators (with optional fuel recipe) ────────────
    if (machineInfo.category === "power") {
      const baseGeneration = machineInfo.basePower; // negative
      if (!recipe) {
        node.powerDraw = baseGeneration;
        node.theoreticalOutput = Math.abs(baseGeneration);
        node.actualOutput = Math.abs(baseGeneration);
        continue;
      }
      const cyclesPerMin = (60 / recipe.craft_time) * machine.overclock;
      const inputSlotMap = mapRecipeIOToSlots(recipe.inputs, machine.inputs);
      const outputSlotMap = mapRecipeIOToSlots(recipe.outputs, machine.outputs);
      const inputSlots: SimulationNode["inputSlots"] = [];
      let minSatisfaction = 1;

      for (let i = 0; i < recipe.inputs.length; i++) {
        const ri = recipe.inputs[i];
        const needed = cyclesPerMin * ri.amount;
        let available = 0;
        let source: string | "external" = "external";

        const slotIdx = inputSlotMap[i];
        const conn = slotIdx >= 0 ? machine.inputs[slotIdx] : undefined;
        if (conn?.connectedTo) {
          const srcOutput = outputAvailable[conn.connectedTo.machineId]?.[conn.connectedTo.slot];
          if (srcOutput) {
            available = srcOutput.rate;
            source = conn.connectedTo.machineId;
            const limit = maxRateForConnection(conn);
            if (srcOutput.rate > limit) {
              available = limit;
              node.warnings.push({
                type: conn.kind === "fluid" ? "pipe_limit" : "belt_limit",
                message: `${conn.kind === "fluid" ? "Pipe" : "Belt"} into ${machineInfo.label} is saturated (${limit}/min).`,
                severity: "warning",
                machineId: id,
              });
            }
          }
        }
        const sat = needed > 0 ? Math.min(1, available / needed) : 1;
        if (sat < minSatisfaction) minSatisfaction = sat;
        inputSlots.push({ item: ri.item, needed, available, source });
      }
      node.inputSatisfaction = minSatisfaction;
      node.inputSlots = inputSlots;
      node.powerDraw = baseGeneration * minSatisfaction;
      node.theoreticalOutput = Math.abs(baseGeneration);
      node.actualOutput = Math.abs(node.powerDraw);

      const outputSlots: SimulationNode["outputSlots"] = [];
      for (let i = 0; i < recipe.outputs.length; i++) {
        const ro = recipe.outputs[i];
        const produced = cyclesPerMin * ro.amount * minSatisfaction;
        outputSlots.push({ item: ro.item, produced, consumed: 0, surplus: produced, destinations: [] });
        // Index outputAvailable by the machine slot the recipe output maps
        // to, not by recipe order — downstream connections reference the
        // machine slot.
        const slotIdx = outputSlotMap[i] >= 0 ? outputSlotMap[i] : i;
        outputAvailable[id][slotIdx] = { item: ro.item, rate: produced };
      }
      node.outputSlots = outputSlots;
      continue;
    }

    // ─── Production / refining / smelting ──────────────────
    if (!recipe) continue;

    const cyclesPerMin = (60 / recipe.craft_time) * machine.overclock;
    const sloopMult = somersloopOutputMultiplier(somersloops, machineInfo.somersloopSlots);
    const inputSlotMap = mapRecipeIOToSlots(recipe.inputs, machine.inputs);
    const outputSlotMap = mapRecipeIOToSlots(recipe.outputs, machine.outputs);

    const inputSlots: SimulationNode["inputSlots"] = [];
    let minSatisfaction = 1;

    for (let i = 0; i < recipe.inputs.length; i++) {
      const ri = recipe.inputs[i];
      const needed = cyclesPerMin * ri.amount;
      let available = 0;
      let source: string | "external" = "external";

      const slotIdx = inputSlotMap[i];
      const conn = slotIdx >= 0 ? machine.inputs[slotIdx] : undefined;
      if (conn?.connectedTo) {
        const srcOutput = outputAvailable[conn.connectedTo.machineId]?.[conn.connectedTo.slot];
        if (srcOutput) {
          available = srcOutput.rate;
          source = conn.connectedTo.machineId;
          const limit = maxRateForConnection(conn);
          if (srcOutput.rate > limit) {
            available = limit;
            node.warnings.push({
              type: conn.kind === "fluid" ? "pipe_limit" : "belt_limit",
              message: `${conn.kind === "fluid" ? "Pipe" : "Belt"} into ${machineInfo.label} is saturated (${limit}/min).`,
              severity: "warning",
              machineId: id,
            });
          }
        }
      } else {
        node.warnings.push({
          type: "disconnected",
          message: `${machineInfo.label} ${ri.type === "fluid" ? "fluid" : "item"} input (${ri.item.replace(/_/g, " ")}) is not connected.`,
          severity: "info",
          machineId: id,
        });
      }

      const sat = needed > 0 ? Math.min(1, available / needed) : 1;
      if (sat < minSatisfaction) minSatisfaction = sat;
      inputSlots.push({ item: ri.item, needed, available, source });
    }

    node.inputSatisfaction = minSatisfaction;
    node.inputSlots = inputSlots;
    node.theoreticalOutput = cyclesPerMin * (recipe.outputs[0]?.amount ?? 0) * sloopMult;
    node.actualOutput = node.theoreticalOutput * minSatisfaction;

    const outputSlots: SimulationNode["outputSlots"] = [];
    for (let i = 0; i < recipe.outputs.length; i++) {
      const ro = recipe.outputs[i];
      const produced = cyclesPerMin * ro.amount * sloopMult * minSatisfaction;
      outputSlots.push({ item: ro.item, produced, consumed: 0, surplus: produced, destinations: [] });
      const slotIdx = outputSlotMap[i] >= 0 ? outputSlotMap[i] : i;
      outputAvailable[id][slotIdx] = { item: ro.item, rate: produced };
    }
    node.outputSlots = outputSlots;

    node.powerDraw = calcPowerAtOverclock(
      Math.abs(machineInfo.basePower),
      machineInfo.powerExponent,
      machine.overclock,
      somersloops,
      machineInfo.somersloopSlots,
    );

    if (minSatisfaction < 0.99) {
      node.warnings.push({
        type: "bottleneck",
        message: `${machineInfo.label} is starved — only ${(minSatisfaction * 100).toFixed(0)}% input satisfaction.`,
        severity: "warning",
        machineId: id,
      });
    }
  }

  // Second pass: track consumption + destination links on output slots.
  // Resolve which recipe-input applies to each connected slot via the
  // same kind/itemType matching used during the forward pass — never
  // by positional `recipe.inputs[inIdx]`, which doesn't match for
  // mixed item+fluid machines.
  for (const machine of machines) {
    const recipe = machine.recipe ? RECIPES.find(r => r.id === machine.recipe) : null;
    machine.inputs.forEach((input, inIdx) => {
      if (!input.connectedTo) return;
      const srcNode = nodes[input.connectedTo.machineId];
      if (!srcNode) return;
      // Find the right output slot on the source by the slot index it
      // claims to feed. Then resolve which recipe-output produced it
      // (matched by item key) so `outputSlots[]` order stays in sync
      // with `outputAvailable[]`.
      const srcOutputSlot = srcNode.outputSlots.find(os => os.item === input.itemType)
        ?? srcNode.outputSlots[input.connectedTo.slot];
      if (!srcOutputSlot) return;

      const node = nodes[machine.id];
      const sat = node?.inputSatisfaction ?? 1;
      if (recipe) {
        // Match by item key first, then by kind+slot fallback.
        const ri =
          recipe.inputs.find(r => r.item === input.itemType) ??
          recipe.inputs[inIdx];
        if (ri) {
          const cyclesPerMin = (60 / recipe.craft_time) * machine.overclock;
          const consumed = cyclesPerMin * ri.amount * sat;
          srcOutputSlot.consumed += consumed;
          srcOutputSlot.surplus = srcOutputSlot.produced - srcOutputSlot.consumed;
        }
      }
      srcOutputSlot.destinations.push(machine.id);
    });
  }

  // Aggregate
  let totalConsumption = 0;
  let totalGeneration = 0;
  const totalItems: Record<string, { produced: number; consumed: number; net: number }> = {};
  const allWarnings: SimulationWarning[] = [];
  const criticalIssues: SimulationWarning[] = [];

  for (const node of Object.values(nodes)) {
    if (node.powerDraw >= 0) totalConsumption += node.powerDraw;
    else totalGeneration += -node.powerDraw;

    for (const os of node.outputSlots) {
      if (!totalItems[os.item]) totalItems[os.item] = { produced: 0, consumed: 0, net: 0 };
      totalItems[os.item].produced += os.produced;
    }
    for (const is_ of node.inputSlots) {
      if (!totalItems[is_.item]) totalItems[is_.item] = { produced: 0, consumed: 0, net: 0 };
      totalItems[is_.item].consumed += is_.needed * (node.inputSatisfaction);
    }
    for (const w of node.warnings) {
      if (w.severity === "error") criticalIssues.push(w);
      else allWarnings.push(w);
    }
  }

  for (const item of Object.values(totalItems)) {
    item.net = item.produced - item.consumed;
  }

  const externalInputs = Object.entries(totalItems)
    .filter(([, v]) => v.net < -0.01)
    .map(([item, v]) => ({ item, rate: Math.abs(v.net) }))
    .sort((a, b) => b.rate - a.rate);

  const finalOutputs = Object.entries(totalItems)
    .filter(([, v]) => v.net > 0.01)
    .map(([item, v]) => ({ item, rate: v.net }))
    .sort((a, b) => b.rate - a.rate);

  const suggestions = generateFactorySuggestions(machines, nodes);

  return {
    nodes,
    totalPower: totalConsumption - totalGeneration,
    totalConsumption,
    totalGeneration,
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
  nodes: Record<string, SimulationNode>,
): FactorySuggestion[] {
  const suggestions: FactorySuggestion[] = [];

  for (const machine of machines) {
    const node = nodes[machine.id];
    if (!node) continue;
    const machineInfo = MACHINES[machine.machineType];
    if (!machineInfo) continue;

    if (machineInfo.category === "extraction" && !machine.extractionItem) {
      suggestions.push({
        type: "set_resource",
        message: `Choose a resource node for ${machineInfo.label}.`,
        impact: "Extractor stays idle until a resource is picked.",
        machineId: machine.id,
        priority: 110,
      });
      continue;
    }

    if (
      !node.recipe &&
      machineInfo.category !== "extraction" &&
      machineInfo.category !== "power"
    ) {
      suggestions.push({
        type: "fix_recipe",
        message: `Set a recipe for ${machineInfo.label}.`,
        impact: "Machine is idle without a recipe.",
        machineId: machine.id,
        priority: 100,
      });
      continue;
    }

    if (machine.overclock > 1.01) {
      for (const os of node.outputSlots) {
        if (os.surplus > os.produced * 0.3) {
          suggestions.push({
            type: "change_overclock",
            message: `Reduce overclock on ${machineInfo.label} — ${os.item.replace(/_/g, " ")} has ${os.surplus.toFixed(1)}/min surplus.`,
            impact: `Save power by reducing from ${(machine.overclock * 100).toFixed(0)}% to 100%.`,
            machineId: machine.id,
            overclock: 1.0,
            priority: 20,
          });
        }
      }
    }

    if (node.inputSatisfaction < 0.99 && node.inputSatisfaction > 0) {
      for (const is_ of node.inputSlots) {
        if (is_.available < is_.needed && is_.source === "external") {
          const deficit = is_.needed - is_.available;
          const recipe = getRecipeForItem(is_.item);
          if (recipe) {
            const outputPerMachine = calcOutputPerMin(recipe, 1, 1.0);
            const count = Math.ceil(deficit / outputPerMachine);
            const mt = recipe.machine as keyof typeof MACHINES;
            suggestions.push({
              type: "add_machine",
              message: `Add ${count} ${recipe.machine.replace(/_/g, " ")}(s) producing ${is_.item.replace(/_/g, " ")} to supply ${machineInfo.label}.`,
              impact: `+${(outputPerMachine * count).toFixed(1)}/min ${is_.item.replace(/_/g, " ")}`,
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
