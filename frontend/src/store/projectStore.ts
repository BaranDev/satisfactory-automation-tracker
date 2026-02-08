import { create } from "zustand";
import { nanoid } from "nanoid";
import { ITEMS, RECIPES } from "@/data/recipes";
import { MACHINES } from "@/data/machines";
import {
  simulate as runSimulation,
  simulateFactory,
  calcOutputPerMin,
} from "@/lib/simulation";
import * as api from "@/lib/api";
import type { ProjectData } from "@/lib/api";
import type {
  MachineInstance,
  MachineType,
  FactoryModule,
  FactorySimulationResult,
  ConnectionPoint,
} from "@/types/factory";

// ─── Types ───────────────────────────────────────────────────

export type SyncStatus =
  | "in_sync"
  | "local_changes"
  | "cloud_newer"
  | "no_cloud";

type ItemState = ProjectData["items"][string];

interface DisplayBottleneck {
  itemKey: string;
  label: string;
  shortfall: number;
  shortfallPercent: number;
  neededMachines: number;
}

interface DisplaySuggestion {
  itemKey: string;
  message: string;
}

interface DisplayItemResult {
  outputPerMin: number;
  isBottleneck: boolean;
  isSurplus: boolean;
}

export interface DisplaySimResult {
  items: Record<string, DisplayItemResult>;
  bottlenecks: DisplayBottleneck[];
  suggestions: DisplaySuggestion[];
  rawMaterials: Record<string, number>;
}

// ─── Store Interface ─────────────────────────────────────────

interface ProjectStore {
  // Core state
  project: ProjectData | null;
  cloudProject: ProjectData | null;
  isLoading: boolean;
  error: string | null;
  simulationResult: DisplaySimResult | null;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  previousState: ProjectData | null;

  // New: Factory machine state
  factoryMachines: MachineInstance[];
  factorySimulation: FactorySimulationResult | null;
  savedModules: FactoryModule[];
  selectedMachineId: string | null;

  // Computed getters
  items: ProjectData["items"];
  projectId: string | null;
  projectName: string;

  // Project actions
  createProject: (name: string) => Promise<ProjectData | null>;
  loadProject: (projectId: string) => Promise<boolean>;
  setProjectName: (name: string) => void;

  // Item actions (legacy)
  updateItem: (key: string, updates: Partial<ItemState>) => void;
  addItem: (key: string, item: ItemState) => void;
  removeItem: (key: string) => void;
  toggleAutomated: (key: string) => void;
  setMachines: (key: string, machines: number) => void;
  setOverclock: (key: string, overclock: number) => void;

  // Machine actions (new factory system)
  addMachine: (machineType: MachineType, position?: { x: number; y: number }) => string;
  removeMachine: (machineId: string) => void;
  updateMachineRecipe: (machineId: string, recipeId: string | null) => void;
  updateMachineOverclock: (machineId: string, overclock: number) => void;
  updateMachinePosition: (machineId: string, position: { x: number; y: number }) => void;
  setFactoryMachines: (machines: MachineInstance[]) => void;
  selectMachine: (machineId: string | null) => void;

  // Module actions
  createModule: (name: string, machineIds: string[]) => FactoryModule | null;
  saveModuleToLibrary: (module: FactoryModule) => void;
  instantiateModule: (moduleId: string, position: { x: number; y: number }) => void;

  // Simulation
  simulate: () => void;
  simulateFactoryMachines: () => void;
  setFactorySimulation: (result: FactorySimulationResult) => void;

  // Serialization
  exportJson: () => string;
  importJson: (data: string) => boolean;

  // Cloud sync
  pullFromCloud: () => Promise<boolean>;
  pushToCloud: (force?: boolean) => Promise<{ success: boolean; conflict?: boolean }>;
  syncToCloud: () => Promise<void>;
  refreshFromCloud: () => Promise<void>;

