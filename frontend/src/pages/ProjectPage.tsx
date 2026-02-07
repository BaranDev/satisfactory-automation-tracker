import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useProjectStore } from "@/store/projectStore";
import Header from "@/components/Header";
import ItemGrid from "@/components/ItemGrid";
import SyncPanel from "@/components/SyncPanel";
import SimulationPanel from "@/components/SimulationPanel";
import BottomBar from "@/components/BottomBar";

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { project, isLoading, error, loadProject } = useProjectStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (projectId && !initialized) {
      loadProject(projectId).then((success) => {
        if (!success) {
          // Project not found, could redirect or show error
        }
        setInitialized(true);
      });
    }
  }, [projectId, initialized, loadProject]);

  if (isLoading && !project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading project...</p>
        </motion.div>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <h1 className="text-2xl font-bold text-destructive mb-2">
            Project Not Found
          </h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="text-primary underline"
          >
            Go back home
          </button>
        </motion.div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel - Item Grid */}
        <motion.aside
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="w-80 border-r border-border glass-strong p-4 overflow-y-auto"
        >
          <ItemGrid />
        </motion.aside>

        {/* Center - Main Content Area */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex-1 p-6 overflow-y-auto"
        >
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">
              {Object.keys(project.items).length === 0
                ? "No items yet"
                : `${Object.values(project.items).filter((i) => i.automated).length} / ${Object.keys(project.items).length} automated`}
            </h2>

            {Object.keys(project.items).length === 0 && (
              <div className="glass rounded-xl p-8 text-center">
                <p className="text-muted-foreground mb-4">
                  Add items from the left panel to start tracking your factory
                  automation.
                </p>
              </div>
            )}

            {/* Simulation Results Display */}
            <SimulationPanel />
          </div>
        </motion.div>

        {/* Right Panel - Sync Controls */}
        <motion.aside
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="w-80 border-l border-border glass-strong p-4 overflow-y-auto"
        >
          <SyncPanel />
        </motion.aside>
      </main>

      <BottomBar />
    </div>
  );
}
