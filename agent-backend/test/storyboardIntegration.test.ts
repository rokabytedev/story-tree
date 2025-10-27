import { describe, expect, it, vi } from 'vitest';

import { loadStoryTreeSnapshot } from '../src/story-storage/storyTreeSnapshot.js';
import type { StoryTreeSceneletSource } from '../src/story-storage/types.js';
import { runStoryboardTask } from '../src/storyboard/storyboardTask.js';
import { StoryboardTaskError } from '../src/storyboard/errors.js';
import type { AgentWorkflowStoriesRepository, AgentWorkflowStoryRecord } from '../src/workflow/types.js';

function createStoryRecord(): AgentWorkflowStoryRecord {
  return {
    id: 'story-1',
    displayName: 'Integration Story',
    initialPrompt: 'An integration test tale',
    storyConstitution: {
      proposedStoryTitle: 'Integration Story',
      storyConstitutionMarkdown: '# Constitution',
    },
    visualDesignDocument: {
      character_designs: [{ character_name: 'Rhea' }],
    },
    storyboardBreakdown: null,
  };
}

function createStoriesRepository(story: AgentWorkflowStoryRecord): AgentWorkflowStoriesRepository & {
  updates: Array<{ storyId: string; patch: unknown }>;
} {
  const updates: Array<{ storyId: string; patch: unknown }> = [];

  return {
    updates,
    async createStory() {
      throw new Error('Not implemented in integration tests.');
    },
    async updateStoryArtifacts(storyId, patch) {
      updates.push({ storyId, patch });
      if ((patch as { storyboardBreakdown?: unknown }).storyboardBreakdown !== undefined) {
        story.storyboardBreakdown = (patch as { storyboardBreakdown?: unknown }).storyboardBreakdown ?? null;
      }
      return story;
    },
    async getStoryById(storyId) {
      return storyId === story.id ? story : null;
    },
  } satisfies AgentWorkflowStoriesRepository & { updates: Array<{ storyId: string; patch: unknown }> };
}

function createStoryTreeLoader(scenelets: StoryTreeSceneletSource[]) {
  return (storyId: string) =>
    loadStoryTreeSnapshot(storyId, {
      sceneletsRepository: {
        async listSceneletsByStory(requestedStoryId: string) {
          if (requestedStoryId !== storyId) {
            return [] as StoryTreeSceneletSource[];
          }
          return scenelets;
        },
      },
    });
}

describe('storyboard task integration', () => {
  it('generates and persists storyboard using assembled story tree', async () => {
    const story = createStoryRecord();
    const repository = createStoriesRepository(story);
    const scenelets: StoryTreeSceneletSource[] = [
      {
        id: 'scenelet-root',
        storyId: 'story-1',
        parentId: null,
        choiceLabelFromParent: null,
        choicePrompt: null,
        content: {
          description: 'Opening scene',
          dialogue: [
            { character: 'Rhea', line: 'Hello there.' },
          ],
          shot_suggestions: [],
        },
        isBranchPoint: false,
        isTerminalNode: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    ];
    const storyTreeLoader = createStoryTreeLoader(scenelets);
    const geminiClient = {
      generateJson: vi.fn(async () =>
        JSON.stringify({
          storyboard_breakdown: [
            {
              scenelet_id: 'scenelet-1',
              shot_index: 1,
              framing_and_angle: 'Medium',
              composition_and_content: 'Frame description',
              character_action_and_emotion: 'Action description',
              dialogue: [{ character: 'Rhea', line: 'Hello there.' }],
              camera_dynamics: 'Static',
              lighting_and_atmosphere: 'Bright',
            },
          ],
        })
      ),
    };

    const result = await runStoryboardTask('story-1', {
      storiesRepository: repository,
      storyTreeLoader,
      promptLoader: async () => 'System prompt',
      geminiClient: geminiClient as any,
    });

    expect(result.storyboardBreakdown).toEqual({
      storyboard_breakdown: [
        expect.objectContaining({ scenelet_id: 'scenelet-1' }),
      ],
    });
    expect(repository.updates[0]).toMatchObject({
      storyId: 'story-1',
      patch: {
        storyboardBreakdown: {
          storyboard_breakdown: expect.any(Array),
        },
      },
    });
    expect(story.storyboardBreakdown).not.toBeNull();
    expect(geminiClient.generateJson).toHaveBeenCalled();
  });

  it('throws when storyboard already persisted', async () => {
    const story = createStoryRecord();
    story.storyboardBreakdown = { storyboard_breakdown: [] };
    const repository = createStoriesRepository(story);
    const storyTreeLoader = createStoryTreeLoader([]);

    await expect(
      runStoryboardTask('story-1', {
        storiesRepository: repository,
        storyTreeLoader,
        promptLoader: async () => 'System prompt',
        geminiClient: { generateJson: vi.fn() } as any,
      })
    ).rejects.toBeInstanceOf(StoryboardTaskError);
  });
});
