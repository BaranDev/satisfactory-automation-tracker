import { useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  X,
  Zap,
  Gauge,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { MACHINES } from "@/data/machines";
import { RECIPES, ITEMS } from "@/data/recipes";
import { ItemImage } from "@/components/ItemImage";
import { cn } from "@/lib/utils";
import type { MachineInstance, SimulationNode } from "@/types/factory";

interface InspectorPanelProps {
  machine: MachineInstance;
  simulation?: SimulationNode;
  onClose: () => void;
  onRecipeChange: (machineId: string, recipeId: string | null) => void;
  onOverclockChange: (machineId: string, overclock: number) => void;
  onDelete: (machineId: string) => void;
}

export default function InspectorPanel({
  machine,
  simulation,
  onClose,
  onRecipeChange,
  onOverclockChange,
  onDelete,
}: InspectorPanelProps) {
  const machineInfo = MACHINES[machine.machineType];
  const recipe = machine.recipe ? RECIPES.find(r => r.id === machine.recipe) : null;

  const compatibleRecipes = useMemo(() => {
    if (!machineInfo) return [];
    return RECIPES.filter(r => r.machine === machine.machineType);
  }, [machine.machineType, machineInfo]);

  const handleOverclockInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val)) {
      onOverclockChange(machine.id, Math.max(1, Math.min(250, val)) / 100);
    }
  }, [machine.id, onOverclockChange]);

  if (!machineInfo) return null;

  return (
    <motion.div
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 20, opacity: 0 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
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
        {/* Recipe Selector */}
        {compatibleRecipes.length > 0 && (
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

        {/* Overclock */}
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

        {/* Power consumption */}
        <div className="glass rounded-lg p-3 space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <Zap className="w-3.5 h-3.5 text-ficsit-amber" />
            <span className="text-muted-foreground">Power</span>
            <span className="ml-auto font-mono text-foreground">
              {simulation?.powerDraw.toFixed(1) ?? machineInfo.basePower.toFixed(1)} MW
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Gauge className="w-3.5 h-3.5 text-neon-cyan" />
            <span className="text-muted-foreground">Efficiency</span>
            <span className="ml-auto font-mono text-foreground">
              {simulation ? `${(simulation.inputSatisfaction * 100).toFixed(0)}%` : "--"}
            </span>
          </div>
        </div>

        {/* Input Details */}
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

        {/* Output Details */}
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

        {/* Warnings */}
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

        {/* Delete */}
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
