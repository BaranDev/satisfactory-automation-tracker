import { useState } from "react";
import {
  Cloud,
  CloudOff,
  RefreshCw,
  Check,
  AlertCircle,
  Undo2,
} from "lucide-react";
import { useProjectStore, type SyncStatus } from "@/store/projectStore";
import { cn } from "@/lib/utils";

export function SyncBar() {
  const syncStatus = useProjectStore((s) => s.syncStatus);
  const syncToCloud = useProjectStore((s) => s.syncToCloud);
  const refreshFromCloud = useProjectStore((s) => s.refreshFromCloud);
  const undo = useProjectStore((s) => s.undo);
  const canUndo = useProjectStore((s) => s.canUndo);
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncToCloud();
    } finally {
      setSyncing(false);
    }
  };

  const handleRefresh = async () => {
    setSyncing(true);
    try {
      await refreshFromCloud();
    } finally {
      setSyncing(false);
    }
  };

  const statusConfig: Record<
    SyncStatus,
    { icon: React.ReactNode; label: string; color: string }
  > = {
    in_sync: {
      icon: <Check className="w-3.5 h-3.5" />,
      label: "Saved",
      color: "text-emerald-400",
    },
    local_changes: {
      icon: <Cloud className="w-3.5 h-3.5" />,
      label: "Unsaved",
      color: "text-amber-400",
    },
    cloud_newer: {
      icon: <AlertCircle className="w-3.5 h-3.5" />,
      label: "Cloud newer",
      color: "text-sky-400",
    },
    no_cloud: {
      icon: <CloudOff className="w-3.5 h-3.5" />,
      label: "Local only",
      color: "text-zinc-500",
    },
  };

  const config = statusConfig[syncStatus];

  return (
    <div className="flex items-center gap-2">
      {/* Status indicator */}
      <div className={cn("flex items-center gap-1.5 text-xs", config.color)}>
        {config.icon}
        <span className="hidden sm:inline">{config.label}</span>
      </div>

      {/* Undo button - shows when there's a previous state to restore */}
      {canUndo && (
        <button
          onClick={undo}
          className="flex items-center gap-1 rounded-md bg-violet-500/15 border border-violet-500/25 px-2 py-1 text-xs font-medium text-violet-400 hover:bg-violet-500/25 transition-colors"
          title="Restore previous local state"
        >
          <Undo2 className="w-3 h-3" />
          <span className="hidden sm:inline">Undo</span>
        </button>
      )}

      {/* Sync button */}
      {syncStatus === "local_changes" && (
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1 rounded-md bg-orange-500/15 border border-orange-500/25 px-2 py-1 text-xs font-medium text-orange-400 hover:bg-orange-500/25 transition-colors disabled:opacity-50"
        >
          {syncing ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <Cloud className="w-3 h-3" />
          )}
          <span className="hidden sm:inline">Save</span>
        </button>
      )}

      {/* Refresh button for cloud_newer */}
      {syncStatus === "cloud_newer" && (
        <button
          onClick={handleRefresh}
          disabled={syncing}
          className="flex items-center gap-1 rounded-md bg-sky-500/15 border border-sky-500/25 px-2 py-1 text-xs font-medium text-sky-400 hover:bg-sky-500/25 transition-colors disabled:opacity-50"
        >
          {syncing ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          <span className="hidden sm:inline">Fetch Remote</span>
        </button>
      )}
    </div>
  );
}
