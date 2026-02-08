// Comprehensive Satisfactory game knowledge for the AI system prompt.
// Provides machine specs, logistics limits, power formulas, and optimization tips.

export const SATISFACTORY_KNOWLEDGE = {
  machines: {
    miner_mk1: { power: 5, outputRate: 60, description: 'Basic miner. 60 items/min on normal node at 100%.' },
    miner_mk2: { power: 12, outputRate: 120, description: 'Intermediate miner. 120 items/min on normal node at 100%.' },
    miner_mk3: { power: 30, outputRate: 240, description: 'Advanced miner. 240 items/min on normal node at 100%.' },
    smelter: { power: 4, craftSpeed: 1.0, inputs: 1, outputs: 1, description: 'Smelts ores into ingots. 4 MW.' },
    foundry: { power: 16, craftSpeed: 1.0, inputs: 2, outputs: 1, description: 'Combines two ingredients for alloys. 16 MW.' },
    constructor: { power: 4, craftSpeed: 1.0, inputs: 1, outputs: 1, description: 'Single-input production. 4 MW.' },
    assembler: { power: 15, craftSpeed: 1.0, inputs: 2, outputs: 1, description: 'Two-input production. 15 MW.' },
    manufacturer: { power: 55, craftSpeed: 1.0, inputs: 4, outputs: 1, description: 'Up to 4 inputs for complex parts. 55 MW.' },
    refinery: { power: 30, craftSpeed: 1.0, handlesLiquids: true, description: 'Processes oil and other fluids. 30 MW.' },
    blender: { power: 75, craftSpeed: 1.0, inputs: 4, outputs: 2, handlesLiquids: true, description: 'Advanced fluid/solid mixing. 75 MW.' },
    packager: { power: 10, description: 'Packages/unpackages fluids. 10 MW.' },
    particle_accelerator: { power: [250, 1500], description: 'Variable power consumption per recipe. Nuclear Pasta, Plutonium Pellets.' },
    converter: { power: 400, description: 'Converts SAM into advanced materials. 400 MW.' },
    quantum_encoder: { power: [0, 2000], description: 'Variable power. Produces end-game components. 0–2000 MW.' },
  },

  logistics: {
    belt_mk1: 60,
    belt_mk2: 120,
    belt_mk3: 270,
    belt_mk4: 480,
    belt_mk5: 780,
    belt_mk6: 1200,
    pipe_mk1: 300,
    pipe_mk2: 600,
  },

  nodePurity: { impure: 0.5, normal: 1.0, pure: 2.0 },

  powerFormula: 'Power = BasePower * (Overclock)^1.321928. At 250% overclock, a machine uses ~3.59x its base power.',

  tips: [
    'Steel production: 3 Iron Ore + 3 Coal per cycle in Foundry → 3 Steel Ingot. At 100% clock = 45/min each input for 45/min Steel Ingot output.',
    'Plastic from oil: 1 Refinery with 30 Crude Oil/min → 20 Plastic/min + 10 Heavy Oil Residue/min.',
    'Rubber from oil: 1 Refinery with 30 Crude Oil/min → 20 Rubber/min + 20 Heavy Oil Residue/min.',
    'Iron Rod → Screw chain: 1 Constructor for Iron Rod (15/min) feeds 1 Constructor for Screw (40/min). Common bottleneck in early game.',
    'Reinforced Iron Plate: 1 Assembler needs 30 Iron Plate/min + 60 Screw/min. That is 5 Constructors for Plates, 2 for Screws.',
    'Motor production: 2 Rotors + 2 Stators per cycle. Stators need Steel Pipe + Wire. Rotors need Iron Rod + Screw.',
    'Computer: Most complex Manufacturer recipe. Needs Circuit Board, Cable, Plastic, and Screw. Plan backward from outputs.',
    'Heavy Modular Frame: 5 Modular Frame + 15 Steel Pipe + 5 Encased Industrial Beam + 100 Screw. Very screw-hungry.',
    'Aluminum production chain: Bauxite → Alumina Solution (Refinery) → Aluminum Scrap (Refinery with Coal) → Aluminum Ingot (Foundry with Silica).',
    'Nuclear power: Each Nuclear Power Plant needs 1 Uranium Fuel Rod/300s and Water. Produces 2500 MW but also Uranium Waste.',
    'Overclock efficiency: 250% clock uses ~3.59x power for 2.5x output. Two machines at 100% is more power efficient than one at 200%.',
    'Belt saturation check: If a belt carries 780 items/min (Mk.5 max), adding more machines downstream won\'t help until you upgrade to Mk.6 or split the line.',
    'Manifold vs load balancing: Manifold (series splitting) is simpler to build. Load balancing is more responsive but complex. Both work for steady-state.',
    'Power Shards: Each slot adds 50% overclock capacity (up to 250% with 3 shards). Only use on machines where throughput is the bottleneck.',
    'Space Elevator phases: Phase 1 (Smart Plating), Phase 2 (Versatile Framework + Automated Wiring), Phase 3 (multiple), Phase 4 (end-game). Plan production lines per phase.',
    'Alternate recipes can dramatically change ratios. Steel Screw alternate makes Screws from Steel Beam, bypassing Iron Rod entirely.',
    'Fuel generators: 250 MW each. Fuel (liquid) at 12 m³/min. Turbofuel at 4.5 m³/min for same power. Turbofuel is 2.67x more efficient per oil.',
    'Pipe throughput: Mk.1 pipes carry 300 m³/min, Mk.2 carry 600 m³/min. Plan fluid production around these limits.',
  ],

  productionChainDepths: {
    'Tier 1 (basic)': 'Iron Ore → Iron Ingot → Iron Plate / Iron Rod → Screw',
    'Tier 2 (early)': 'Copper Ore → Copper Ingot → Wire → Cable; also Reinforced Iron Plate, Rotor',
    'Tier 3 (steel)': 'Iron Ore + Coal → Steel Ingot → Steel Beam / Steel Pipe; Stator, Encased Industrial Beam',
    'Tier 4 (motors)': 'Motor = Rotor + Stator; Modular Frame; Heavy Modular Frame',
    'Tier 5 (oil)': 'Crude Oil → Plastic / Rubber / Fuel; Circuit Board, Computer',
    'Tier 7 (aluminum)': 'Bauxite → Alumina Solution → Aluminum Scrap → Aluminum Ingot; Battery, Supercomputer',
    'Tier 8 (nuclear)': 'Uranium → Uranium Cell → Fuel Rod; Cooling System, Turbo Motor, Nuclear Pasta',
    'Tier 9 (alien)': 'SAM → Reanimated SAM → Ficsite Ingot; Quantum Encoder products; end-game Space Elevator',
  },
} as const;

