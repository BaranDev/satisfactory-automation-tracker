import { useCallback, useMemo, useRef } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  BackgroundVariant,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nanoid } from "nanoid";
import { Factory as FactoryIcon } from "lucide-react";
import { motion } from "framer-motion";

import { MachineNode, type MachineNodeData } from "./MachineNode";
import { MACHINES } from "@/data/machines";
import { RECIPES, ITEMS } from "@/data/recipes";
import { simulateFactory } from "@/lib/simulation";
import type { MachineInstance, MachineType, FactorySimulationResult } from "@/types/factory";
import { cn } from "@/lib/utils";

const nodeTypes = {
  machine: MachineNode,
};

interface FactoryCanvasProps {
  machines: MachineInstance[];
  onMachinesChange: (machines: MachineInstance[]) => void;
  selectedMachineId: string | null;
  onSelectMachine: (id: string | null) => void;
  simulation: FactorySimulationResult | null;
  onSimulationChange: (result: FactorySimulationResult) => void;
}

export default function FactoryCanvas({
  machines,
  onMachinesChange,
  selectedMachineId,
  onSelectMachine,
  simulation,
  onSimulationChange,
}: FactoryCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Convert machines to ReactFlow nodes
  const initialNodes: Node[] = useMemo(() =>
    machines.map(m => ({
      id: m.id,
      type: "machine",
      position: m.position,
      selected: m.id === selectedMachineId,
      data: {
        machineType: m.machineType,
        recipe: m.recipe,
        overclock: m.overclock,
        simulation: simulation?.nodes[m.id],
        onSelect: onSelectMachine,
      } satisfies MachineNodeData,
    })),
    [machines, selectedMachineId, simulation, onSelectMachine],
  );

  // Convert connections to ReactFlow edges
  const initialEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];
    for (const m of machines) {
      for (let i = 0; i < m.inputs.length; i++) {
        const conn = m.inputs[i];
        if (conn.connectedTo) {
          const itemLabel = conn.itemType ? (ITEMS[conn.itemType]?.label ?? conn.itemType) : "";
          edges.push({
            id: `${conn.connectedTo.machineId}-out${conn.connectedTo.slot}-${m.id}-in${i}`,
            source: conn.connectedTo.machineId,
            target: m.id,
            sourceHandle: `output-${conn.connectedTo.slot}`,
            targetHandle: `input-${i}`,
            label: itemLabel,
            labelStyle: { fontSize: 10, fill: "var(--muted-foreground)" },
            style: { strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
            animated: conn.actualRate > 0,
          });
        }
      }
    }
    return edges;
  }, [machines]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync nodes back when they're updated externally
  useMemo(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useMemo(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Handle new connections between machines
  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;

      const sourceSlot = parseInt(params.sourceHandle?.replace("output-", "") ?? "0");
      const targetSlot = parseInt(params.targetHandle?.replace("input-", "") ?? "0");

      // Find what item the source outputs at this slot
      const sourceMachine = machines.find(m => m.id === params.source);
      if (!sourceMachine?.recipe) return;
      const sourceRecipe = RECIPES.find(r => r.id === sourceMachine.recipe);
      const outputItem = sourceRecipe?.outputs[sourceSlot]?.item;

      // Update machines with new connection
      const updatedMachines = machines.map(m => {
        if (m.id === params.target) {
          const newInputs = [...m.inputs];
          // Ensure the slot array is large enough
          while (newInputs.length <= targetSlot) {
            newInputs.push({
              slot: newInputs.length,
              connectedTo: null,
              itemType: null,
              actualRate: 0,
              maxRate: 780,
            });
          }
          newInputs[targetSlot] = {
            ...newInputs[targetSlot],
            connectedTo: { machineId: params.source!, slot: sourceSlot },
            itemType: outputItem ?? null,
          };
          return { ...m, inputs: newInputs };
        }
        return m;
      });

      onMachinesChange(updatedMachines);

      // Re-run simulation
      const result = simulateFactory(updatedMachines);
      onSimulationChange(result);

      setEdges(eds => addEdge({
        ...params,
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
        style: { strokeWidth: 2 },
        animated: true,
      }, eds));
    },
    [machines, onMachinesChange, onSimulationChange, setEdges],
  );

  // Handle node position changes (drag)
  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);

      // Update machine positions when dragged
      const posChanges = changes.filter(c => c.type === "position" && "position" in c && c.position);
      if (posChanges.length > 0) {
        const updatedMachines = machines.map(m => {
          const change = posChanges.find(c => "id" in c && c.id === m.id);
          if (change && "position" in change && change.position) {
            return { ...m, position: change.position };
          }
          return m;
        });
        onMachinesChange(updatedMachines);
      }
    },
    [machines, onMachinesChange, onNodesChange],
  );

  // Handle edge deletion
  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      onEdgesChange(changes);

      const removals = changes.filter(c => c.type === "remove");
      if (removals.length > 0) {
        const removedIds = new Set(removals.map(r => r.id));
        // Find and disconnect the corresponding machine inputs
        const updatedMachines = machines.map(m => {
          const newInputs = m.inputs.map((inp, i) => {
            if (inp.connectedTo) {
              const edgeId = `${inp.connectedTo.machineId}-out${inp.connectedTo.slot}-${m.id}-in${i}`;
              if (removedIds.has(edgeId)) {
                return { ...inp, connectedTo: null, itemType: null, actualRate: 0 };
              }
            }
            return inp;
          });
          return { ...m, inputs: newInputs };
        });
        onMachinesChange(updatedMachines);
        const result = simulateFactory(updatedMachines);
        onSimulationChange(result);
      }
    },
    [machines, onMachinesChange, onSimulationChange, onEdgesChange],
  );

  // Handle drop from palette
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const machineType = e.dataTransfer.getData("application/machine-type") as MachineType;
      if (!machineType || !MACHINES[machineType]) return;

      const wrapper = reactFlowWrapper.current;
      if (!wrapper) return;

      const bounds = wrapper.getBoundingClientRect();
      const position = {
        x: e.clientX - bounds.left - 90,
        y: e.clientY - bounds.top - 30,
      };

      const machineInfo = MACHINES[machineType];
      const newMachine: MachineInstance = {
        id: nanoid(8),
        machineType,
        recipe: machineInfo.compatibleRecipes[0] ?? null,
        overclock: 1.0,
        position,
        inputs: Array.from({ length: machineInfo.inputSlots + machineInfo.fluidInputs }, (_, i) => ({
          slot: i,
          connectedTo: null,
          itemType: null,
          actualRate: 0,
          maxRate: 780,
        })),
        outputs: Array.from({ length: machineInfo.outputSlots + machineInfo.fluidOutputs }, (_, i) => ({
          slot: i,
          connectedTo: null,
          itemType: null,
          actualRate: 0,
          maxRate: 780,
        })),
      };

      const updatedMachines = [...machines, newMachine];
      onMachinesChange(updatedMachines);

      const result = simulateFactory(updatedMachines);
      onSimulationChange(result);
    },
    [machines, onMachinesChange, onSimulationChange],
  );

  if (machines.length === 0) {
    return <EmptyCanvasState />;
  }

  return (
    <div ref={reactFlowWrapper} className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          style: { strokeWidth: 2, stroke: "hsl(var(--primary) / 0.5)" },
          markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(var(--muted-foreground) / 0.15)" />
        <Controls className="!bg-card !border-border/50 !shadow-md [&>button]:!bg-card [&>button]:!border-border/30 [&>button]:!text-foreground [&>button:hover]:!bg-secondary" />
        <MiniMap
          className="!bg-card/80 !border-border/50"
          nodeColor={() => "hsl(var(--primary) / 0.5)"}
          maskColor="hsl(var(--background) / 0.8)"
        />
      </ReactFlow>
    </div>
  );
}

function EmptyCanvasState() {
  return (
    <div className="flex items-center justify-center h-full hex-grid-bg">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-md"
      >
        <div className="w-20 h-20 rounded-xl mx-auto mb-6 flex items-center justify-center bg-secondary/50">
          <FactoryIcon className="w-10 h-10 text-muted-foreground/50" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Build Your Factory
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Drag machines from the palette on the left onto the canvas. Connect
          outputs to inputs by dragging between the handles. The simulation will
          automatically calculate production rates, detect bottlenecks, and
          suggest optimizations.
        </p>
        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground/60">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary/50" />
            Drag to add
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-neon-green/50" />
            Connect machines
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-neon-red/50" />
            Auto-simulate
          </span>
        </div>
      </motion.div>
    </div>
  );
}
