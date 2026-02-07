// Static recipe database for Satisfactory 1.0
// Used by the simulation engine to compute production rates and detect bottlenecks
//
// Machine types: miner, smelter, foundry, constructor, assembler, manufacturer,
//                refinery, blender, packager, particle_accelerator, converter, quantum_encoder

export interface RecipeInput {
  item: string;
  amount: number;
}

export interface Recipe {
  id: string;
  label: string;
  machine: string;
  craft_time: number; // seconds per cycle
  outputs: { item: string; amount: number }[];
  inputs: RecipeInput[];
  is_alternate?: boolean;
}

export interface ItemInfo {
  key: string;
  label: string;
  icon: string; // filename in assets bucket e.g. "iron_plate.webp"
  category: string;
  tier: number; // rough unlock tier (0 = raw resource)
}

// ─── Items Registry ───────────────────────────────────────────

export const ITEMS: Record<string, ItemInfo> = {
  // Raw Resources (tier 0)
  iron_ore:       { key: "iron_ore",       label: "Iron Ore",        icon: "iron_ore.webp",       category: "resource", tier: 0 },
  copper_ore:     { key: "copper_ore",     label: "Copper Ore",      icon: "copper_ore.webp",     category: "resource", tier: 0 },
  limestone:      { key: "limestone",      label: "Limestone",       icon: "limestone.webp",      category: "resource", tier: 0 },
  coal:           { key: "coal",           label: "Coal",            icon: "coal.webp",           category: "resource", tier: 0 },
  caterium_ore:   { key: "caterium_ore",   label: "Caterium Ore",    icon: "caterium_ore.webp",   category: "resource", tier: 0 },
  raw_quartz:     { key: "raw_quartz",     label: "Raw Quartz",      icon: "raw_quartz.webp",     category: "resource", tier: 0 },
  sulfur:         { key: "sulfur",         label: "Sulfur",          icon: "sulfur.webp",         category: "resource", tier: 0 },
  bauxite:        { key: "bauxite",        label: "Bauxite",         icon: "bauxite.webp",        category: "resource", tier: 0 },
  uranium:        { key: "uranium",        label: "Uranium",         icon: "uranium.webp",        category: "resource", tier: 0 },
  sam:            { key: "sam",            label: "SAM",             icon: "sam.webp",            category: "resource", tier: 0 },
  water:          { key: "water",          label: "Water",           icon: "water.webp",          category: "resource", tier: 0 },
  crude_oil:      { key: "crude_oil",      label: "Crude Oil",       icon: "crude_oil.webp",      category: "resource", tier: 0 },
  nitrogen_gas:   { key: "nitrogen_gas",   label: "Nitrogen Gas",    icon: "nitrogen_gas.webp",   category: "resource", tier: 0 },

  // Ingots (tier 1)
  iron_ingot:     { key: "iron_ingot",     label: "Iron Ingot",      icon: "iron_ingot.webp",     category: "ingot", tier: 1 },
  copper_ingot:   { key: "copper_ingot",   label: "Copper Ingot",    icon: "copper_ingot.webp",   category: "ingot", tier: 1 },
  caterium_ingot: { key: "caterium_ingot", label: "Caterium Ingot",  icon: "caterium_ingot.webp", category: "ingot", tier: 2 },
  steel_ingot:    { key: "steel_ingot",    label: "Steel Ingot",     icon: "steel_ingot.webp",    category: "ingot", tier: 3 },
  aluminum_ingot: { key: "aluminum_ingot", label: "Aluminum Ingot",  icon: "aluminum_ingot.webp", category: "ingot", tier: 7 },
  ficsite_ingot:  { key: "ficsite_ingot",  label: "Ficsite Ingot",   icon: "ficsite_ingot.webp",  category: "ingot", tier: 9 },

  // Basic Parts (tier 1-2)
  iron_plate:              { key: "iron_plate",              label: "Iron Plate",              icon: "iron_plate.webp",              category: "part", tier: 1 },
  iron_rod:                { key: "iron_rod",                label: "Iron Rod",                icon: "iron_rod.webp",                category: "part", tier: 1 },
  screw:                   { key: "screw",                   label: "Screw",                   icon: "screw.webp",                   category: "part", tier: 1 },
  wire:                    { key: "wire",                    label: "Wire",                    icon: "wire.webp",                    category: "part", tier: 1 },
  cable:                   { key: "cable",                   label: "Cable",                   icon: "cable.webp",                   category: "part", tier: 1 },
  concrete:                { key: "concrete",                label: "Concrete",                icon: "concrete.webp",                category: "part", tier: 1 },
  copper_sheet:            { key: "copper_sheet",            label: "Copper Sheet",            icon: "copper_sheet.webp",            category: "part", tier: 2 },
  quartz_crystal:          { key: "quartz_crystal",          label: "Quartz Crystal",          icon: "quartz_crystal.webp",          category: "part", tier: 2 },
  silica:                  { key: "silica",                  label: "Silica",                  icon: "silica.webp",                  category: "part", tier: 2 },
  quickwire:               { key: "quickwire",               label: "Quickwire",               icon: "quickwire.webp",               category: "part", tier: 2 },
  steel_beam:              { key: "steel_beam",              label: "Steel Beam",              icon: "steel_beam.webp",              category: "part", tier: 3 },
  steel_pipe:              { key: "steel_pipe",              label: "Steel Pipe",              icon: "steel_pipe.webp",              category: "part", tier: 3 },
  plastic:                 { key: "plastic",                 label: "Plastic",                 icon: "plastic.webp",                 category: "part", tier: 5 },
  rubber:                  { key: "rubber",                  label: "Rubber",                  icon: "rubber.webp",                  category: "part", tier: 5 },
  aluminum_casing:         { key: "aluminum_casing",         label: "Aluminum Casing",         icon: "aluminum_casing.webp",         category: "part", tier: 7 },
  alclad_aluminum_sheet:   { key: "alclad_aluminum_sheet",   label: "Alclad Aluminum Sheet",   icon: "alclad_aluminum_sheet.webp",   category: "part", tier: 7 },
  ficsite_trigon:          { key: "ficsite_trigon",          label: "Ficsite Trigon",          icon: "ficsite_trigon.webp",          category: "part", tier: 9 },

  // Intermediate (tier 2-5)
  reinforced_iron_plate:       { key: "reinforced_iron_plate",       label: "Reinforced Iron Plate",       icon: "reinforced_iron_plate.webp",       category: "intermediate", tier: 2 },
  modular_frame:               { key: "modular_frame",               label: "Modular Frame",               icon: "modular_frame.webp",               category: "intermediate", tier: 2 },
  rotor:                       { key: "rotor",                       label: "Rotor",                       icon: "rotor.webp",                       category: "intermediate", tier: 2 },
  stator:                      { key: "stator",                      label: "Stator",                      icon: "stator.webp",                      category: "intermediate", tier: 3 },
  motor:                       { key: "motor",                       label: "Motor",                       icon: "motor.webp",                       category: "intermediate", tier: 4 },
  encased_industrial_beam:     { key: "encased_industrial_beam",     label: "Encased Industrial Beam",     icon: "encased_industrial_beam.webp",     category: "intermediate", tier: 3 },
  heavy_modular_frame:         { key: "heavy_modular_frame",         label: "Heavy Modular Frame",         icon: "heavy_modular_frame.webp",         category: "intermediate", tier: 4 },
  circuit_board:               { key: "circuit_board",               label: "Circuit Board",               icon: "circuit_board.webp",               category: "intermediate", tier: 5 },
  ai_limiter:                  { key: "ai_limiter",                  label: "AI Limiter",                  icon: "ai_limiter.webp",                  category: "intermediate", tier: 5 },
  high_speed_connector:        { key: "high_speed_connector",        label: "High-Speed Connector",        icon: "high_speed_connector.webp",        category: "intermediate", tier: 5 },
  computer:                    { key: "computer",                    label: "Computer",                    icon: "computer.webp",                    category: "intermediate", tier: 5 },
  crystal_oscillator:          { key: "crystal_oscillator",          label: "Crystal Oscillator",          icon: "crystal_oscillator.webp",          category: "intermediate", tier: 5 },
  supercomputer:               { key: "supercomputer",               label: "Supercomputer",               icon: "supercomputer.webp",               category: "intermediate", tier: 7 },
  battery:                     { key: "battery",                     label: "Battery",                     icon: "battery.webp",                     category: "intermediate", tier: 7 },
  electromagnetic_control_rod: { key: "electromagnetic_control_rod", label: "Electromagnetic Control Rod", icon: "electromagnetic_control_rod.webp", category: "intermediate", tier: 7 },
  cooling_system:              { key: "cooling_system",              label: "Cooling System",              icon: "cooling_system.webp",              category: "intermediate", tier: 8 },
  turbo_motor:                 { key: "turbo_motor",                 label: "Turbo Motor",                 icon: "turbo_motor.webp",                 category: "intermediate", tier: 8 },
  radio_control_unit:          { key: "radio_control_unit",          label: "Radio Control Unit",          icon: "radio_control_unit.webp",          category: "intermediate", tier: 7 },
  fused_modular_frame:         { key: "fused_modular_frame",         label: "Fused Modular Frame",         icon: "fused_modular_frame.webp",         category: "intermediate", tier: 8 },
  sam_fluctuator:              { key: "sam_fluctuator",              label: "SAM Fluctuator",              icon: "sam_fluctuator.webp",              category: "intermediate", tier: 7 },
  pressure_conversion_cube:    { key: "pressure_conversion_cube",    label: "Pressure Conversion Cube",    icon: "pressure_conversion_cube.webp",    category: "intermediate", tier: 8 },
  assembly_director_system:    { key: "assembly_director_system",    label: "Assembly Director System",    icon: "assembly_director_system.webp",    category: "intermediate", tier: 8 },
  neural_quantum_processor:    { key: "neural_quantum_processor",    label: "Neural-Quantum Processor",    icon: "neural_quantum_processor.webp",    category: "intermediate", tier: 9 },
  superposition_oscillator:    { key: "superposition_oscillator",    label: "Superposition Oscillator",    icon: "superposition_oscillator.webp",    category: "intermediate", tier: 9 },

  // Fluids (tier 3-8)
  heavy_oil_residue: { key: "heavy_oil_residue", label: "Heavy Oil Residue", icon: "heavy_oil_residue.webp", category: "fluid",   tier: 5 },
  fuel:              { key: "fuel",              label: "Fuel",              icon: "fuel.webp",              category: "fluid",   tier: 5 },
  polymer_resin:     { key: "polymer_resin",     label: "Polymer Resin",     icon: "polymer_resin.webp",     category: "fluid",   tier: 5 },
  turbofuel:         { key: "turbofuel",         label: "Turbofuel",         icon: "turbofuel.webp",         category: "fluid",   tier: 5 },
  alumina_solution:  { key: "alumina_solution",  label: "Alumina Solution",  icon: "alumina_solution.webp",  category: "fluid",   tier: 7 },
  sulfuric_acid:     { key: "sulfuric_acid",     label: "Sulfuric Acid",     icon: "sulfuric_acid.webp",     category: "fluid",   tier: 7 },
  nitric_acid:       { key: "nitric_acid",       label: "Nitric Acid",       icon: "nitric_acid.webp",       category: "fluid",   tier: 8 },
  dissolved_silica:  { key: "dissolved_silica",  label: "Dissolved Silica",  icon: "dissolved_silica.webp",  category: "fluid",   tier: 7 },
  rocket_fuel:       { key: "rocket_fuel",       label: "Rocket Fuel",       icon: "rocket_fuel.webp",       category: "fluid",   tier: 8 },
  ionized_fuel:      { key: "ionized_fuel",      label: "Ionized Fuel",      icon: "ionized_fuel.webp",      category: "fluid",   tier: 8 },

  // Biomass & Fuel
  biomass:         { key: "biomass",         label: "Biomass",         icon: "biomass.webp",         category: "fuel", tier: 0 },
  solid_biofuel:   { key: "solid_biofuel",   label: "Solid Biofuel",   icon: "solid_biofuel.webp",   category: "fuel", tier: 1 },
  compacted_coal:  { key: "compacted_coal",  label: "Compacted Coal",  icon: "compacted_coal.webp",  category: "fuel", tier: 3 },
  petroleum_coke:  { key: "petroleum_coke",  label: "Petroleum Coke",  icon: "petroleum_coke.webp",  category: "fuel", tier: 5 },
  fabric:          { key: "fabric",          label: "Fabric",          icon: "fabric.webp",          category: "fuel", tier: 2 },

  // Nuclear
  encased_uranium_cell:   { key: "encased_uranium_cell",   label: "Encased Uranium Cell",   icon: "encased_uranium_cell.webp",   category: "nuclear", tier: 7 },
  uranium_fuel_rod:       { key: "uranium_fuel_rod",       label: "Uranium Fuel Rod",       icon: "uranium_fuel_rod.webp",       category: "nuclear", tier: 7 },
  non_fissile_uranium:    { key: "non_fissile_uranium",    label: "Non-fissile Uranium",    icon: "non_fissile_uranium.webp",    category: "nuclear", tier: 8 },
  plutonium_pellet:       { key: "plutonium_pellet",       label: "Plutonium Pellet",       icon: "plutonium_pellet.webp",       category: "nuclear", tier: 8 },
  encased_plutonium_cell: { key: "encased_plutonium_cell", label: "Encased Plutonium Cell", icon: "encased_plutonium_cell.webp", category: "nuclear", tier: 8 },
  plutonium_fuel_rod:     { key: "plutonium_fuel_rod",     label: "Plutonium Fuel Rod",     icon: "plutonium_fuel_rod.webp",     category: "nuclear", tier: 8 },
  ficsonium:              { key: "ficsonium",              label: "Ficsonium",              icon: "ficsonium.webp",              category: "nuclear", tier: 9 },
  ficsonium_fuel_rod:     { key: "ficsonium_fuel_rod",     label: "Ficsonium Fuel Rod",     icon: "ficsonium_fuel_rod.webp",     category: "nuclear", tier: 9 },

  // Space Elevator
  smart_plating:              { key: "smart_plating",              label: "Smart Plating",              icon: "smart_plating.webp",              category: "elevator", tier: 2 },
  versatile_framework:        { key: "versatile_framework",        label: "Versatile Framework",        icon: "versatile_framework.webp",        category: "elevator", tier: 3 },
  automated_wiring:           { key: "automated_wiring",           label: "Automated Wiring",           icon: "automated_wiring.webp",           category: "elevator", tier: 4 },
  modular_engine:             { key: "modular_engine",             label: "Modular Engine",             icon: "modular_engine.webp",             category: "elevator", tier: 5 },
  adaptive_control_unit:      { key: "adaptive_control_unit",      label: "Adaptive Control Unit",      icon: "adaptive_control_unit.webp",      category: "elevator", tier: 5 },
  magnetic_field_generator:   { key: "magnetic_field_generator",   label: "Magnetic Field Generator",   icon: "magnetic_field_generator.webp",   category: "elevator", tier: 8 },
  thermal_propulsion_rocket:  { key: "thermal_propulsion_rocket",  label: "Thermal Propulsion Rocket",  icon: "thermal_propulsion_rocket.webp",  category: "elevator", tier: 8 },
  nuclear_pasta:              { key: "nuclear_pasta",              label: "Nuclear Pasta",              icon: "nuclear_pasta.webp",              category: "elevator", tier: 8 },
  biochemical_sculptor:       { key: "biochemical_sculptor",       label: "Biochemical Sculptor",       icon: "biochemical_sculptor.webp",       category: "elevator", tier: 9 },
  ballistic_warp_drive:       { key: "ballistic_warp_drive",       label: "Ballistic Warp Drive",       icon: "ballistic_warp_drive.webp",       category: "elevator", tier: 9 },

  // Alien
  dark_matter_crystal:     { key: "dark_matter_crystal",     label: "Dark Matter Crystal",     icon: "dark_matter_crystal.webp",     category: "alien", tier: 9 },
  dark_matter_residue:     { key: "dark_matter_residue",     label: "Dark Matter Residue",     icon: "dark_matter_residue.webp",     category: "alien", tier: 9 },
  diamonds:                { key: "diamonds",                label: "Diamonds",                icon: "diamonds.webp",                category: "alien", tier: 9 },
  time_crystal:            { key: "time_crystal",            label: "Time Crystal",            icon: "time_crystal.webp",            category: "alien", tier: 9 },
  excited_photonic_matter: { key: "excited_photonic_matter", label: "Excited Photonic Matter", icon: "excited_photonic_matter.webp", category: "alien", tier: 9 },
  reanimated_sam:          { key: "reanimated_sam",          label: "Reanimated SAM",          icon: "reanimated_sam.webp",          category: "alien", tier: 9 },
  power_shard:             { key: "power_shard",             label: "Power Shard",             icon: "power_shard.webp",             category: "alien", tier: 2 },
};

