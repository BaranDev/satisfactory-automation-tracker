import { useState, createContext, useContext, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// ─── Context ─────────────────────────────────────────────────

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tabs components must be used within <Tabs>");
  return ctx;
}

// ─── Tabs Root ───────────────────────────────────────────────

interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  children,
  className,
}: TabsProps) {
  const [internal, setInternal] = useState(defaultValue);
  const activeTab = value ?? internal;
  const setActiveTab = (v: string) => {
    setInternal(v);
    onValueChange?.(v);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

// ─── Tabs List ───────────────────────────────────────────────

interface TabsListProps {
  children: ReactNode;
  className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-lg bg-zinc-800/60 p-1",
        className,
      )}
      role="tablist"
    >
      {children}
    </div>
  );
}

// ─── Tabs Trigger ────────────────────────────────────────────

interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  className?: string;
  count?: number;
}

export function TabsTrigger({
  value,
  children,
  className,
  count,
}: TabsTriggerProps) {
  const { activeTab, setActiveTab } = useTabs();
  const isActive = activeTab === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => setActiveTab(value)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50",
        isActive
          ? "bg-zinc-700 text-zinc-100 shadow-sm"
          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/40",
        className,
      )}
    >
      {children}
      {count !== undefined && (
        <span
          className={cn(
            "text-xs tabular-nums",
            isActive ? "text-zinc-300" : "text-zinc-500",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Tabs Content ────────────────────────────────────────────

interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const { activeTab } = useTabs();
  if (activeTab !== value) return null;
  return (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  );
}
