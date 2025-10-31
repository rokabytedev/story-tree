import { describe, expect, it, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { runShotImageTask } from '../src/shot-image/shotImageTask.js';
import { ShotImageTaskError, CharacterReferenceMissingError } from '../src/shot-image/errors.js';
import type { ShotImageTaskDependencies, ShotImageTaskResult } from '../src/shot-image/types.js';
import type { AgentWorkflowStoriesRepository, AgentWorkflowStoryRecord } from '../src/workflow/types.js';
import type {
  ShotProductionShotsRepository,
  ShotsMissingImages,
  ShotRecord,
} from '../src/shot-production/types.js';

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn().mockResolvedValue(Buffer.from('fake-image-data')),
  },
  readFile: vi.fn().mockResolvedValue(Buffer.from('fake-image-data')),
}));

type RepositoryWithUpdates = AgentWorkflowStoriesRepository & { updates: Array<{ storyId: string; patch: unknown }> };

function createStory(overrides: Partial<AgentWorkflowStoryRecord> = {}): AgentWorkflowStoryRecord {
  const hasVisualDesignOverride = Object.prototype.hasOwnProperty.call(
    overrides,
    'visualDesignDocument'
  );
  return {
    id: overrides.id ?? 'story-1',
    displayName: overrides.displayName ?? 'Test Story',
    initialPrompt: overrides.initialPrompt ?? 'Prompt',
    storyConstitution: overrides.storyConstitution ?? null,
    visualDesignDocument: hasVisualDesignOverride
      ? overrides.visualDesignDocument ?? null
      : {
          character_designs: [],
          environment_designs: [],
        },
    audioDesignDocument: overrides.audioDesignDocument ?? null,
    visualReferencePackage:
      Object.prototype.hasOwnProperty.call(overrides, 'visualReferencePackage')
        ? overrides.visualReferencePackage
        : { character_model_sheets: [], environment_keyframes: [] },
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
      return story;
    },
    async getStoryById(storyId) {
      return storyId === story.id ? story : null;
    },
  } satisfies RepositoryWithUpdates;
}

function createShotsRepository(
  shotsMissingImages: ShotsMissingImages[],
  shotsByScenelet: Record<string, ShotRecord[]>
): ShotProductionShotsRepository {
  const updates: Array<{ storyId: string; sceneletId: string; shotIndex: number; paths: unknown }> = [];

  return {
    async findShotsMissingImages(_storyId: string) {
      return shotsMissingImages;
    },
    async getShotsByStory(_storyId: string) {
      return shotsByScenelet;
    },
    async updateShotImagePaths(storyId, sceneletId, shotIndex, paths) {
      updates.push({ storyId, sceneletId, shotIndex, paths });
    },
    updates,
  } as ShotProductionShotsRepository & { updates: typeof updates };
}

function buildDependencies(
  overrides: Partial<ShotImageTaskDependencies> & {
    storiesRepository: AgentWorkflowStoriesRepository;
    shotsRepository: ShotProductionShotsRepository;
  }
): ShotImageTaskDependencies {
  return {
    geminiImageClient: overrides.geminiImageClient ?? { generateImage: vi.fn() },
    imageStorage: overrides.imageStorage ?? { saveImage: vi.fn() },
    referenceImageLoader: overrides.referenceImageLoader ?? { loadCharacterReferences: vi.fn() },
    storiesRepository: overrides.storiesRepository,
    shotsRepository: overrides.shotsRepository,
    ...overrides,
  };
}

