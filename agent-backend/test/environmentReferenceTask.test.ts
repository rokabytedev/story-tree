import { describe, expect, it, vi } from 'vitest';

import { runEnvironmentReferenceTask } from '../src/environment-reference/environmentReferenceTask.js';
import { EnvironmentReferenceTaskError } from '../src/environment-reference/errors.js';
import type {
  EnvironmentReferenceStoryRecord,
  EnvironmentReferenceTaskDependencies,
} from '../src/environment-reference/types.js';
import type {
  AgentWorkflowStoriesRepository,
  AgentWorkflowStoryRecord,
} from '../src/workflow/types.js';

interface StoriesRepositoryStub extends AgentWorkflowStoriesRepository {
  updates: Array<{ storyId: string; patch: unknown }>;
}

function createStory(
  overrides: Partial<AgentWorkflowStoryRecord> & { visualDesignDocument?: unknown } = {}
): EnvironmentReferenceStoryRecord {
  return {
    id: overrides.id ?? 'story-1',
    displayName: overrides.displayName ?? 'Sample Story',
    initialPrompt: overrides.initialPrompt ?? 'Create a story about a crystal cavern.',
    storyConstitution:
      Object.prototype.hasOwnProperty.call(overrides, 'storyConstitution') ?
        overrides.storyConstitution ?? null :
        {
          proposedStoryTitle: 'Sample Story',
          storyConstitutionMarkdown: '# Constitution',
          targetSceneletsPerPath: 12,
        },
    visualDesignDocument:
      Object.prototype.hasOwnProperty.call(overrides, 'visualDesignDocument') ?
        overrides.visualDesignDocument ?? null :
        {
          global_aesthetic: {
            visual_style: { name: 'Moody', description: 'High contrast lighting' },
            master_color_palette: [{ hex_code: '#000000', color_name: 'Black', usage_notes: 'Shadows' }],
          },
          environment_designs: [
            {
              environment_id: 'crystal-cavern',
              environment_name: 'Crystal Cavern',
              detailed_description: {
                overall_description: 'A glittering cavern filled with crystals.',
                lighting_and_atmosphere: 'Soft bioluminescent glow.',
                color_tones: 'Teal and amber',
                key_elements: 'Water pools, crystal formations',
              },
            },
          ],
        },
    audioDesignDocument:
      Object.prototype.hasOwnProperty.call(overrides, 'audioDesignDocument') ?
        overrides.audioDesignDocument ?? null :
        null,
    visualReferencePackage:
      Object.prototype.hasOwnProperty.call(overrides, 'visualReferencePackage') ?
        overrides.visualReferencePackage ?? null :
        null,
  };
}

function createStoriesRepository(story: EnvironmentReferenceStoryRecord | null): StoriesRepositoryStub {
  const updates: Array<{ storyId: string; patch: unknown }> = [];
  return {
    updates,
    async createStory() {
      throw new Error('not implemented');
    },
    async updateStoryArtifacts(storyId: string, patch: unknown) {
      updates.push({ storyId, patch });
      if (story && storyId === story.id) {
        const visualDesignDocument = (patch as { visualDesignDocument?: unknown }).visualDesignDocument;
        if (visualDesignDocument !== undefined) {
          story.visualDesignDocument = visualDesignDocument;
        }
      }
      return story as AgentWorkflowStoryRecord;
    },
    async getStoryById(storyId: string) {
      if (!story || story.id !== storyId) {
        return null;
      }
      return story;
    },
  };
}

function buildDependencies(
  overrides: Partial<EnvironmentReferenceTaskDependencies> & { storiesRepository: StoriesRepositoryStub }
): EnvironmentReferenceTaskDependencies {
  return {
    storiesRepository: overrides.storiesRepository,
    ...overrides,
  };
}

