import type { Edge, Node } from "@xyflow/react";
import type { HierarchyPointNode } from "d3-hierarchy";
import { calculateTreeLayout, buildHierarchy } from "./layoutUtils";
import type { StoryboardHierarchyNode } from "./layoutUtils";
import type {
  BranchingPointNodeData,
  SceneletNodeData,
  StoryTreeData,
  StoryboardBranchingPoint,
  StoryboardScenelet,
  ShotImage,
} from "./types";

const CANVAS_PADDING_X = 48;
const CANVAS_PADDING_Y = 48;
const EDGE_STYLE = {
  stroke: "rgba(148, 163, 184, 0.6)",
  strokeWidth: 1.6,
};

export function createReactFlowGraph(
  data: StoryTreeData,
  onShotClick?: (shot: ShotImage) => void
): {
  nodes: Node<SceneletNodeData | BranchingPointNodeData>[];
  edges: Edge[];
} {
  const hierarchyRoot = buildHierarchy(data);
  if (!hierarchyRoot) {
    return { nodes: [], edges: [] };
  }

  const layoutRoot = calculateTreeLayout(hierarchyRoot);
  return {
    nodes: mapToReactFlowNodes(layoutRoot, onShotClick),
    edges: mapToReactFlowEdges(layoutRoot),
  };
}

function mapToReactFlowNodes(
  layoutRoot: HierarchyPointNode<StoryboardHierarchyNode>,
  onShotClick?: (shot: ShotImage) => void
): Node<SceneletNodeData | BranchingPointNodeData>[] {
  const allNodes = layoutRoot.descendants();
  const minX = Math.min(...allNodes.map((node) => node.x));
  const minY = Math.min(...allNodes.map((node) => node.y));

  return allNodes.map((node) => {
    const x = node.x - minX + CANVAS_PADDING_X;
    const y = node.y - minY + CANVAS_PADDING_Y;

    if (node.data.type === "scenelet") {
      return createSceneletNode(node.data.scenelet, x, y, onShotClick);
    }

    return createBranchingPointNode(node.data.branchingPoint, x, y);
  });
}

function createSceneletNode(
  scenelet: StoryboardScenelet,
  x: number,
  y: number,
  onShotClick?: (shot: ShotImage) => void
): Node<SceneletNodeData> {
  return {
    id: scenelet.id,
    type: "scenelet",
    data: { type: "scenelet", scenelet, onShotClick },
    position: { x, y },
    draggable: false,
    selectable: true,
  };
}

function createBranchingPointNode(
  branchingPoint: StoryboardBranchingPoint,
  x: number,
  y: number
): Node<BranchingPointNodeData> {
  return {
    id: branchingPoint.id,
    type: "branching-point",
    data: { type: "branching-point", branchingPoint },
    position: { x, y },
    draggable: false,
    selectable: true,
  };
}

function mapToReactFlowEdges(
  layoutRoot: HierarchyPointNode<StoryboardHierarchyNode>
): Edge[] {
  const edges: Edge[] = [];

  for (const node of layoutRoot.descendants()) {
    for (const child of node.children ?? []) {
      edges.push({
        id: `${node.data.id}->${child.data.id}`,
        source: node.data.id,
        target: child.data.id,
        type: "smoothstep",
        animated: false,
        style: EDGE_STYLE,
      });
    }
  }

  return edges;
}
