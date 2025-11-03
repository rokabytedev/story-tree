import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { VisualCharacterSummary } from "@/lib/visualDesignDocument";
import { VisualCharacterCard } from "./VisualCharacterCard";

const baseCharacter: VisualCharacterSummary = {
  id: "character-1",
  name: "Ada",
  role: "Protagonist",
  description: "Brave explorer of fantastical realms.",
  attire: "Explorer gear",
  physique: "Athletic",
  facialFeatures: "Determined gaze",
  imagePath: "/images/characters/ada.png",
  sceneletIds: ["scenelet-1"],
};

describe("VisualCharacterCard", () => {
  it("uses a square hero image without extra borders and adds the voice card hover treatment", () => {
    const markup = renderToStaticMarkup(
      <VisualCharacterCard character={baseCharacter} />,
    );

    expect(markup).toContain("hover:bg-surface");
    expect(markup).toContain("aspect-square");
    expect(markup).not.toContain(
      "relative w-full overflow-hidden rounded-3xl border border-border bg-page",
    );
  });
});
