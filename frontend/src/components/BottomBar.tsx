import { motion } from "framer-motion";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/store/projectStore";

export default function BottomBar() {
  const { previousState, undo, syncStatus } = useProjectStore();

  return (
    <footer className="h-12 border-t border-border glass-strong px-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button
          size="sm"
          variant="ghost"
          onClick={undo}
          disabled={!previousState}
          className="gap-2"
        >
          <Undo2 className="w-4 h-4" />
          Undo
        </Button>

        {previousState && (
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-xs text-muted-foreground"
          >
            Previous state available
          </motion.span>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        Status:{" "}
        <span className="font-medium">{syncStatus.replace("_", " ")}</span>
      </div>
    </footer>
  );
}
