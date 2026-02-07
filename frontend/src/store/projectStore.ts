import { create } from "zustand";
import { ITEMS } from "@/data/recipes";
import {
  simulate as runSimulation,
  calcOutputPerMin,
} from "@/lib/simulation";
import * as api from "@/lib/api";
import type { ProjectData } from "@/lib/api";

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

  // Computed getters
  items: ProjectData["items"];
  projectId: string | null;
  projectName: string;

  // Project actions
  createProject: (name: string) => Promise<ProjectData | null>;
  loadProject: (projectId: string) => Promise<boolean>;
  setProjectName: (name: string) => void;

  // Item actions
  updateItem: (key: string, updates: Partial<ItemState>) => void;
  addItem: (key: string, item: ItemState) => void;
  removeItem: (key: string) => void;
  toggleAutomated: (key: string) => void;
  setMachines: (key: string, machines: number) => void;
  setOverclock: (key: string, overclock: number) => void;

  // Serialization
  exportJson: () => string;
  importJson: (data: string) => boolean;

  // Simulation
  simulate: () => void;

  // Cloud sync
  pullFromCloud: () => Promise<boolean>;
  pushToCloud: (force?: boolean) => Promise<{ success: boolean; conflict?: boolean }>;
  syncToCloud: () => Promise<void>;
  refreshFromCloud: () => Promise<void>;

  // Undo
  undo: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Merge cloud items into a full item map that includes every known game item.
 */
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

  // Include any items from cloud that aren't in our local DB
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

// ─── Store Implementation ────────────────────────────────────

export const useProjectStore = create<ProjectStore>((set, get) => ({
  // Initial state
  project: null,
  cloudProject: null,
  isLoading: false,
  error: null,
  simulationResult: null,
  syncStatus: "no_cloud",
  lastSyncedAt: null,
  previousState: null,

  // Computed getters
  get items() {
    return get().project?.items ?? {};
  },
  get projectId() {
    return get().project?.project_id ?? null;
  },
  get projectName() {
    return get().project?.name ?? "Untitled Project";
  },

  // ─── Project Actions ─────────────────────────────────────

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
      set({
        project,
        cloudProject: data,
        syncStatus: "in_sync",
        lastSyncedAt: new Date().toISOString(),
        isLoading: false,
      });
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

  // ─── Item Actions ────────────────────────────────────────

  updateItem: (key: string, updates: Partial<ItemState>) => {
    const { project } = get();
    if (!project || !project.items[key]) return;
    set({
      previousState: project,
      project: {
        ...project,
        items: {
          ...project.items,
          [key]: { ...project.items[key], ...updates },
        },
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
      project: {
        ...project,
        items: rest,
        last_updated: new Date().toISOString(),
      },
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
        items: {
          ...project.items,
          [key]: { ...item, automated: !item.automated },
        },
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
        items: {
          ...project.items,
          [key]: { ...project.items[key], machines: Math.max(0, machines) },
        },
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
          [key]: {
            ...project.items[key],
            overclock: Math.max(0.01, Math.min(2.5, overclock)),
          },
        },
        last_updated: new Date().toISOString(),
      },
      syncStatus: "local_changes",
    });
  },

  // ─── Serialization ───────────────────────────────────────

  exportJson: () => {
    const { project } = get();
    return JSON.stringify(project, null, 2);
  },

  importJson: (data: string) => {
    try {
      const parsed = JSON.parse(data) as ProjectData;
      if (!parsed.project_id || !parsed.name || !parsed.items) return false;
      const { project } = get();
      set({
        previousState: project,
        project: parsed,
        syncStatus: "local_changes",
      });
      return true;
    } catch {
      return false;
    }
  },

  // ─── Simulation ──────────────────────────────────────────

  simulate: () => {
    const { project } = get();
    if (!project) return;

    const simInput: Record<
      string,
      { automated: boolean; machines: number; overclock: number }
    > = {};
    for (const [key, item] of Object.entries(project.items)) {
      simInput[key] = {
        automated: item.automated,
        machines: item.machines,
        overclock: item.overclock,
      };
    }

    const result = runSimulation(simInput);

    // Convert to display format
    const displayItems: Record<string, DisplayItemResult> = {};
    for (const [key, node] of Object.entries(result.nodes)) {
      displayItems[key] = {
        outputPerMin: node.supplyRate,
        isBottleneck: node.isBottleneck,
        isSurplus: !node.isBottleneck && node.surplus > 0,
      };
    }

    const displayBottlenecks: DisplayBottleneck[] = result.bottlenecks
      .slice(0, 3)
      .map((node) => {
        const shortfall = node.demandRate - node.supplyRate;
        const shortfallPercent =
          node.demandRate > 0 ? (shortfall / node.demandRate) * 100 : 100;
        const recipe = node.recipe;
        let neededMachines = 0;
        if (recipe) {
          const outputPerMachine = calcOutputPerMin(
            recipe,
            1,
            node.overclock || 1
          );
          neededMachines = Math.ceil(shortfall / outputPerMachine);
        }
        return {
          itemKey: node.itemKey,
          label: node.label,
          shortfall,
          shortfallPercent,
          neededMachines,
        };
      });

    const displaySuggestions: DisplaySuggestion[] = result.suggestions.map(
      (s) => ({
        itemKey: s.itemKey,
        message: s.message,
      })
    );

    // Compute raw materials
    const rawMaterials: Record<string, number> = {};
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
      set({
        project: { ...data, items: buildFullItems(data.items) },
        cloudProject: data,
        syncStatus: "in_sync",
        lastSyncedAt: new Date().toISOString(),
        isLoading: false,
        simulationResult: null,
      });
      return true;
    } catch {
      set({ isLoading: false });
      return false;
    }
  },

  pushToCloud: async (force = false) => {
    const { project, cloudProject } = get();
    if (!project) return { success: false };
    set({ isLoading: true });
    try {
      // Only push items that differ from defaults
      const pushItems: ProjectData["items"] = {};
      for (const [key, item] of Object.entries(project.items)) {
        if (item.automated || item.machines !== 1 || item.overclock !== 1.0) {
          pushItems[key] = item;
        }
      }
      const pushData: ProjectData = { ...project, items: pushItems };

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

  // ─── Undo ────────────────────────────────────────────────

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
