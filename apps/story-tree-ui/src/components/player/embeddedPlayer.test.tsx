import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import type { StoryBundle } from "../../../../../agent-backend/src/bundle/types.js";
import { EmbeddedPlayer } from "./embeddedPlayer.js";

function createBranchingBundle(): StoryBundle {
  const exportedAt = new Date().toISOString();
  return {
    metadata: {
      storyId: "story-123",
      title: "Branching Adventure",
      exportedAt,
    },
    rootSceneletId: "scenelet-root",
    scenelets: [
      {
        id: "scenelet-root",
        description: "Starting point",
        shots: [
          {
            shotIndex: 0,
            imagePath: "/images/root-0.png",
            audioPath: "/audio/root-0.wav",
          },
        ],
        branchAudioPath: "/audio/branches/scenelet-root.wav",
        next: {
          type: "branch",
          choicePrompt: "Choose a path",
          choices: [
            { label: "Path A", sceneletId: "scenelet-a" },
            { label: "Path B", sceneletId: "scenelet-b" },
          ],
        },
      },
      {
        id: "scenelet-a",
        description: "First branch",
        shots: [
          {
            shotIndex: 0,
            imagePath: "/images/a-0.png",
            audioPath: "/audio/a-0.wav",
          },
        ],
        branchAudioPath: null,
        next: { type: "terminal" },
      },
      {
        id: "scenelet-b",
        description: "Second branch",
        shots: [
          {
            shotIndex: 0,
            imagePath: "/images/b-0.png",
            audioPath: null,
          },
        ],
        branchAudioPath: null,
        next: { type: "terminal" },
      },
    ],
    music: {
      cues: [
        {
          cueName: "intro",
          sceneletIds: ["scenelet-root"],
          audioPath: "/music/intro.mp3",
        },
      ],
      sceneletCueMap: {
        "scenelet-root": "intro",
      },
    },
  };
}

function useMediaSpies() {
  const playCalls: HTMLMediaElement[] = [];
  const pauseCalls: HTMLMediaElement[] = [];

  const playSpy = vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(function () {
    playCalls.push(this as HTMLMediaElement);
    return Promise.resolve();
  });

  const pauseSpy = vi
    .spyOn(window.HTMLMediaElement.prototype, "pause")
    .mockImplementation(function () {
      pauseCalls.push(this as HTMLMediaElement);
      return undefined;
    });

  return {
    playCalls,
    pauseCalls,
    restore() {
      playSpy.mockRestore();
      pauseSpy.mockRestore();
    },
  };
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("EmbeddedPlayer branch narration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("plays branch audio on the shot element after the grace period without interrupting music", () => {
    const media = useMediaSpies();
    const bundle = createBranchingBundle();
    bundle.scenelets[0].shots[0].audioPath = null;
    render(<EmbeddedPlayer bundle={bundle} />);

    const [playButton] = screen.getAllByRole("button", { name: /play story/i });
    fireEvent.click(playButton);

    advance(500); // shot ramp-up
    advance(3000); // no audio hold (missing shot audio)
    advance(500); // ramp-down into branch
    const pauseCountBeforeBranch = media.pauseCalls.length;
    advance(500); // branch narration grace period

    const shotAudioPlays = media.playCalls.filter(
      (element) => !(element as HTMLMediaElement).dataset?.cueName
    ) as HTMLAudioElement[];
    expect(shotAudioPlays.length).toBeGreaterThan(0);
    const shotAudio = shotAudioPlays[shotAudioPlays.length - 1];
    expect(media.playCalls[media.playCalls.length - 1]).toBe(shotAudio);
    expect(shotAudio!.src).toContain("/audio/branches/scenelet-root.wav");
    expect(screen.getByText("Choose a path")).toBeTruthy();

    const pausedMusic = media.pauseCalls
      .slice(pauseCountBeforeBranch)
      .filter((element) => element.dataset?.cueName);
    expect(pausedMusic).toHaveLength(0);

    const choiceButton = screen.getByRole("button", { name: "Path A" });
    fireEvent.click(choiceButton);

    expect(shotAudio!.getAttribute("src")).toBeNull();

    advance(500); // ramp-up for next scenelet shot

    expect(shotAudio!.src).toContain("/audio/a-0.wav");
    expect(media.playCalls[media.playCalls.length - 1]).toBe(shotAudio);
  });
});