/** Build the full AI system prompt incorporating game knowledge */
export function buildGameKnowledgePrompt(): string {
  const machineList = Object.entries(SATISFACTORY_KNOWLEDGE.machines)
    .map(([key, m]) => {
      const power = Array.isArray(m.power) ? `${m.power[0]}–${m.power[1]} MW` : `${m.power} MW`;
      return `  - ${key}: ${power}. ${m.description}`;
    })
    .join('\n');

  const beltList = Object.entries(SATISFACTORY_KNOWLEDGE.logistics)
    .map(([k, v]) => `  - ${k.replace(/_/g, ' ')}: ${v}/min`)
    .join('\n');

  const tipList = SATISFACTORY_KNOWLEDGE.tips
    .map((t, i) => `  ${i + 1}. ${t}`)
    .join('\n');

  const chainList = Object.entries(SATISFACTORY_KNOWLEDGE.productionChainDepths)
    .map(([tier, chain]) => `  ${tier}: ${chain}`)
    .join('\n');

  return `## Satisfactory Game Knowledge

### Machines & Power
${machineList}

### Logistics Throughput
${beltList}

### Resource Node Purity
  Impure = 0.5x base rate, Normal = 1.0x, Pure = 2.0x

### Overclock Power Formula
  ${SATISFACTORY_KNOWLEDGE.powerFormula}

### Production Chain Overview
${chainList}

### Optimization Tips
${tipList}`;
}