describe('runEnvironmentReferenceTask', () => {
  it('generates environment reference image and persists generated path', async () => {
    const story = createStory();
    const repository = createStoriesRepository(story);
    const generateImage = vi.fn(async () => ({
      imageData: Buffer.from('environment-image'),
      mimeType: 'image/png',
    }));
    const saveImage = vi.fn(async (_buffer: Buffer, storyId: string, category: string, filename: string) => {
      expect(storyId).toBe('story-1');
      expect(category).toBe('visuals/environments/crystal-cavern');
      expect(filename).toBe('environment-reference.png');
      return `${storyId}/${category}/${filename}`;
    });

    const result = await runEnvironmentReferenceTask(
      'story-1',
      buildDependencies({
        storiesRepository: repository,
        geminiImageClient: { generateImage },
        imageStorage: { saveImage },
        timeoutMs: 10_000,
      })
    );

    expect(generateImage).toHaveBeenCalledTimes(1);
    expect(generateImage).toHaveBeenCalledWith({
      userPrompt: expect.stringContaining('# Role: Environment Concept Artist'),
      aspectRatio: '16:9',
      timeoutMs: 10_000,
      retry: undefined,
    });
    expect(saveImage).toHaveBeenCalledTimes(1);
    expect(repository.updates).toHaveLength(1);

    const visualDesignDoc = story.visualDesignDocument as {
      environment_designs: Array<{ environment_reference_image_path?: string }>;
    };
    expect(
      visualDesignDoc.environment_designs[0]?.environment_reference_image_path
    ).toBe('generated/story-1/visuals/environments/crystal-cavern/environment-reference.png');
    expect(result.generatedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('skips environment when image exists and override is false', async () => {
    const story = createStory({
      visualDesignDocument: {
        global_aesthetic: {
          palette: [],
        },
        environment_designs: [
          {
            environment_id: 'crystal-cavern',
            environment_reference_image_path:
              'generated/story-1/visuals/environments/crystal-cavern/environment-reference.png',
          },
        ],
      },
    });
    const repository = createStoriesRepository(story);
    const generateImage = vi.fn();

    const result = await runEnvironmentReferenceTask(
      'story-1',
      buildDependencies({
        storiesRepository: repository,
        geminiImageClient: { generateImage: generateImage as never },
      })
    );

    expect(generateImage).not.toHaveBeenCalled();
    expect(result.generatedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
  });

  it('resumes batch generation by skipping existing paths', async () => {
    const story = createStory({
      visualDesignDocument: {
        global_aesthetic: { rules: 'test' },
        environment_designs: [
          {
            environment_id: 'forest-clearing',
            environment_reference_image_path:
              'generated/story-1/visuals/environments/forest-clearing/environment-reference.png',
          },
          {
            environment_id: 'crystal-cavern',
            detailed_description: {},
          },
        ],
      },
    });
    const repository = createStoriesRepository(story);
    const generateImage = vi.fn(async () => ({
      imageData: Buffer.from('image-data'),
      mimeType: 'image/png',
    }));
    const saveImage = vi.fn(async (_buffer: Buffer, storyId: string, category: string, filename: string) => {
      return `${storyId}/${category}/${filename}`;
    });

    const result = await runEnvironmentReferenceTask(
      'story-1',
      buildDependencies({
        storiesRepository: repository,
        geminiImageClient: { generateImage },
        imageStorage: { saveImage },
        resume: true,
      })
    );

    expect(generateImage).toHaveBeenCalledTimes(1);
    expect(result.generatedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
  });

  it('regenerates environment when override is true in single mode', async () => {
    const story = createStory({
      visualDesignDocument: {
        global_aesthetic: { palette: [] },
        environment_designs: [
          {
            environment_id: 'forest-clearing',
            environment_reference_image_path:
              'generated/story-1/visuals/environments/forest-clearing/environment-reference.png',
          },
          { environment_id: 'crystal-cavern' },
        ],
      },
    });
    const repository = createStoriesRepository(story);
    const generateImage = vi.fn(async () => ({
      imageData: Buffer.from('image-bytes'),
      mimeType: 'image/png',
    }));
    const saveImage = vi.fn(async (_buffer: Buffer, storyId: string, category: string, filename: string) => {
      return `${storyId}/${category}/${filename}`;
    });

    const result = await runEnvironmentReferenceTask(
      'story-1',
      buildDependencies({
        storiesRepository: repository,
        geminiImageClient: { generateImage },
        imageStorage: { saveImage },
        targetEnvironmentId: 'forest-clearing',
        override: true,
      })
    );

    expect(generateImage).toHaveBeenCalledTimes(1);
    expect(result.generatedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
  });

  it('collects errors and continues processing remaining environments', async () => {
    const story = createStory({
      visualDesignDocument: {
        global_aesthetic: { palette: [] },
        environment_designs: [
          { environment_id: 'forest-clearing' },
          { environment_id: 'crystal-cavern' },
        ],
      },
    });
    const repository = createStoriesRepository(story);
    const generateImage = vi
      .fn()
      .mockResolvedValue({ imageData: Buffer.from('image'), mimeType: 'image/png' })
      .mockResolvedValue({ imageData: Buffer.from('image-2'), mimeType: 'image/png' });
    const saveImage = vi
      .fn()
      .mockRejectedValueOnce(new Error('disk full'))
      .mockResolvedValueOnce('story-1/visuals/environments/crystal-cavern/environment-reference.png');

    const result = await runEnvironmentReferenceTask(
      'story-1',
      buildDependencies({
        storiesRepository: repository,
        geminiImageClient: { generateImage },
        imageStorage: { saveImage },
      })
    );

    expect(result.generatedCount).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      environmentId: 'forest-clearing',
      error: expect.stringContaining('Failed to save image'),
    });
  });

  it('throws when story is not found', async () => {
    const repository = createStoriesRepository(null);
    await expect(
      runEnvironmentReferenceTask(
        'missing-story',
        buildDependencies({
          storiesRepository: repository,
        })
      )
    ).rejects.toThrow(EnvironmentReferenceTaskError);
  });

  it('throws when target environment id does not exist', async () => {
    const story = createStory();
    const repository = createStoriesRepository(story);

    await expect(
      runEnvironmentReferenceTask(
        'story-1',
        buildDependencies({
          storiesRepository: repository,
          targetEnvironmentId: 'non-existent',
        })
      )
    ).rejects.toThrow(EnvironmentReferenceTaskError);
  });
});
