import { useState, useMemo, useCallback } from "react";
import { Search, ChevronDown, ChevronUp, Check, Minus } from "lucide-react";
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

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, (ItemInfo & { key: string })[]> = {};
    for (const [key, info] of Object.entries(ITEMS)) {
      const cat = info.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({ ...info, key });
    }
    // Sort each group by tier then label
    for (const arr of Object.values(groups)) {
      arr.sort((a, b) => a.tier - b.tier || a.label.localeCompare(b.label));
    }
    return groups;
  }, []);

  // Filter by search + automation toggle
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

  // Count automated per category for tab badges
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

  // "All" tab items
  const allItems = useMemo(() => {
    return Object.entries(ITEMS)
      .map(([key, info]) => ({ ...info, key }))
      .sort((a, b) => a.tier - b.tier || a.label.localeCompare(b.label));
  }, []);

  if (!project) {
    return (
      <div className="text-center py-12 text-zinc-500">No project loaded</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
            className="w-full rounded-lg bg-zinc-800/80 border border-zinc-700/50 pl-10 pr-4 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/50 transition-colors"
          />
        </div>
        <button
          onClick={() => setShowOnlyAutomated(!showOnlyAutomated)}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
            showOnlyAutomated
              ? "bg-orange-500/15 border-orange-500/40 text-orange-400"
              : "bg-zinc-800/60 border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600",
          )}
        >
          <Check className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Automated only</span>
          {automatedCounts.all > 0 && (
            <span className="tabular-nums text-xs opacity-70">
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

        {/* All Items Tab */}
        <TabsContent value="all" className="mt-4">
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

        {/* Per-category Tabs */}
        {Object.entries(CATEGORIES)
          .filter(([k]) => k !== "all" && groupedItems[k]?.length)
          .map(([catKey]) => (
            <TabsContent key={catKey} value={catKey} className="mt-4">
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

// ─── Item List (grid) ────────────────────────────────────────

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
      <div className="text-center py-12 text-zinc-500 text-sm">
        No items found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
      {itemList.map((info) => {
        const state = storeItems[info.key];
        const isExpanded = expandedItem === info.key;
        const isAutomated = state?.automated ?? false;

        return (
          <div
            key={info.key}
            className={cn(
              "group rounded-lg border transition-all duration-150",
              isAutomated
                ? "bg-orange-500/5 border-orange-500/25"
                : "bg-zinc-800/40 border-zinc-700/30 hover:border-zinc-600/50",
            )}
          >
            {/* Item Row */}
            <div
              className="flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none"
              onClick={() => setExpandedItem(isExpanded ? null : info.key)}
            >
              <ItemImage
                icon={info.icon}
                label={info.label}
                category={info.category}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-200 truncate">
                    {info.label}
                  </span>
                  {isAutomated && (
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-orange-400" />
                  )}
                </div>
                {isAutomated && state && (
                  <span className="text-[11px] text-zinc-500 tabular-nums">
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
                  "shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-all",
                  isAutomated
                    ? "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30"
                    : "bg-zinc-700/40 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/60",
                )}
                title={
                  isAutomated ? "Mark as not automated" : "Mark as automated"
                }
              >
                {isAutomated ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Minus className="w-3.5 h-3.5" />
                )}
              </button>
              <div className="shrink-0 text-zinc-600">
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </div>

            {/* Expanded Controls */}
            {isExpanded && (
              <div className="px-3 pb-3 pt-1 border-t border-zinc-700/30 space-y-3">
                {/* Machines */}
                <div className="flex items-center justify-between">
                  <label className="text-xs text-zinc-400">Machines</label>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        setMachines(info.key, (state?.machines ?? 1) - 1)
                      }
                      className="w-6 h-6 rounded bg-zinc-700/60 text-zinc-400 hover:text-zinc-200 flex items-center justify-center text-sm transition-colors"
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
                      className="w-14 rounded bg-zinc-800 border border-zinc-700/50 text-center text-sm text-zinc-200 py-0.5 focus:outline-none focus:ring-1 focus:ring-orange-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() =>
                        setMachines(info.key, (state?.machines ?? 1) + 1)
                      }
                      className="w-6 h-6 rounded bg-zinc-700/60 text-zinc-400 hover:text-zinc-200 flex items-center justify-center text-sm transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Overclock */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-zinc-400">Overclock</label>
                    <span className="text-xs text-zinc-300 tabular-nums font-medium">
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
                    className="w-full h-1.5 rounded-full appearance-none bg-zinc-700 cursor-pointer accent-orange-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-0"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-600">
                    <span>1%</span>
                    <Tooltip content="Default speed">
                      <button
                        onClick={() => setOverclock(info.key, 1.0)}
                        className="text-zinc-500 hover:text-orange-400 transition-colors"
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
