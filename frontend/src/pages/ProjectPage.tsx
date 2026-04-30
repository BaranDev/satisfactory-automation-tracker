import { useEffect, useState, useCallback, Suspense, lazy } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Layers,
  Package,
  Cpu,
} from "lucide-react";
import { useProjectStore } from "@/store/projectStore";
import Header from "@/components/Header";
import ItemGrid from "@/components/ItemGrid";
import FactoryFloor from "@/components/FactoryFloor";
import MachinePalette from "@/components/MachinePalette";
import AiChat from "@/components/AiChat";
import InspectorPanel from "@/components/InspectorPanel";
import ProductionSummary from "@/components/ProductionSummary";
import BottomBar from "@/components/BottomBar";
import { cn } from "@/lib/utils";
import type { MachineType } from "@/types/factory";

// Lazy load the ReactFlow canvas for better initial load
const FactoryCanvas = lazy(() => import("@/components/FactoryCanvas"));

type ViewMode = "legacy" | "canvas";
type LeftTab = "machines" | "items" | "modules";

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const {
    project,
    isLoading,
    error,
    loadProject,
    factoryMachines,
    factorySimulation,
    selectedMachineId,
    selectMachine,
    addMachine,
    removeMachine,
    updateMachineRecipe,
    updateMachineOverclock,
    updateMachineExtractionItem,
    updateMachineNodePurity,
    updateMachineSomersloops,
    updateMachineSourceItem,
    updateMachineSourceRate,
    setFactoryMachines,
    setFactorySimulation,
  } = useProjectStore();

  const [initialized, setInitialized] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("canvas");
  const [leftTab, setLeftTab] = useState<LeftTab>("machines");

  useEffect(() => {
    if (projectId && !initialized) {
      loadProject(projectId).then(() => {
        setInitialized(true);
      });
    }
  }, [projectId, initialized, loadProject]);

  const handleAddMachine = useCallback(
    (machineType: MachineType) => {
      addMachine(machineType);
    },
    [addMachine],
  );

  const selectedMachine = selectedMachineId
    ? factoryMachines.find((m) => m.id === selectedMachineId)
    : null;

  if (isLoading && !project) {
    return (
      <div className="min-h-screen flex items-center justify-center hex-grid-bg">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading factory...</p>
        </motion.div>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="min-h-screen flex items-center justify-center hex-grid-bg">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center glass rounded-lg p-8 max-w-md"
        >
          <h1 className="text-xl font-bold text-destructive mb-2">
            Factory Not Found
          </h1>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="text-sm text-primary hover:underline"
          >
            Return to home
          </button>
        </motion.div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col">
      <Header />

      {/* View mode toggle */}
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border/30 bg-card/30">
        <button
          onClick={() => setViewMode("canvas")}
          className={cn(
            "text-[11px] px-3 py-1 rounded-full flex items-center gap-1.5 transition-colors",
            viewMode === "canvas"
              ? "bg-primary/15 text-primary font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/30",
          )}
        >
          <Layers className="w-3 h-3" />
          Factory Canvas
        </button>
        <button
          onClick={() => setViewMode("legacy")}
          className={cn(
            "text-[11px] px-3 py-1 rounded-full flex items-center gap-1.5 transition-colors",
            viewMode === "legacy"
              ? "bg-primary/15 text-primary font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/30",
          )}
        >
          <Package className="w-3 h-3" />
          Item Tracker
        </button>
      </div>

      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <motion.aside
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className={cn(
            "border-r border-border/40 glass-strong overflow-hidden transition-all duration-300 shrink-0 flex flex-col",
            leftCollapsed ? "w-0 p-0" : "w-80",
          )}
        >
          {!leftCollapsed && (
            <>
              {viewMode === "canvas" ? (
                <>
                  {/* Tabs for canvas mode */}
                  <div className="flex border-b border-border/30">
                    <button
                      onClick={() => setLeftTab("machines")}
                      className={cn(
                        "flex-1 text-[11px] py-2.5 font-medium transition-colors flex items-center justify-center gap-1.5",
                        leftTab === "machines"
                          ? "text-primary border-b-2 border-primary"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Cpu className="w-3 h-3" />
                      Machines
                    </button>
                    <button
                      onClick={() => setLeftTab("items")}
                      className={cn(
                        "flex-1 text-[11px] py-2.5 font-medium transition-colors flex items-center justify-center gap-1.5",
                        leftTab === "items"
                          ? "text-primary border-b-2 border-primary"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Package className="w-3 h-3" />
                      Items
                    </button>
                    <button
                      onClick={() => setLeftTab("modules")}
                      className={cn(
                        "flex-1 text-[11px] py-2.5 font-medium transition-colors flex items-center justify-center gap-1.5",
                        leftTab === "modules"
                          ? "text-primary border-b-2 border-primary"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Layers className="w-3 h-3" />
                      Modules
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {leftTab === "machines" && (
                      <MachinePalette onAddMachine={handleAddMachine} />
                    )}
                    {leftTab === "items" && (
                      <div className="p-4">
                        <ItemGrid />
                      </div>
                    )}
                    {leftTab === "modules" && (
                      <div className="p-4 text-center">
                        <p className="text-xs text-muted-foreground">
                          Select machines on canvas, then use "Create Module" to
                          save reusable groups.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 overflow-y-auto p-4">
                  <ItemGrid />
                </div>
              )}
            </>
          )}
        </motion.aside>

        {/* Left Collapse Toggle */}
        <button
          onClick={() => setLeftCollapsed(!leftCollapsed)}
          className="w-5 flex items-center justify-center border-r border-border/20 bg-card/40 hover:bg-card/80 transition-colors shrink-0"
          title={leftCollapsed ? "Show palette" : "Hide palette"}
        >
          {leftCollapsed ? (
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          ) : (
            <ChevronLeft className="w-3 h-3 text-muted-foreground" />
          )}
        </button>

        {/* Center - Main Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex-1 overflow-hidden flex flex-col"
        >
          <div className="flex-1 overflow-hidden">
            {viewMode === "canvas" ? (
              <Suspense
                fallback={
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                }
              >
                <FactoryCanvas
                  machines={factoryMachines}
                  onMachinesChange={setFactoryMachines}
                  selectedMachineId={selectedMachineId}
                  onSelectMachine={selectMachine}
                  simulation={factorySimulation}
                  onSimulationChange={setFactorySimulation}
                />
              </Suspense>
            ) : (
              <FactoryFloor />
            )}
          </div>

          {/* Production Summary (canvas mode only) */}
          {viewMode === "canvas" &&
            factorySimulation &&
            factoryMachines.length > 0 && (
              <ProductionSummary
                simulation={factorySimulation}
                machineCount={factoryMachines.length}
              />
            )}
        </motion.div>

        {/* Right Collapse Toggle */}
        <button
          onClick={() => setRightCollapsed(!rightCollapsed)}
          className="w-5 flex items-center justify-center border-l border-border/20 bg-card/40 hover:bg-card/80 transition-colors shrink-0"
          title={rightCollapsed ? "Show panel" : "Hide panel"}
        >
          {rightCollapsed ? (
            <ChevronLeft className="w-3 h-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          )}
        </button>

        {/* Right Panel - AI Chat or Inspector */}
        <motion.aside
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className={cn(
            "border-l border-border/40 glass-strong overflow-hidden transition-all duration-300 shrink-0",
            rightCollapsed ? "w-0" : "w-80",
          )}
        >
          {!rightCollapsed && (
            <AnimatePresence mode="wait">
              {selectedMachine && viewMode === "canvas" ? (
                <InspectorPanel
                  key="inspector"
                  machine={selectedMachine}
                  simulation={factorySimulation?.nodes[selectedMachineId!]}
                  onClose={() => selectMachine(null)}
                  onRecipeChange={updateMachineRecipe}
                  onOverclockChange={updateMachineOverclock}
                  onExtractionItemChange={updateMachineExtractionItem}
                  onNodePurityChange={updateMachineNodePurity}
                  onSomersloopsChange={updateMachineSomersloops}
                  onSourceItemChange={updateMachineSourceItem}
                  onSourceRateChange={updateMachineSourceRate}
                  onDelete={removeMachine}
                />
              ) : (
                <AiChat
                  key="chat"
                  factoryMachines={factoryMachines}
                  factorySimulation={factorySimulation}
                />
              )}
            </AnimatePresence>
          )}
        </motion.aside>
      </main>

      <BottomBar />
    </div>
  );
}