  // Undo
  undo: () => void;
  canUndo: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────

function buildFullItems(
  saved: Record<string, Partial<ItemState>> = {}
): ProjectData["items"] {
  const result: ProjectData["items"] = {};

  for (const [key, info] of Object.entries(ITEMS)) {
    const s = saved[key];
    result[key] = {
      label: s?.label ?? info.label,
      icon: s?.icon ?? info.icon,
      automated: s?.automated ?? false,
      machines: s?.machines ?? 1,
      overclock: s?.overclock ?? 1.0,
    };
  }

  for (const [key, s] of Object.entries(saved)) {
    if (!result[key]) {
      result[key] = {
        label: s.label ?? key,
        icon: s.icon,
        automated: s.automated ?? false,
        machines: s.machines ?? 1,
        overclock: s.overclock ?? 1.0,
      };
    }
  }

  return result;
}

function makeEmptyConnectionPoints(machineType: MachineType): { inputs: ConnectionPoint[]; outputs: ConnectionPoint[] } {
  const info = MACHINES[machineType];
  if (!info) return { inputs: [], outputs: [] };

  const inputs: ConnectionPoint[] = Array.from(
    { length: info.inputSlots + info.fluidInputs },
    (_, i) => ({ slot: i, connectedTo: null, itemType: null, actualRate: 0, maxRate: 780 }),
  );
  const outputs: ConnectionPoint[] = Array.from(
    { length: info.outputSlots + info.fluidOutputs },
    (_, i) => ({ slot: i, connectedTo: null, itemType: null, actualRate: 0, maxRate: 780 }),
  );

  return { inputs, outputs };
}

// ─── Store Implementation ────────────────────────────────────

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: null,
  cloudProject: null,
  isLoading: false,
  error: null,
  simulationResult: null,
  syncStatus: "no_cloud",
  lastSyncedAt: null,
  previousState: null,

  // New factory state
  factoryMachines: [],
  factorySimulation: null,
  savedModules: [],
  selectedMachineId: null,

  get items() {
    return get().project?.items ?? {};
  },
  get projectId() {
    return get().project?.project_id ?? null;
  },
  get projectName() {
    return get().project?.name ?? "Untitled Project";
  },
  get canUndo() {
    return get().previousState !== null;
  },

