import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { StoryboardBranchingPoint } from "./types";
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
    const markup = renderToStaticMarkup(
      <BranchingPointNode
        {...({
          id: branchingPoint.id,
          data: { type: "branching-point", branchingPoint },
        } as any)}
      />,
    );

    expect(markup).toContain("bg-surface");
    expect(markup).not.toContain("bg-page p-4");
  });
});
