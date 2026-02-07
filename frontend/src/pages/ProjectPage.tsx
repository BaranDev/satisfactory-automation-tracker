import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useProjectStore } from "@/store/projectStore";
import Header from "@/components/Header";
import ItemGrid from "@/components/ItemGrid";
import FactoryFloor from "@/components/FactoryFloor";
import AiChat from "@/components/AiChat";
import BottomBar from "@/components/BottomBar";
import { cn } from "@/lib/utils";

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { project, isLoading, error, loadProject } = useProjectStore();
  const [initialized, setInitialized] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  useEffect(() => {
    if (projectId && !initialized) {
      loadProject(projectId).then(() => {
        setInitialized(true);
      });
    }
  }, [projectId, initialized, loadProject]);

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
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel - Item Catalog */}
        <motion.aside
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className={cn(
            "border-r border-border/40 glass-strong overflow-y-auto transition-all duration-300 shrink-0",
            leftCollapsed ? "w-0 p-0 overflow-hidden" : "w-80 p-4",
          )}
        >
          {!leftCollapsed && <ItemGrid />}
        </motion.aside>

        {/* Left Collapse Toggle */}
        <button
          onClick={() => setLeftCollapsed(!leftCollapsed)}
          className="w-5 flex items-center justify-center border-r border-border/20 bg-card/40 hover:bg-card/80 transition-colors shrink-0"
          title={leftCollapsed ? "Show item catalog" : "Hide item catalog"}
        >
          {leftCollapsed ? (
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          ) : (
            <ChevronLeft className="w-3 h-3 text-muted-foreground" />
          )}
        </button>

        {/* Center - Factory Floor */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex-1 overflow-hidden"
        >
          <FactoryFloor />
        </motion.div>

        {/* Right Collapse Toggle */}
        <button
          onClick={() => setRightCollapsed(!rightCollapsed)}
          className="w-5 flex items-center justify-center border-l border-border/20 bg-card/40 hover:bg-card/80 transition-colors shrink-0"
          title={rightCollapsed ? "Show AI assistant" : "Hide AI assistant"}
        >
          {rightCollapsed ? (
            <ChevronLeft className="w-3 h-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          )}
        </button>

        {/* Right Panel - AI Chat */}
        <motion.aside
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className={cn(
            "border-l border-border/40 glass-strong overflow-hidden transition-all duration-300 shrink-0",
            rightCollapsed ? "w-0" : "w-80",
          )}
        >
          {!rightCollapsed && <AiChat />}
        </motion.aside>
      </main>

      <BottomBar />
    </div>
  );
}
