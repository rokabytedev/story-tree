import { describe, expect, it } from "vitest";
import { buildGeneratedMusicPath } from "./audioPaths";

describe("buildGeneratedMusicPath", () => {
  it("uses the exact cue name when constructing the music asset path", () => {
    const storyId = " 8f87d2c0-e9fd-442d-aff2-a63a70036ee1 ";
    const cueName = "The Micro-Explorer";

    const result = buildGeneratedMusicPath(storyId, cueName);

    expect(result).toBe("/generated/8f87d2c0-e9fd-442d-aff2-a63a70036ee1/music/The Micro-Explorer.m4a");
  });
});
