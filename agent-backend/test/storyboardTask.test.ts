import { describe, expect, it, vi } from 'vitest';

import { StoryTreeAssemblyError } from '../src/story-storage/errors.js';
import type { StoryTreeSnapshot } from '../src/story-storage/types.js';
import { runStoryboardTask } from '../src/storyboard/storyboardTask.js';
import { StoryboardTaskError } from '../src/storyboard/errors.js';
import type { AgentWorkflowStoriesRepository, AgentWorkflowStoryRecord } from '../src/workflow/types.js';

function createStory(): AgentWorkflowStoryRecord {
  return {
    id: 'story-1',
    displayName: 'Stub Story',
    initialPrompt: 'An unforgettable journey',
    storyConstitution: {
      proposedStoryTitle: 'Stub Story',
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
      throw new Error('Not implemented');
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

const SNAPSHOT: StoryTreeSnapshot = {
  entries: [
    {
      kind: 'scenelet',
      data: {
        id: 'scenelet-1',
        parentId: null,
        role: 'root',
        description: 'Intro',
        dialogue: [
          { character: 'Rhea', line: 'Hello there.' },
        ],
        shotSuggestions: [],
      },
    },
  ],
  yaml: '- scenelet-1:\n  role: root\n  description: "Intro"\n  dialogue:\n    - character: "Rhea"\n      line: "Hello there."\n  shot_suggestions: []',
};

const VALID_RESPONSE = JSON.stringify({
  storyboard_breakdown: [
    {
      scenelet_id: 'scenelet-1',
      shot_index: 1,
      framing_and_angle: 'Medium',
      composition_and_content: 'Frame description',
      character_action_and_emotion: 'Action description',
      dialogue: [
        { character: 'Rhea', line: 'Hello there.' },
      ],
      camera_dynamics: 'Static',
      lighting_and_atmosphere: 'Bright',
    },
  ],
});

describe('runStoryboardTask', () => {
  it('generates storyboard breakdown and persists response', async () => {
    const story = createStory();
    const repository = createStoriesRepository(story);
    const geminiClient = {
      generateJson: vi.fn(async () => VALID_RESPONSE),
    };

    const result = await runStoryboardTask('story-1', {
      storiesRepository: repository,
      storyTreeLoader: async () => SNAPSHOT,
      promptLoader: async () => 'System prompt text',
      geminiClient: geminiClient as any,
    });

    expect(result.storyboardBreakdown).toEqual({
      storyboard_breakdown: [
        expect.objectContaining({
          scenelet_id: 'scenelet-1',
          shot_index: 1,
        }),
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
    expect(geminiClient.generateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        systemInstruction: 'System prompt text',
        userContent: expect.stringContaining('# Visual Design Document'),
      }),
      undefined
    );
    expect(story.storyboardBreakdown).toEqual({
      storyboard_breakdown: expect.any(Array),
    });
  });

  it('logs Gemini request payload when logger provided', async () => {
    const story = createStory();
    const repository = createStoriesRepository(story);
    const geminiClient = {
      generateJson: vi.fn(async () => VALID_RESPONSE),
    };
    const logger = { debug: vi.fn() };

    await runStoryboardTask('story-1', {
      storiesRepository: repository,
      storyTreeLoader: async () => SNAPSHOT,
      promptLoader: async () => 'Verbose system prompt',
      geminiClient: geminiClient as any,
      logger: logger as any,
    });

    expect(logger.debug).toHaveBeenCalledWith(
      'Invoking Gemini for storyboard task',
      expect.objectContaining({
        storyId: 'story-1',
        geminiRequest: expect.objectContaining({
          systemInstruction: 'Verbose system prompt',
          userContent: expect.stringContaining('Interactive Script Story Tree (YAML)'),
        }),
      })
    );
  });

  it('throws when visual design document missing', async () => {
    const story = createStory();
    story.visualDesignDocument = null;
    const repository = createStoriesRepository(story);

    await expect(
      runStoryboardTask('story-1', {
        storiesRepository: repository,
        storyTreeLoader: async () => SNAPSHOT,
        promptLoader: async () => 'System prompt text',
        geminiClient: { generateJson: vi.fn() } as any,
      })
    ).rejects.toBeInstanceOf(StoryboardTaskError);
  });

  it('throws when constitution missing', async () => {
    const story = createStory();
    story.storyConstitution = null;
    const repository = createStoriesRepository(story);

    await expect(
      runStoryboardTask('story-1', {
        storiesRepository: repository,
        storyTreeLoader: async () => SNAPSHOT,
        promptLoader: async () => 'System prompt text',
        geminiClient: { generateJson: vi.fn() } as any,
      })
    ).rejects.toBeInstanceOf(StoryboardTaskError);
  });

  it('throws when story tree missing', async () => {
    const story = createStory();
    const repository = createStoriesRepository(story);

    await expect(
      runStoryboardTask('story-1', {
        storiesRepository: repository,
        storyTreeLoader: async () => {
          throw new StoryTreeAssemblyError('No scenelets');
        },
        promptLoader: async () => 'System prompt text',
        geminiClient: { generateJson: vi.fn() } as any,
      })
    ).rejects.toBeInstanceOf(StoryboardTaskError);
  });

  it('throws when Gemini returns invalid JSON', async () => {
    const story = createStory();
    const repository = createStoriesRepository(story);
    const geminiClient = {
      generateJson: vi.fn(async () => 'not-json'),
    };

    await expect(
      runStoryboardTask('story-1', {
        storiesRepository: repository,
        storyTreeLoader: async () => SNAPSHOT,
        promptLoader: async () => 'System prompt text',
        geminiClient: geminiClient as any,
      })
    ).rejects.toBeInstanceOf(StoryboardTaskError);
  });

  it('throws when storyboard already exists', async () => {
    const story = createStory();
    story.storyboardBreakdown = { storyboard_breakdown: [] };
    const repository = createStoriesRepository(story);

    await expect(
      runStoryboardTask('story-1', {
        storiesRepository: repository,
        storyTreeLoader: async () => SNAPSHOT,
        promptLoader: async () => 'System prompt text',
        geminiClient: { generateJson: vi.fn() } as any,
      })
    ).rejects.toBeInstanceOf(StoryboardTaskError);
  });
});
