// Post-1.0 deltas to the upstream greeny/SatisfactoryTools data set.
//
// The upstream data file at `dev/data/data.json` was last touched on
// 2024-09-10 (commit "Added 1.0") so it does NOT include rate or recipe
// adjustments shipped in patches 1.1.x and 1.2.0+. Add manual overrides
// here as we notice drift in-game; the merged result is what
// `src/data/recipes.ts` exposes.
//
// To override a recipe by id, set `RECIPE_OVERRIDES["<id>"] = { craft_time, outputs: [...] }`
// (only the fields you want to change — the rest comes from the bake).
// To add a recipe missing upstream, append to `RECIPE_ADDITIONS`.
// To re-tag an item category, set `ITEM_OVERRIDES["<key>"] = { category: "..." }`.

import type { Recipe, ItemInfo } from "../recipes";

export const RECIPE_OVERRIDES: Record<string, Partial<Recipe>> = {
  // Example:
  // "iron_plate": { craft_time: 6.0 },
};

export const RECIPE_ADDITIONS: Recipe[] = [];

export const ITEM_OVERRIDES: Record<string, Partial<ItemInfo>> = {};
