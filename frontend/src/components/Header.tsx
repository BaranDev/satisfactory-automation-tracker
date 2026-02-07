import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Zap,
  Copy,
  Check,
  Download,
  Upload,
  FileText,
  Edit2,
  X,
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

export default function Header() {
  const { project, setProjectName, exportJson, importJson } = useProjectStore();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importData, setImportData] = useState("");

  if (!project) return null;

  const shareUrl = `${window.location.origin}/p/${project.project_id}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Link copied!", description: "Share it with your friends" });
  };

  const handleExport = () => {
    const json = exportJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project-${project.project_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported!", description: "Project JSON downloaded" });
  };

  const handleImport = () => {
    if (importJson(importData)) {
      setImportOpen(false);
      setImportData("");
      toast({ title: "Imported!", description: "Project data updated" });
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

  return (
    <header className="h-16 border-b border-border glass-strong px-4 flex items-center justify-between">
      {/* Left: Logo & Name */}
      <div className="flex items-center gap-4">
        <Link
          to="/"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
        </Link>

        {editingName ? (
          <div className="flex items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveRename();
                if (e.key === "Escape") setEditingName(false);
              }}
              className="w-48 h-8 text-sm"
              autoFocus
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={handleSaveRename}
              className="h-8 w-8"
            >
              <Check className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setEditingName(false)}
              className="h-8 w-8"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <button
            onClick={handleStartRename}
            className="flex items-center gap-2 hover:text-primary transition-colors"
          >
            <h1 className="text-lg font-semibold">{project.name}</h1>
            <Edit2 className="w-3 h-3 opacity-50" />
          </button>
        )}

        <span className="text-xs text-muted-foreground">
          v{project.version}
        </span>
      </div>

      {/* Center: Share Link */}
      <div className="flex items-center gap-2">
        <code className="text-xs bg-background/50 px-3 py-1 rounded-md text-muted-foreground">
          {shareUrl}
        </code>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleCopy}
          className="h-8 w-8"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Right: Export/Import */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleExport}
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          Export
        </Button>

        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" className="gap-2">
              <Upload className="w-4 h-4" />
              Import
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Project JSON</DialogTitle>
              <DialogDescription>
                Paste your project JSON below. This will replace local data.
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

        <Button size="sm" variant="neon" className="gap-2">
          <FileText className="w-4 h-4" />
          Export PDF
        </Button>

        <span className="text-xs text-muted-foreground ml-4">
          Updated: {new Date(project.last_updated).toLocaleString()}
        </span>
      </div>
    </header>
  );
}
