import { useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  X,
  Zap,
  Gauge,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Mountain,
  Sparkles,
} from "lucide-react";
import {
  MACHINES,
  EXTRACTABLE_RESOURCES,
  DEFAULT_EXTRACTION_ITEM,
  NODE_PURITY,
  MINER_BASE_RATES,
  somersloopOutputMultiplier,
  calcPowerAtOverclock,
} from "@/data/machines";
import { RECIPES, ITEMS } from "@/data/recipes";
import { ItemImage } from "@/components/ItemImage";
import { cn } from "@/lib/utils";
import type { MachineInstance, NodePurity, SimulationNode } from "@/types/factory";

interface InspectorPanelProps {
  machine: MachineInstance;
  simulation?: SimulationNode;
  onClose: () => void;
  onRecipeChange: (machineId: string, recipeId: string | null) => void;
  onOverclockChange: (machineId: string, overclock: number) => void;
  onExtractionItemChange: (machineId: string, item: string | null) => void;
  onNodePurityChange: (machineId: string, purity: NodePurity) => void;
  onSomersloopsChange: (machineId: string, count: number) => void;
  onDelete: (machineId: string) => void;
}

const PURITY_LABELS: Record<NodePurity, string> = {
  impure: "Impure",
  normal: "Normal",
  pure: "Pure",
};

