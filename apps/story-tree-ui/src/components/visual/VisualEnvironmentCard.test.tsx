import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { VisualEnvironmentSummary } from "@/lib/visualDesignDocument";
import { VisualEnvironmentCard } from "./VisualEnvironmentCard";

const baseEnvironment: VisualEnvironmentSummary = {
  id: "environment-1",
  name: "Enchanted Forest",
  overallDescription: "A mystical grove bathed in emerald light.",
  lighting: "Dappled sunlight through towering trees",
  colorTones: "Emerald, amber, and moonlit silver",
  keyElements: "Glowing flora, gentle mist",
  referenceImagePath: "/images/environments/forest.png",
  sceneletIds: ["scenelet-2"],
};

describe("VisualEnvironmentCard", () => {
  it("uses a 16 by 9 hero image without nested borders and adopts the shared hover state", () => {
    const markup = renderToStaticMarkup(
      <VisualEnvironmentCard environment={baseEnvironment} />,
    );

    expect(markup).toContain("hover:bg-surface");
    expect(markup).toContain("aspect-[16/9]");
    expect(markup).not.toContain(
      "relative w-full overflow-hidden rounded-3xl border border-border bg-page",
    );
  });
});
