import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}), { virtual: true });
import { mapStoryTreeEntriesToStoryboardData } from "./stories";
import type { StoryTreeEntry } from "../../../../../agent-backend/src/story-storage/types";

describe("mapStoryTreeEntriesToStoryboardData", () => {
  it("maps scenelet and branching point entries into storyboard data", () => {
    const entries: StoryTreeEntry[] = [
      {
        kind: "scenelet",
        data: {
          id: "scenelet-1",
          parentId: null,
          role: "root",
          description: "Opening scene that sets the tone.",
          dialogue: [
            { character: "Narrator", line: "Welcome to the story." },
            { character: "Hero", line: "I'm ready." },
          ],
          shotSuggestions: ["Wide establishing shot", "Close-up of hero"],
          choiceLabel: null,
        },
      },
      {
        kind: "branching-point",
        data: {
          id: "branching-point-1",
          sourceSceneletId: "scenelet-1",
          choicePrompt: "What should the hero do?",
          choices: [
            { label: "Investigate the noise", leadsTo: "scenelet-2" },
            { label: "Ignore and continue", leadsTo: "scenelet-3" },
          ],
        },
      },
      {
        kind: "scenelet",
        data: {
          id: "scenelet-2",
          parentId: "scenelet-1",
          role: "branch",
          description: "The hero investigates the eerie sound.",
          dialogue: [{ character: "Hero", line: "Let's find out." }],
          shotSuggestions: [],
          choiceLabel: "Investigate the noise",
        },
      },
    ];

    const result = mapStoryTreeEntriesToStoryboardData(entries);

    expect(result.scenelets).toHaveLength(2);
    expect(result.branchingPoints).toHaveLength(1);

    expect(result.scenelets[0]).toMatchObject({
      id: "scenelet-1",
      parentId: null,
      role: "root",
      description: "Opening scene that sets the tone.",
      dialogue: [
        { character: "Narrator", line: "Welcome to the story." },
        { character: "Hero", line: "I'm ready." },
      ],
      shotSuggestions: ["Wide establishing shot", "Close-up of hero"],
      choiceLabel: null,
    });

    expect(result.scenelets[1]).toMatchObject({
      id: "scenelet-2",
      parentId: "scenelet-1",
      role: "branch",
      choiceLabel: "Investigate the noise",
    });

    expect(result.branchingPoints[0]).toMatchObject({
      id: "branching-point-1",
      sourceSceneletId: "scenelet-1",
      choicePrompt: "What should the hero do?",
      choices: [
        { label: "Investigate the noise", leadsTo: "scenelet-2" },
        { label: "Ignore and continue", leadsTo: "scenelet-3" },
      ],
    });
  });

  it("returns empty arrays when no entries are provided", () => {
    const result = mapStoryTreeEntriesToStoryboardData([]);

    expect(result.scenelets).toEqual([]);
    expect(result.branchingPoints).toEqual([]);
  });
});
