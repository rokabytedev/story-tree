import { describe, expect, it } from "vitest";
import { createReactFlowGraph } from "./dataTransformers";
import type { StoryTreeData } from "./types";

describe("dataTransformers", () => {
  it("maps hierarchy to ReactFlow nodes and edges", () => {
    const data: StoryTreeData = {
      scenelets: [
        {
          id: "scenelet-1",
          parentId: null,
          role: "root",
          description: "Root scene",
          dialogue: [],
          shotSuggestions: [],
          choiceLabel: null,
        },
        {
          id: "scenelet-2",
          parentId: "scenelet-1",
          role: "branch",
          description: "Left branch",
          dialogue: [],
          shotSuggestions: [],
          choiceLabel: "Left",
        },
        {
          id: "scenelet-3",
          parentId: "scenelet-1",
          role: "branch",
          description: "Right branch",
          dialogue: [],
          shotSuggestions: [],
          choiceLabel: "Right",
        },
      ],
      branchingPoints: [
        {
          id: "branching-point-1",
          sourceSceneletId: "scenelet-1",
          choicePrompt: "Choose a path",
          choices: [
            { label: "Left", leadsTo: "scenelet-2" },
            { label: "Right", leadsTo: "scenelet-3" },
          ],
        },
      ],
    };

    const graph = createReactFlowGraph(data);

    expect(graph.nodes).toHaveLength(4);
    expect(graph.edges).toHaveLength(3);

    const edgeIds = graph.edges.map((edge) => edge.id);
    expect(edgeIds).toContain("scenelet-1->branching-point-1");
    expect(edgeIds).toContain("branching-point-1->scenelet-2");
    expect(edgeIds).toContain("branching-point-1->scenelet-3");

    for (const node of graph.nodes) {
      expect(node.position.x).toBeGreaterThanOrEqual(0);
      expect(node.position.y).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns empty graph when hierarchy cannot be built", () => {
    const graph = createReactFlowGraph({ scenelets: [], branchingPoints: [] });

    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
  });
});
