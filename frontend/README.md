# Frontend Documentation

The frontend is a React single-page application built with Vite, TypeScript, and Tailwind CSS. It provides a visual interface for tracking automated items, simulating production, and managing cloud sync.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [File Structure](#file-structure)
3. [State Management](#state-management)
4. [API Layer](#api-layer)
5. [Simulation Engine](#simulation-engine)
6. [Components](#components)
7. [Hooks](#hooks)
8. [Pages](#pages)
9. [Recipe Data](#recipe-data)
10. [Styling](#styling)
11. [Environment Variables](#environment-variables)
12. [Running Locally](#running-locally)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Application (Vite)                     │
├─────────────────────────────────────────────────────────────────┤
│  Pages                                                           │
│  ├── HomePage.tsx    (Create/Join project)                      │
│  └── ProjectPage.tsx (Main factory view)                        │
├─────────────────────────────────────────────────────────────────┤
│  Components                                                      │
│  ├── Header.tsx       (Project name, sync, export)              │
│  ├── ItemGrid.tsx     (Item catalog sidebar)                    │
│  ├── FactoryFloor.tsx (Drag-drop factory visualization)         │
│  ├── AiChat.tsx       (FICSIT AI assistant)                     │
│  ├── SimulationPanel  (Bottlenecks, suggestions)                │
│  └── SyncBar/Panel    (Cloud sync controls)                     │
├─────────────────────────────────────────────────────────────────┤
│  Store (Zustand)                                                 │
│  └── projectStore.ts  (Global state, sync logic)                │
├─────────────────────────────────────────────────────────────────┤
│  Lib                                                             │
│  ├── api.ts           (Backend API client)                      │
│  ├── simulation.ts    (Production rate calculator)              │
│  └── utils.ts         (Utility functions)                       │
├─────────────────────────────────────────────────────────────────┤
│  Data                                                            │
│  └── recipes.ts       (Static item/recipe database)             │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
frontend/src/
├── App.tsx                 # Root component with layout
├── main.tsx                # Entry point, router setup
├── index.css               # Global styles, Tailwind imports
├── components/
│   ├── Header.tsx          # Top navigation bar
│   ├── ItemGrid.tsx        # Left sidebar item catalog
│   ├── FactoryFloor.tsx    # Center drag-drop canvas
│   ├── AiChat.tsx          # Right sidebar AI assistant
│   ├── SimulationPanel.tsx # Bottleneck/suggestion display
│   ├── SyncBar.tsx         # Minimal sync status bar
│   ├── SyncPanel.tsx       # Full sync controls panel
│   ├── BottomBar.tsx       # Status bar at bottom
│   ├── ItemImage.tsx       # Item icon with fallback
│   └── ui/                 # Shadcn UI primitives
│       ├── button.tsx
│       ├── dialog.tsx
│       ├── input.tsx
│       ├── checkbox.tsx
│       ├── toast.tsx
│       └── ...
├── hooks/
│   └── useRemoteUpdateChecker.ts  # Polling for cloud updates
├── lib/
│   ├── api.ts              # Backend API client
│   ├── simulation.ts       # Production simulation engine
│   └── utils.ts            # cn() classname utility
├── pages/
│   ├── HomePage.tsx        # Landing page
│   └── ProjectPage.tsx     # Main project view
├── store/
│   └── projectStore.ts     # Zustand global state
├── data/
│   └── recipes.ts          # Item definitions and recipes
└── types/
    └── ...
```

---

## State Management

### projectStore.ts

The application uses Zustand for global state management. The store manages:

- Project data (items, name, version)
- Cloud sync state
- Simulation results
- Undo/redo history

#### State Shape

```typescript
interface ProjectStore {
  // Core state
  project: ProjectData | null;           // Current project data
  cloudProject: ProjectData | null;       // Last known cloud state
  isLoading: boolean;                     // Loading indicator
  error: string | null;                   // Error message
  simulationResult: DisplaySimResult | null;  // Simulation output
  syncStatus: SyncStatus;                 // in_sync | local_changes | cloud_newer | no_cloud
  lastSyncedAt: string | null;            // ISO timestamp
  previousState: ProjectData | null;      // For undo after pull

  // Computed getters
  items: ProjectData["items"];            // Shorthand accessor
  projectId: string | null;               // Current project ID
  projectName: string;                    // Current project name
  canUndo: boolean;                       // Whether undo is available
}
```

#### Sync Status Values

| Status | Meaning |
|--------|---------|
| `in_sync` | Local and cloud are identical |
| `local_changes` | User has unsaved changes |
| `cloud_newer` | Cloud has newer version |
| `no_cloud` | No cloud data exists |

#### Key Actions

**Project Management:**
- `createProject(name)` - Create new project via API
- `loadProject(projectId)` - Load project from cloud
- `setProjectName(name)` - Update project name locally

**Item Management:**
- `updateItem(key, updates)` - Update item properties
- `toggleAutomated(key)` - Toggle automation status
- `setMachines(key, count)` - Set machine count
- `setOverclock(key, value)` - Set overclock (0.01-2.5)
- `addItem(key, item)` - Add new item
- `removeItem(key)` - Remove item

**Cloud Sync:**
- `pullFromCloud()` - Fetch latest from cloud
- `pushToCloud(force?)` - Save to cloud (with conflict detection)
- `syncToCloud()` - Alias for pushToCloud
- `refreshFromCloud()` - Alias for pullFromCloud

**Undo:**
- `undo()` - Restore previous state after pull

#### Conflict Detection Flow

```
User clicks Save
    │
    ▼
pushToCloud(force=false)
    │
    ├─── Success ──────────► Update local state, syncStatus = "in_sync"
    │
    └─── 409 Conflict ────► syncStatus = "cloud_newer"
                            │
                            ▼
                       Show conflict dialog
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  │                  ▼
    "Use Remote"            │        "Overwrite with Mine"
    pullFromCloud()         │        pushToCloud(force=true)
         │                  │                  │
         ▼                  │                  ▼
    Replace local           │        Force save to cloud
    (can undo)             ▼
```

---

## API Layer

### api.ts

The API client wraps all backend calls with proper error handling.

#### Base Configuration

```typescript
const API_BASE = "/api";  // Proxied to backend by nginx
```

#### Types

```typescript
interface ProjectData {
  project_id: string;
  name: string;
  version: number;
  last_updated: string;
  assets_base_url?: string;
  items: Record<string, {
    label: string;
    icon?: string;
    automated: boolean;
    machines: number;
    overclock: number;
  }>;
}
```

#### Functions

| Function | Description |
|----------|-------------|
| `createProject(name)` | Create new project, returns ProjectData |
| `getProject(projectId)` | Fetch project, returns ProjectData or null |
| `checkCloudVersion(projectId)` | Lightweight version check for polling |
| `updateProject(projectId, data, options)` | Save project with conflict detection |
| `listAssets()` | Get list of available asset keys |
| `getAssetUrl(key)` | Get URL for asset image |

#### Error Classes

```typescript
class ApiError extends Error {
  status: number;    // HTTP status code
  detail: unknown;   // Error details from server
}

class ConflictApiError extends Error {
  cloudVersion: number;        // Server's version
  cloudLastUpdated: string;    // When server was last updated
  yourVersion: number;         // Version you expected
}
```

---

## Simulation Engine

### simulation.ts

The simulation engine calculates production rates, detects bottlenecks, and generates optimization suggestions. It runs entirely client-side.

#### Core Concepts

1. **Supply Rate** - Items per minute produced by assigned machines
2. **Demand Rate** - Items per minute required by downstream consumers
3. **Surplus** - Supply minus demand (negative = bottleneck)
4. **Ratio** - Supply divided by demand (less than 1 = bottleneck)

#### Key Functions

**calcOutputPerMin(recipe, machines, overclock)**

Calculate output per minute for a recipe:

```typescript
function calcOutputPerMin(recipe: Recipe, machines: number, overclock: number): number {
  const cyclesPerMin = (60 / recipe.craft_time) * overclock;
  const outputPerMachine = cyclesPerMin * recipe.outputs[0].amount;
  return outputPerMachine * machines;
}
```

**simulate(items)**

Main simulation function. Takes all items and returns:

```typescript
interface SimulationResult {
  nodes: Record<string, NodeResult>;     // Per-item results
  bottlenecks: NodeResult[];              // Sorted by severity
  suggestions: Suggestion[];              // Optimization tips
  totalAutomated: number;                 // Count of automated items
  totalItems: number;                     // Total items in database
}

interface NodeResult {
  itemKey: string;
  label: string;
  recipe: Recipe | undefined;
  supplyRate: number;        // Items/min produced
  demandRate: number;        // Items/min needed
  surplus: number;           // Supply - Demand
  ratio: number;             // Supply / Demand
  isBottleneck: boolean;     // ratio < 0.99
  isRawResource: boolean;    // Is raw material
  machines: number;
  overclock: number;
}
```

#### Simulation Algorithm

1. **Calculate Supply** - For each automated item, compute output based on recipe, machines, and overclock
2. **Calculate Demand** - For each automated item, sum up input requirements from all consumers
3. **Compute Surplus/Ratio** - Identify bottlenecks (supply < demand)
4. **Generate Suggestions** - Recommend adding machines or automating upstream items

#### Suggestion Types

| Type | Description |
|------|-------------|
| `add_machines` | Add more machines to increase output |
| `automate_upstream` | Automate an input that's currently manual |
| `increase_overclock` | Overclock instead of adding machines |

---

## Components

### Header.tsx

The top navigation bar containing:

- Project name (editable inline)
- Sync status indicator
- Quick sync button (Save/Fetch)
- "New changes available" button (when remote is newer)
- Export/Import dropdown
- Share button (copy URL)

**Key Features:**
- Conflict resolution dialog when save fails
- Pull warning dialog with "Don't show again" option
- Real-time sync status updates

### ItemGrid.tsx

Left sidebar displaying all items from the recipe database:

- Searchable item list
- Category filters (resources, ingots, parts, etc.)
- Drag-and-drop to factory floor
- Automation toggle per item
- Machine count and overclock controls

### FactoryFloor.tsx

Center canvas showing automated items:

- Drag items from sidebar to add
- Visual indicators for bottlenecks
- Production rate display
- Interactive item cards

### AiChat.tsx

Right sidebar AI assistant:

- Chat interface for factory questions
- Integration with production data
- Optimization suggestions

### SyncBar.tsx

Minimal sync status bar:

- Shows current sync status
- Save/Fetch buttons
- Undo button (appears after pull)
- Conflict handling with inline options

### SyncPanel.tsx

Full sync controls panel:

- Detailed sync status with timestamps
- Version information
- Manual refresh/save buttons
- Conflict resolution dialog

### SimulationPanel.tsx

Displays simulation results:

- Top bottlenecks with severity
- Optimization suggestions
- Raw material requirements
- Production statistics

---

## Hooks

### useRemoteUpdateChecker.ts

Custom hook for polling cloud updates.

```typescript
interface UseRemoteUpdateCheckerResult {
  hasRemoteUpdate: boolean;          // True if cloud is newer
  remoteVersion: number | null;       // Cloud version number
  checkNow: () => Promise<void>;      // Manual refresh
  hideWarning: boolean;               // User preference
  setHideWarning: (value: boolean) => void;
}
```

**Features:**

- **Configurable polling interval** - Via `VITE_POLL_INTERVAL_MS` env var (default 5000ms)
- **Page Visibility API** - Pauses polling when tab is hidden
- **localStorage persistence** - Remembers "don't show warning" preference
- **Automatic reset** - Clears update flag when user syncs

**Implementation:**

```typescript
useEffect(() => {
  const startPolling = () => {
    checkNow();
    intervalRef.current = window.setInterval(checkNow, POLL_INTERVAL_MS);
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      stopPolling();
    } else {
      startPolling();
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  // ...
}, [project?.project_id, checkNow]);
```

---

## Pages

### HomePage.tsx

Landing page with:

- Create new project form
- Join existing project by link/ID
- Feature showcase grid
- Branding and navigation

### ProjectPage.tsx

Main application view with three-column layout:

1. **Left Panel** - ItemGrid (collapsible)
2. **Center** - FactoryFloor
3. **Right Panel** - AiChat (collapsible)

Plus Header at top and BottomBar at bottom.

**Routing:**
- `/` - HomePage
- `/p/:projectId` - ProjectPage

---

## Recipe Data

### recipes.ts

Static database of all Satisfactory items and recipes.

#### ItemInfo Structure

```typescript
interface ItemInfo {
  key: string;       // Unique identifier (e.g., "iron_plate")
  label: string;     // Display name (e.g., "Iron Plate")
  icon: string;      // Icon filename (e.g., "iron_plate.webp")
  category: string;  // Category for filtering
  tier: number;      // Unlock tier (0 = raw resource)
}
```

#### Categories

| Category | Description |
|----------|-------------|
| `resource` | Raw materials (ore, water, oil) |
| `ingot` | Smelted metals |
| `part` | Basic manufactured parts |
| `intermediate` | Complex components |
| `fluid` | Liquids and gases |
| `fuel` | Energy sources |
| `nuclear` | Nuclear materials |
| `elevator` | Space elevator parts |
| `alien` | Tier 9 alien technology |

#### Recipe Structure

```typescript
interface Recipe {
  id: string;                    // Unique recipe ID
  label: string;                 // Display name
  machine: string;               // Machine type
  craft_time: number;            // Seconds per cycle
  outputs: { item: string; amount: number }[];
  inputs: { item: string; amount: number }[];
  is_alternate?: boolean;        // Alternate recipe flag
}
```

#### Machine Types

- `miner` - Miner Mk1/2/3
- `smelter` - Smelter
- `foundry` - Foundry
- `constructor` - Constructor
- `assembler` - Assembler
- `manufacturer` - Manufacturer
- `refinery` - Refinery
- `blender` - Blender
- `packager` - Packager
- `particle_accelerator` - Particle Accelerator
- `converter` - Converter
- `quantum_encoder` - Quantum Encoder

---

## Styling

The application uses Tailwind CSS with custom configuration.

### Theme Colors

| Color | CSS Variable | Usage |
|-------|--------------|-------|
| Primary | `--primary` | Orange accent, buttons |
| Accent | `--accent` | Pink/magenta secondary |
| Background | `--background` | Dark background |
| Foreground | `--foreground` | Text color |
| Border | `--border` | Subtle borders |
| Muted | `--muted` | Subdued backgrounds |

### Custom Classes

| Class | Description |
|-------|-------------|
| `glass` | Glassmorphism card style |
| `glass-strong` | Stronger glass effect |
| `glow-orange` | Orange glow effect |
| `hex-grid-bg` | Hexagon grid background |
| `text-glow-orange` | Glowing text effect |
| `neon-cyan` | Cyan neon color |
| `neon-green` | Green neon color |
| `ficsit-amber` | FICSIT brand amber |

### Animations

- Framer Motion for page transitions
- CSS animations for loading states
- Hover effects on interactive elements

---

## Environment Variables

### Frontend (.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_POLL_INTERVAL_MS` | Cloud update check interval in milliseconds | `5000` |

**Usage:**

```typescript
const POLL_INTERVAL_MS = parseInt(
  import.meta.env.VITE_POLL_INTERVAL_MS || "5000",
  10
);
```

---

## Running Locally

### Prerequisites

- Node.js 20+

### Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env (optional)
echo "VITE_POLL_INTERVAL_MS=5000" > .env

# Start development server
npm run dev
```

The server starts at `http://localhost:5173`.

### Build for Production

```bash
npm run build
```

Output is in the `dist/` directory.

### Docker Build

```bash
docker build -t satisfactory-tracker-frontend .
docker run -p 80:80 satisfactory-tracker-frontend
```

The nginx server proxies `/api/*` requests to the backend container.

---

## Dependencies

Key packages from `package.json`:

| Package | Purpose |
|---------|---------|
| `react` | UI framework |
| `react-router-dom` | Client-side routing |
| `zustand` | State management |
| `framer-motion` | Animations |
| `lucide-react` | Icons |
| `@radix-ui/*` | Headless UI components |
| `tailwindcss` | Utility-first CSS |
| `vite` | Build tool and dev server |
| `typescript` | Type checking |
