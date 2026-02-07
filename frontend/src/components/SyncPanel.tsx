import { useState } from "react";
import { motion } from "framer-motion";
import {
  Cloud,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  Check,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProjectStore } from "@/store/projectStore";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export default function SyncPanel() {
  const {
    project,
    cloudProject,
    syncStatus,
    isLoading,
    pullFromCloud,
    pushToCloud,
    lastSyncedAt,
  } = useProjectStore();
  const { toast } = useToast();
  const [showConflict, setShowConflict] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);

  const handlePull = async () => {
    setIsPulling(true);
    const success = await pullFromCloud();
    setIsPulling(false);

    if (success) {
      toast({ title: "Pulled from cloud", description: "Local data updated" });
    } else {
      toast({ title: "Pull failed", variant: "destructive" });
    }
  };

  const handlePush = async (force = false) => {
    setIsPushing(true);
    const result = await pushToCloud(force);
    setIsPushing(false);

    if (result.success) {
      toast({ title: "Pushed to cloud", description: "Cloud data updated" });
      setShowConflict(false);
    } else if (result.conflict) {
      setShowConflict(true);
    } else {
      toast({ title: "Push failed", variant: "destructive" });
    }
  };

  const statusConfig: Record<
    string,
    { label: string; color: string; bgColor: string; icon: typeof Cloud }
  > = {
    in_sync: {
      label: "In Sync",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      icon: Check,
    },
    local_changes: {
      label: "Local Changes",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      icon: RefreshCw,
    },
    cloud_newer: {
      label: "Cloud Newer",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      icon: Cloud,
    },
    no_cloud: {
      label: "Not Synced",
      color: "text-muted-foreground",
      bgColor: "bg-muted/10",
      icon: Cloud,
    },
  };

  const status = statusConfig[syncStatus] ?? statusConfig.no_cloud;
  const StatusIcon = status.icon;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Cloud className="w-5 h-5 text-primary" />
          Sync
        </h2>

        {/* Status Badge */}
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          className={cn(
            "rounded-lg p-4 flex items-center gap-3",
            status.bgColor,
          )}
        >
          <StatusIcon className={cn("w-5 h-5", status.color)} />
          <div>
            <p className={cn("font-medium", status.color)}>{status.label}</p>
            {lastSyncedAt && (
              <p className="text-xs text-muted-foreground">
                Last sync: {new Date(lastSyncedAt).toLocaleString()}
              </p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Sync Buttons */}
      <div className="space-y-2">
        <Button
          onClick={handlePull}
          disabled={isPulling || isLoading}
          variant="outline"
          className="w-full justify-start gap-3"
        >
          {isPulling ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Pull from Cloud
        </Button>

        <Button
          onClick={() => handlePush(false)}
          disabled={isPushing || isLoading || syncStatus === "in_sync"}
          variant="neon"
          className="w-full justify-start gap-3"
        >
          {isPushing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          Push to Cloud
        </Button>
      </div>

      {/* Version Info */}
      {cloudProject && (
        <div className="glass rounded-lg p-3 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cloud Version</span>
            <span className="font-mono">v{cloudProject.version}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cloud Updated</span>
            <span className="font-mono">
              {new Date(cloudProject.last_updated).toLocaleDateString()}
            </span>
          </div>
        </div>
      )}

      {/* Conflict Dialog */}
      <Dialog open={showConflict} onOpenChange={setShowConflict}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Version Conflict
            </DialogTitle>
            <DialogDescription>
              The cloud version has been updated since your last sync. Do you
              want to overwrite it with your local changes?
            </DialogDescription>
          </DialogHeader>

          <div className="glass rounded-lg p-4 space-y-2 text-sm">
            <p>
              <strong>Your version:</strong> v{project?.version}
            </p>
            <p>
              <strong>Cloud version:</strong> v{cloudProject?.version}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConflict(false)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={handlePull}>
              Pull First
            </Button>
            <Button variant="destructive" onClick={() => handlePush(true)}>
              Overwrite Cloud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
