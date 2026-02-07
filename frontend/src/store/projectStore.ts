import { create } from "zustand";
import { ITEMS } from "@/data/recipes";
import type { ProjectData } from "@/lib/api";

export type SyncStatus = "in_sync" | "local_changes" | "cloud_newer" | "no_cloud";

interface ItemState {
  label: string;
  icon?: string;
  automated: boolean;
  machines: number;
  overclock: number;
}

interface ProjectStore {
  // Project data
  projectId: string | null;
  projectName: string;
  version: number;
  lastUpdated: string | null;
  assetsBaseUrl: string | null;
  items: Record<string, ItemState>;

  // Sync state
  syncStatus: SyncStatus;
  cloudVersion: number | null;
  cloudLastUpdated: string | null;
  lastSyncedAt: string | null;

  // Undo (single step)
  previousState: Record<string, ItemState> | null;

  // Actions
  initFromCloud: (data: ProjectData) => void;
  initNewProject: (projectId: string, name: string, assetsBaseUrl?: string) => void;
  setItem: (key: string, updates: Partial<ItemState>) => void;
  toggleAutomated: (key: string) => void;
  setMachines: (key: string, machines: number) => void;
  setOverclock: (key: string, overclock: number) => void;
  markSynced: (version: number) => void;
  markCloudNewer: (cloudVersion: number, cloudLastUpdated: string) => void;
  undo: () => void;
  loadFromJson: (data: ProjectData) => void;
  toProjectData: () => ProjectData;
  setProjectName: (name: string) => void;
}

/**
 * Initialize items map with all known items from recipe database,
 * merged with any saved state from cloud.
 */
function buildItemsMap(
  savedItems: Record<string, Partial<ItemState>> = {}
): Record<string, ItemState> {
  const result: Record<string, ItemState> = {};

  for (const [key, info] of Object.entries(ITEMS)) {
    const saved = savedItems[key];
    result[key] = {
      label: saved?.label ?? info.label,
      icon: saved?.icon ?? info.icon,
      automated: saved?.automated ?? false,
      machines: saved?.machines ?? 1,
      overclock: saved?.overclock ?? 1.0,
    };
  }

  // Include any items from cloud that aren't in our local DB
  for (const [key, saved] of Object.entries(savedItems)) {
    if (!result[key]) {
      result[key] = {
        label: saved.label ?? key,
        icon: saved.icon,
        automated: saved.automated ?? false,
        machines: saved.machines ?? 1,
        overclock: saved.overclock ?? 1.0,
      };
    }
  }

  return result;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projectId: null,
  projectName: "New Project",
  version: 0,
  lastUpdated: null,
  assetsBaseUrl: null,
  items: buildItemsMap(),
  syncStatus: "no_cloud",
  cloudVersion: null,
  cloudLastUpdated: null,
  lastSyncedAt: null,
  previousState: null,

  initFromCloud: (data) =>
    set({
      projectId: data.project_id,
      projectName: data.name,
      version: data.version,
      lastUpdated: data.last_updated,
      assetsBaseUrl: data.assets_base_url ?? null,
      items: buildItemsMap(data.items),
      syncStatus: "in_sync",
      cloudVersion: data.version,
      cloudLastUpdated: data.last_updated,
      lastSyncedAt: new Date().toISOString(),
      previousState: null,
    }),

  initNewProject: (projectId, name, assetsBaseUrl) =>
    set({
      projectId,
      projectName: name,
      version: 1,
      lastUpdated: new Date().toISOString(),
      assetsBaseUrl: assetsBaseUrl ?? null,
      items: buildItemsMap(),
      syncStatus: "in_sync",
      cloudVersion: 1,
      cloudLastUpdated: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
      previousState: null,
    }),

  setItem: (key, updates) => {
    const current = get().items;
    set({
      previousState: { ...current },
      items: {
        ...current,
        [key]: { ...current[key], ...updates },
      },
      syncStatus: "local_changes",
      lastUpdated: new Date().toISOString(),
    });
  },

  toggleAutomated: (key) => {
    const item = get().items[key];
    if (item) get().setItem(key, { automated: !item.automated });
  },

  setMachines: (key, machines) => {
    get().setItem(key, { machines: Math.max(0, machines) });
  },

  setOverclock: (key, overclock) => {
    get().setItem(key, { overclock: Math.max(0.01, Math.min(2.5, overclock)) });
  },

  markSynced: (version) =>
    set({
      syncStatus: "in_sync",
      version,
      cloudVersion: version,
      cloudLastUpdated: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
    }),

  markCloudNewer: (cloudVersion, cloudLastUpdated) =>
    set({
      syncStatus: "cloud_newer",
      cloudVersion,
      cloudLastUpdated,
    }),

  undo: () => {
    const prev = get().previousState;
    if (prev) {
      set({
        items: prev,
        previousState: null,
        syncStatus: "local_changes",
      });
    }
  },

  loadFromJson: (data) =>
    set({
      projectId: data.project_id,
      projectName: data.name,
      version: data.version,
      lastUpdated: data.last_updated,
      assetsBaseUrl: data.assets_base_url ?? null,
      items: buildItemsMap(data.items),
      syncStatus: "local_changes",
      previousState: get().items,
    }),

  toProjectData: (): ProjectData => {
    const state = get();
    // Only include items that have been modified from defaults
    const items: Record<string, ItemState> = {};
    for (const [key, item] of Object.entries(state.items)) {
      if (item.automated || item.machines !== 1 || item.overclock !== 1.0) {
        items[key] = item;
      }
    }
    return {
      project_id: state.projectId ?? "",
      name: state.projectName,
      version: state.version,
      last_updated: state.lastUpdated ?? new Date().toISOString(),
      assets_base_url: state.assetsBaseUrl ?? undefined,
      items,
    };
  },

  setProjectName: (name) =>
    set({ projectName: name, syncStatus: "local_changes" }),
}));