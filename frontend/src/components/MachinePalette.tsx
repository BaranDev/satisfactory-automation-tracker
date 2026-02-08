import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ChevronRight,
  Cpu,
  Flame,
  Factory,
  Cog,
  Droplets,
  Hammer,
} from "lucide-react";
import { MACHINES, CATEGORY_LABELS, type MachineCategory } from "@/data/machines";
import { ItemImage } from "@/components/ItemImage";
import { cn } from "@/lib/utils";
import type { MachineType } from "@/types/factory";

const CATEGORY_ICONS: Record<MachineCategory, React.ReactNode> = {
  extraction: <Hammer className="w-3.5 h-3.5" />,
  smelting: <Flame className="w-3.5 h-3.5" />,
  production: <Factory className="w-3.5 h-3.5" />,
  refining: <Droplets className="w-3.5 h-3.5" />,
  power: <Cog className="w-3.5 h-3.5" />,
  logistics: <Cpu className="w-3.5 h-3.5" />,
};

interface MachinePaletteProps {
  onAddMachine: (machineType: MachineType) => void;
}

export default function MachinePalette({ onAddMachine }: MachinePaletteProps) {
  const [search, setSearch] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<MachineCategory | null>("production");

  const filteredMachines = Object.values(MACHINES).filter(m =>
    m.label.toLowerCase().includes(search.toLowerCase()),
  );

  const categorized = filteredMachines.reduce<Record<string, typeof filteredMachines>>((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {});

  const handleDragStart = useCallback((e: React.DragEvent, machineType: MachineType) => {
    e.dataTransfer.setData("application/machine-type", machineType);
    e.dataTransfer.effectAllowed = "copy";
  }, []);

  const categories = Object.keys(CATEGORY_LABELS) as MachineCategory[];

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
          <input
            type="text"
            placeholder="Search machines..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-2 rounded bg-background/80 border border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto">
        {categories.map(category => {
          const machines = categorized[category];
          if (!machines || machines.length === 0) return null;
          const isExpanded = expandedCategory === category || search.length > 0;

          return (
            <div key={category} className="border-b border-border/20">
              <button
                onClick={() => setExpandedCategory(isExpanded && !search ? null : category)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors"
              >
                {CATEGORY_ICONS[category]}
                <span className="flex-1 text-left">{CATEGORY_LABELS[category]}</span>
                <span className="text-[10px] text-muted-foreground/60">{machines.length}</span>
                <ChevronRight className={cn(
                  "w-3 h-3 transition-transform",
                  isExpanded && "rotate-90",
                )} />
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-2 pb-2 space-y-1">
                      {machines.map(machine => (
                        <div
                          key={machine.key}
                          draggable
                          onDragStart={e => handleDragStart(e, machine.key)}
                          onClick={() => onAddMachine(machine.key)}
                          className="flex items-center gap-2 px-2 py-1.5 rounded cursor-grab active:cursor-grabbing bg-secondary/20 hover:bg-secondary/40 transition-colors group"
                          title={`${machine.label} — ${Math.abs(machine.basePower)} MW, Drag to canvas or click to add`}
                        >
                          <ItemImage
                            icon={machine.icon}
                            label={machine.label}
                            category={machine.category}
                            size="sm"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-foreground truncate">
                              {machine.label}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {machine.basePower < 0
                                ? `Generates ${Math.abs(machine.basePower)} MW`
                                : `${machine.basePower} MW`}
                              {machine.compatibleRecipes.length > 0 && (
                                <> · {machine.compatibleRecipes.length} recipes</>
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