export default function InspectorPanel({
  machine,
  simulation,
  onClose,
  onRecipeChange,
  onOverclockChange,
  onExtractionItemChange,
  onNodePurityChange,
  onSomersloopsChange,
  onDelete,
}: InspectorPanelProps) {
  const machineInfo = MACHINES[machine.machineType];
  const isExtractor = machineInfo?.category === "extraction";
  const isPowerGen = machineInfo?.category === "power";

  const compatibleRecipes = useMemo(() => {
    if (!machineInfo) return [];
    return RECIPES.filter(r => r.machine === machine.machineType);
  }, [machine.machineType, machineInfo]);

  const resourceOptions = useMemo(() => {
    if (!isExtractor) return [];
    return EXTRACTABLE_RESOURCES[machine.machineType] ?? [];
  }, [isExtractor, machine.machineType]);

  const resourceLocked = useMemo(() => {
    if (!isExtractor) return false;
    const def = DEFAULT_EXTRACTION_ITEM[machine.machineType];
    return def !== null && def !== undefined;
  }, [isExtractor, machine.machineType]);

  const purity: NodePurity = machine.nodePurity ?? "normal";
  const somersloops = machine.somersloops ?? 0;

  const handleOverclockInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val)) {
      onOverclockChange(machine.id, Math.max(1, Math.min(250, val)) / 100);
    }
  }, [machine.id, onOverclockChange]);

  const extractorRate = useMemo(() => {
    if (!isExtractor) return null;
    const base = MINER_BASE_RATES[machine.machineType];
    if (typeof base === "number") {
      return base * NODE_PURITY[purity] * machine.overclock;
    }
    if (machine.machineType === "water_extractor") return 120 * machine.overclock;
    if (machine.machineType === "oil_extractor") return 120 * NODE_PURITY[purity] * machine.overclock;
    return null;
  }, [isExtractor, machine.machineType, machine.overclock, purity]);

  if (!machineInfo) return null;

  const displayPower =
    simulation?.powerDraw ??
    calcPowerAtOverclock(
      machineInfo.basePower,
      machineInfo.powerExponent,
      machine.overclock,
      somersloops,
      machineInfo.somersloopSlots,
    );

  return (
    <motion.div
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 20, opacity: 0 }}
      className="flex flex-col h-full"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <ItemImage
          icon={machineInfo.icon}
          label={machineInfo.label}
          category={machineInfo.category}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground truncate">{machineInfo.label}</h3>
          <p className="text-[10px] text-muted-foreground">ID: {machine.id.slice(0, 8)}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-secondary transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isExtractor && (
          <div className="space-y-3">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Mountain className="w-3 h-3" /> Resource Node
            </label>

            <select
              value={machine.extractionItem ?? ""}
              disabled={resourceLocked && resourceOptions.length === 1}
              onChange={e => onExtractionItemChange(machine.id, e.target.value || null)}
              className="w-full text-xs px-3 py-2 rounded bg-background/80 border border-border/50 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-60"
            >
              <option value="">Select resource…</option>
              {resourceOptions.map(itemKey => (
                <option key={itemKey} value={itemKey}>
                  {ITEMS[itemKey]?.label ?? itemKey}
                </option>
              ))}
            </select>

            {machine.machineType !== "water_extractor" && (
              <div className="grid grid-cols-3 gap-1">
                {(Object.keys(NODE_PURITY) as NodePurity[]).map(p => (
                  <button
                    key={p}
                    onClick={() => onNodePurityChange(machine.id, p)}
                    className={cn(
                      "py-1.5 rounded text-[11px] font-medium transition-colors border",
                      purity === p
                        ? "bg-primary/20 text-primary border-primary/40"
                        : "bg-secondary/30 text-muted-foreground border-transparent hover:bg-secondary/50",
                    )}
                  >
                    {PURITY_LABELS[p]} ({NODE_PURITY[p]}×)
                  </button>
                ))}
              </div>
            )}

            {extractorRate !== null && machine.extractionItem && (
              <div className="text-[11px] text-muted-foreground flex justify-between glass rounded p-2">
                <span>Output rate</span>
                <span className="font-mono text-neon-green">
                  {extractorRate.toFixed(1)} / min
                </span>
              </div>
            )}

            {!machine.extractionItem && !resourceLocked && (
              <p className="text-[10px] text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Pick a resource to start extracting.
              </p>
            )}
          </div>
        )}

        {!isExtractor && !isPowerGen && compatibleRecipes.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Recipe
            </label>
            <select
              value={machine.recipe ?? ""}
              onChange={e => onRecipeChange(machine.id, e.target.value || null)}
              className="w-full text-xs px-3 py-2 rounded bg-background/80 border border-border/50 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              <option value="">Select recipe...</option>
              {compatibleRecipes.map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>
        )}

        {isPowerGen && compatibleRecipes.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Zap className="w-3 h-3" /> Fuel
            </label>
            <select
              value={machine.recipe ?? ""}
              onChange={e => onRecipeChange(machine.id, e.target.value || null)}
              className="w-full text-xs px-3 py-2 rounded bg-background/80 border border-border/50 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              <option value="">Select fuel...</option>
              {compatibleRecipes.map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Overclock
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={250}
                value={Math.round(machine.overclock * 100)}
                onChange={handleOverclockInput}
                className="w-14 rounded bg-background/80 border border-border/50 text-center text-xs text-foreground py-1 focus:outline-none focus:ring-1 focus:ring-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>
          <input
            type="range"
            min={1}
            max={250}
            value={Math.round(machine.overclock * 100)}
            onChange={e => onOverclockChange(machine.id, parseInt(e.target.value) / 100)}
            className="w-full h-1.5 rounded-full appearance-none bg-secondary cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground/60">
            <span>1%</span>
            <button
              onClick={() => onOverclockChange(machine.id, 1.0)}
              className="hover:text-primary transition-colors"
            >
              100%
            </button>
            <span>250%</span>
          </div>
        </div>

        {machineInfo.somersloopSlots > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-primary" /> Somersloop
              </label>
              <span className="text-[10px] text-muted-foreground font-mono">
                {somersloops} / {machineInfo.somersloopSlots}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={machineInfo.somersloopSlots}
              step={1}
              value={somersloops}
              onChange={e => onSomersloopsChange(machine.id, parseInt(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none bg-secondary cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
            />
            <p className="text-[10px] text-muted-foreground/60">
              Output ×{somersloopOutputMultiplier(somersloops, machineInfo.somersloopSlots).toFixed(2)}
              {" · "}Power ×{Math.pow(1 + somersloops / machineInfo.somersloopSlots, 2).toFixed(2)}
            </p>
          </div>
        )}

        <div className="glass rounded-lg p-3 space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <Zap className="w-3.5 h-3.5 text-ficsit-amber" />
            <span className="text-muted-foreground">{displayPower < 0 ? "Generates" : "Power"}</span>
            <span className="ml-auto font-mono text-foreground">
              {Math.abs(displayPower).toFixed(1)} MW
            </span>
          </div>
          {!isExtractor && !isPowerGen && (
            <div className="flex items-center gap-2 text-xs">
              <Gauge className="w-3.5 h-3.5 text-neon-cyan" />
              <span className="text-muted-foreground">Efficiency</span>
              <span className="ml-auto font-mono text-foreground">
                {simulation ? `${(simulation.inputSatisfaction * 100).toFixed(0)}%` : "--"}
              </span>
            </div>
          )}
        </div>

        {simulation && simulation.inputSlots.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Inputs
            </h4>
            {simulation.inputSlots.map((slot, i) => {
              const itemInfo = ITEMS[slot.item];
              const pct = slot.needed > 0 ? (slot.available / slot.needed) * 100 : 0;
              return (
                <div key={i} className="glass rounded p-2 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{itemInfo?.label ?? slot.item}</span>
                    <span className={cn(
                      "font-mono",
                      pct >= 99 ? "text-neon-green" : pct >= 50 ? "text-amber-500" : "text-red-500",
                    )}>
                      {slot.available.toFixed(1)} / {slot.needed.toFixed(1)}/min
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        pct >= 99 ? "bg-neon-green" : pct >= 50 ? "bg-amber-500" : "bg-red-500",
                      )}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Source: {slot.source === "external" ? "External" : `Machine #${slot.source.slice(0, 6)}`}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {simulation && simulation.outputSlots.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <ArrowRight className="w-3 h-3" /> Outputs
            </h4>
            {simulation.outputSlots.map((slot, i) => {
              const itemInfo = ITEMS[slot.item];
              return (
                <div key={i} className="glass rounded p-2 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{itemInfo?.label ?? slot.item}</span>
                    <span className="font-mono text-neon-green">{slot.produced.toFixed(1)}/min</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Consumed: {slot.consumed.toFixed(1)}/min</span>
                    <span className={slot.surplus > 0 ? "text-neon-green" : "text-muted-foreground"}>
                      Surplus: {slot.surplus.toFixed(1)}/min
                    </span>
                  </div>
                  {slot.destinations.length > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      Feeds: {slot.destinations.length} machine(s)
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {simulation && simulation.warnings.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Issues
            </h4>
            {simulation.warnings.map((w, i) => (
              <div
                key={i}
                className={cn(
                  "text-xs p-2 rounded",
                  w.severity === "error" ? "bg-red-500/10 text-red-400" :
                  w.severity === "warning" ? "bg-amber-500/10 text-amber-400" :
                  "bg-blue-500/10 text-blue-400",
                )}
              >
                {w.message}
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => onDelete(machine.id)}
          className="w-full py-2 rounded text-xs font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors"
        >
          Remove Machine
        </button>
      </div>
    </motion.div>
  );
}
