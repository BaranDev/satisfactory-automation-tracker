import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, Check, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProjectStore } from "@/store/projectStore";
import { getRecipes } from "@/lib/simulation";
import { cn } from "@/lib/utils";

export default function ItemGrid() {
  const { project, updateItem, addItem, removeItem } = useProjectStore();
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  if (!project) return null;

  const items = Object.entries(project.items);
  const filteredItems = items.filter(
    ([key, item]) =>
      item.label.toLowerCase().includes(search.toLowerCase()) ||
      key.toLowerCase().includes(search.toLowerCase()),
  );

  const recipes = getRecipes();
  const existingItemKeys = new Set(Object.keys(project.items));
  const availableRecipes = recipes.filter(
    (r) => !existingItemKeys.has(r.outputs[0]?.item),
  );

  const handleAddItem = (recipeId: string, label: string) => {
    addItem(recipeId, {
      label,
      icon: `${recipeId}.webp`,
      automated: false,
      machines: 1,
      overclock: 1.0,
    });
    setShowAddModal(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
            className="pl-9 bg-background/50"
          />
        </div>
        <Button
          size="icon"
          variant="neon"
          onClick={() => setShowAddModal(true)}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-2 pr-2">
          <AnimatePresence mode="popLayout">
            {filteredItems.map(([key, item]) => (
              <motion.div
                key={key}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={cn(
                  "glass rounded-lg p-3 space-y-3",
                  item.automated && "neon-green border-neon-green/30",
                )}
              >
                {/* Header Row */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-background/50 flex items-center justify-center text-lg">
                    {item.label.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">
                      {item.label}
                    </h3>
                    <p className="text-xs text-muted-foreground">{key}</p>
                  </div>
                  <Switch
                    checked={item.automated}
                    onCheckedChange={(checked) =>
                      updateItem(key, { automated: checked })
                    }
                  />
                </div>

                {/* Controls (only when automated) */}
                {item.automated && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="space-y-2"
                  >
                    {/* Machines */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16">
                        Machines
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() =>
                          updateItem(key, {
                            machines: Math.max(1, item.machines - 1),
                          })
                        }
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-8 text-center font-mono">
                        {item.machines}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() =>
                          updateItem(key, { machines: item.machines + 1 })
                        }
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>

                    {/* Overclock */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16">
                        Overclock
                      </span>
                      <Slider
                        value={[item.overclock * 100]}
                        onValueChange={([v]) =>
                          updateItem(key, { overclock: v / 100 })
                        }
                        min={1}
                        max={250}
                        step={1}
                        className="flex-1"
                      />
                      <span className="w-12 text-right text-xs font-mono">
                        {(item.overclock * 100).toFixed(0)}%
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* Remove button */}
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive h-6 text-xs"
                    onClick={() => removeItem(key)}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Remove
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredItems.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {search ? "No matching items" : "No items added yet"}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Add Item Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="glass-strong rounded-xl p-6 w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold mb-4">Add Item</h2>

              <ScrollArea className="flex-1">
                <div className="space-y-2 pr-2">
                  {availableRecipes.map((recipe) => (
                    <button
                      key={recipe.id}
                      onClick={() =>
                        handleAddItem(
                          recipe.outputs[0]?.item ?? recipe.id,
                          recipe.label,
                        )
                      }
                      className="w-full text-left glass rounded-lg p-3 hover:bg-primary/10 transition-colors"
                    >
                      <h3 className="font-medium">{recipe.label}</h3>
                      <p className="text-xs text-muted-foreground">
                        {recipe.machine} • {recipe.craft_time}s
                      </p>
                    </button>
                  ))}
                </div>
              </ScrollArea>

              <Button
                variant="ghost"
                className="mt-4"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
