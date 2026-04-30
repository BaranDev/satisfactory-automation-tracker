// Recipe + item registry for Satisfactory.
//
// Data is baked from the upstream community dataset
// `greeny/SatisfactoryTools` (see scripts/bake-data.mjs) into
// `./generated/{items,recipes}.ts`. Manual deltas live in
// `./overrides/post-1.0.ts` and are merged on import.
//
// The shape of `Recipe` and `ItemInfo` is held stable here so consumers
// (simulation engine, UI components, AI context) don't need to know
// whether a row came from upstream, an override, or an addition.

import { GENERATED_ITEMS } from "./generated/items";
import { GENERATED_RECIPES } from "./generated/recipes";
import { ITEM_OVERRIDES, RECIPE_OVERRIDES, RECIPE_ADDITIONS } from "./overrides/post-1.0";

export interface RecipeIO {
  item: string;
  amount: number;
  /** "item" rides on a belt; "fluid" rides on a pipe. Optional for
   *  backward compat — undefined means treat as the slot's `kind`. */
  type?: "item" | "fluid";
}

/** Backward-compat alias used by older imports. */
export type RecipeInput = RecipeIO;

export interface Recipe {
  id: string;
  label: string;
  /** MachineType key (e.g. "smelter", "assembler"). */
  machine: string;
  /** Seconds per cycle at 100% clock. */
  craft_time: number;
  outputs: RecipeIO[];
  inputs: RecipeIO[];
  is_alternate?: boolean;
}

export interface ItemInfo {
  key: string;
  label: string;
  icon: string;
  category: string;
  /** Rough unlock tier. We default to 0 because the upstream dataset
   *  doesn't expose tier ordering — refresh once schematic-aware bake lands. */
  tier: number;
  /** True if the upstream marked this as a fluid. */
  isFluid?: boolean;
  stackSize?: number;
  sinkPoints?: number;
}

// ─── Merge generated + overrides ─────────────────────────────────

function mergeItems(): Record<string, ItemInfo> {
  const out: Record<string, ItemInfo> = {};
  for (const [k, v] of Object.entries(GENERATED_ITEMS)) {
    out[k] = { ...v };
  }
  for (const [k, patch] of Object.entries(ITEM_OVERRIDES)) {
    out[k] = { ...(out[k] ?? { key: k, label: k, icon: `${k}.webp`, category: "part", tier: 0 }), ...patch };
  }
  return out;
}

function mergeRecipes(): Recipe[] {
  const byId = new Map<string, Recipe>();
  for (const r of GENERATED_RECIPES) byId.set(r.id, r);
  for (const [id, patch] of Object.entries(RECIPE_OVERRIDES)) {
    const base = byId.get(id);
    if (base) byId.set(id, { ...base, ...patch });
  }
  for (const r of RECIPE_ADDITIONS) byId.set(r.id, r);
  return Array.from(byId.values());
}

export const ITEMS: Record<string, ItemInfo> = mergeItems();
export const RECIPES: Recipe[] = mergeRecipes();

// ─── Helpers ────────────────────────────────────────────────────

/** Get the recipe that produces a given item (preferring non-alternate). */
export function getRecipeForItem(itemKey: string): Recipe | undefined {
  const hits = RECIPES.filter(r => r.outputs.some(o => o.item === itemKey));
  if (hits.length === 0) return undefined;
  return hits.find(r => !r.is_alternate) ?? hits[0];
}

/** All recipes that produce a given item. */
export function getRecipesForItem(itemKey: string): Recipe[] {
  return RECIPES.filter(r => r.outputs.some(o => o.item === itemKey));
}

/** All recipes that consume a given item. */
export function getConsumerRecipes(itemKey: string): Recipe[] {
  return RECIPES.filter(r => r.inputs.some(i => i.item === itemKey));
}

/** Item keys sorted by tier then label. */
export function getSortedItemKeys(): string[] {
  return Object.keys(ITEMS).sort((a, b) => {
    const ta = ITEMS[a].tier;
    const tb = ITEMS[b].tier;
    if (ta !== tb) return ta - tb;
    return ITEMS[a].label.localeCompare(ITEMS[b].label);
  });
}

/** Items grouped by category. */
export function getItemsByCategory(): Record<string, ItemInfo[]> {
  const groups: Record<string, ItemInfo[]> = Object.create(null);
  for (const item of Object.values(ITEMS)) {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
  }
  return groups;
}