describe('runShotImageTask', () => {
  it('generates both first and key frame images for shots missing images', async () => {
    const story = createStory();
    const storiesRepository = createStoriesRepository(story);

    const shotsMissingImages: ShotsMissingImages[] = [
      {
        sceneletId: 'scenelet-1',
        shotIndex: 1,
        missingFirstFrame: true,
        missingKeyFrame: true,
      },
    ];

    const shotsByScenelet: Record<string, ShotRecord[]> = {
      'scenelet-1': [
        {
          sceneletSequence: 1,
          shotIndex: 1,
          storyboardPayload: { character_names: ['Alice', 'Bob'] },
          firstFramePrompt: 'First frame prompt',
          keyFramePrompt: 'Key frame prompt',
          videoClipPrompt: 'Video clip prompt',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ],
    };

    const shotsRepository = createShotsRepository(shotsMissingImages, shotsByScenelet);

    const generateImage = vi
      .fn()
      .mockResolvedValueOnce({ imageData: Buffer.from('first-frame-image'), mimeType: 'image/png' })
      .mockResolvedValueOnce({ imageData: Buffer.from('key-frame-image'), mimeType: 'image/png' });

    const saveImage = vi.fn(async (_buffer: Buffer, storyId: string, category: string, filename: string) => {
      return `${storyId}/${category}/${filename}`;
    });

    const loadCharacterReferences = vi.fn(async () => {
      return new Map([
        ['Alice', ['story-1/visuals/characters/alice/model_sheet_1.png']],
        ['Bob', ['story-1/visuals/characters/bob/model_sheet_1.png']],
      ]);
    });

    const result = (await runShotImageTask(
      'story-1',
      buildDependencies({
        storiesRepository,
        shotsRepository,
        geminiImageClient: { generateImage },
        imageStorage: { saveImage },
        referenceImageLoader: { loadCharacterReferences },
      })
    )) as ShotImageTaskResult;

    expect(loadCharacterReferences).toHaveBeenCalledWith('story-1', ['Alice', 'Bob'], 3);
    expect(generateImage).toHaveBeenCalledTimes(2);
    expect(generateImage).toHaveBeenNthCalledWith(1, expect.objectContaining({ userPrompt: 'First frame prompt' }));
    expect(generateImage).toHaveBeenNthCalledWith(2, expect.objectContaining({ userPrompt: 'Key frame prompt' }));

    expect(saveImage).toHaveBeenCalledTimes(2);
    expect(saveImage).toHaveBeenNthCalledWith(
      1,
      Buffer.from('first-frame-image'),
      'story-1',
      'shots/scenelet-1',
      'shot-1_first_frame.png'
    );
    expect(saveImage).toHaveBeenNthCalledWith(
      2,
      Buffer.from('key-frame-image'),
      'story-1',
      'shots/scenelet-1',
      'shot-1_key_frame.png'
    );

    expect((shotsRepository as any).updates).toHaveLength(2);
    expect(result.generatedFirstFrameImages).toBe(1);
    expect(result.generatedKeyFrameImages).toBe(1);
    expect(result.totalShots).toBe(1);
  });

  it('generates only missing first frame when key frame exists', async () => {
    const story = createStory();
    const storiesRepository = createStoriesRepository(story);

    const shotsMissingImages: ShotsMissingImages[] = [
      {
        sceneletId: 'scenelet-1',
        shotIndex: 1,
        missingFirstFrame: true,
        missingKeyFrame: false,
      },
    ];

    const shotsByScenelet: Record<string, ShotRecord[]> = {
      'scenelet-1': [
        {
          sceneletSequence: 1,
          shotIndex: 1,
          storyboardPayload: { character_names: ['Alice'] },
          firstFramePrompt: 'First frame prompt',
          keyFramePrompt: 'Key frame prompt',
          videoClipPrompt: 'Video clip prompt',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ],
    };

    const shotsRepository = createShotsRepository(shotsMissingImages, shotsByScenelet);

    const generateImage = vi
      .fn()
      .mockResolvedValueOnce({ imageData: Buffer.from('first-frame-image'), mimeType: 'image/png' });

    const saveImage = vi.fn(async (_buffer: Buffer, storyId: string, category: string, filename: string) => {
      return `${storyId}/${category}/${filename}`;
    });

    const loadCharacterReferences = vi.fn(async () => {
      return new Map([['Alice', ['story-1/visuals/characters/alice/model_sheet_1.png']]]);
    });

    const result = await runShotImageTask(
      'story-1',
      buildDependencies({
        storiesRepository,
        shotsRepository,
        geminiImageClient: { generateImage },
        imageStorage: { saveImage },
        referenceImageLoader: { loadCharacterReferences },
      })
    );

    expect(generateImage).toHaveBeenCalledTimes(1);
    expect(saveImage).toHaveBeenCalledTimes(1);
    expect(result.generatedFirstFrameImages).toBe(1);
    expect(result.generatedKeyFrameImages).toBe(0);
  });

  it('skips generation when all shots have images', async () => {
    const story = createStory();
    const storiesRepository = createStoriesRepository(story);
    const shotsRepository = createShotsRepository([], {});

    const generateImage = vi.fn();
    const saveImage = vi.fn();

    const result = await runShotImageTask(
      'story-1',
      buildDependencies({
        storiesRepository,
        shotsRepository,
        geminiImageClient: { generateImage },
        imageStorage: { saveImage },
      })
    );

    expect(result.generatedFirstFrameImages).toBe(0);
    expect(result.generatedKeyFrameImages).toBe(0);
    expect(generateImage).not.toHaveBeenCalled();
    expect(saveImage).not.toHaveBeenCalled();
  });

  it('throws when story does not exist', async () => {
    const story = createStory({ id: 'other-story' });
    const storiesRepository = createStoriesRepository(story);
    const shotsRepository = createShotsRepository([], {});

    await expect(
      runShotImageTask(
        'story-1',
        buildDependencies({
          storiesRepository,
          shotsRepository,
        })
      )
    ).rejects.toBeInstanceOf(ShotImageTaskError);
  });

  it('throws when story lacks visual design document', async () => {
    const story = createStory({ visualDesignDocument: null });
    const storiesRepository = createStoriesRepository(story);
    const shotsRepository = createShotsRepository([], {});

    await expect(
      runShotImageTask(
        'story-1',
        buildDependencies({
          storiesRepository,
          shotsRepository,
        })
      )
    ).rejects.toThrow(/visual design document/);
  });

  it('throws when character references are missing', async () => {
    const story = createStory();
    const storiesRepository = createStoriesRepository(story);

    const shotsMissingImages: ShotsMissingImages[] = [
      {
        sceneletId: 'scenelet-1',
        shotIndex: 1,
        missingFirstFrame: true,
        missingKeyFrame: false,
      },
    ];

    const shotsByScenelet: Record<string, ShotRecord[]> = {
      'scenelet-1': [
        {
          sceneletSequence: 1,
          shotIndex: 1,
          storyboardPayload: { character_names: ['NonExistent'] },
          firstFramePrompt: 'First frame prompt',
          keyFramePrompt: 'Key frame prompt',
          videoClipPrompt: 'Video clip prompt',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ],
    };

    const shotsRepository = createShotsRepository(shotsMissingImages, shotsByScenelet);

    const loadCharacterReferences = vi.fn(async () => {
      throw new ShotImageTaskError('Character not found');
    });

    await expect(
      runShotImageTask(
        'story-1',
        buildDependencies({
          storiesRepository,
          shotsRepository,
          referenceImageLoader: { loadCharacterReferences },
        })
      )
    ).rejects.toBeInstanceOf(CharacterReferenceMissingError);
  });

  it('throws when referenced character is missing model sheet path in visual design document', async () => {
    const story = createStory({
      visualDesignDocument: {
        character_designs: [
          {
            character_id: 'hero',
            character_model_sheet_image_path: '',
          },
        ],
        environment_designs: [],
      },
    });
    const storiesRepository = createStoriesRepository(story);

    const shotsMissingImages: ShotsMissingImages[] = [
      {
        sceneletId: 'scenelet-1',
        shotIndex: 1,
        missingFirstFrame: true,
        missingKeyFrame: false,
      },
    ];

    const shotsByScenelet: Record<string, ShotRecord[]> = {
      'scenelet-1': [
        {
          sceneletSequence: 1,
          shotIndex: 1,
          storyboardPayload: {
            referencedDesigns: {
              characters: ['hero'],
              environments: [],
            },
          },
          firstFramePrompt: 'First frame prompt',
          keyFramePrompt: 'Key frame prompt',
          videoClipPrompt: 'Video clip prompt',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ],
    };

    const shotsRepository = createShotsRepository(shotsMissingImages, shotsByScenelet);

    await expect(
      runShotImageTask(
        'story-1',
        buildDependencies({
          storiesRepository,
          shotsRepository,
          geminiImageClient: { generateImage: vi.fn() },
          imageStorage: { saveImage: vi.fn() },
        })
      )
    ).rejects.toThrow(/CREATE_CHARACTER_MODEL_SHEET/);
  });

  it('uses visual design document paths for referenced character images', async () => {
    const relativePath = 'story-1/visuals/characters/hero/character-model-sheet.png';
    const generatedRoot = join(process.cwd(), 'apps/story-tree-ui/public/generated');
    const absolutePath = join(generatedRoot, relativePath);
    const expectedReferencePath = join('apps/story-tree-ui/public/generated', relativePath);

    try {
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, Buffer.from('model-sheet-image'));

      const story = createStory({
        visualDesignDocument: {
          character_designs: [
            {
              character_id: 'hero',
              character_model_sheet_image_path: relativePath,
            },
          ],
          environment_designs: [],
        },
      });
      const storiesRepository = createStoriesRepository(story);

      const shotsMissingImages: ShotsMissingImages[] = [
        {
          sceneletId: 'scenelet-1',
          shotIndex: 1,
          missingFirstFrame: true,
          missingKeyFrame: false,
        },
      ];

      const shotsByScenelet: Record<string, ShotRecord[]> = {
        'scenelet-1': [
          {
            sceneletSequence: 1,
            shotIndex: 1,
            storyboardPayload: {
              referencedDesigns: {
                characters: ['hero'],
                environments: [],
              },
            },
            firstFramePrompt: 'First frame prompt',
            keyFramePrompt: 'Key frame prompt',
            videoClipPrompt: 'Video clip prompt',
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
          },
        ],
      };

      const shotsRepository = createShotsRepository(shotsMissingImages, shotsByScenelet);

      const generateImage = vi
        .fn()
        .mockResolvedValueOnce({ imageData: Buffer.from('first-frame'), mimeType: 'image/png' });

      const saveImage = vi
        .fn()
        .mockResolvedValueOnce('story-1/shots/scenelet-1/shot-1_first_frame.png');

      const result = await runShotImageTask(
        'story-1',
        buildDependencies({
          storiesRepository,
          shotsRepository,
          geminiImageClient: { generateImage },
          imageStorage: { saveImage } as any,
        })
      );

      expect(generateImage).toHaveBeenCalledTimes(1);
      const [{ referenceImages }] = generateImage.mock.calls[0] ?? [{}];
      expect(referenceImages).toBeDefined();
      expect(referenceImages).toHaveLength(1);
      expect(referenceImages?.[0]?.name).toBe(expectedReferencePath);

      expect(saveImage).toHaveBeenCalledWith(
        Buffer.from('first-frame'),
        'story-1',
        'shots/scenelet-1',
        'shot-1_first_frame.png'
      );

      expect(result.generatedFirstFrameImages).toBe(1);
      expect(result.generatedKeyFrameImages).toBe(0);
    } finally {
      if (existsSync(absolutePath)) {
        rmSync(join(generatedRoot, 'story-1'), { recursive: true, force: true });
      }
    }
  });

  it('uses visual design document paths for referenced environment images', async () => {
    const relativePath = 'story-1/visuals/environments/hangar/reference.png';
    const persistedPath = join('generated', relativePath);
    const generatedRoot = join(process.cwd(), 'apps/story-tree-ui/public/generated');
    const absolutePath = join(generatedRoot, relativePath);
    const expectedReferencePath = join('apps/story-tree-ui/public/generated', relativePath);

    try {
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, Buffer.from('environment-image'));

      const story = createStory({
        visualDesignDocument: {
          character_designs: [],
          environment_designs: [
            {
              environment_id: 'hangar',
              environment_reference_image_path: persistedPath,
            },
          ],
        },
      });
      const storiesRepository = createStoriesRepository(story);

      const shotsMissingImages: ShotsMissingImages[] = [
        {
          sceneletId: 'scenelet-1',
          shotIndex: 1,
          missingFirstFrame: true,
          missingKeyFrame: false,
        },
      ];

      const shotsByScenelet: Record<string, ShotRecord[]> = {
        'scenelet-1': [
          {
            sceneletSequence: 1,
            shotIndex: 1,
            storyboardPayload: {
              referencedDesigns: {
                characters: [],
                environments: ['hangar'],
              },
            },
            firstFramePrompt: 'First frame prompt',
            keyFramePrompt: 'Key frame prompt',
            videoClipPrompt: 'Video clip prompt',
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
          },
        ],
      };

      const shotsRepository = createShotsRepository(shotsMissingImages, shotsByScenelet);

      const generateImage = vi
        .fn()
        .mockResolvedValueOnce({ imageData: Buffer.from('first-frame'), mimeType: 'image/png' });

      const saveImage = vi
        .fn()
        .mockResolvedValueOnce('story-1/shots/scenelet-1/shot-1_first_frame.png');

      const result = await runShotImageTask(
        'story-1',
        buildDependencies({
          storiesRepository,
          shotsRepository,
          geminiImageClient: { generateImage },
          imageStorage: { saveImage } as any,
        })
      );

      expect(generateImage).toHaveBeenCalledTimes(1);
      const [{ referenceImages }] = generateImage.mock.calls[0] ?? [{}];
      expect(referenceImages).toBeDefined();
      expect(referenceImages).toHaveLength(1);
      expect(referenceImages?.[0]?.name).toBe(expectedReferencePath);

      expect(saveImage).toHaveBeenCalledWith(
        Buffer.from('first-frame'),
        'story-1',
        'shots/scenelet-1',
        'shot-1_first_frame.png'
      );

      expect(result.generatedFirstFrameImages).toBe(1);
      expect(result.generatedKeyFrameImages).toBe(0);
    } finally {
      if (existsSync(absolutePath)) {
        rmSync(join(generatedRoot, 'story-1'), { recursive: true, force: true });
      }
    }
  });

  it('throws when referenced environment image file is missing', async () => {
    const relativePath = 'story-1/visuals/environments/bridge/reference.png';
    const persistedPath = join('generated', relativePath);

    const story = createStory({
      visualDesignDocument: {
        character_designs: [],
        environment_designs: [
          {
            environment_id: 'bridge',
            environment_reference_image_path: persistedPath,
          },
        ],
      },
    });
    const storiesRepository = createStoriesRepository(story);

    const shotsMissingImages: ShotsMissingImages[] = [
      {
        sceneletId: 'scenelet-1',
        shotIndex: 1,
        missingFirstFrame: true,
        missingKeyFrame: false,
      },
    ];

    const shotsByScenelet: Record<string, ShotRecord[]> = {
      'scenelet-1': [
        {
          sceneletSequence: 1,
          shotIndex: 1,
          storyboardPayload: {
            referencedDesigns: {
              characters: [],
              environments: ['bridge'],
            },
          },
          firstFramePrompt: 'First frame prompt',
          keyFramePrompt: 'Key frame prompt',
          videoClipPrompt: 'Video clip prompt',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ],
    };

    const shotsRepository = createShotsRepository(shotsMissingImages, shotsByScenelet);

    await expect(
      runShotImageTask(
        'story-1',
        buildDependencies({
          storiesRepository,
          shotsRepository,
          geminiImageClient: { generateImage: vi.fn() },
          imageStorage: { saveImage: vi.fn() },
        })
      )
    ).rejects.toThrow(/Environment keyframe not found/);
  });
});
