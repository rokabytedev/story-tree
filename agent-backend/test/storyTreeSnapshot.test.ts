import { describe, expect, it } from 'vitest';

import {
  assembleStoryTreeSnapshot,
  loadStoryTreeSnapshot,
} from '../src/story-storage/storyTreeSnapshot.js';
import { StoryTreeAssemblyError } from '../src/story-storage/errors.js';
import type { StoryTreeSceneletSource } from '../src/story-storage/types.js';

let sceneletCounter = 0;

function resetSceneletCounter(): void {
  sceneletCounter = 0;
}

function makeScenelet(overrides: Partial<StoryTreeSceneletSource> = {}): StoryTreeSceneletSource {
  const index = sceneletCounter++;
  return {
    id: overrides.id ?? `scenelet-${index}`,
    parentId: overrides.parentId ?? null,
    choiceLabelFromParent: overrides.choiceLabelFromParent ?? null,
    choicePrompt: overrides.choicePrompt ?? null,
    content:
      overrides.content ?? {
        description: `Scenelet ${index}`,
        dialogue: [],
        shot_suggestions: [],
      },
    isBranchPoint: overrides.isBranchPoint ?? false,
    isTerminalNode: overrides.isTerminalNode ?? false,
    createdAt: overrides.createdAt ?? timestamp(1 + index),
  } satisfies StoryTreeSceneletSource;
}

function timestamp(day: number): string {
  const date = new Date(`2025-01-${String(day).padStart(2, '0')}T00:00:00.000Z`);
  return date.toISOString();
}

