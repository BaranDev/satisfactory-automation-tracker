import { useState, useMemo, useCallback } from "react";
import {
  Search,
  ChevronDown,
  ChevronUp,
  Check,
  Minus,
  GripVertical,
} from "lucide-react";
import { ITEMS, type ItemInfo } from "@/data/recipes";
import { useProjectStore } from "@/store/projectStore";
import { ItemImage } from "@/components/ItemImage";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";

// ─── Category Config ─────────────────────────────────────────

interface CategoryMeta {
  label: string;
  color: string;
  border: string;
}

const CATEGORIES: Record<string, CategoryMeta> = {
  all: {
    label: "All",
    color: "text-zinc-300",
    border: "border-zinc-600",
  },
  resource: {
    label: "Resources",
    color: "text-amber-400",
    border: "border-amber-600/40",
  },
  ingot: {
    label: "Ingots",
    color: "text-orange-400",
    border: "border-orange-600/40",
  },
  part: {
    label: "Parts",
    color: "text-sky-400",
    border: "border-sky-600/40",
  },
  intermediate: {
    label: "Components",
    color: "text-violet-400",
    border: "border-violet-600/40",
  },
  fluid: {
    label: "Fluids",
    color: "text-cyan-400",
    border: "border-cyan-600/40",
  },
  fuel: {
    label: "Fuel",
    color: "text-red-400",
    border: "border-red-600/40",
  },
  nuclear: {
    label: "Nuclear",
    color: "text-green-400",
    border: "border-green-600/40",
  },
  alien: {
    label: "Alien",
    color: "text-pink-400",
    border: "border-pink-600/40",
  },
  elevator: {
    label: "Space Elevator",
    color: "text-yellow-400",
    border: "border-yellow-600/40",
  },
};

// ─── Main Component ──────────────────────────────────────────

export default function ItemGrid() {
  const project = useProjectStore((s) => s.project);
  const toggleAutomated = useProjectStore((s) => s.toggleAutomated);
  const setMachines = useProjectStore((s) => s.setMachines);
  const setOverclock = useProjectStore((s) => s.setOverclock);

  const [search, setSearch] = useState("");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [showOnlyAutomated, setShowOnlyAutomated] = useState(false);

  const items = project?.items ?? {};

  const groupedItems = useMemo(() => {
    const groups: Record<string, (ItemInfo & { key: string })[]> = {};
    for (const [key, info] of Object.entries(ITEMS)) {
      const cat = info.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({ ...info, key });
    }
    for (const arr of Object.values(groups)) {
      arr.sort((a, b) => a.tier - b.tier || a.label.localeCompare(b.label));
    }
    return groups;
  }, []);

  const filterItems = useCallback(
    (categoryItems: (ItemInfo & { key: string })[]) => {
      return categoryItems.filter((info) => {
        const matchesSearch =
          !search ||
          info.label.toLowerCase().includes(search.toLowerCase()) ||
          info.key.toLowerCase().includes(search.toLowerCase());
        const matchesAutomation =
          !showOnlyAutomated || items[info.key]?.automated;
        return matchesSearch && matchesAutomation;
      });
    },
    [search, showOnlyAutomated, items],
  );

  const automatedCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    for (const [key, item] of Object.entries(items)) {
      if (item.automated) {
        counts.all = (counts.all || 0) + 1;
        const cat = ITEMS[key]?.category ?? "part";
        counts[cat] = (counts[cat] || 0) + 1;
      }
    }
    return counts;
  }, [items]);

  const allItems = useMemo(() => {
    return Object.entries(ITEMS)
      .map(([key, info]) => ({ ...info, key }))
      .sort((a, b) => a.tier - b.tier || a.label.localeCompare(b.label));
  }, []);

  if (!project) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No project loaded
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Item Catalog
        </h2>
        <span className="text-[10px] text-muted-foreground/60">
          Drag to factory floor
        </span>
      </div>

      {/* Search + Filter Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
            className="w-full rounded-md bg-background/60 border border-border/40 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-colors"
          />
        </div>
        <button
          onClick={() => setShowOnlyAutomated(!showOnlyAutomated)}
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-all shrink-0",
            showOnlyAutomated
              ? "bg-primary/10 border-primary/30 text-primary"
              : "bg-background/40 border-border/40 text-muted-foreground hover:text-foreground hover:border-border/60",
          )}
        >
          <Check className="w-3 h-3" />
          {automatedCounts.all > 0 && (
            <span className="tabular-nums text-[10px] opacity-70">
              {automatedCounts.all}
            </span>
          )}
        </button>
      </div>

      {/* Category Tabs */}
      <Tabs defaultValue="all">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger
            value="all"
            count={
              showOnlyAutomated
                ? automatedCounts.all
                : Object.keys(ITEMS).length
            }
          >
            All
          </TabsTrigger>
          {Object.entries(CATEGORIES)
            .filter(([k]) => k !== "all" && groupedItems[k]?.length)
            .map(([catKey, meta]) => (
              <TabsTrigger
                key={catKey}
                value={catKey}
                count={
                  showOnlyAutomated
                    ? (automatedCounts[catKey] ?? 0)
                    : (groupedItems[catKey]?.length ?? 0)
                }
              >
                <span className={meta.color}>{meta.label}</span>
              </TabsTrigger>
            ))}
        </TabsList>

        <TabsContent value="all" className="mt-3">
          <ItemList
            items={filterItems(allItems)}
            storeItems={items}
            expandedItem={expandedItem}
            setExpandedItem={setExpandedItem}
            toggleAutomated={toggleAutomated}
            setMachines={setMachines}
            setOverclock={setOverclock}
          />
        </TabsContent>

        {Object.entries(CATEGORIES)
          .filter(([k]) => k !== "all" && groupedItems[k]?.length)
          .map(([catKey]) => (
            <TabsContent key={catKey} value={catKey} className="mt-3">
              <ItemList
                items={filterItems(groupedItems[catKey] ?? [])}
                storeItems={items}
                expandedItem={expandedItem}
                setExpandedItem={setExpandedItem}
                toggleAutomated={toggleAutomated}
                setMachines={setMachines}
                setOverclock={setOverclock}
              />
            </TabsContent>
          ))}
      </Tabs>
    </div>
  );
}

