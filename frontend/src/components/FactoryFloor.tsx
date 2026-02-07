import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  Package,
  ChevronRight,
  Gauge,
  Factory,
  Minus,
  Plus,
  X,
  GripVertical,
} from "lucide-react";
import { ITEMS, getRecipeForItem } from "@/data/recipes";
import { useProjectStore } from "@/store/projectStore";
import { ItemImage } from "@/components/ItemImage";
import { cn } from "@/lib/utils";

export default function FactoryFloor() {
  const {
    project,
    simulationResult,
    simulate,
    toggleAutomated,
    setMachines,
    setOverclock,
  } = useProjectStore();

  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Auto-simulate when items change
  const automatedItems = project
    ? Object.entries(project.items).filter(([, i]) => i.automated)
    : [];

  useEffect(() => {
    if (automatedItems.length > 0) {
      simulate();
    }
  }, [
    automatedItems.length,
    // Re-simulate when any automated item's config changes
    ...automatedItems.map(([, i]) => `${i.machines}-${i.overclock}`),
  ]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const itemKey = e.dataTransfer.getData("text/plain");
      if (itemKey && project?.items[itemKey] && !project.items[itemKey].automated) {
        toggleAutomated(itemKey);
      }
    },
    [project, toggleAutomated],
  );

  if (!project) return null;

  const hasAutomatedItems = automatedItems.length > 0;

  // Build stats
  const totalOutput = simulationResult
    ? Object.values(simulationResult.items).reduce(
        (sum, r) => sum + r.outputPerMin,
        0,
      )
    : 0;
  const bottleneckCount = simulationResult?.bottlenecks.length ?? 0;
  const totalMachines = automatedItems.reduce(
    (sum, [, i]) => sum + i.machines,
    0,
  );

  return (
    <div className="flex flex-col h-full">
      {/* Production Stats Bar */}
      {hasAutomatedItems && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 px-4 py-3 border-b border-border/50 glass-strong"
        >
          <StatCard
            icon={<Factory className="w-4 h-4" />}
            label="Automated"
            value={`${automatedItems.length}`}
            color="text-primary"
          />
          <div className="w-px h-8 bg-border/50" />
          <StatCard
            icon={<Gauge className="w-4 h-4" />}
            label="Machines"
            value={`${totalMachines}`}
            color="text-neon-cyan"
          />
          <div className="w-px h-8 bg-border/50" />
          <StatCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="Total Output"
            value={`${totalOutput.toFixed(0)}/min`}
            color="text-neon-green"
          />
          <div className="w-px h-8 bg-border/50" />
          <StatCard
            icon={<AlertTriangle className="w-4 h-4" />}
            label="Bottlenecks"
            value={`${bottleneckCount}`}
            color={bottleneckCount > 0 ? "text-neon-red" : "text-muted-foreground"}
          />
        </motion.div>
      )}

      {/* Main Factory Canvas */}
      <div
        className={cn(
          "flex-1 overflow-y-auto p-6 hex-grid-bg transition-all duration-300",
          isDragOver && "drop-zone-active",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {!hasAutomatedItems ? (
          <EmptyState isDragOver={isDragOver} />
        ) : (
          <div className="space-y-6">
            {/* Production Nodes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {automatedItems.map(([key, item]) => {
                  const info = ITEMS[key];
                  const recipe = getRecipeForItem(key);
                  const simResult = simulationResult?.items[key];
                  const isBottleneck = simResult?.isBottleneck ?? false;
                  const isSurplus = simResult?.isSurplus ?? false;

                  return (
                    <motion.div
                      key={key}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className={cn(
                        "glass rounded-lg overflow-hidden transition-all duration-200",
                        isBottleneck && "bottleneck",
                        isSurplus && "healthy",
                        selectedNode === key && "ring-1 ring-primary/50",
                      )}
                      onClick={() =>
                        setSelectedNode(selectedNode === key ? null : key)
                      }
                    >
                      {/* Node Header */}
                      <div className="flex items-center gap-3 p-3 border-b border-border/30">
                        <GripVertical className="w-4 h-4 text-muted-foreground/30" />
                        <ItemImage
                          icon={info?.icon ?? ""}
                          label={info?.label ?? key}
                          category={info?.category}
                          size="md"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {info?.label ?? key}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {recipe
                              ? recipe.machine.replace(/_/g, " ")
                              : info?.category === "resource"
                                ? "Miner"
                                : "Manual"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-mono font-bold text-primary">
                            {simResult
                              ? `${simResult.outputPerMin.toFixed(1)}/min`
                              : "--"}
                          </p>
                          {isBottleneck && (
                            <p className="text-[10px] text-neon-red font-medium">
                              BOTTLENECK
                            </p>
                          )}
                          {isSurplus && (
                            <p className="text-[10px] text-neon-green font-medium">
                              SURPLUS
                            </p>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAutomated(key);
                          }}
                          className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                          title="Remove from production"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Node Controls */}
                      <div className="p-3 space-y-3">
                        {/* Machines */}
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                            Machines
                          </label>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMachines(key, item.machines - 1);
                              }}
                              className="w-6 h-6 rounded bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center justify-center transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min={0}
                              value={item.machines}
                              onChange={(e) =>
                                setMachines(key, parseInt(e.target.value) || 0)
                              }
                              onClick={(e) => e.stopPropagation()}
                              className="w-12 rounded bg-background/80 border border-border/50 text-center text-sm text-foreground py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMachines(key, item.machines + 1);
                              }}
                              className="w-6 h-6 rounded bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center justify-center transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Overclock */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                              Overclock
                            </label>
                            <span className="text-xs font-mono text-foreground font-medium">
                              {Math.round(item.overclock * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={1}
                            max={250}
                            value={Math.round(item.overclock * 100)}
                            onChange={(e) =>
                              setOverclock(key, parseInt(e.target.value) / 100)
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="w-full h-1.5 rounded-full appearance-none bg-secondary cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-0"
                          />
                          <div className="flex justify-between text-[10px] text-muted-foreground/60">
                            <span>1%</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOverclock(key, 1.0);
                              }}
                              className="hover:text-primary transition-colors"
                            >
                              100%
                            </button>
                            <span>250%</span>
                          </div>
                        </div>

                        {/* Recipe Info */}
                        {recipe && (
                          <div className="pt-2 border-t border-border/20">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {recipe.inputs.map((input) => (
                                <span
                                  key={input.item}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary/40 text-[10px] text-muted-foreground"
                                >
                                  {ITEMS[input.item]?.label ?? input.item}
                                  <span className="text-primary font-mono">
                                    x{input.amount}
                                  </span>
                                </span>
                              ))}
                              <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
                              {recipe.outputs.map((output) => (
                                <span
                                  key={output.item}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-[10px] text-primary"
                                >
                                  {ITEMS[output.item]?.label ?? output.item}
                                  <span className="font-mono">x{output.amount}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Simulation Results */}
            {simulationResult && (
              <div className="space-y-4">
                {/* Bottlenecks */}
                {simulationResult.bottlenecks.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass rounded-lg p-4 border border-neon-red/20"
                  >
                    <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-neon-red">
                      <AlertTriangle className="w-4 h-4" />
                      BOTTLENECKS DETECTED
                    </h3>
                    <div className="space-y-2">
                      {simulationResult.bottlenecks.map((b) => (
                        <div
                          key={b.itemKey}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-foreground">{b.label}</span>
                          <span className="font-mono text-neon-red text-xs">
                            -{b.shortfall.toFixed(1)}/min ({b.shortfallPercent.toFixed(0)}
                            %)
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Suggestions */}
                {simulationResult.suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass rounded-lg p-4 border border-primary/20"
                  >
                    <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-primary">
                      <Lightbulb className="w-4 h-4" />
                      OPTIMIZATION SUGGESTIONS
                    </h3>
                    <div className="space-y-2">
                      {simulationResult.suggestions.slice(0, 5).map((s, i) => (
                        <div
                          key={`${s.itemKey}-${i}`}
                          className="flex items-start gap-2 text-sm"
                        >
                          <ChevronRight className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                          <span className="text-muted-foreground">{s.message}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Raw Materials */}
                {Object.keys(simulationResult.rawMaterials).length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass rounded-lg p-4"
                  >
                    <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                      <Package className="w-4 h-4 text-ficsit-amber" />
                      RAW MATERIAL REQUIREMENTS
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(simulationResult.rawMaterials).map(
                        ([material, amount]) => (
                          <div
                            key={material}
                            className="flex items-center justify-between p-2 rounded bg-secondary/30"
                          >
                            <span className="text-xs capitalize text-muted-foreground">
                              {material.replace(/_/g, " ")}
                            </span>
                            <span className="font-mono text-xs text-ficsit-amber">
                              {amount.toFixed(1)}/min
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────

function EmptyState({ isDragOver }: { isDragOver: boolean }) {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-md"
      >
        <div
          className={cn(
            "w-20 h-20 rounded-xl mx-auto mb-6 flex items-center justify-center transition-all duration-300",
            isDragOver
              ? "bg-primary/20 glow-orange"
              : "bg-secondary/50",
          )}
        >
          <Factory
            className={cn(
              "w-10 h-10 transition-colors",
              isDragOver ? "text-primary" : "text-muted-foreground/50",
            )}
          />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {isDragOver ? "Drop to automate" : "Your Factory Floor"}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {isDragOver
            ? "Release to add this item to your production line"
            : "Drag items from the catalog on the left to start building your production line. Each item becomes a production node you can configure with machine count and overclock settings."}
        </p>
        {!isDragOver && (
          <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground/60">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary/50" />
              Drag to add
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-neon-green/50" />
              Auto-simulate
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-neon-red/50" />
              Find bottlenecks
            </span>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={color}>{icon}</span>
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <p className={cn("text-sm font-mono font-bold", color)}>{value}</p>
      </div>
    </div>
  );
}
