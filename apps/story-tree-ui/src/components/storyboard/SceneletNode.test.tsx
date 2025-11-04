import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { Node, NodeProps } from "@xyflow/react";
import type { SceneletNodeData, StoryboardScenelet } from "./types";
import { SceneletNode } from "./SceneletNode";

const scenelet: StoryboardScenelet = {
  id: "scenelet-1",
  parentId: null,
  role: "root",
  description: "An establishing shot of the enchanted forest.",
  dialogue: [],
  shotSuggestions: [],
  shots: [],
  choiceLabel: null,
};

describe("SceneletNode", () => {
  it("uses the surface background instead of the page background", () => {
    const nodeProps: NodeProps<Node<SceneletNodeData>> = {
      id: scenelet.id,
      data: { type: "scenelet", scenelet },
      type: "scenelet",
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
      <SceneletNode {...nodeProps} />,
    );

    expect(markup).toContain("bg-surface");
    expect(markup).not.toContain("bg-page text-text");
  });
});
