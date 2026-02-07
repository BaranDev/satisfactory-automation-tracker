import { Undo2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/store/projectStore";
import { cn } from "@/lib/utils";

export default function BottomBar() {
  const { previousState, undo, syncStatus } = useProjectStore();

  const syncColor =
    syncStatus === "in_sync"
      ? "text-neon-green"
      : syncStatus === "local_changes"
        ? "text-ficsit-amber"
        : syncStatus === "cloud_newer"
          ? "text-neon-cyan"
          : "text-muted-foreground";

  return (
    <footer className="h-10 border-t border-border/40 glass-strong px-4 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="ghost"
          onClick={undo}
          disabled={!previousState}
          className="gap-1.5 h-7 px-2 text-xs"
        >
          <Undo2 className="w-3.5 h-3.5" />
          Undo
        </Button>

        <div className="w-px h-4 bg-border/30" />

        <span className="text-[10px] text-muted-foreground">
          Status:{" "}
          <span className={cn("font-medium", syncColor)}>
            {syncStatus.replace(/_/g, " ")}
          </span>
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[10px] text-muted-foreground">
          FICSIT Automation Tracker{" "}
          <span className="text-primary/60">BETA</span>
        </span>
        <a
          href="https://github.com/BaranDev"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-primary transition-colors"
        >
          BaranDev
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
    </footer>
  );
}
