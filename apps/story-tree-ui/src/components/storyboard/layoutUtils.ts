import { hierarchy, tree, type HierarchyPointNode } from "d3-hierarchy";
import type {
  StoryTreeData,
  StoryboardBranchingPoint,
  StoryboardScenelet,
} from "./types";

export const NODE_WIDTH = 640;
export const HORIZONTAL_GAP = 0;
export const VERTICAL_GAP = 500;

export type StoryboardHierarchyNode =
  | {
      id: string;
      type: "scenelet";
      scenelet: StoryboardScenelet;
      children: StoryboardHierarchyNode[];
    }
  | {
      id: string;
      type: "branching-point";
      branchingPoint: StoryboardBranchingPoint;
      children: StoryboardHierarchyNode[];
    };

interface BuildHierarchyContext {
  sceneletsById: Map<string, StoryboardScenelet>;
  childrenByParentId: Map<string, StoryboardScenelet[]>;
  branchingBySceneletId: Map<string, StoryboardBranchingPoint>;
  visitedScenelets: Set<string>;
}

export function buildHierarchy(data: StoryTreeData): StoryboardHierarchyNode | null {
  if (!data.scenelets.length) {
    return null;
  }

  const sceneletsById = new Map<string, StoryboardScenelet>();
  const childrenByParentId = new Map<string, StoryboardScenelet[]>();

  for (const scenelet of data.scenelets) {
    sceneletsById.set(scenelet.id, scenelet);
    if (scenelet.parentId) {
      const list = childrenByParentId.get(scenelet.parentId);
      if (list) {
        list.push(scenelet);
      } else {
        childrenByParentId.set(scenelet.parentId, [scenelet]);
      }
    }
  }

  const branchingBySceneletId = new Map<string, StoryboardBranchingPoint>();
  for (const branching of data.branchingPoints) {
    branchingBySceneletId.set(branching.sourceSceneletId, branching);
  }

  const rootScenelet = data.scenelets.find((scenelet) => scenelet.parentId === null);
  if (!rootScenelet) {
    return null;
  }

  const context: BuildHierarchyContext = {
    sceneletsById,
    childrenByParentId,
    branchingBySceneletId,
    visitedScenelets: new Set<string>(),
  };

  return buildSceneletNode(rootScenelet, context);
}

export function calculateTreeLayout(
  hierarchyRoot: StoryboardHierarchyNode
): HierarchyPointNode<StoryboardHierarchyNode> {
  return tree<StoryboardHierarchyNode>()
    .nodeSize([NODE_WIDTH + HORIZONTAL_GAP, VERTICAL_GAP])
    .separation((left, right) => {
      const sameParent = left.parent?.data.id === right.parent?.data.id;
      return sameParent ? 1.2 : 2;
    })(hierarchy(hierarchyRoot, (node) => node.children));
}

function buildSceneletNode(
  scenelet: StoryboardScenelet,
  context: BuildHierarchyContext
): StoryboardHierarchyNode {
  if (context.visitedScenelets.has(scenelet.id)) {
    return {
      id: scenelet.id,
      type: "scenelet",
      scenelet,
      children: [],
    };
  }

  context.visitedScenelets.add(scenelet.id);

  const children: StoryboardHierarchyNode[] = [];
  const branchingPoint = context.branchingBySceneletId.get(scenelet.id) ?? null;

  if (branchingPoint) {
    const branchingNode = buildBranchingPointNode(branchingPoint, context);
    if (branchingNode.children.length > 0) {
      children.push(branchingNode);
    }
  }

  const branchChildIds = new Set<string>(
    branchingPoint ? branchingPoint.choices.map((choice) => choice.leadsTo) : []
  );

  const linearChildren = context.childrenByParentId.get(scenelet.id) ?? [];
  for (const child of linearChildren) {
    if (branchChildIds.has(child.id)) {
      continue;
    }
    children.push(buildSceneletNode(child, context));
  }

  return {
    id: scenelet.id,
    type: "scenelet",
    scenelet,
    children,
  };
}

function buildBranchingPointNode(
  branchingPoint: StoryboardBranchingPoint,
  context: BuildHierarchyContext
): StoryboardHierarchyNode {
  const children: StoryboardHierarchyNode[] = [];

  for (const choice of branchingPoint.choices) {
    const childScenelet = context.sceneletsById.get(choice.leadsTo);
    if (!childScenelet) {
      continue;
    }
    children.push(buildSceneletNode(childScenelet, context));
  }

  return {
    id: branchingPoint.id,
    type: "branching-point",
    branchingPoint,
    children,
  };
}
