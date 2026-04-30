#!/usr/bin/env node
// Bake game data from greeny/SatisfactoryTools `dev/data/data.json` into
// TypeScript sources at `src/data/generated/{recipes,items}.ts`.
//
// Usage:
//   node scripts/bake-data.mjs           # fetch upstream + write
//   node scripts/bake-data.mjs --local <path>   # use a local JSON file
//
// The bake is idempotent. Run after every Satisfactory patch + spot-check
// the override layer at src/data/overrides/post-1.0.ts for hand-tuned
// deltas the upstream hasn't picked up yet.

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DATA_DIR = resolve(__dirname, "..", "src", "data");
const GENERATED_DIR = resolve(SRC_DATA_DIR, "generated");

const UPSTREAM = "https://raw.githubusercontent.com/greeny/SatisfactoryTools/dev/data/data.json";

// ─── Mapping tables ─────────────────────────────────────────────

/** Map greeny producedIn className → our MachineType key. */
const BUILDING_TO_MACHINE = {
  Desc_SmelterMk1_C: "smelter",
  Desc_FoundryMk1_C: "foundry",
  Desc_ConstructorMk1_C: "constructor",
  Desc_AssemblerMk1_C: "assembler",
  Desc_ManufacturerMk1_C: "manufacturer",
  Desc_OilRefinery_C: "refinery",
  Desc_Blender_C: "blender",
  Desc_Packager_C: "packager",
  Desc_HadronCollider_C: "particle_accelerator",
  Desc_Converter_C: "converter",
  Desc_QuantumEncoder_C: "quantum_encoder",
  // Power generators
  Desc_GeneratorBiomass_Automated_C: "biomass_burner",
  Desc_GeneratorBiomass_C: "biomass_burner",
  Desc_GeneratorCoal_C: "coal_generator",
  Desc_GeneratorFuel_C: "fuel_generator",
  Desc_GeneratorNuclear_C: "nuclear_power_plant",
  Desc_GeneratorGeoThermal_C: "geothermal_generator",
  // Misc — skip
  Desc_Workshop_C: null,                        // workbench — not automatable
  BP_WorkshopComponent_C: null,
  BP_WorkBenchComponent_C: null,
};

/** Map greeny resource className → our item key (mostly auto, special cases here). */
const SPECIAL_ITEM_KEYS = {
  Desc_OreIron_C: "iron_ore",
  Desc_OreCopper_C: "copper_ore",
  Desc_Stone_C: "limestone",
  Desc_Coal_C: "coal",
  Desc_OreGold_C: "caterium_ore",
  Desc_RawQuartz_C: "raw_quartz",
  Desc_Sulfur_C: "sulfur",
  Desc_OreBauxite_C: "bauxite",
  Desc_OreUranium_C: "uranium",
  Desc_SAM_C: "sam",
  Desc_Water_C: "water",
  Desc_LiquidOil_C: "crude_oil",
  Desc_NitrogenGas_C: "nitrogen_gas",
  Desc_LiquidFuel_C: "fuel",
  Desc_LiquidTurboFuel_C: "turbofuel",
  Desc_LiquidBiofuel_C: "liquid_biofuel",
  Desc_HeavyOilResidue_C: "heavy_oil_residue",
  Desc_AluminaSolution_C: "alumina_solution",
  Desc_SulfuricAcid_C: "sulfuric_acid",
  Desc_NitricAcid_C: "nitric_acid",
  Desc_DissolvedSilica_C: "dissolved_silica",
  Desc_RocketFuel_C: "rocket_fuel",
  Desc_IonizedFuel_C: "ionized_fuel",
  Desc_DarkMatter_C: "dark_matter_residue",
  Desc_QuantumEnergy_C: "excited_photonic_matter",
  Desc_PackagedWater_C: "packaged_water",
  Desc_PackagedOil_C: "packaged_oil",
  Desc_PackagedFuel_C: "packaged_fuel",
  Desc_PackagedOilResidue_C: "packaged_heavy_oil_residue",
  Desc_PackagedTurboFuel_C: "packaged_turbofuel",
  Desc_PackagedBiofuel_C: "packaged_liquid_biofuel",
  Desc_PackagedAlumina_C: "packaged_alumina_solution",
  Desc_PackagedSulfuricAcid_C: "packaged_sulfuric_acid",
  Desc_PackagedNitrogenGas_C: "packaged_nitrogen_gas",
  Desc_PackagedNitricAcid_C: "packaged_nitric_acid",
  Desc_PackagedRocketFuel_C: "packaged_rocket_fuel",
  Desc_PackagedIonizedFuel_C: "packaged_ionized_fuel",
};

/** Item category guess. We rely on the upstream `liquid` flag for fluids;
 *  everything else falls into a few buckets keyed by suffix or className. */
function inferCategory(className, liquid) {
  if (liquid) return "fluid";
  if (className.includes("Ore") || className === "Desc_Coal_C" || className === "Desc_Stone_C" || className === "Desc_Sulfur_C" || className === "Desc_RawQuartz_C" || className === "Desc_SAM_C") return "resource";
  if (className.endsWith("Ingot_C") || className.includes("Ingot")) return "ingot";
  if (className.includes("Plate") || className.includes("Rod") || className.includes("Wire") || className.includes("Cable") || className.includes("Screw")) return "part";
  if (className.includes("Frame") || className.includes("Rotor") || className.includes("Stator") || className.includes("Motor")) return "intermediate";
  if (className.includes("Computer") || className.includes("Circuit") || className.includes("Limiter") || className.includes("Processor")) return "advanced";
  if (className.includes("Fuel") || className.includes("Oil")) return "fluid";
  if (className.includes("Packaged")) return "packaged";
  if (className.includes("Nobelisk") || className.includes("Rebar") || className.includes("Ammo")) return "ammo";
  if (className.includes("Schematic") || className.includes("HardDrive") || className.includes("PowerShard") || className.includes("Somersloop") || className.includes("MercerSphere")) return "special";
  return "part";
}

