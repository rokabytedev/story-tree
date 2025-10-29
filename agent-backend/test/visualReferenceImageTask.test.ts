import { describe, expect, it, vi } from 'vitest';

import { runVisualReferenceImageTask } from '../src/visual-reference-image/visualReferenceImageTask.js';
import { VisualReferenceImageTaskError } from '../src/visual-reference-image/errors.js';
import type {
  VisualReferenceImageTaskDependencies,
  VisualReferenceImageTaskResult,
} from '../src/visual-reference-image/types.js';
import type { AgentWorkflowStoriesRepository, AgentWorkflowStoryRecord } from '../src/workflow/types.js';

type RepositoryWithUpdates = AgentWorkflowStoriesRepository & { updates: Array<{ storyId: string; patch: unknown }> };

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
            targetSceneletsPerPath: 12,
          },
    visualDesignDocument: overrides.visualDesignDocument ?? { exists: true },
    audioDesignDocument:
      Object.prototype.hasOwnProperty.call(overrides, 'audioDesignDocument')
        ? overrides.audioDesignDocument ?? null
        : null,
    visualReferencePackage:
      Object.prototype.hasOwnProperty.call(overrides, 'visualReferencePackage') ? overrides.visualReferencePackage : null,
  };
}

function createStoriesRepository(story: AgentWorkflowStoryRecord): RepositoryWithUpdates {
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
    async listStories() {
      throw new Error('not implemented');
    },
    async deleteStoryById() {
      throw new Error('not implemented');
    },
  } satisfies RepositoryWithUpdates;
}

function buildDependencies(
  overrides: Partial<VisualReferenceImageTaskDependencies> & { storiesRepository?: AgentWorkflowStoriesRepository }
): VisualReferenceImageTaskDependencies {
  if (!overrides.storiesRepository) {
    throw new Error('storiesRepository is required');
  }
  return {
    ...overrides,
  } satisfies VisualReferenceImageTaskDependencies;
}

describe('runVisualReferenceImageTask', () => {
  it('generates missing character and environment images and persists updates', async () => {
    const story = createStory({
      visualReferencePackage: {
        character_model_sheets: [
          {
            character_name: 'Cosmo the Coder',
            reference_plates: [
              {
                plate_description: 'Model sheet',
                type: 'CHARACTER_MODEL_SHEET',
                image_generation_prompt: 'Prompt for Cosmo model sheet.',
              },
              {
                plate_description: 'Already generated',
                type: 'CHARACTER_MODEL_SHEET',
                image_generation_prompt: 'No-op prompt',
                image_path: 'story-1/visuals/characters/cosmo-the-coder/model_sheet_2.png',
              },
            ],
          },
        ],
        environment_keyframes: [
          {
            environment_name: 'Decision Grove',
            keyframes: [
              {
                keyframe_description: 'Establishing shot',
                image_generation_prompt: 'Prompt for environment.',
              },
            ],
          },
        ],
      },
    });
    const repository = createStoriesRepository(story);
    const generateImage = vi
      .fn()
      .mockResolvedValueOnce({ imageData: Buffer.from('character-image'), mimeType: 'image/png' })
      .mockResolvedValueOnce({ imageData: Buffer.from('environment-image'), mimeType: 'image/png' });
    const saveImage = vi.fn(async (_buffer: Buffer, storyId: string, category: string, filename: string) => {
      return `${storyId}/${category}/${filename}`;
    });

    const result = (await runVisualReferenceImageTask(
      'story-1',
      buildDependencies({
        storiesRepository: repository,
        geminiImageClient: { generateImage },
        imageStorage: { saveImage },
      })
    )) as VisualReferenceImageTaskResult;

    expect(generateImage).toHaveBeenCalledTimes(2);
    expect(generateImage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ userPrompt: 'Prompt for Cosmo model sheet.' })
    );
    expect(generateImage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ userPrompt: 'Prompt for environment.' })
    );
    expect(saveImage).toHaveBeenCalledTimes(2);
    expect(saveImage).toHaveBeenNthCalledWith(
      1,
      Buffer.from('character-image'),
      'story-1',
      'visuals/characters/cosmo-the-coder',
      'model_sheet_1.png'
    );
    expect(saveImage).toHaveBeenNthCalledWith(
      2,
      Buffer.from('environment-image'),
      'story-1',
      'visuals/environments/decision-grove',
      'keyframe_1.png'
    );
    expect(repository.updates).toHaveLength(1);
    expect(result.generatedCharacterImages).toBe(1);
    expect(result.generatedEnvironmentImages).toBe(1);
    expect(result.visualReferencePackage.character_model_sheets[0]?.reference_plates[0]?.image_path).toBe(
      'story-1/visuals/characters/cosmo-the-coder/model_sheet_1.png'
    );
    expect(result.visualReferencePackage.environment_keyframes[0]?.keyframes[0]?.image_path).toBe(
      'story-1/visuals/environments/decision-grove/keyframe_1.png'
    );
  });

  it('skips generation when all image paths are populated', async () => {
    const story = createStory({
      visualReferencePackage: {
        character_model_sheets: [
          {
            character_name: 'Cosmo the Coder',
            reference_plates: [
              {
                plate_description: 'Model sheet',
                type: 'CHARACTER_MODEL_SHEET',
                image_generation_prompt: 'Prompt',
                image_path: 'story-1/visuals/characters/cosmo-the-coder/model_sheet_1.png',
              },
            ],
          },
        ],
        environment_keyframes: [
          {
            environment_name: 'Decision Grove',
            keyframes: [
              {
                keyframe_description: 'Establishing shot',
                image_generation_prompt: 'Prompt',
                image_path: 'story-1/visuals/environments/decision-grove/keyframe_1.png',
              },
            ],
          },
        ],
      },
    });
    const repository = createStoriesRepository(story);
    const generateImage = vi.fn();
    const saveImage = vi.fn();

    const result = await runVisualReferenceImageTask(
      'story-1',
      buildDependencies({
        storiesRepository: repository,
        geminiImageClient: { generateImage },
        imageStorage: { saveImage },
      })
    );

    expect(result.generatedCharacterImages).toBe(0);
    expect(result.generatedEnvironmentImages).toBe(0);
    expect(generateImage).not.toHaveBeenCalled();
    expect(saveImage).not.toHaveBeenCalled();
    expect(repository.updates).toHaveLength(0);
  });

  it('throws when the story lacks a visual reference package', async () => {
    const story = createStory({ visualReferencePackage: null });
    const repository = createStoriesRepository(story);

    await expect(
      runVisualReferenceImageTask(
        'story-1',
        buildDependencies({
          storiesRepository: repository,
          geminiImageClient: { generateImage: vi.fn() },
          imageStorage: { saveImage: vi.fn() },
        })
      )
    ).rejects.toBeInstanceOf(VisualReferenceImageTaskError);
  });
});

