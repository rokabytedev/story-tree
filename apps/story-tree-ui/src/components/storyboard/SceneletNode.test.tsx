import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { StoryboardScenelet } from "./types";
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
    const markup = renderToStaticMarkup(
      <SceneletNode
        {...({
          id: scenelet.id,
          data: { type: "scenelet", scenelet },
        } as any)}
      />,
    );

    expect(markup).toContain("bg-surface");
    expect(markup).not.toContain("bg-page text-text");
  });
});