describe('assembleStoryTreeSnapshot', () => {
  it('builds a linear story snapshot with deterministic yaml', () => {
    resetSceneletCounter();

    const root = makeScenelet({
      id: 'root',
      content: {
        description: 'Opening scene',
        dialogue: [],
        shot_suggestions: ['Wide shot of the city skyline.'],
      },
    });
    const middle = makeScenelet({
      id: 'middle',
      parentId: 'root',
      content: {
        description: 'Second scene',
        dialogue: [],
        shot_suggestions: [],
      },
    });
    const ending = makeScenelet({
      id: 'ending',
      parentId: 'middle',
      isTerminalNode: true,
      content: {
        description: 'Final scene',
        dialogue: [],
        shot_suggestions: [],
      },
    });

    const snapshot = assembleStoryTreeSnapshot([root, middle, ending]);

    expect(snapshot.entries.map((entry) => entry.data.id)).toEqual([
      'scenelet-1',
      'scenelet-2',
      'scenelet-3',
    ]);

    expect(snapshot.yaml).toBe(
      `- scenelet-1:\n  role: root\n  description: "Opening scene"\n  dialogue: []\n  shot_suggestions:\n    - "Wide shot of the city skyline."\n- scenelet-2:\n  description: "Second scene"\n  dialogue: []\n  shot_suggestions: []\n- scenelet-3:\n  role: terminal\n  description: "Final scene"\n  dialogue: []\n  shot_suggestions: []`
    );
  });

  it('builds a branching snapshot in depth-first order', () => {
    resetSceneletCounter();

    const root = makeScenelet({
      id: 'root',
      content: { description: 'Root', dialogue: [], shot_suggestions: [] },
    });
    const setup = makeScenelet({
      id: 'setup',
      parentId: 'root',
      isBranchPoint: true,
      choicePrompt: 'What should happen next?',
      content: { description: 'Setup', dialogue: [], shot_suggestions: [] },
      createdAt: timestamp(5),
    });
    const branchAIntro = makeScenelet({
      id: 'branch-a-intro',
      parentId: 'setup',
      choiceLabelFromParent: 'Investigate the cave',
      content: {
        description: 'Branch A intro',
        dialogue: [],
        shot_suggestions: [],
      },
      createdAt: timestamp(7),
    });
    const branchAFollowup = makeScenelet({
      id: 'branch-a-follow',
      parentId: 'branch-a-intro',
      content: {
        description: 'Branch A follow-up',
        dialogue: [],
        shot_suggestions: [],
      },
      createdAt: timestamp(8),
    });
    const branchBEnding = makeScenelet({
      id: 'branch-b-ending',
      parentId: 'setup',
      choiceLabelFromParent: 'Return to shore',
      isTerminalNode: true,
      content: {
        description: 'Branch B ending',
        dialogue: [],
        shot_suggestions: [],
      },
      createdAt: timestamp(6),
    });

    const snapshot = assembleStoryTreeSnapshot([
      root,
      setup,
      branchAIntro,
      branchAFollowup,
      branchBEnding,
    ]);

    expect(snapshot.entries.map((entry) => entry.kind)).toEqual([
      'scenelet',
      'scenelet',
      'branching-point',
      'scenelet',
      'scenelet',
      'scenelet',
    ]);

    expect(snapshot.yaml).toBe(
      `- scenelet-1:\n  role: root\n  description: "Root"\n  dialogue: []\n  shot_suggestions: []\n- scenelet-2:\n  description: "Setup"\n  dialogue: []\n  shot_suggestions: []\n- branching-point-1:\n  choice_prompt: "What should happen next?"\n  choices:\n    - label: "Investigate the cave"\n      leads_to: scenelet-3\n    - label: "Return to shore"\n      leads_to: scenelet-5\n- scenelet-3:\n  role: branch\n  choice_label: "Investigate the cave"\n  description: "Branch A intro"\n  dialogue: []\n  shot_suggestions: []\n- scenelet-4:\n  description: "Branch A follow-up"\n  dialogue: []\n  shot_suggestions: []\n- scenelet-5:\n  role: terminal\n  choice_label: "Return to shore"\n  description: "Branch B ending"\n  dialogue: []\n  shot_suggestions: []`
    );
  });

  it('throws when tree is missing a root scenelet', () => {
    resetSceneletCounter();
    const orphan = makeScenelet({
      id: 'orphan',
      parentId: 'missing',
    });

    expect(() => assembleStoryTreeSnapshot([orphan])).toThrow(StoryTreeAssemblyError);
  });

  it('throws when multiple roots exist', () => {
    resetSceneletCounter();
    const rootA = makeScenelet({ id: 'root-a', parentId: null });
    const rootB = makeScenelet({ id: 'root-b', parentId: null });

    expect(() => assembleStoryTreeSnapshot([rootA, rootB])).toThrow(StoryTreeAssemblyError);
  });

  it('throws when a branch point child is missing a choice label', () => {
    resetSceneletCounter();
    const root = makeScenelet({
      id: 'root',
      isBranchPoint: true,
      choicePrompt: 'Choose wisely',
    });
    const child = makeScenelet({
      id: 'child',
      parentId: 'root',
      choiceLabelFromParent: null,
    });

    expect(() => assembleStoryTreeSnapshot([root, child])).toThrow(StoryTreeAssemblyError);
  });

  it('throws when a branch point is missing a prompt', () => {
    resetSceneletCounter();
    const root = makeScenelet({
      id: 'root',
      isBranchPoint: true,
      choicePrompt: null,
    });
    const child = makeScenelet({
      id: 'child',
      parentId: 'root',
      choiceLabelFromParent: 'Option A',
    });

    expect(() => assembleStoryTreeSnapshot([root, child])).toThrow(StoryTreeAssemblyError);
  });
});

describe('loadStoryTreeSnapshot', () => {
  it('fetches scenelets using repository and assembles snapshot', async () => {
    resetSceneletCounter();
    const root = makeScenelet({ id: 'root' });
    const child = makeScenelet({ id: 'child', parentId: 'root', isTerminalNode: true });

    const requests: string[] = [];
    const snapshot = await loadStoryTreeSnapshot('  story-123  ', {
      sceneletsRepository: {
        async listSceneletsByStory(storyId) {
          requests.push(storyId);
          return [root, child];
        },
      },
    });

    expect(requests).toEqual(['story-123']);
    expect(snapshot.entries.length).toBe(2);
    expect(snapshot.entries[0]?.data.id).toBe('scenelet-1');
  });

  it('throws when story id is blank', async () => {
    await expect(
      loadStoryTreeSnapshot('   ', {
        sceneletsRepository: {
          async listSceneletsByStory() {
            return [];
          },
        },
      })
    ).rejects.toBeInstanceOf(StoryTreeAssemblyError);
  });
});