// ─── Item List ────────────────────────────────────────────────

interface ItemListProps {
  items: (ItemInfo & { key: string })[];
  storeItems: Record<
    string,
    {
      automated: boolean;
      machines: number;
      overclock: number;
      label: string;
      icon?: string;
    }
  >;
  expandedItem: string | null;
  setExpandedItem: (key: string | null) => void;
  toggleAutomated: (key: string) => void;
  setMachines: (key: string, n: number) => void;
  setOverclock: (key: string, v: number) => void;
}

function ItemList({
  items: itemList,
  storeItems,
  expandedItem,
  setExpandedItem,
  toggleAutomated,
  setMachines,
  setOverclock,
}: ItemListProps) {
  if (itemList.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-xs">
        No items found.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {itemList.map((info) => {
        const state = storeItems[info.key];
        const isExpanded = expandedItem === info.key;
        const isAutomated = state?.automated ?? false;

        return (
          <div
            key={info.key}
            draggable={!isAutomated}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", info.key);
              e.dataTransfer.effectAllowed = "copy";
            }}
            className={cn(
              "group rounded-md border transition-all duration-150",
              isAutomated
                ? "bg-primary/5 border-primary/20"
                : "bg-background/30 border-border/20 hover:border-border/40 draggable-item",
            )}
          >
            {/* Item Row */}
            <div
              className="flex items-center gap-2 px-2 py-1.5 cursor-pointer select-none"
              onClick={() => setExpandedItem(isExpanded ? null : info.key)}
            >
              {!isAutomated && (
                <GripVertical className="w-3 h-3 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors shrink-0" />
              )}
              <ItemImage
                icon={info.icon}
                label={info.label}
                category={info.category}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-foreground truncate">
                    {info.label}
                  </span>
                  {isAutomated && (
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </div>
                {isAutomated && state && (
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {state.machines}x @ {Math.round(state.overclock * 100)}%
                  </span>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleAutomated(info.key);
                }}
                className={cn(
                  "shrink-0 w-6 h-6 rounded flex items-center justify-center transition-all",
                  isAutomated
                    ? "bg-primary/15 text-primary hover:bg-primary/25"
                    : "bg-secondary/40 text-muted-foreground/50 hover:text-foreground hover:bg-secondary/60",
                )}
                title={
                  isAutomated ? "Remove from production" : "Add to production"
                }
              >
                {isAutomated ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Minus className="w-3 h-3" />
                )}
              </button>
              <div className="shrink-0 text-muted-foreground/30">
                {isExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </div>
            </div>

            {/* Expanded Controls */}
            {isExpanded && (
              <div className="px-2 pb-2 pt-1 border-t border-border/20 space-y-2">
                {/* Machines */}
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Machines
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        setMachines(info.key, (state?.machines ?? 1) - 1)
                      }
                      className="w-5 h-5 rounded bg-secondary/50 text-muted-foreground hover:text-foreground flex items-center justify-center text-xs transition-colors"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={0}
                      value={state?.machines ?? 1}
                      onChange={(e) =>
                        setMachines(info.key, parseInt(e.target.value) || 0)
                      }
                      className="w-12 rounded bg-background/60 border border-border/30 text-center text-xs text-foreground py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() =>
                        setMachines(info.key, (state?.machines ?? 1) + 1)
                      }
                      className="w-5 h-5 rounded bg-secondary/50 text-muted-foreground hover:text-foreground flex items-center justify-center text-xs transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Overclock */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Overclock
                    </label>
                    <span className="text-[10px] text-foreground tabular-nums font-medium">
                      {Math.round((state?.overclock ?? 1) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={250}
                    value={Math.round((state?.overclock ?? 1) * 100)}
                    onChange={(e) =>
                      setOverclock(info.key, parseInt(e.target.value) / 100)
                    }
                    className="w-full h-1 rounded-full appearance-none bg-secondary cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-0"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground/40">
                    <span>1%</span>
                    <Tooltip content="Reset to default">
                      <button
                        onClick={() => setOverclock(info.key, 1.0)}
                        className="hover:text-primary transition-colors"
                      >
                        100%
                      </button>
                    </Tooltip>
                    <span>250%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
