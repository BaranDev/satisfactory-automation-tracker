import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Zap,
  Copy,
  Check,
  Download,
  Upload,
  Edit2,
  X,
  Cloud,
  CloudOff,
  Loader2,
  Github,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useProjectStore } from "@/store/projectStore";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export default function Header() {
  const {
    project,
    setProjectName,
    exportJson,
    importJson,
    syncStatus,
    isLoading,
    pushToCloud,
  } = useProjectStore();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importData, setImportData] = useState("");
  const [isPushing, setIsPushing] = useState(false);

  if (!project) return null;

  const shareUrl = `${window.location.origin}/p/${project.project_id}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Link copied", description: "Share it with your friends" });
  };

  const handleExport = () => {
    const json = exportJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `factory-${project.project_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "Factory JSON downloaded" });
  };

  const handleImport = () => {
    if (importJson(importData)) {
      setImportOpen(false);
      setImportData("");
      toast({ title: "Imported", description: "Factory data updated" });
    } else {
      toast({
        title: "Import failed",
        description: "Invalid JSON format",
        variant: "destructive",
      });
    }
  };

  const handleStartRename = () => {
    setNewName(project.name);
    setEditingName(true);
  };

  const handleSaveRename = () => {
    if (newName.trim()) {
      setProjectName(newName.trim());
    }
    setEditingName(false);
  };

  const handleQuickSync = async () => {
    setIsPushing(true);
    const result = await pushToCloud(false);
    setIsPushing(false);
    if (result.success) {
      toast({ title: "Synced", description: "Factory saved to cloud" });
    } else if (result.conflict) {
      toast({
        title: "Conflict detected",
        description: "Cloud has newer changes",
        variant: "destructive",
      });
    }
  };

  const syncColor =
    syncStatus === "in_sync"
      ? "text-neon-green"
      : syncStatus === "local_changes"
        ? "text-ficsit-amber"
        : syncStatus === "cloud_newer"
          ? "text-neon-cyan"
          : "text-muted-foreground";

  return (
    <header className="h-14 border-b border-border/40 glass-strong px-4 flex items-center justify-between shrink-0">
      {/* Left: Logo & Name */}
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="w-7 h-7 rounded bg-primary/15 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-xs font-bold text-primary tracking-tight hidden lg:block">
            FICSIT
          </span>
        </Link>

        <div className="w-px h-6 bg-border/30" />

        {editingName ? (
          <div className="flex items-center gap-1.5">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveRename();
                if (e.key === "Escape") setEditingName(false);
              }}
              className="w-40 h-7 text-sm bg-background/50"
              autoFocus
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={handleSaveRename}
              className="h-7 w-7"
            >
              <Check className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setEditingName(false)}
              className="h-7 w-7"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : (
          <button
            onClick={handleStartRename}
            className="flex items-center gap-1.5 hover:text-primary transition-colors group"
          >
            <h1 className="text-sm font-semibold truncate max-w-[200px]">
              {project.name}
            </h1>
            <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
          </button>
        )}

        <span className="text-[10px] text-muted-foreground font-mono">
          v{project.version}
        </span>
      </div>

      {/* Center: Share */}
      <div className="hidden md:flex items-center gap-2">
        <code className="text-[11px] bg-background/40 px-2.5 py-1 rounded text-muted-foreground font-mono">
          {shareUrl}
        </code>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleCopy}
          className="h-7 w-7"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-neon-green" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">
        {/* Sync Status + Quick Sync */}
        <button
          onClick={handleQuickSync}
          disabled={isPushing || isLoading || syncStatus === "in_sync"}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all",
            syncStatus === "local_changes"
              ? "bg-ficsit-amber/10 hover:bg-ficsit-amber/20"
              : "hover:bg-secondary/50",
            syncColor,
          )}
          title={`Status: ${syncStatus.replace("_", " ")}`}
        >
          {isPushing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : syncStatus === "in_sync" ? (
            <Cloud className="w-3.5 h-3.5" />
          ) : syncStatus === "no_cloud" ? (
            <CloudOff className="w-3.5 h-3.5" />
          ) : (
            <Cloud className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">
            {syncStatus === "in_sync"
              ? "Synced"
              : syncStatus === "local_changes"
                ? "Save"
                : syncStatus === "cloud_newer"
                  ? "Update"
                  : "Offline"}
          </span>
        </button>

        <div className="w-px h-5 bg-border/30" />

        <Button
          size="sm"
          variant="ghost"
          onClick={handleExport}
          className="gap-1.5 h-7 px-2 text-xs"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export</span>
        </Button>

        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" className="gap-1.5 h-7 px-2 text-xs">
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Import</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Factory JSON</DialogTitle>
              <DialogDescription>
                Paste your factory JSON below. This will replace local data.
              </DialogDescription>
            </DialogHeader>
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              className="w-full h-48 p-3 rounded-md bg-background border border-border text-sm font-mono"
              placeholder="Paste JSON here..."
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleImport}>Import</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="w-px h-5 bg-border/30 hidden lg:block" />

        <a
          href="https://github.com/BaranDev"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Github className="w-3.5 h-3.5" />
        </a>
      </div>
    </header>
  );
}
