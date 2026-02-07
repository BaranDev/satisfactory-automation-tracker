import { memo, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AlertTriangle, Settings } from "lucide-react";
import { MACHINES } from "@/data/machines";
import { RECIPES, ITEMS } from "@/data/recipes";
import { ItemImage } from "@/components/ItemImage";
import { cn } from "@/lib/utils";
import type { MachineType } from "@/types/factory";
import type { SimulationNode } from "@/types/factory";

export interface MachineNodeData {
  machineType: MachineType;
  recipe: string | null;
  overclock: number;
  simulation?: SimulationNode;
  onSelect?: (id: string) => void;
  onRecipeChange?: (id: string, recipeId: string) => void;
  onOverclockChange?: (id: string, overclock: number) => void;
  [key: string]: unknown;
}

function MachineNodeComponent({ id, data, selected }: NodeProps & { data: MachineNodeData }) {
  const machineInfo = MACHINES[data.machineType];
  const recipe = data.recipe ? RECIPES.find(r => r.id === data.recipe) : null;
  const sim = data.simulation;

  const isStarved = sim ? sim.inputSatisfaction < 0.99 : false;
  const hasWarnings = sim ? sim.warnings.length > 0 : false;
  const hasErrors = sim ? sim.warnings.some(w => w.severity === "error") : false;

  const outputRate = sim?.actualOutput ?? 0;
  const powerDraw = sim?.powerDraw ?? 0;

  const handleClick = useCallback(() => {
    data.onSelect?.(id);
  }, [id, data]);

  if (!machineInfo) return null;

  // Determine how many input/output handles to show
  const inputCount = recipe ? recipe.inputs.length : machineInfo.inputSlots + machineInfo.fluidInputs;
  const outputCount = recipe ? recipe.outputs.length : machineInfo.outputSlots + machineInfo.fluidOutputs;

  return (
    <div
      onClick={handleClick}
      className={cn(
        "rounded-lg border bg-card/95 backdrop-blur-sm shadow-md min-w-[180px] transition-all",
        selected && "ring-2 ring-primary",
        isStarved && "border-amber-500/60",
        hasErrors && "border-red-500/60",
        !isStarved && !hasErrors && "border-border/50",
      )}
    >
      {/* Input handles */}
      {Array.from({ length: inputCount }).map((_, i) => {
        const recipeInput = recipe?.inputs[i];
        const itemLabel = recipeInput ? (ITEMS[recipeInput.item]?.label ?? recipeInput.item) : "";
        return (
          <Handle
            key={`input-${i}`}
            type="target"
            position={Position.Left}
            id={`input-${i}`}
            style={{ top: `${((i + 1) / (inputCount + 1)) * 100}%` }}
            className="!w-3 !h-3 !bg-secondary !border-2 !border-muted-foreground/50 hover:!border-primary transition-colors"
            title={itemLabel}
          />
        );
      })}

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
        <ItemImage
          icon={machineInfo.icon}
          label={machineInfo.label}
          category={machineInfo.category}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">
            {machineInfo.label}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            {recipe?.label ?? "No recipe"}
          </p>
        </div>
        {hasWarnings && (
          <AlertTriangle className={cn(
            "w-3.5 h-3.5 shrink-0",
            hasErrors ? "text-red-500" : "text-amber-500",
          )} />
        )}
      </div>

      {/* Stats */}
      <div className="px-3 py-2 space-y-1">
        {/* Output rate */}
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Output</span>
          <span className={cn(
            "font-mono font-medium",
            isStarved ? "text-amber-500" : "text-neon-green",
          )}>
            {outputRate.toFixed(1)}/min
          </span>
        </div>

        {/* Overclock */}
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Clock</span>
          <span className="font-mono text-foreground">
            {(data.overclock * 100).toFixed(0)}%
          </span>
        </div>

        {/* Power */}
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Power</span>
          <span className="font-mono text-foreground">
            {powerDraw.toFixed(1)} MW
          </span>
        </div>

        {/* Input satisfaction bar */}
        {sim && recipe && (
          <div className="pt-1">
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  sim.inputSatisfaction >= 0.99 ? "bg-neon-green" :
                  sim.inputSatisfaction >= 0.5 ? "bg-amber-500" :
                  "bg-red-500",
                )}
                style={{ width: `${sim.inputSatisfaction * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Recipe I/O summary */}
        {recipe && (
          <div className="flex items-center gap-1 pt-1 flex-wrap">
            {recipe.inputs.map(inp => (
              <span
                key={inp.item}
                className="text-[9px] px-1 py-0.5 rounded bg-secondary/50 text-muted-foreground"
                title={`${ITEMS[inp.item]?.label ?? inp.item}: ${inp.amount}/cycle`}
              >
                {ITEMS[inp.item]?.label?.slice(0, 8) ?? inp.item.slice(0, 8)}
              </span>
            ))}
            <span className="text-[9px] text-muted-foreground/40">→</span>
            {recipe.outputs.map(out => (
              <span
                key={out.item}
                className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary"
                title={`${ITEMS[out.item]?.label ?? out.item}: ${out.amount}/cycle`}
              >
                {ITEMS[out.item]?.label?.slice(0, 8) ?? out.item.slice(0, 8)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Output handles */}
      {Array.from({ length: outputCount }).map((_, i) => {
        const recipeOutput = recipe?.outputs[i];
        const itemLabel = recipeOutput ? (ITEMS[recipeOutput.item]?.label ?? recipeOutput.item) : "";
        return (
          <Handle
            key={`output-${i}`}
            type="source"
            position={Position.Right}
            id={`output-${i}`}
            style={{ top: `${((i + 1) / (outputCount + 1)) * 100}%` }}
            className="!w-3 !h-3 !bg-primary !border-2 !border-primary/50 hover:!border-primary transition-colors"
            title={itemLabel}
          />
        );
      })}
    </div>
  );
}

export const MachineNode = memo(MachineNodeComponent);