  createProject: async (name: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.createProject(name);
      const project: ProjectData = {
        ...data,
        items: buildFullItems(data.items),
      };
      set({
        project,
        cloudProject: data,
        syncStatus: "in_sync",
        lastSyncedAt: new Date().toISOString(),
        isLoading: false,
        factoryMachines: [],
        factorySimulation: null,
      });
      return project;
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      return null;
    }
  },

  loadProject: async (projectId: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.getProject(projectId);
      if (!data) {
        set({ isLoading: false, error: "Project not found" });
        return false;
      }
      const project: ProjectData = {
        ...data,
        items: buildFullItems(data.items),
      };

      // Load factory machines from project data if available
      const factoryData = (data as unknown as Record<string, unknown>).factory_machines as MachineInstance[] | undefined;

      set({
        project,
        cloudProject: data,
        syncStatus: "in_sync",
        lastSyncedAt: new Date().toISOString(),
        isLoading: false,
        factoryMachines: factoryData ?? [],
        factorySimulation: null,
      });

      // Run factory simulation if machines exist
      if (factoryData && factoryData.length > 0) {
        const result = simulateFactory(factoryData);
        set({ factorySimulation: result });
      }

      return true;
    } catch (err) {
      set({ isLoading: false, error: String(err) });
      return false;
    }
  },

  setProjectName: (name: string) => {
    const { project } = get();
    if (!project) return;
    set({
      previousState: project,
      project: { ...project, name, last_updated: new Date().toISOString() },
      syncStatus: "local_changes",
    });
  },

  // ─── Legacy Item Actions ─────────────────────────────────

  updateItem: (key: string, updates: Partial<ItemState>) => {
    const { project } = get();
    if (!project || !project.items[key]) return;
    set({
      previousState: project,
      project: {
        ...project,
        items: { ...project.items, [key]: { ...project.items[key], ...updates } },
        last_updated: new Date().toISOString(),
      },
      syncStatus: "local_changes",
    });
  },

  addItem: (key: string, item: ItemState) => {
    const { project } = get();
    if (!project) return;
    set({
      previousState: project,
      project: {
        ...project,
        items: { ...project.items, [key]: item },
        last_updated: new Date().toISOString(),
      },
      syncStatus: "local_changes",
    });
  },

  removeItem: (key: string) => {
    const { project } = get();
    if (!project) return;
    const { [key]: _, ...rest } = project.items;
    set({
      previousState: project,
      project: { ...project, items: rest, last_updated: new Date().toISOString() },
      syncStatus: "local_changes",
    });
  },

  toggleAutomated: (key: string) => {
    const { project } = get();
    if (!project || !project.items[key]) return;
    const item = project.items[key];
    set({
      previousState: project,
      project: {
        ...project,
        items: { ...project.items, [key]: { ...item, automated: !item.automated } },
        last_updated: new Date().toISOString(),
      },
      syncStatus: "local_changes",
    });
  },

  setMachines: (key: string, machines: number) => {
    const { project } = get();
    if (!project || !project.items[key]) return;
    set({
      previousState: project,
      project: {
        ...project,
        items: { ...project.items, [key]: { ...project.items[key], machines: Math.max(0, machines) } },
        last_updated: new Date().toISOString(),
      },
      syncStatus: "local_changes",
    });
  },

  setOverclock: (key: string, overclock: number) => {
    const { project } = get();
    if (!project || !project.items[key]) return;
    set({
      previousState: project,
      project: {
        ...project,
        items: {
          ...project.items,
          [key]: { ...project.items[key], overclock: Math.max(0.01, Math.min(2.5, overclock)) },
        },
        last_updated: new Date().toISOString(),
      },
      syncStatus: "local_changes",
    });
  },

  // ─── New Machine Actions ─────────────────────────────────

  addMachine: (machineType: MachineType, position?: { x: number; y: number }) => {
    const id = nanoid(8);
    const info = MACHINES[machineType];
    const { inputs, outputs } = makeEmptyConnectionPoints(machineType);

    const newMachine: MachineInstance = {
      id,
      machineType,
      recipe: info?.compatibleRecipes[0] ?? null,
      overclock: 1.0,
      position: position ?? { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
      inputs,
      outputs,
    };

    const { factoryMachines } = get();
    const updated = [...factoryMachines, newMachine];
    set({ factoryMachines: updated, syncStatus: "local_changes" });

    const result = simulateFactory(updated);
    set({ factorySimulation: result });

    return id;
  },

  removeMachine: (machineId: string) => {
    const { factoryMachines } = get();
    const updated = factoryMachines
      .filter(m => m.id !== machineId)
      .map(m => ({
        ...m,
        inputs: m.inputs.map(inp =>
          inp.connectedTo?.machineId === machineId
            ? { ...inp, connectedTo: null, itemType: null, actualRate: 0 }
            : inp,
        ),
        outputs: m.outputs.map(out =>
          out.connectedTo?.machineId === machineId
            ? { ...out, connectedTo: null, itemType: null, actualRate: 0 }
            : out,
        ),
      }));

    set({
      factoryMachines: updated,
      selectedMachineId: get().selectedMachineId === machineId ? null : get().selectedMachineId,
      syncStatus: "local_changes",
    });

    const result = simulateFactory(updated);
    set({ factorySimulation: result });
  },

  updateMachineRecipe: (machineId: string, recipeId: string | null) => {
    const { factoryMachines } = get();
    const updated = factoryMachines.map(m =>
      m.id === machineId ? { ...m, recipe: recipeId } : m,
    );
    set({ factoryMachines: updated, syncStatus: "local_changes" });

    const result = simulateFactory(updated);
    set({ factorySimulation: result });
  },

  updateMachineOverclock: (machineId: string, overclock: number) => {
    const { factoryMachines } = get();
    const updated = factoryMachines.map(m =>
      m.id === machineId
        ? { ...m, overclock: Math.max(0.01, Math.min(2.5, overclock)) }
        : m,
    );
    set({ factoryMachines: updated, syncStatus: "local_changes" });

    const result = simulateFactory(updated);
    set({ factorySimulation: result });
  },

  updateMachinePosition: (machineId: string, position: { x: number; y: number }) => {
    const { factoryMachines } = get();
    set({
      factoryMachines: factoryMachines.map(m =>
        m.id === machineId ? { ...m, position } : m,
      ),
    });
  },

  setFactoryMachines: (machines: MachineInstance[]) => {
    set({ factoryMachines: machines, syncStatus: "local_changes" });
  },

  selectMachine: (machineId: string | null) => {
    set({ selectedMachineId: machineId });
  },

  // ─── Module Actions ──────────────────────────────────────

  createModule: (name: string, machineIds: string[]) => {
    const { factoryMachines } = get();
    const selected = factoryMachines.filter(m => machineIds.includes(m.id));
    if (selected.length === 0) return null;

    const module: FactoryModule = {
      id: nanoid(8),
      name,
      machines: selected,
      exposedInputs: [],
      exposedOutputs: [],
    };

    return module;
  },

  saveModuleToLibrary: (module: FactoryModule) => {
    const { savedModules } = get();
    set({ savedModules: [...savedModules.filter(m => m.id !== module.id), module] });

    try {
      const existing = JSON.parse(localStorage.getItem("factory-modules") ?? "[]") as FactoryModule[];
      const updated = [...existing.filter(m => m.id !== module.id), module];
      localStorage.setItem("factory-modules", JSON.stringify(updated));
    } catch {
      // ignore
    }
  },

  instantiateModule: (moduleId: string, position: { x: number; y: number }) => {
    const { savedModules, factoryMachines } = get();
    const module = savedModules.find(m => m.id === moduleId);
    if (!module) return;

    const idMap = new Map<string, string>();
    const newMachines: MachineInstance[] = module.machines.map(m => {
      const newId = nanoid(8);
      idMap.set(m.id, newId);
      return {
        ...m,
        id: newId,
        position: { x: m.position.x + position.x, y: m.position.y + position.y },
      };
    });

    for (const machine of newMachines) {
      machine.inputs = machine.inputs.map(inp => ({
        ...inp,
        connectedTo: inp.connectedTo
          ? { machineId: idMap.get(inp.connectedTo.machineId) ?? inp.connectedTo.machineId, slot: inp.connectedTo.slot }
          : null,
      }));
      machine.outputs = machine.outputs.map(out => ({
        ...out,
        connectedTo: out.connectedTo
          ? { machineId: idMap.get(out.connectedTo.machineId) ?? out.connectedTo.machineId, slot: out.connectedTo.slot }
          : null,
      }));
    }

    const updated = [...factoryMachines, ...newMachines];
    set({ factoryMachines: updated, syncStatus: "local_changes" });

    const result = simulateFactory(updated);
    set({ factorySimulation: result });
  },

  // ─── Simulation ──────────────────────────────────────────

  simulate: () => {
    const { project } = get();
    if (!project) return;

    const simInput: Record<string, { automated: boolean; machines: number; overclock: number }> = Object.create(null);
    for (const [key, item] of Object.entries(project.items)) {
      simInput[key] = { automated: item.automated, machines: item.machines, overclock: item.overclock };
    }

    const result = runSimulation(simInput);

    const displayItems: Record<string, DisplayItemResult> = Object.create(null);
    for (const [key, node] of Object.entries(result.nodes)) {
      displayItems[key] = {
        outputPerMin: node.supplyRate,
        isBottleneck: node.isBottleneck,
        isSurplus: !node.isBottleneck && node.surplus > 0,
      };
    }

    const displayBottlenecks: DisplayBottleneck[] = result.bottlenecks
      .slice(0, 3)
      .map(node => {
        const shortfall = node.demandRate - node.supplyRate;
        const shortfallPercent = node.demandRate > 0 ? (shortfall / node.demandRate) * 100 : 100;
        const recipe = node.recipe;
        let neededMachines = 0;
        if (recipe) {
          const outputPerMachine = calcOutputPerMin(recipe, 1, node.overclock || 1);
          neededMachines = Math.ceil(shortfall / outputPerMachine);
        }
        return { itemKey: node.itemKey, label: node.label, shortfall, shortfallPercent, neededMachines };
      });

    const displaySuggestions: DisplaySuggestion[] = result.suggestions.map(s => ({
      itemKey: s.itemKey,
      message: s.message,
    }));

    const rawMaterials: Record<string, number> = Object.create(null);
    for (const [key, node] of Object.entries(result.nodes)) {
      if (node.isRawResource && node.demandRate > 0) {
        rawMaterials[key] = node.demandRate;
      }
    }

    set({
      simulationResult: {
        items: displayItems,
        bottlenecks: displayBottlenecks,
        suggestions: displaySuggestions,
        rawMaterials,
      },
    });
  },

  simulateFactoryMachines: () => {
    const { factoryMachines } = get();
    const result = simulateFactory(factoryMachines);
    set({ factorySimulation: result });
  },

  setFactorySimulation: (result: FactorySimulationResult) => {
    set({ factorySimulation: result });
  },

  // ─── Serialization ───────────────────────────────────────

  exportJson: () => {
    const { project, factoryMachines } = get();
    return JSON.stringify({ ...project, factory_machines: factoryMachines }, null, 2);
  },

  importJson: (data: string) => {
    try {
      const parsed = JSON.parse(data);
      if (!parsed.project_id || !parsed.name || !parsed.items) return false;
      const { project } = get();
      set({
        previousState: project,
        project: parsed as ProjectData,
        factoryMachines: parsed.factory_machines ?? [],
        syncStatus: "local_changes",
      });
      return true;
    } catch {
      return false;
    }
  },

  // ─── Cloud Sync ──────────────────────────────────────────

  pullFromCloud: async () => {
    const { project } = get();
    if (!project) return false;
    set({ isLoading: true });
    try {
      const data = await api.getProject(project.project_id);
      if (!data) {
        set({ isLoading: false });
        return false;
      }
      const factoryData = (data as unknown as Record<string, unknown>).factory_machines as MachineInstance[] | undefined;
      set({
        previousState: project,
        project: { ...data, items: buildFullItems(data.items) },
        cloudProject: data,
        syncStatus: "in_sync",
        lastSyncedAt: new Date().toISOString(),
        isLoading: false,
        simulationResult: null,
        factoryMachines: factoryData ?? [],
      });

      if (factoryData && factoryData.length > 0) {
        const result = simulateFactory(factoryData);
        set({ factorySimulation: result });
      }

      return true;
    } catch {
      set({ isLoading: false });
      return false;
    }
  },

  pushToCloud: async (force = false) => {
    const { project, cloudProject, factoryMachines } = get();
    if (!project) return { success: false };
    set({ isLoading: true });
    try {
      const pushItems: ProjectData["items"] = {};
      for (const [key, item] of Object.entries(project.items)) {
        if (item.automated || item.machines !== 1 || item.overclock !== 1.0) {
          pushItems[key] = item;
        }
      }
      const pushData = {
        ...project,
        items: pushItems,
        factory_machines: factoryMachines,
      } as ProjectData;

      const result = await api.updateProject(project.project_id, pushData, {
        force,
        expectedVersion: cloudProject?.version,
      });
      set({
        project: {
          ...project,
          version: result.project.version,
          last_updated: result.project.last_updated,
        },
        cloudProject: result.project,
        syncStatus: "in_sync",
        lastSyncedAt: new Date().toISOString(),
        isLoading: false,
      });
      return { success: true };
    } catch (err) {
      set({ isLoading: false });
      if (err instanceof api.ConflictApiError) {
        set({ syncStatus: "cloud_newer" });
        return { success: false, conflict: true };
      }
      return { success: false };
    }
  },

  syncToCloud: async () => {
    await get().pushToCloud();
  },

  refreshFromCloud: async () => {
    await get().pullFromCloud();
  },

  undo: () => {
    const prev = get().previousState;
    if (prev) {
      set({
        project: prev,
        previousState: null,
        syncStatus: "local_changes",
      });
    }
  },
}));
