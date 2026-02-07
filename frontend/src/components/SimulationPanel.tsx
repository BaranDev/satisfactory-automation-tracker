import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  Package,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProjectStore } from "@/store/projectStore";
import { cn } from "@/lib/utils";

export default function SimulationPanel() {
  const { project, simulationResult, simulate } = useProjectStore();

  if (!project) return null;

  const hasAutomatedItems = Object.values(project.items).some(
    (i) => i.automated,
  );

  return (
    <div className="space-y-6">
      {/* Simulate Button */}
      <div className="flex items-center gap-4">
        <Button
          onClick={simulate}
          disabled={!hasAutomatedItems}
          variant="neon"
          size="lg"
          className="gap-2"
        >
          <Zap className="w-5 h-5" />
          Simulate
        </Button>

        {!hasAutomatedItems && (
          <p className="text-sm text-muted-foreground">
            Mark items as automated to simulate
          </p>
        )}
      </div>

      <AnimatePresence>
        {simulationResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Output Summary */}
            <div className="glass rounded-xl p-4">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Production Rates
              </h3>

              <div className="grid gap-2">
                {Object.entries(simulationResult.items).map(([key, result]) => (
                  <div
                    key={key}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-lg",
                      result.isBottleneck && "bg-red-500/10 bottleneck",
                      result.isSurplus && "bg-green-500/10",
                    )}
                  >
                    <span className="text-sm font-medium">
                      {project.items[key]?.label || key}
                    </span>
                    <div className="flex items-center gap-2">
                      <motion.span
                        key={result.outputPerMin}
                        initial={{ scale: 1.2, color: "#00f5ff" }}
                        animate={{ scale: 1, color: "#ffffff" }}
                        className="font-mono text-sm"
                      >
                        {result.outputPerMin.toFixed(1)}/min
                      </motion.span>
                      {result.isBottleneck && (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottlenecks */}
            {simulationResult.bottlenecks.length > 0 && (
              <div className="glass rounded-xl p-4 border border-red-500/30">
                <h3 className="font-bold mb-4 flex items-center gap-2 text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  Top Bottlenecks
                </h3>

                <div className="space-y-3">
                  {simulationResult.bottlenecks.map((bottleneck, i) => (
                    <motion.div
                      key={bottleneck.itemKey}
                      initial={{ x: -10, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium">{bottleneck.label}</p>
                        <p className="text-xs text-muted-foreground">
                          Shortfall: {bottleneck.shortfall.toFixed(1)}/min (
                          {bottleneck.shortfallPercent.toFixed(0)}%)
                        </p>
                      </div>
                      <span className="text-sm font-mono text-red-400">
                        +{bottleneck.neededMachines} machines
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {simulationResult.suggestions.length > 0 && (
              <div className="glass rounded-xl p-4 border border-primary/30">
                <h3 className="font-bold mb-4 flex items-center gap-2 text-primary">
                  <Lightbulb className="w-4 h-4" />
                  Suggestions
                </h3>

                <ScrollArea className="max-h-48">
                  <div className="space-y-2 pr-2">
                    {simulationResult.suggestions.map((suggestion, i) => (
                      <motion.div
                        key={`${suggestion.itemKey}-${i}`}
                        initial={{ x: -10, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-start gap-2 p-2 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4 text-primary mt-0.5" />
                        <p className="text-sm">{suggestion.message}</p>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Raw Materials */}
            {Object.keys(simulationResult.rawMaterials).length > 0 && (
              <div className="glass rounded-xl p-4">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <Package className="w-4 h-4 text-orange-400" />
                  Raw Material Needs
                </h3>

                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(simulationResult.rawMaterials).map(
                    ([material, amount]) => (
                      <div
                        key={material}
                        className="flex items-center justify-between p-2 rounded-lg bg-orange-500/5"
                      >
                        <span className="text-sm capitalize">
                          {material.replace(/_/g, " ")}
                        </span>
                        <span className="font-mono text-sm text-orange-400">
                          {amount.toFixed(1)}/min
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
