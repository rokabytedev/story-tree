'use client';

import { useMemo } from "react";
import { Background, Controls, Panel, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { BranchingPointNode } from "./BranchingPointNode";
import { SceneletNode } from "./SceneletNode";
import { createReactFlowGraph } from "./dataTransformers";
import type { BranchingPointNodeData, SceneletNodeData, StoryTreeData } from "./types";

const nodeTypes = {
  scenelet: SceneletNode,
  "branching-point": BranchingPointNode,
};

export interface StoryboardCanvasProps {
  data: StoryTreeData;
}

export function StoryboardCanvas({ data }: StoryboardCanvasProps) {
  const graph = useMemo(() => createReactFlowGraph(data), [data]);

  if (graph.nodes.length === 0) {
    return (
      <div className="flex min-h-[480px] items-center justify-center rounded-3xl border border-dashed border-border bg-surface-muted/40">
        <p className="text-sm text-text-muted">Storyboard data is not available for this story.</p>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-220px)] min-h-[640px] overflow-hidden rounded-3xl border border-border bg-surface shadow-inner">
      <ReactFlow<SceneletNodeData | BranchingPointNodeData>
        nodes={graph.nodes}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        minZoom={0.1}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: 0.2, minZoom: 0.4 }}
        panOnDrag
        panOnScroll
        zoomOnScroll
        nodeOrigin={[0.5, 0]}
      >
        <Background
          className="!bg-surface"
          color="rgba(148, 163, 184, 0.25)"
          gap={32}
          size={2}
        />
        <Controls
          showInteractive={false}
          position="top-left"
          className="[&_button]:!bg-surface [&_button]:!border-border"
        />
        <Panel position="top-right">
          <div className="rounded-full bg-surface-muted/80 px-3 py-1 text-xs text-text-muted">
            Pinch to zoom • Drag to move
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
