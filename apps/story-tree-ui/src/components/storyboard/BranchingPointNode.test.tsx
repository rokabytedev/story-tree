import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { Node, NodeProps } from "@xyflow/react";
import type { BranchingPointNodeData, StoryboardBranchingPoint } from "./types";
import { BranchingPointNode } from "./BranchingPointNode";

const branchingPoint: StoryboardBranchingPoint = {
  id: "branch-1",
  sourceSceneletId: "scenelet-1",
  choicePrompt: "Which path should the hero take?",
  choices: [
    { label: "Follow the glowing lights", leadsTo: "scenelet-2" },
    { label: "Investigate the rustling bushes", leadsTo: "scenelet-3" },
  ],
};

describe("BranchingPointNode", () => {
  it("switches to the surface background color for cards", () => {
    const nodeProps: NodeProps<Node<BranchingPointNodeData>> = {
      id: branchingPoint.id,
      data: { type: "branching-point", branchingPoint },
      type: "branching-point",
      dragging: false,
      draggable: false,
      selectable: true,
      deletable: false,
      selected: false,
      zIndex: 0,
      isConnectable: false,
      positionAbsoluteX: 0,
      positionAbsoluteY: 0,
    };

    const markup = renderToStaticMarkup(
      <BranchingPointNode {...nodeProps} />,
    );

    expect(markup).toContain("bg-surface");
    expect(markup).not.toContain("bg-page p-4");
  });
});