// ─── Recipes (Default / Standard only) ───────────────────────

export const RECIPES: Recipe[] = [
  // ── Smelter Recipes ──
  {
    id: "iron_ingot",
    label: "Iron Ingot",
    machine: "smelter",
    craft_time: 2,
    outputs: [{ item: "iron_ingot", amount: 1 }],
    inputs: [{ item: "iron_ore", amount: 1 }],
  },
  {
    id: "copper_ingot",
    label: "Copper Ingot",
    machine: "smelter",
    craft_time: 2,
    outputs: [{ item: "copper_ingot", amount: 1 }],
    inputs: [{ item: "copper_ore", amount: 1 }],
  },
  {
    id: "caterium_ingot",
    label: "Caterium Ingot",
    machine: "smelter",
    craft_time: 4,
    outputs: [{ item: "caterium_ingot", amount: 1 }],
    inputs: [{ item: "caterium_ore", amount: 3 }],
  },

  // ── Foundry Recipes ──
  {
    id: "steel_ingot",
    label: "Steel Ingot",
    machine: "foundry",
    craft_time: 4,
    outputs: [{ item: "steel_ingot", amount: 3 }],
    inputs: [
      { item: "iron_ore", amount: 3 },
      { item: "coal", amount: 3 },
    ],
  },
  {
    id: "aluminum_ingot",
    label: "Aluminum Ingot",
    machine: "foundry",
    craft_time: 4,
    outputs: [{ item: "aluminum_ingot", amount: 4 }],
    inputs: [
      { item: "aluminum_scrap", amount: 6 },
      { item: "silica", amount: 5 },
    ],
  },

  // ── Constructor Recipes ──
  {
    id: "iron_plate",
    label: "Iron Plate",
    machine: "constructor",
    craft_time: 6,
    outputs: [{ item: "iron_plate", amount: 2 }],
    inputs: [{ item: "iron_ingot", amount: 3 }],
  },
  {
    id: "iron_rod",
    label: "Iron Rod",
    machine: "constructor",
    craft_time: 4,
    outputs: [{ item: "iron_rod", amount: 1 }],
    inputs: [{ item: "iron_ingot", amount: 1 }],
  },
  {
    id: "screw",
    label: "Screw",
    machine: "constructor",
    craft_time: 6,
    outputs: [{ item: "screw", amount: 4 }],
    inputs: [{ item: "iron_rod", amount: 1 }],
  },
  {
    id: "wire",
    label: "Wire",
    machine: "constructor",
    craft_time: 4,
    outputs: [{ item: "wire", amount: 2 }],
    inputs: [{ item: "copper_ingot", amount: 1 }],
  },
  {
    id: "cable",
    label: "Cable",
    machine: "constructor",
    craft_time: 2,
    outputs: [{ item: "cable", amount: 1 }],
    inputs: [{ item: "wire", amount: 2 }],
  },
  {
    id: "concrete",
    label: "Concrete",
    machine: "constructor",
    craft_time: 4,
    outputs: [{ item: "concrete", amount: 1 }],
    inputs: [{ item: "limestone", amount: 3 }],
  },
  {
    id: "copper_sheet",
    label: "Copper Sheet",
    machine: "constructor",
    craft_time: 6,
    outputs: [{ item: "copper_sheet", amount: 1 }],
    inputs: [{ item: "copper_ingot", amount: 2 }],
  },
  {
    id: "quartz_crystal",
    label: "Quartz Crystal",
    machine: "constructor",
    craft_time: 8,
    outputs: [{ item: "quartz_crystal", amount: 3 }],
    inputs: [{ item: "raw_quartz", amount: 5 }],
  },
  {
    id: "silica",
    label: "Silica",
    machine: "constructor",
    craft_time: 8,
    outputs: [{ item: "silica", amount: 5 }],
    inputs: [{ item: "raw_quartz", amount: 3 }],
  },
  {
    id: "quickwire",
    label: "Quickwire",
    machine: "constructor",
    craft_time: 5,
    outputs: [{ item: "quickwire", amount: 5 }],
    inputs: [{ item: "caterium_ingot", amount: 1 }],
  },
  {
    id: "steel_beam",
    label: "Steel Beam",
    machine: "constructor",
    craft_time: 4,
    outputs: [{ item: "steel_beam", amount: 1 }],
    inputs: [{ item: "steel_ingot", amount: 4 }],
  },
  {
    id: "steel_pipe",
    label: "Steel Pipe",
    machine: "constructor",
    craft_time: 6,
    outputs: [{ item: "steel_pipe", amount: 2 }],
    inputs: [{ item: "steel_ingot", amount: 3 }],
  },
  {
    id: "aluminum_casing",
    label: "Aluminum Casing",
    machine: "constructor",
    craft_time: 2,
    outputs: [{ item: "aluminum_casing", amount: 2 }],
    inputs: [{ item: "aluminum_ingot", amount: 3 }],
  },
  {
    id: "solid_biofuel",
    label: "Solid Biofuel",
    machine: "constructor",
    craft_time: 4,
    outputs: [{ item: "solid_biofuel", amount: 4 }],
    inputs: [{ item: "biomass", amount: 8 }],
  },
  {
    id: "ficsite_trigon",
    label: "Ficsite Trigon",
    machine: "constructor",
    craft_time: 6,
    outputs: [{ item: "ficsite_trigon", amount: 2 }],
    inputs: [{ item: "ficsite_ingot", amount: 1 }],
  },

  // ── Assembler Recipes ──
  {
    id: "reinforced_iron_plate",
    label: "Reinforced Iron Plate",
    machine: "assembler",
    craft_time: 12,
    outputs: [{ item: "reinforced_iron_plate", amount: 1 }],
    inputs: [
      { item: "iron_plate", amount: 6 },
      { item: "screw", amount: 12 },
    ],
  },
  {
    id: "modular_frame",
    label: "Modular Frame",
    machine: "assembler",
    craft_time: 60,
    outputs: [{ item: "modular_frame", amount: 2 }],
    inputs: [
      { item: "reinforced_iron_plate", amount: 3 },
      { item: "iron_rod", amount: 12 },
    ],
  },
  {
    id: "rotor",
    label: "Rotor",
    machine: "assembler",
    craft_time: 15,
    outputs: [{ item: "rotor", amount: 1 }],
    inputs: [
      { item: "iron_rod", amount: 5 },
      { item: "screw", amount: 25 },
    ],
  },
  {
    id: "smart_plating",
    label: "Smart Plating",
    machine: "assembler",
    craft_time: 30,
    outputs: [{ item: "smart_plating", amount: 1 }],
    inputs: [
      { item: "reinforced_iron_plate", amount: 1 },
      { item: "rotor", amount: 1 },
    ],
  },
  {
    id: "stator",
    label: "Stator",
    machine: "assembler",
    craft_time: 12,
    outputs: [{ item: "stator", amount: 1 }],
    inputs: [
      { item: "steel_pipe", amount: 3 },
      { item: "wire", amount: 8 },
    ],
  },
  {
    id: "motor",
    label: "Motor",
    machine: "assembler",
    craft_time: 12,
    outputs: [{ item: "motor", amount: 1 }],
    inputs: [
      { item: "rotor", amount: 2 },
      { item: "stator", amount: 2 },
    ],
  },
  {
    id: "encased_industrial_beam",
    label: "Encased Industrial Beam",
    machine: "assembler",
    craft_time: 15,
    outputs: [{ item: "encased_industrial_beam", amount: 1 }],
    inputs: [
      { item: "steel_beam", amount: 3 },
      { item: "concrete", amount: 6 },
    ],
  },
  {
    id: "circuit_board",
    label: "Circuit Board",
    machine: "assembler",
    craft_time: 8,
    outputs: [{ item: "circuit_board", amount: 1 }],
    inputs: [
      { item: "copper_sheet", amount: 2 },
      { item: "plastic", amount: 4 },
    ],
  },
  {
    id: "ai_limiter",
    label: "AI Limiter",
    machine: "assembler",
    craft_time: 12,
    outputs: [{ item: "ai_limiter", amount: 1 }],
    inputs: [
      { item: "circuit_board", amount: 5 },
      { item: "quickwire", amount: 20 },
    ],
  },
  {
    id: "versatile_framework",
    label: "Versatile Framework",
    machine: "assembler",
    craft_time: 24,
    outputs: [{ item: "versatile_framework", amount: 2 }],
    inputs: [
      { item: "modular_frame", amount: 1 },
      { item: "steel_beam", amount: 12 },
    ],
  },
  {
    id: "automated_wiring",
    label: "Automated Wiring",
    machine: "assembler",
    craft_time: 24,
    outputs: [{ item: "automated_wiring", amount: 1 }],
    inputs: [
      { item: "stator", amount: 1 },
      { item: "cable", amount: 20 },
    ],
  },
  {
    id: "alclad_aluminum_sheet",
    label: "Alclad Aluminum Sheet",
    machine: "assembler",
    craft_time: 6,
    outputs: [{ item: "alclad_aluminum_sheet", amount: 3 }],
    inputs: [
      { item: "aluminum_ingot", amount: 3 },
      { item: "copper_ingot", amount: 1 },
    ],
  },
  {
    id: "compacted_coal",
    label: "Compacted Coal",
    machine: "assembler",
    craft_time: 12,
    outputs: [{ item: "compacted_coal", amount: 5 }],
    inputs: [
      { item: "coal", amount: 5 },
      { item: "sulfur", amount: 5 },
    ],
  },
  {
    id: "electromagnetic_control_rod",
    label: "Electromagnetic Control Rod",
    machine: "assembler",
    craft_time: 30,
    outputs: [{ item: "electromagnetic_control_rod", amount: 2 }],
    inputs: [
      { item: "stator", amount: 3 },
      { item: "ai_limiter", amount: 2 },
    ],
  },
  {
    id: "encased_uranium_cell",
    label: "Encased Uranium Cell",
    machine: "assembler",    // actually blender in 1.0, keeping simplified
    craft_time: 12,
    outputs: [{ item: "encased_uranium_cell", amount: 5 }],
    inputs: [
      { item: "uranium", amount: 10 },
      { item: "concrete", amount: 3 },
      { item: "sulfuric_acid", amount: 8 },
    ],
  },
  {
    id: "battery",
    label: "Battery",
    machine: "blender",
    craft_time: 3,
    outputs: [{ item: "battery", amount: 1 }],
    inputs: [
      { item: "sulfuric_acid", amount: 2.5 },
      { item: "alumina_solution", amount: 2 },
      { item: "aluminum_casing", amount: 1 },
    ],
  },
  {
    id: "sam_fluctuator",
    label: "SAM Fluctuator",
    machine: "assembler",
    craft_time: 6,
    outputs: [{ item: "sam_fluctuator", amount: 1 }],
    inputs: [
      { item: "reanimated_sam", amount: 6 },
      { item: "wire", amount: 5 },
    ],
  },
  {
    id: "fabric",
    label: "Fabric",
    machine: "assembler",
    craft_time: 4,
    outputs: [{ item: "fabric", amount: 1 }],
    inputs: [
      { item: "biomass", amount: 1 },
      { item: "polymer_resin", amount: 1 },  // alternate: mycelia
    ],
  },

  // ── Manufacturer Recipes ──
  {
    id: "heavy_modular_frame",
    label: "Heavy Modular Frame",
    machine: "manufacturer",
    craft_time: 30,
    outputs: [{ item: "heavy_modular_frame", amount: 1 }],
    inputs: [
      { item: "modular_frame", amount: 5 },
      { item: "steel_pipe", amount: 15 },
      { item: "encased_industrial_beam", amount: 5 },
      { item: "screw", amount: 100 },
    ],
  },
  {
    id: "computer",
    label: "Computer",
    machine: "manufacturer",
    craft_time: 24,
    outputs: [{ item: "computer", amount: 1 }],
    inputs: [
      { item: "circuit_board", amount: 10 },
      { item: "cable", amount: 9 },
      { item: "plastic", amount: 18 },
      { item: "screw", amount: 52 },
    ],
  },
  {
    id: "crystal_oscillator",
    label: "Crystal Oscillator",
    machine: "manufacturer",
    craft_time: 120,
    outputs: [{ item: "crystal_oscillator", amount: 2 }],
    inputs: [
      { item: "quartz_crystal", amount: 36 },
      { item: "cable", amount: 28 },
      { item: "reinforced_iron_plate", amount: 5 },
    ],
  },
  {
    id: "high_speed_connector",
    label: "High-Speed Connector",
    machine: "manufacturer",
    craft_time: 16,
    outputs: [{ item: "high_speed_connector", amount: 1 }],
    inputs: [
      { item: "quickwire", amount: 56 },
      { item: "cable", amount: 10 },
      { item: "circuit_board", amount: 1 },
    ],
  },
  {
    id: "supercomputer",
    label: "Supercomputer",
    machine: "manufacturer",
    craft_time: 32,
    outputs: [{ item: "supercomputer", amount: 1 }],
    inputs: [
      { item: "computer", amount: 2 },
      { item: "ai_limiter", amount: 2 },
      { item: "high_speed_connector", amount: 3 },
      { item: "plastic", amount: 28 },
    ],
  },
  {
    id: "modular_engine",
    label: "Modular Engine",
    machine: "manufacturer",
    craft_time: 60,
    outputs: [{ item: "modular_engine", amount: 1 }],
    inputs: [
      { item: "motor", amount: 2 },
      { item: "rubber", amount: 15 },
      { item: "smart_plating", amount: 2 },
    ],
  },
  {
    id: "adaptive_control_unit",
    label: "Adaptive Control Unit",
    machine: "manufacturer",
    craft_time: 120,
    outputs: [{ item: "adaptive_control_unit", amount: 2 }],
    inputs: [
      { item: "automated_wiring", amount: 15 },
      { item: "circuit_board", amount: 10 },
      { item: "heavy_modular_frame", amount: 2 },
      { item: "computer", amount: 2 },
    ],
  },
  {
    id: "turbo_motor",
    label: "Turbo Motor",
    machine: "manufacturer",
    craft_time: 32,
    outputs: [{ item: "turbo_motor", amount: 1 }],
    inputs: [
      { item: "cooling_system", amount: 4 },
      { item: "radio_control_unit", amount: 2 },
      { item: "motor", amount: 4 },
      { item: "rubber", amount: 24 },
    ],
  },
  {
    id: "radio_control_unit",
    label: "Radio Control Unit",
    machine: "manufacturer",
    craft_time: 48,
    outputs: [{ item: "radio_control_unit", amount: 2 }],
    inputs: [
      { item: "aluminum_casing", amount: 32 },
      { item: "crystal_oscillator", amount: 1 },
      { item: "computer", amount: 1 },
    ],
  },
  {
    id: "uranium_fuel_rod",
    label: "Uranium Fuel Rod",
    machine: "manufacturer",
    craft_time: 150,
    outputs: [{ item: "uranium_fuel_rod", amount: 1 }],
    inputs: [
      { item: "encased_uranium_cell", amount: 50 },
      { item: "encased_industrial_beam", amount: 3 },
      { item: "electromagnetic_control_rod", amount: 5 },
    ],
  },
  {
    id: "plutonium_fuel_rod",
    label: "Plutonium Fuel Rod",
    machine: "manufacturer",
    craft_time: 240,
    outputs: [{ item: "plutonium_fuel_rod", amount: 1 }],
    inputs: [
      { item: "encased_plutonium_cell", amount: 30 },
      { item: "steel_beam", amount: 18 },
      { item: "electromagnetic_control_rod", amount: 6 },
      { item: "heavy_modular_frame", amount: 10 },  // simplified
    ],
  },
  {
    id: "magnetic_field_generator",
    label: "Magnetic Field Generator",
    machine: "manufacturer",
    craft_time: 120,
    outputs: [{ item: "magnetic_field_generator", amount: 2 }],
    inputs: [
      { item: "versatile_framework", amount: 5 },
      { item: "electromagnetic_control_rod", amount: 2 },
      { item: "battery", amount: 10 },
    ],
  },
  {
    id: "thermal_propulsion_rocket",
    label: "Thermal Propulsion Rocket",
    machine: "manufacturer",
    craft_time: 120,
    outputs: [{ item: "thermal_propulsion_rocket", amount: 2 }],
    inputs: [
      { item: "modular_engine", amount: 5 },
      { item: "turbo_motor", amount: 2 },
      { item: "cooling_system", amount: 6 },
      { item: "fused_modular_frame", amount: 2 },
    ],
  },
  {
    id: "assembly_director_system",
    label: "Assembly Director System",
    machine: "assembler",
    craft_time: 80,
    outputs: [{ item: "assembly_director_system", amount: 1 }],
    inputs: [
      { item: "adaptive_control_unit", amount: 2 },
      { item: "supercomputer", amount: 1 },
    ],
  },
  {
    id: "fused_modular_frame",
    label: "Fused Modular Frame",
    machine: "blender",
    craft_time: 40,
    outputs: [{ item: "fused_modular_frame", amount: 1 }],
    inputs: [
      { item: "heavy_modular_frame", amount: 1 },
      { item: "aluminum_casing", amount: 50 },
      { item: "nitrogen_gas", amount: 25 },
    ],
  },
  {
    id: "cooling_system",
    label: "Cooling System",
    machine: "blender",
    craft_time: 10,
    outputs: [{ item: "cooling_system", amount: 1 }],
    inputs: [
      { item: "heavy_oil_residue", amount: 5 },  // simplified
      { item: "rubber", amount: 2 },
      { item: "water", amount: 5 },
      { item: "nitrogen_gas", amount: 25 },
    ],
  },
  {
    id: "pressure_conversion_cube",
    label: "Pressure Conversion Cube",
    machine: "assembler",
    craft_time: 60,
    outputs: [{ item: "pressure_conversion_cube", amount: 1 }],
    inputs: [
      { item: "fused_modular_frame", amount: 1 },
      { item: "radio_control_unit", amount: 2 },
    ],
  },
  {
    id: "nuclear_pasta",
    label: "Nuclear Pasta",
    machine: "particle_accelerator",
    craft_time: 120,
    outputs: [{ item: "nuclear_pasta", amount: 1 }],
    inputs: [
      { item: "copper_sheet", amount: 200 },
      { item: "pressure_conversion_cube", amount: 1 },
    ],
  },

  // ── Refinery Recipes ──
  {
    id: "plastic",
    label: "Plastic",
    machine: "refinery",
    craft_time: 6,
    outputs: [
      { item: "plastic", amount: 2 },
      { item: "heavy_oil_residue", amount: 1 },
    ],
    inputs: [{ item: "crude_oil", amount: 3 }],
  },
  {
    id: "rubber",
    label: "Rubber",
    machine: "refinery",
    craft_time: 6,
    outputs: [
      { item: "rubber", amount: 2 },
      { item: "heavy_oil_residue", amount: 2 },
    ],
    inputs: [{ item: "crude_oil", amount: 3 }],
  },
  {
    id: "fuel",
    label: "Fuel",
    machine: "refinery",
    craft_time: 6,
    outputs: [
      { item: "fuel", amount: 4 },
      { item: "polymer_resin", amount: 3 },
    ],
    inputs: [{ item: "crude_oil", amount: 6 }],
  },
  {
    id: "petroleum_coke",
    label: "Petroleum Coke",
    machine: "refinery",
    craft_time: 6,
    outputs: [{ item: "petroleum_coke", amount: 12 }],
    inputs: [{ item: "heavy_oil_residue", amount: 4 }],
  },
  {
    id: "alumina_solution",
    label: "Alumina Solution",
    machine: "refinery",
    craft_time: 6,
    outputs: [
      { item: "alumina_solution", amount: 12 },
      { item: "silica", amount: 5 },
    ],
    inputs: [
      { item: "bauxite", amount: 12 },
      { item: "water", amount: 18 },
    ],
  },
  {
    id: "sulfuric_acid",
    label: "Sulfuric Acid",
    machine: "refinery",
    craft_time: 6,
    outputs: [{ item: "sulfuric_acid", amount: 5 }],
    inputs: [
      { item: "sulfur", amount: 5 },
      { item: "water", amount: 5 },
    ],
  },
  {
    id: "turbofuel",
    label: "Turbofuel",
    machine: "refinery",
    craft_time: 16,
    outputs: [{ item: "turbofuel", amount: 5 }],
    inputs: [
      { item: "fuel", amount: 6 },
      { item: "compacted_coal", amount: 4 },
    ],
  },

  // ── Blender Recipes ──
  {
    id: "nitric_acid",
    label: "Nitric Acid",
    machine: "blender",
    craft_time: 6,
    outputs: [{ item: "nitric_acid", amount: 3 }],
    inputs: [
      { item: "nitrogen_gas", amount: 12 },
      { item: "water", amount: 3 },
      { item: "iron_plate", amount: 1 },
    ],
  },
  {
    id: "non_fissile_uranium",
    label: "Non-fissile Uranium",
    machine: "blender",
    craft_time: 24,
    outputs: [{ item: "non_fissile_uranium", amount: 20 }],
    inputs: [
      { item: "uranium_waste", amount: 15 },  // simplified
      { item: "silica", amount: 10 },
      { item: "nitric_acid", amount: 6 },
      { item: "sulfuric_acid", amount: 6 },
    ],
  },
  {
    id: "encased_plutonium_cell",
    label: "Encased Plutonium Cell",
    machine: "assembler",    // particle accelerator in 1.0, simplified
    craft_time: 12,
    outputs: [{ item: "encased_plutonium_cell", amount: 1 }],
    inputs: [
      { item: "plutonium_pellet", amount: 2 },
      { item: "concrete", amount: 4 },
    ],
  },
  {
    id: "plutonium_pellet",
    label: "Plutonium Pellet",
    machine: "particle_accelerator",
    craft_time: 60,
    outputs: [{ item: "plutonium_pellet", amount: 30 }],
    inputs: [
      { item: "non_fissile_uranium", amount: 100 },
      { item: "uranium_waste", amount: 25 },
    ],
  },

  // ── Converter Recipes ──
  {
    id: "ficsite_ingot_iron",
    label: "Ficsite Ingot (Iron)",
    machine: "converter",
    craft_time: 6,
    outputs: [{ item: "ficsite_ingot", amount: 1 }],
    inputs: [
      { item: "reanimated_sam", amount: 4 },
      { item: "iron_ingot", amount: 24 },
    ],
  },
  {
    id: "dark_matter_crystal",
    label: "Dark Matter Crystal",
    machine: "converter",
    craft_time: 2,
    outputs: [
      { item: "dark_matter_crystal", amount: 1 },
      { item: "dark_matter_residue", amount: 5 },
    ],
    inputs: [{ item: "diamonds", amount: 1 }],
  },

  // ── Quantum Encoder Recipes ──
  {
    id: "neural_quantum_processor",
    label: "Neural-Quantum Processor",
    machine: "quantum_encoder",
    craft_time: 30,
    outputs: [
      { item: "neural_quantum_processor", amount: 1 },
      { item: "dark_matter_residue", amount: 6 },
    ],
    inputs: [
      { item: "time_crystal", amount: 5 },
      { item: "supercomputer", amount: 1 },
      { item: "ficsite_trigon", amount: 15 },
      { item: "excited_photonic_matter", amount: 25 },
    ],
  },
  {
    id: "superposition_oscillator",
    label: "Superposition Oscillator",
    machine: "quantum_encoder",
    craft_time: 60,
    outputs: [
      { item: "superposition_oscillator", amount: 1 },
      { item: "dark_matter_residue", amount: 25 },
    ],
    inputs: [
      { item: "dark_matter_crystal", amount: 6 },
      { item: "crystal_oscillator", amount: 1 },
      { item: "alclad_aluminum_sheet", amount: 25 },
      { item: "excited_photonic_matter", amount: 75 },
    ],
  },
  {
    id: "biochemical_sculptor",
    label: "Biochemical Sculptor",
    machine: "quantum_encoder",
    craft_time: 120,
    outputs: [
      { item: "biochemical_sculptor", amount: 4 },
      { item: "dark_matter_residue", amount: 10 },
    ],
    inputs: [
      { item: "assembly_director_system", amount: 1 },
      { item: "ficsite_trigon", amount: 80 },
      { item: "water", amount: 20 },
      { item: "excited_photonic_matter", amount: 40 },
    ],
  },
  {
    id: "ballistic_warp_drive",
    label: "Ballistic Warp Drive",
    machine: "manufacturer",
    craft_time: 60,
    outputs: [{ item: "ballistic_warp_drive", amount: 1 }],
    inputs: [
      { item: "thermal_propulsion_rocket", amount: 1 },
      { item: "superposition_oscillator", amount: 5 },
      { item: "dark_matter_crystal", amount: 50 },
      { item: "sam_fluctuator", amount: 250 },  // simplified
    ],
  },
  {
    id: "ficsonium_fuel_rod",
    label: "Ficsonium Fuel Rod",
    machine: "manufacturer",
    craft_time: 24,
    outputs: [{ item: "ficsonium_fuel_rod", amount: 1 }],
    inputs: [
      { item: "ficsonium", amount: 5 },
      { item: "electromagnetic_control_rod", amount: 5 },
      { item: "ficsite_trigon", amount: 100 },
      { item: "excited_photonic_matter", amount: 50 },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────

/** Build a map from item key → recipe that produces it (first/default recipe) */
export function getRecipeForItem(itemKey: string): Recipe | undefined {
  return RECIPES.find((r) => r.outputs.some((o) => o.item === itemKey));
}

/** Get all recipes that produce a given item */
export function getRecipesForItem(itemKey: string): Recipe[] {
  return RECIPES.filter((r) => r.outputs.some((o) => o.item === itemKey));
}

/** Get all recipes that consume a given item */
export function getConsumerRecipes(itemKey: string): Recipe[] {
  return RECIPES.filter((r) => r.inputs.some((i) => i.item === itemKey));
}

/** Get all item keys sorted by tier then label */
export function getSortedItemKeys(): string[] {
  return Object.keys(ITEMS).sort((a, b) => {
    const ta = ITEMS[a].tier;
    const tb = ITEMS[b].tier;
    if (ta !== tb) return ta - tb;
    return ITEMS[a].label.localeCompare(ITEMS[b].label);
  });
}

/** Get items grouped by category */
export function getItemsByCategory(): Record<string, ItemInfo[]> {
  const groups: Record<string, ItemInfo[]> = {};
  for (const item of Object.values(ITEMS)) {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
  }
  return groups;
}