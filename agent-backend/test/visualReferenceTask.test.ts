import { describe, expect, it, vi } from 'vitest';

import { runVisualReferenceTask } from '../src/visual-reference/visualReferenceTask.js';
import { VisualReferenceTaskError } from '../src/visual-reference/errors.js';
import type { VisualReferenceTaskDependencies } from '../src/visual-reference/types.js';
import type { AgentWorkflowStoryRecord, AgentWorkflowStoriesRepository } from '../src/workflow/types.js';
import type { StoryTreeSnapshot } from '../src/story-storage/types.js';
import { StoryTreeAssemblyError } from '../src/story-storage/errors.js';

const STORY_TREE: StoryTreeSnapshot = {
  entries: [],
  yaml: '- scenelet-1:\n  role: root\n  description: "Intro"',
};

const VISUAL_DESIGN_DOCUMENT = {
  character_designs: [
    { character_name: 'Rhea' },
    { character_name: 'Narrator' },
  ],
  environment_designs: [{ environment_name: 'Choice Clearing' }],
};

const VALID_RESPONSE = JSON.stringify({
  visual_reference_package: {
    character_model_sheets: [
      {
        character_name: 'Rhea',
        reference_plates: [
          {
            plate_description: 'Comprehensive model sheet',
            type: 'CHARACTER_MODEL_SHEET',
            image_generation_prompt:
              'Extensive prompt referencing Rhea multiple times with carefully described lighting and consistent studio ambience exceeding eighty characters easily for validation.',
          },
        ],
      },
      {
        character_name: 'Narrator',
        reference_plates: [
          {
            plate_description: 'Narrator model sheet',
            type: 'CHARACTER_MODEL_SHEET',
            image_generation_prompt:
              'Detailed prompt referencing the Narrator ribbon form, ensuring lighting continuity and maintaining a descriptive tone that surpasses the minimum length.',
          },
        ],
      },
    ],
    environment_keyframes: [
      {
        environment_name: 'Choice Clearing',
        keyframes: [
          {
            keyframe_description: 'Dusk ambience',
            image_generation_prompt:
              'Choice Clearing during dusk with turquoise threads glowing, long shadows forming between trees, and shimmering atmosphere matching the visual design intent.',
          },
        ],
      },
    ],
  },
});

function createStory(overrides: Partial<AgentWorkflowStoryRecord> = {}): AgentWorkflowStoryRecord {
  return {
    id: overrides.id ?? 'story-1',
    displayName: overrides.displayName ?? 'Stub Story',
    initialPrompt: overrides.initialPrompt ?? 'Prompt',
    storyConstitution:
      Object.prototype.hasOwnProperty.call(overrides, 'storyConstitution')
        ? overrides.storyConstitution ?? null
        : {
            proposedStoryTitle: 'Stub Story',
            storyConstitutionMarkdown: '# Constitution',
          },
    visualDesignDocument:
      Object.prototype.hasOwnProperty.call(overrides, 'visualDesignDocument')
        ? overrides.visualDesignDocument ?? null
        : VISUAL_DESIGN_DOCUMENT,
    audioDesignDocument:
      Object.prototype.hasOwnProperty.call(overrides, 'audioDesignDocument')
        ? overrides.audioDesignDocument ?? null
        : null,
    visualReferencePackage:
      Object.prototype.hasOwnProperty.call(overrides, 'visualReferencePackage')
        ? overrides.visualReferencePackage ?? null
        : null,
  };
}

function createStoriesRepository(story: AgentWorkflowStoryRecord): AgentWorkflowStoriesRepository & {
  updates: Array<{ storyId: string; patch: unknown }>;
} {
  const updates: Array<{ storyId: string; patch: unknown }> = [];

  return {
    updates,
    async createStory() {
      throw new Error('not implemented');
    },
    async updateStoryArtifacts(storyId, patch) {
      updates.push({ storyId, patch });
      if ((patch as { visualReferencePackage?: unknown }).visualReferencePackage !== undefined) {
        story.visualReferencePackage = (patch as { visualReferencePackage?: unknown }).visualReferencePackage ?? null;
      }
      return story;
    },
    async getStoryById(storyId) {
      return storyId === story.id ? story : null;
    },
  } satisfies AgentWorkflowStoriesRepository & { updates: Array<{ storyId: string; patch: unknown }> };
}

function buildDependencies(
  overrides: Partial<VisualReferenceTaskDependencies> & {
    storiesRepository?: AgentWorkflowStoriesRepository;
  }
): VisualReferenceTaskDependencies {
  if (!overrides.storiesRepository) {
    throw new Error('storiesRepository is required');
  }
  if (!overrides.storyTreeLoader) {
    throw new Error('storyTreeLoader is required');
  }

  return {
    promptLoader: async () => 'System prompt',
    geminiClient: {
      generateJson: vi.fn(async () => VALID_RESPONSE),
    },
    ...overrides,
  } satisfies VisualReferenceTaskDependencies;
}

describe('runVisualReferenceTask', () => {
  it('persists validated package and returns result', async () => {
    const story = createStory();
    const repository = createStoriesRepository(story);

    const result = await runVisualReferenceTask('story-1', buildDependencies({
      storiesRepository: repository,
      storyTreeLoader: async () => STORY_TREE,
    }));

    expect(result.visualReferencePackage).toMatchObject({
      character_model_sheets: expect.any(Array),
    });
    expect(repository.updates).toHaveLength(1);
    expect(story.visualReferencePackage).toBeTruthy();
  });

  it('throws when story lacks constitution', async () => {
    const story = createStory({ storyConstitution: null });
    const repository = createStoriesRepository(story);

    await expect(
      runVisualReferenceTask('story-1', buildDependencies({
        storiesRepository: repository,
        storyTreeLoader: async () => STORY_TREE,
      }))
    ).rejects.toBeInstanceOf(VisualReferenceTaskError);
  });

  it('throws when visual design document missing', async () => {
    const story = createStory({ visualDesignDocument: null });
    const repository = createStoriesRepository(story);

    await expect(
      runVisualReferenceTask('story-1', buildDependencies({
        storiesRepository: repository,
        storyTreeLoader: async () => STORY_TREE,
      }))
    ).rejects.toBeInstanceOf(VisualReferenceTaskError);
  });

  it('throws when visual reference package already exists', async () => {
    const story = createStory({ visualReferencePackage: { existing: true } });
    const repository = createStoriesRepository(story);

    await expect(
      runVisualReferenceTask('story-1', buildDependencies({
        storiesRepository: repository,
        storyTreeLoader: async () => STORY_TREE,
      }))
    ).rejects.toThrow(/already has a visual reference package/);
  });

  it('throws when interactive script is missing', async () => {
    const story = createStory();
    const repository = createStoriesRepository(story);

    await expect(
      runVisualReferenceTask('story-1', buildDependencies({
        storiesRepository: repository,
        storyTreeLoader: async () => {
          throw new StoryTreeAssemblyError('Scenelets unavailable');
        },
      }))
    ).rejects.toThrow(/Interactive script must be generated/);
  });

  it('surfaces validation failures from Gemini payload', async () => {
    const story = createStory();
    const repository = createStoriesRepository(story);

    await expect(
      runVisualReferenceTask('story-1', {
        storiesRepository: repository,
        storyTreeLoader: async () => STORY_TREE,
        promptLoader: async () => 'System prompt',
        geminiClient: {
          generateJson: vi.fn(async () => JSON.stringify({ invalid: true })),
        },
      })
    ).rejects.toBeInstanceOf(VisualReferenceTaskError);
  });
});
