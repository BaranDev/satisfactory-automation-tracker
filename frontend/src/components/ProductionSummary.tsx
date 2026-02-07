import { motion } from "framer-motion";
import {
  Zap,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Package,
  Lightbulb,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { ITEMS } from "@/data/recipes";
import { cn } from "@/lib/utils";
import type { FactorySimulationResult } from "@/types/factory";

interface ProductionSummaryProps {
  simulation: FactorySimulationResult;
  machineCount: number;
}

export default function ProductionSummary({ simulation, machineCount }: ProductionSummaryProps) {
  const [expanded, setExpanded] = useState(false);

  const criticalCount = simulation.criticalIssues.length;
  const warningCount = simulation.warnings.length;
  const outputCount = simulation.finalOutputs.length;
  const inputCount = simulation.externalInputs.length;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="border-t border-border/50 glass-strong"
    >
      {/* Summary bar (always visible) */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 px-4 py-2.5 hover:bg-secondary/20 transition-colors"
      >
        {/* Power */}
        <div className="flex items-center gap-1.5 text-xs">
          <Zap className="w-3.5 h-3.5 text-ficsit-amber" />
          <span className="text-muted-foreground">Power:</span>
          <span className="font-mono font-medium text-foreground">
            {simulation.totalPower.toFixed(1)} MW
          </span>
        </div>

        <div className="w-px h-4 bg-border/50" />

        {/* Machines */}
        <div className="flex items-center gap-1.5 text-xs">
          <Package className="w-3.5 h-3.5 text-neon-cyan" />
          <span className="font-mono font-medium text-foreground">{machineCount}</span>
          <span className="text-muted-foreground">machines</span>
        </div>

        <div className="w-px h-4 bg-border/50" />

        {/* Outputs */}
        <div className="flex items-center gap-1.5 text-xs">
          <TrendingUp className="w-3.5 h-3.5 text-neon-green" />
          <span className="font-mono font-medium text-foreground">{outputCount}</span>
          <span className="text-muted-foreground">outputs</span>
        </div>

        <div className="w-px h-4 bg-border/50" />

        {/* Issues */}
        {(criticalCount + warningCount) > 0 && (
          <>
            <div className="flex items-center gap-1.5 text-xs">
              <AlertTriangle className={cn(
                "w-3.5 h-3.5",
                criticalCount > 0 ? "text-red-500" : "text-amber-500",
              )} />
              <span className={cn(
                "font-mono font-medium",
                criticalCount > 0 ? "text-red-500" : "text-amber-500",
              )}>
                {criticalCount + warningCount}
              </span>
              <span className="text-muted-foreground">issues</span>
            </div>
            <div className="w-px h-4 bg-border/50" />
          </>
        )}

        <div className="flex-1" />

        {expanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="border-t border-border/30 px-4 py-3 max-h-64 overflow-y-auto"
        >
          <div className="grid grid-cols-3 gap-4">
            {/* Final outputs */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-neon-green flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Final Outputs
              </h4>
              {simulation.finalOutputs.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">No outputs yet</p>
              ) : (
                simulation.finalOutputs.map(o => (
                  <div key={o.item} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate">
                      {ITEMS[o.item]?.label ?? o.item.replace(/_/g, " ")}
                    </span>
                    <span className="font-mono text-neon-green">{o.rate.toFixed(1)}/min</span>
                  </div>
                ))
              )}
            </div>

            {/* External inputs */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-ficsit-amber flex items-center gap-1">
                <TrendingDown className="w-3 h-3" /> Required Inputs
              </h4>
              {simulation.externalInputs.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">Self-sufficient</p>
              ) : (
                simulation.externalInputs.map(i => (
                  <div key={i.item} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate">
                      {ITEMS[i.item]?.label ?? i.item.replace(/_/g, " ")}
                    </span>
                    <span className="font-mono text-ficsit-amber">{i.rate.toFixed(1)}/min</span>
                  </div>
                ))
              )}
            </div>

            {/* Issues & suggestions */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-primary flex items-center gap-1">
                <Lightbulb className="w-3 h-3" /> Issues & Suggestions
              </h4>
              {simulation.criticalIssues.map((w, i) => (
                <p key={`c-${i}`} className="text-[10px] text-red-400">{w.message}</p>
              ))}
              {simulation.warnings.slice(0, 3).map((w, i) => (
                <p key={`w-${i}`} className="text-[10px] text-amber-400">{w.message}</p>
              ))}
              {simulation.suggestions.slice(0, 3).map((s, i) => (
                <p key={`s-${i}`} className="text-[10px] text-muted-foreground">{s.message}</p>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
