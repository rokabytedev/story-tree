import { describe, expect, it } from "vitest";
import { buildHierarchy, calculateTreeLayout } from "./layoutUtils";
import type { StoryTreeData } from "./types";

describe("layoutUtils", () => {
  it("buildHierarchy constructs scenelet and branching nodes", () => {
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

    const hierarchyRoot = buildHierarchy(data);

    expect(hierarchyRoot?.type).toBe("scenelet");
    expect(hierarchyRoot?.children).toHaveLength(1);
    expect(hierarchyRoot?.children[0]?.type).toBe("branching-point");
    expect(hierarchyRoot?.children[0]?.children).toHaveLength(2);
  });

  it("calculateTreeLayout positions children below parents", () => {
    const data: StoryTreeData = {
      scenelets: [
        {
          id: "scenelet-1",
          parentId: null,
          role: "root",
          description: "",
          dialogue: [],
          shotSuggestions: [],
          choiceLabel: null,
        },
        {
          id: "scenelet-2",
          parentId: "scenelet-1",
          role: "linear",
          description: "",
          dialogue: [],
          shotSuggestions: [],
          choiceLabel: null,
        },
      ],
      branchingPoints: [],
    };

    const hierarchyRoot = buildHierarchy(data);
    const layoutRoot = hierarchyRoot ? calculateTreeLayout(hierarchyRoot) : null;

    expect(layoutRoot?.data.id).toBe("scenelet-1");
    expect(layoutRoot?.children?.[0]?.data.id).toBe("scenelet-2");
    expect(layoutRoot?.children?.[0]?.y).toBeGreaterThan(layoutRoot?.y ?? 0);
  });

  it("returns null hierarchy when there are no scenelets", () => {
    expect(buildHierarchy({ scenelets: [], branchingPoints: [] })).toBeNull();
  });
});