function classNameToKey(className) {
  if (SPECIAL_ITEM_KEYS[className]) return SPECIAL_ITEM_KEYS[className];
  // Strip Desc_ prefix and _C suffix
  let n = className.replace(/^Desc_/, "").replace(/_C$/, "");
  // Convert PascalCase / camelCase → snake_case
  n = n.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
  n = n.replace(/_+/g, "_");
  return n.toLowerCase();
}

function recipeIdFromSlug(slug) {
  return slug.replace(/^recipe-/, "").replace(/-c$/, "").replace(/-/g, "_");
}

// ─── Bake ────────────────────────────────────────────────────────

async function loadData(args) {
  const localFlag = args.indexOf("--local");
  if (localFlag !== -1 && args[localFlag + 1]) {
    const p = resolve(process.cwd(), args[localFlag + 1]);
    if (!existsSync(p)) throw new Error(`File not found: ${p}`);
    return JSON.parse(readFileSync(p, "utf8"));
  }
  console.log(`Fetching ${UPSTREAM}…`);
  const r = await fetch(UPSTREAM);
  if (!r.ok) throw new Error(`Upstream returned ${r.status}`);
  return r.json();
}

function bake(data) {
  // Items
  const items = {};
  for (const [className, raw] of Object.entries(data.items)) {
    const key = classNameToKey(className);
    if (items[key]) continue;
    items[key] = {
      key,
      label: raw.name,
      icon: `${key}.webp`,
      category: inferCategory(className, raw.liquid === true),
      tier: 0,
      isFluid: raw.liquid === true,
      stackSize: raw.stackSize ?? 0,
      sinkPoints: raw.sinkPoints ?? 0,
    };
  }
  // Add resources too (some are not in items{} for some patches)
  for (const [className, _r] of Object.entries(data.resources)) {
    const key = classNameToKey(className);
    if (items[key]) {
      items[key].category = "resource";
      continue;
    }
    items[key] = {
      key,
      label: data.items[className]?.name ?? key,
      icon: `${key}.webp`,
      category: "resource",
      tier: 0,
      isFluid: data.items[className]?.liquid === true,
      stackSize: 0,
      sinkPoints: 0,
    };
  }

  // Recipes — only those producible in a known automatable machine
  const recipes = [];
  let skippedNoMachine = 0;
  let skippedManual = 0;
  for (const raw of Object.values(data.recipes)) {
    if (!raw.inMachine) { skippedManual++; continue; }
    const producedIn = raw.producedIn ?? [];
    let machine = null;
    for (const b of producedIn) {
      if (BUILDING_TO_MACHINE[b]) {
        machine = BUILDING_TO_MACHINE[b];
        break;
      }
    }
    if (!machine) { skippedNoMachine++; continue; }

    recipes.push({
      id: recipeIdFromSlug(raw.slug),
      label: raw.name,
      machine,
      craft_time: raw.time,
      is_alternate: raw.alternate === true,
      inputs: (raw.ingredients ?? []).map(ing => ({
        item: classNameToKey(ing.item),
        amount: ing.amount,
        type: items[classNameToKey(ing.item)]?.isFluid ? "fluid" : "item",
      })),
      outputs: (raw.products ?? []).map(p => ({
        item: classNameToKey(p.item),
        amount: p.amount,
        type: items[classNameToKey(p.item)]?.isFluid ? "fluid" : "item",
      })),
    });
  }

  console.log(`Items baked: ${Object.keys(items).length}`);
  console.log(`Recipes baked: ${recipes.length} (skipped ${skippedNoMachine} unknown-machine, ${skippedManual} manual-only)`);
  return { items, recipes };
}

function emitTs({ items, recipes }) {
  const itemsBlock = `// AUTO-GENERATED by scripts/bake-data.mjs — do not edit by hand.
// Source: greeny/SatisfactoryTools dev/data/data.json
// Re-bake with: \`npm run bake-data\`

import type { ItemInfo } from "../recipes";

export const GENERATED_ITEMS: Record<string, ItemInfo & { isFluid?: boolean; stackSize?: number; sinkPoints?: number }> = ${JSON.stringify(items, null, 2)};
`;

  const recipesBlock = `// AUTO-GENERATED by scripts/bake-data.mjs — do not edit by hand.
// Source: greeny/SatisfactoryTools dev/data/data.json
// Re-bake with: \`npm run bake-data\`

import type { Recipe } from "../recipes";

export const GENERATED_RECIPES: Recipe[] = ${JSON.stringify(recipes, null, 2)};
`;

  writeFileSync(resolve(GENERATED_DIR, "items.ts"), itemsBlock, "utf8");
  writeFileSync(resolve(GENERATED_DIR, "recipes.ts"), recipesBlock, "utf8");
  console.log(`Wrote ${resolve(GENERATED_DIR, "items.ts")}`);
  console.log(`Wrote ${resolve(GENERATED_DIR, "recipes.ts")}`);
}

const data = await loadData(process.argv.slice(2));
const baked = bake(data);
emitTs(baked);
console.log("Done.");
