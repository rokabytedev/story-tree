import { describe, expect, it, vi } from 'vitest';

import { loadStoryTreeSnapshot } from '../src/story-storage/storyTreeSnapshot.js';
import type { StoryTreeSceneletSource } from '../src/story-storage/types.js';
import { runVisualDesignTask } from '../src/visual-design/visualDesignTask.js';
import { VisualDesignTaskError } from '../src/visual-design/errors.js';
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
      throw new Error('Not implemented in integration tests.');
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

describe('visual design task integration', () => {
  it('generates and persists document using assembled story tree', async () => {
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
          dialogue: [],
          shot_suggestions: [],
        },
        isBranchPoint: false,
        isTerminalNode: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    ];
    const storyTreeLoader = createStoryTreeLoader(scenelets);
    const geminiClient = {
      generateJson: vi.fn(async () => JSON.stringify({ visual_design_document: { summary: 'Success' } })),
    };

    const result = await runVisualDesignTask('story-1', {
      storiesRepository: repository,
      storyTreeLoader,
      promptLoader: async () => 'System prompt',
      geminiClient: geminiClient as any,
    });

    expect(result.visualDesignDocument).toEqual({ summary: 'Success' });
    expect(repository.updates[0]).toMatchObject({
      storyId: 'story-1',
      patch: { visualDesignDocument: { summary: 'Success' } },
    });
    expect(story.visualDesignDocument).toEqual({ summary: 'Success' });
    expect(geminiClient.generateJson).toHaveBeenCalled();
  });

  it('throws when interactive script scenelets missing', async () => {
    const story = createStoryRecord();
    const repository = createStoriesRepository(story);
    const storyTreeLoader = createStoryTreeLoader([]);

    await expect(
      runVisualDesignTask('story-1', {
        storiesRepository: repository,
        storyTreeLoader,
        promptLoader: async () => 'System prompt',
        geminiClient: { generateJson: vi.fn() } as any,
      })
    ).rejects.toBeInstanceOf(VisualDesignTaskError);
  });

  it('surfaces Gemini failures with context', async () => {
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
          dialogue: [],
          shot_suggestions: [],
        },
        isBranchPoint: false,
        isTerminalNode: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    ];
    const storyTreeLoader = createStoryTreeLoader(scenelets);
    const geminiClient = { generateJson: vi.fn(async () => 'not-json') };

    await expect(
      runVisualDesignTask('story-1', {
        storiesRepository: repository,
        storyTreeLoader,
        promptLoader: async () => 'System prompt',
        geminiClient: geminiClient as any,
      })
    ).rejects.toBeInstanceOf(VisualDesignTaskError);
  });

  it('prevents repeated execution when document already exists', async () => {
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
          dialogue: [],
          shot_suggestions: [],
        },
        isBranchPoint: false,
        isTerminalNode: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    ];
    const storyTreeLoader = createStoryTreeLoader(scenelets);
    const geminiClient = {
      generateJson: vi.fn(async () => JSON.stringify({ visual_design_document: { summary: 'Success' } })),
    };

    await runVisualDesignTask('story-1', {
      storiesRepository: repository,
      storyTreeLoader,
      promptLoader: async () => 'System prompt',
      geminiClient: geminiClient as any,
    });

    await expect(
      runVisualDesignTask('story-1', {
        storiesRepository: repository,
        storyTreeLoader,
        promptLoader: async () => 'System prompt',
        geminiClient: geminiClient as any,
      })
    ).rejects.toBeInstanceOf(VisualDesignTaskError);
    expect(geminiClient.generateJson).toHaveBeenCalledTimes(1);
  });
});
