import { describe, expect, it, vi } from 'vitest';

import { StoryTreeAssemblyError } from '../src/story-storage/errors.js';
import type { StoryTreeSnapshot } from '../src/story-storage/types.js';
import { runVisualDesignTask } from '../src/visual-design/visualDesignTask.js';
import { VisualDesignTaskError } from '../src/visual-design/errors.js';
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
    visualDesignDocument: null,
    audioDesignDocument: null,
    visualReferencePackage: null,
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
      if ((patch as { visualDesignDocument?: unknown }).visualDesignDocument !== undefined) {
        story.visualDesignDocument = (patch as { visualDesignDocument?: unknown }).visualDesignDocument ?? null;
      }
      if ((patch as { audioDesignDocument?: unknown }).audioDesignDocument !== undefined) {
        story.audioDesignDocument = (patch as { audioDesignDocument?: unknown }).audioDesignDocument ?? null;
      }
      return story;
    },
    async getStoryById(storyId) {
      return storyId === story.id ? story : null;
    },
  } satisfies AgentWorkflowStoriesRepository & { updates: Array<{ storyId: string; patch: unknown }> };
}

const snapshot: StoryTreeSnapshot = {
  entries: [],
  yaml: `- scenelet-1:\n  role: root\n  description: "Opening"\n  dialogue: []\n  shot_suggestions: []`,
};

describe('runVisualDesignTask', () => {
  it('generates visual design document and persists response', async () => {
    const story = createStory();
    const repository = createStoriesRepository(story);
    const geminiClient = {
      generateJson: vi.fn(async () => JSON.stringify({ visual_design_document: { beats: [] } })),
    };

    const result = await runVisualDesignTask('story-1', {
      storiesRepository: repository,
      storyTreeLoader: async () => snapshot,
      promptLoader: async () => 'System prompt text',
      geminiClient: geminiClient as any,
    });

    expect(result.visualDesignDocument).toEqual({ beats: [] });
    expect(repository.updates[0]).toMatchObject({
      storyId: 'story-1',
      patch: { visualDesignDocument: { beats: [] } },
    });
    expect(geminiClient.generateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        systemInstruction: 'System prompt text',
        userContent: expect.stringContaining('Interactive Script Story Tree (YAML)'),
      }),
      undefined
    );
    expect(story.visualDesignDocument).toEqual({ beats: [] });
  });

  it('logs Gemini request payload when logger is provided', async () => {
    const story = createStory();
    const repository = createStoriesRepository(story);
    const geminiClient = {
      generateJson: vi.fn(async () => JSON.stringify({ visual_design_document: { beats: [] } })),
    };
    const logger = { debug: vi.fn() };

    await runVisualDesignTask('story-1', {
      storiesRepository: repository,
      storyTreeLoader: async () => snapshot,
      promptLoader: async () => 'Verbose system prompt',
      geminiClient: geminiClient as any,
      logger: logger as any,
    });

    expect(logger.debug).toHaveBeenCalledWith(
      'Invoking Gemini for visual design task',
      expect.objectContaining({
        storyId: 'story-1',
        geminiRequest: expect.objectContaining({
          systemInstruction: 'Verbose system prompt',
          userContent: expect.stringContaining('Interactive Script Story Tree (YAML)'),
        }),
      })
    );
  });

  it('throws when story lacks constitution', async () => {
    const story = createStory();
    story.storyConstitution = null;
    const repository = createStoriesRepository(story);

    await expect(
      runVisualDesignTask('story-1', {
        storiesRepository: repository,
        storyTreeLoader: async () => snapshot,
        promptLoader: async () => 'System prompt text',
        geminiClient: { generateJson: vi.fn() } as any,
      })
    ).rejects.toBeInstanceOf(VisualDesignTaskError);
  });

  it('throws when interactive script data missing', async () => {
    const story = createStory();
    const repository = createStoriesRepository(story);

    await expect(
      runVisualDesignTask('story-1', {
        storiesRepository: repository,
        storyTreeLoader: async () => {
          throw new StoryTreeAssemblyError('Story tree requires at least one scenelet.');
        },
        promptLoader: async () => 'System prompt text',
        geminiClient: { generateJson: vi.fn() } as any,
      })
    ).rejects.toBeInstanceOf(VisualDesignTaskError);
  });

  it('throws when Gemini returns invalid JSON', async () => {
    const story = createStory();
    const repository = createStoriesRepository(story);
    const geminiClient = {
      generateJson: vi.fn(async () => 'not-json'),
    };

    await expect(
      runVisualDesignTask('story-1', {
        storiesRepository: repository,
        storyTreeLoader: async () => snapshot,
        promptLoader: async () => 'System prompt text',
        geminiClient: geminiClient as any,
      })
    ).rejects.toBeInstanceOf(VisualDesignTaskError);
  });

  it('throws when visual design document already exists', async () => {
    const story = createStory();
    story.visualDesignDocument = { existing: true };
    const repository = createStoriesRepository(story);

    await expect(
      runVisualDesignTask('story-1', {
        storiesRepository: repository,
        storyTreeLoader: async () => snapshot,
        promptLoader: async () => 'System prompt text',
        geminiClient: { generateJson: vi.fn() } as any,
      })
    ).rejects.toBeInstanceOf(VisualDesignTaskError);
  });
});
