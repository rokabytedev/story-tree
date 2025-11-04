import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runShotImageTask } from '../src/shot-image/shotImageTask.js';
import { ShotImageTaskError } from '../src/shot-image/errors.js';
import type { ShotImageTaskDependencies, ShotImageTaskResult } from '../src/shot-image/types.js';
import type { AgentWorkflowStoryRecord, AgentWorkflowStoriesRepository } from '../src/workflow/types.js';
import type { ShotProductionShotsRepository, ShotsMissingImages, ShotRecord } from '../src/shot-production/types.js';
import { ReferenceImageRecommenderError } from '../src/reference-images/referenceImageRecommender.js';
import { ReferenceImageLoadError } from '../src/image-generation/referenceImageLoader.js';
import { loadVisualRendererPromptInstructions } from '../src/prompts/visualRendererPrompt.js';

vi.mock('../src/reference-images/index.js', async () => {
  const actual = await vi.importActual<typeof import('../src/reference-images/index.js')>(
    '../src/reference-images/index.js'
  );
  return {
    ...actual,
    recommendReferenceImages: vi.fn(() => [
      { type: 'CHARACTER', id: 'rhea', path: '/generated/story-1/visuals/characters/rhea/model.png', description: 'Rhea model sheet' },
    ]),
  };
});

vi.mock('../src/image-generation/index.js', async () => {
  const actual = await vi.importActual<typeof import('../src/image-generation/index.js')>(
    '../src/image-generation/index.js'
  );
  return {
    ...actual,
    loadReferenceImagesFromPaths: vi.fn(() => [
      { data: Buffer.from('reference'), mimeType: 'image/png', name: '/generated/story-1/visuals/characters/rhea/model.png' },
    ]),
  };
});

const { recommendReferenceImages: mockRecommendReferenceImages } = vi.mocked(
  await import('../src/reference-images/index.js')
);

const { loadReferenceImagesFromPaths: mockLoadReferenceImagesFromPaths } = vi.mocked(
  await import('../src/image-generation/index.js')
);

type RepositoryWithUpdates = AgentWorkflowStoriesRepository & { updates: Array<{ storyId: string; patch: unknown }> };

function createStory(overrides: Partial<AgentWorkflowStoryRecord> = {}): AgentWorkflowStoryRecord {
  const visualDesignDocument = overrides.visualDesignDocument ?? {
    visual_style: { name: 'Neon Noir', description: 'High contrast with vibrant accents.' },
    master_color_palette: ['#101524', '#FF3366'],
    character_designs: [
      { character_id: 'rhea', character_model_sheet_image_path: '/generated/story-1/visuals/characters/rhea/model.png' },
    ],
    environment_designs: [
      {
        environment_id: 'sandbox-studio',
        environment_reference_image_path: '/generated/story-1/visuals/environments/sandbox-studio/keyframe.png',
        associated_scenelet_ids: ['scenelet-1'],
      },
    ],
  };

  return {
    id: overrides.id ?? 'story-1',
    displayName: overrides.displayName ?? 'Test Story',
    initialPrompt: overrides.initialPrompt ?? 'Prompt',
    storyConstitution: overrides.storyConstitution ?? null,
    visualDesignDocument,
    audioDesignDocument: overrides.audioDesignDocument ?? null,
    visualReferencePackage: overrides.visualReferencePackage ?? null,
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
): ShotProductionShotsRepository & { updates: Array<{ storyId: string; sceneletId: string; shotIndex: number; paths: unknown }> } {
  const updates: Array<{ storyId: string; sceneletId: string; shotIndex: number; paths: unknown }> = [];

  return {
    async createSceneletShots() {
      throw new Error('Not implemented');
    },
    async findShotsMissingImages() {
      return shotsMissingImages;
    },
    async getShotsByStory() {
      return shotsByScenelet;
    },
    async getShotsBySceneletRef() {
      return [];
    },
    async updateShotImagePaths(storyId, sceneletId, shotIndex, paths) {
      updates.push({ storyId, sceneletId, shotIndex, paths });
    },
    async updateShotAudioPath(_storyId, sceneletId, shotIndex, audioPath) {
      return {
        sceneletRef: 'mock-ref',
        sceneletId,
        sceneletSequence: 1,
        shotIndex,
        storyboardPayload: {},
        audioFilePath: audioPath ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as ShotRecord;
    },
    updates,
    async findSceneletIdsMissingShots() {
      return [];
    },
  };
}

function buildDependencies(
  overrides: Partial<ShotImageTaskDependencies> & {
    storiesRepository: AgentWorkflowStoriesRepository;
    shotsRepository: ShotProductionShotsRepository;
  }
): ShotImageTaskDependencies {
  return {
    geminiImageClient: overrides.geminiImageClient ?? { generateImage: vi.fn() },
    imageStorage: overrides.imageStorage ?? { saveImage: vi.fn(async () => '/generated/path.png') },
    storiesRepository: overrides.storiesRepository,
    shotsRepository: overrides.shotsRepository,
    ...overrides,
  };
}

function createShotRecord(overrides: Partial<ShotRecord> = {}): ShotRecord {
  return {
    sceneletRef: overrides.sceneletRef ?? 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    sceneletId: overrides.sceneletId ?? 'scenelet-1',
    sceneletSequence: overrides.sceneletSequence ?? 1,
    shotIndex: overrides.shotIndex ?? 1,
    storyboardPayload:
      overrides.storyboardPayload ?? {
        framingAndAngle: 'Wide shot',
        compositionAndContent: 'Rhea and the orb collaborate at the console.',
        characterActionAndEmotion: 'Focused and curious.',
        cameraDynamics: 'Slow dolly forward.',
        lightingAndAtmosphere: 'Cool lights with magenta accents.',
        continuityNotes: 'Maintain console layout.',
        referencedDesigns: {
          characters: ['rhea'],
          environments: ['sandbox-studio'],
        },
        audioAndNarrative: [
          {
            type: 'dialogue',
            source: 'rhea',
            line: 'Let\'s push this challenge even further.',
            delivery: 'Playful and daring, with a spark of competition.',
          },
        ],
      },
    keyFrameImagePath: overrides.keyFrameImagePath,
    createdAt: overrides.createdAt ?? '2025-01-01T00:00:00Z',
    updatedAt: overrides.updatedAt ?? '2025-01-01T00:00:00Z',
  };
}

describe('runShotImageTask', () => {
  beforeEach(() => {
    mockRecommendReferenceImages.mockClear();
    mockLoadReferenceImagesFromPaths.mockClear();
  });

  it('generates key frame images using assembled prompts and reference recommendations', async () => {
    const story = createStory();
    const storiesRepository = createStoriesRepository(story);

    const shotsMissingImages: ShotsMissingImages[] = [
      { sceneletId: 'scenelet-1', shotIndex: 1, missingKeyFrame: true },
    ];

    const shotsByScenelet: Record<string, ShotRecord[]> = {
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': [createShotRecord()],
    };

    const shotsRepository = createShotsRepository(shotsMissingImages, shotsByScenelet);

    const generateImage = vi.fn().mockResolvedValue({
      imageData: Buffer.from('generated-key-frame'),
      mimeType: 'image/png',
    });

    const saveImage = vi.fn(async () => 'story-1/shots/scenelet-1/shot-1_key_frame.png');
    const retryOptions = { policy: { maxAttempts: 3 } };

    const result = (await runShotImageTask(
      'story-1',
      buildDependencies({
        storiesRepository,
        shotsRepository,
        geminiImageClient: { generateImage },
        imageStorage: { saveImage },
        retry: retryOptions,
      })
    )) as ShotImageTaskResult;

    expect(mockRecommendReferenceImages).toHaveBeenCalledWith(
      expect.objectContaining({
        storyId: 'story-1',
        referencedDesigns: { characters: ['rhea'], environments: ['sandbox-studio'] },
      })
    );
    expect(mockLoadReferenceImagesFromPaths).toHaveBeenCalledWith([
      '/generated/story-1/visuals/characters/rhea/model.png',
    ]);

    expect(generateImage).toHaveBeenCalledTimes(1);
    const [{ userPrompt, referenceImages, systemInstruction, retry: callRetry }] =
      generateImage.mock.calls[0] ?? [];
    expect(referenceImages).toHaveLength(1);
    expect(callRetry).toBe(retryOptions);

    const instructions = await loadVisualRendererPromptInstructions();
    expect(typeof userPrompt).toBe('string');
    expect((userPrompt as string).startsWith(instructions)).toBe(true);
    const parsedPrompt = JSON.parse((userPrompt as string).slice(instructions.length).trimStart());
    expect(parsedPrompt.global_aesthetic).toMatchObject({
      visual_style: story.visualDesignDocument.visual_style,
      master_color_palette: story.visualDesignDocument.master_color_palette,
    });
    expect(parsedPrompt.character_designs).toHaveLength(1);
    expect(parsedPrompt.environment_designs).toHaveLength(1);
    expect(parsedPrompt.environment_designs[0]).not.toHaveProperty('associated_scenelet_ids');
    expect(parsedPrompt).not.toHaveProperty('audioAndNarrative');
    expect(systemInstruction).toBeUndefined();

    expect(saveImage).toHaveBeenCalledWith(
      Buffer.from('generated-key-frame'),
      'story-1',
      'shots/scenelet-1',
      'shot-1_key_frame.png'
    );

    expect(shotsRepository.updates).toEqual([
      {
        storyId: 'story-1',
        sceneletId: 'scenelet-1',
        shotIndex: 1,
        paths: { keyFrameImagePath: 'story-1/shots/scenelet-1/shot-1_key_frame.png' },
      },
    ]);

    expect(result).toEqual<ShotImageTaskResult>({
      generatedKeyFrameImages: 1,
      totalShots: 1,
    });
  });

  it('filters by target scenelet and shot index', async () => {
    const story = createStory();
    const storiesRepository = createStoriesRepository(story);

    const shotsMissingImages: ShotsMissingImages[] = [
      { sceneletId: 'scenelet-1', shotIndex: 1, missingKeyFrame: true },
      { sceneletId: 'scenelet-2', shotIndex: 1, missingKeyFrame: true },
    ];

    const shotsByScenelet: Record<string, ShotRecord[]> = {
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': [createShotRecord()],
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb': [
        createShotRecord({
          sceneletId: 'scenelet-2',
          sceneletRef: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          shotIndex: 1,
        }),
      ],
    };

    const shotsRepository = createShotsRepository(shotsMissingImages, shotsByScenelet);

    const generateImage = vi.fn().mockResolvedValue({ imageData: Buffer.from('data'), mimeType: 'image/png' });

    await runShotImageTask(
      'story-1',
      buildDependencies({
        storiesRepository,
        shotsRepository,
        geminiImageClient: { generateImage },
        targetSceneletId: 'scenelet-2',
        targetShotIndex: 1,
      })
    );

    expect(generateImage).toHaveBeenCalledTimes(1);
    expect(mockRecommendReferenceImages).toHaveBeenCalledWith(
      expect.objectContaining({ referencedDesigns: { characters: ['rhea'], environments: ['sandbox-studio'] } })
    );
  });

  it('throws when storyboard payload lacks referenced designs', async () => {
    const story = createStory();
    const storiesRepository = createStoriesRepository(story);

    const shotsMissingImages: ShotsMissingImages[] = [
      { sceneletId: 'scenelet-1', shotIndex: 1, missingKeyFrame: true },
    ];

    const shotsByScenelet: Record<string, ShotRecord[]> = {
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': [
        createShotRecord({
          storyboardPayload: {
            framingAndAngle: 'Wide',
            compositionAndContent: 'Content',
            characterActionAndEmotion: 'Emotion',
            cameraDynamics: 'Dynamics',
            lightingAndAtmosphere: 'Lighting',
            continuityNotes: 'Notes',
            audioAndNarrative: [
              {
                type: 'monologue',
                source: 'narrator',
                line: 'Line',
                delivery: 'A steady narrator read with mounting suspense.',
              },
            ],
          },
        }),
      ],
    };

    const shotsRepository = createShotsRepository(shotsMissingImages, shotsByScenelet);

    await expect(
      runShotImageTask(
        'story-1',
        buildDependencies({ storiesRepository, shotsRepository })
      )
    ).rejects.toThrow(ShotImageTaskError);
  });

  it('wraps reference image recommender errors', async () => {
    mockRecommendReferenceImages.mockImplementation(() => {
      throw new ReferenceImageRecommenderError('missing model sheet');
    });

    const story = createStory();
    const storiesRepository = createStoriesRepository(story);

    const shotsMissingImages: ShotsMissingImages[] = [
      { sceneletId: 'scenelet-1', shotIndex: 1, missingKeyFrame: true },
    ];

    const shotsByScenelet: Record<string, ShotRecord[]> = {
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': [createShotRecord()],
    };

    const shotsRepository = createShotsRepository(shotsMissingImages, shotsByScenelet);

    await expect(
      runShotImageTask(
        'story-1',
        buildDependencies({ storiesRepository, shotsRepository })
      )
    ).rejects.toThrow(/failed to load reference images/i);
  });

  it('wraps reference image load errors', async () => {
    mockLoadReferenceImagesFromPaths.mockImplementation(() => {
      throw new ReferenceImageLoadError('file missing');
    });

    const story = createStory();
    const storiesRepository = createStoriesRepository(story);

    const shotsMissingImages: ShotsMissingImages[] = [
      { sceneletId: 'scenelet-1', shotIndex: 1, missingKeyFrame: true },
    ];

    const shotsByScenelet: Record<string, ShotRecord[]> = {
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': [createShotRecord()],
    };

    const shotsRepository = createShotsRepository(shotsMissingImages, shotsByScenelet);

    await expect(
      runShotImageTask(
        'story-1',
        buildDependencies({ storiesRepository, shotsRepository })
      )
    ).rejects.toThrow(/failed to load reference images/i);
  });

  it('returns zero when no shots require generation', async () => {
    const story = createStory();
    const storiesRepository = createStoriesRepository(story);
    const shotsRepository = createShotsRepository([], {});

    const result = await runShotImageTask(
      'story-1',
      buildDependencies({ storiesRepository, shotsRepository })
    );

    expect(result).toEqual<ShotImageTaskResult>({ generatedKeyFrameImages: 0, totalShots: 0 });
  });

  it('regenerates a targeted shot when override is enabled', async () => {
    mockRecommendReferenceImages.mockImplementation(() => [
      { type: 'CHARACTER', id: 'rhea', path: '/generated/story-1/visuals/characters/rhea/model.png', description: 'Rhea model sheet' },
    ]);
    mockLoadReferenceImagesFromPaths.mockImplementation(() => [
      { data: Buffer.from('reference'), mimeType: 'image/png', name: '/generated/story-1/visuals/characters/rhea/model.png' },
    ]);

    const story = createStory();
    const storiesRepository = createStoriesRepository(story);

    const shotsMissingImages: ShotsMissingImages[] = [];
    const shotsByScenelet: Record<string, ShotRecord[]> = {
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': [
        createShotRecord({
          keyFrameImagePath: '/generated/story-1/shots/scenelet-1/shot-1_key_frame.png',
        }),
      ],
    };
    const shotsRepository = createShotsRepository(shotsMissingImages, shotsByScenelet);

    const generateImage = vi.fn().mockResolvedValue({
      imageData: Buffer.from('override-key-frame'),
      mimeType: 'image/png',
    });
    const saveImage = vi.fn(async () => 'story-1/shots/scenelet-1/shot-1_key_frame.png');

    const result = await runShotImageTask(
      'story-1',
      buildDependencies({
        storiesRepository,
        shotsRepository,
        override: true,
        targetSceneletId: 'scenelet-1',
        targetShotIndex: 1,
        geminiImageClient: { generateImage },
        imageStorage: { saveImage },
      })
    );

    expect(generateImage).toHaveBeenCalledTimes(1);
    expect(saveImage).toHaveBeenCalledTimes(1);
    expect(shotsRepository.updates).toEqual([
      {
        storyId: 'story-1',
        sceneletId: 'scenelet-1',
        shotIndex: 1,
        paths: { keyFrameImagePath: 'story-1/shots/scenelet-1/shot-1_key_frame.png' },
      },
    ]);
    expect(result).toEqual<ShotImageTaskResult>({
      generatedKeyFrameImages: 1,
      totalShots: 1,
    });
  });

  it('regenerates only the targeted scenelet in override mode', async () => {
    mockRecommendReferenceImages.mockImplementation(() => [
      { type: 'CHARACTER', id: 'rhea', path: '/generated/story-1/visuals/characters/rhea/model.png', description: 'Rhea model sheet' },
    ]);
    mockLoadReferenceImagesFromPaths.mockImplementation(() => [
      { data: Buffer.from('reference'), mimeType: 'image/png', name: '/generated/story-1/visuals/characters/rhea/model.png' },
    ]);

    const story = createStory();
    const storiesRepository = createStoriesRepository(story);

    const shotsMissingImages: ShotsMissingImages[] = [];
    const shotsByScenelet: Record<string, ShotRecord[]> = {
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': [
        createShotRecord({
          keyFrameImagePath: '/generated/story-1/shots/scenelet-1/shot-1_key_frame.png',
        }),
      ],
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb': [
        createShotRecord({
          sceneletId: 'scenelet-2',
          sceneletRef: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          shotIndex: 4,
          keyFrameImagePath: '/generated/story-1/shots/scenelet-2/shot-4_key_frame.png',
        }),
      ],
    };
    const shotsRepository = createShotsRepository(shotsMissingImages, shotsByScenelet);

    const generateImage = vi.fn().mockResolvedValue({
      imageData: Buffer.from('override-targeted-shot'),
      mimeType: 'image/png',
    });
    const saveImage = vi.fn(async (_buffer, _storyId, _category, filename) => `story-1/${filename}`);

    const result = await runShotImageTask(
      'story-1',
      buildDependencies({
        storiesRepository,
        shotsRepository,
        override: true,
        targetSceneletId: 'scenelet-2',
        targetShotIndex: 4,
        geminiImageClient: { generateImage },
        imageStorage: { saveImage },
      })
    );

    expect(generateImage).toHaveBeenCalledTimes(1);
    expect(saveImage).toHaveBeenCalledTimes(1);
    expect(shotsRepository.updates).toEqual([
      {
        storyId: 'story-1',
        sceneletId: 'scenelet-2',
        shotIndex: 4,
        paths: { keyFrameImagePath: 'story-1/shot-4_key_frame.png' },
      },
    ]);
    expect(result).toEqual<ShotImageTaskResult>({
      generatedKeyFrameImages: 1,
      totalShots: 1,
    });
  });

  it('regenerates all shots in batch override mode', async () => {
    mockRecommendReferenceImages.mockImplementation(() => [
      { type: 'CHARACTER', id: 'rhea', path: '/generated/story-1/visuals/characters/rhea/model.png', description: 'Rhea model sheet' },
    ]);
    mockLoadReferenceImagesFromPaths.mockImplementation(() => [
      { data: Buffer.from('reference'), mimeType: 'image/png', name: '/generated/story-1/visuals/characters/rhea/model.png' },
    ]);

    const story = createStory();
    const storiesRepository = createStoriesRepository(story);

    const shotsMissingImages: ShotsMissingImages[] = [];
    const shotsByScenelet: Record<string, ShotRecord[]> = {
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': [
        createShotRecord({
          keyFrameImagePath: '/generated/story-1/shots/scenelet-1/shot-1_key_frame.png',
        }),
      ],
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb': [
        createShotRecord({
          sceneletId: 'scenelet-2',
          sceneletRef: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          shotIndex: 2,
          keyFrameImagePath: '/generated/story-1/shots/scenelet-2/shot-2_key_frame.png',
        }),
      ],
    };
    const shotsRepository = createShotsRepository(shotsMissingImages, shotsByScenelet);

    const generateImage = vi.fn().mockResolvedValue({
      imageData: Buffer.from('override'),
      mimeType: 'image/png',
    });
    const saveImage = vi.fn(async (_buffer, _storyId, _category, filename) => `story-1/${filename}`);

    const result = await runShotImageTask(
      'story-1',
      buildDependencies({
        storiesRepository,
        shotsRepository,
        override: true,
        geminiImageClient: { generateImage },
        imageStorage: { saveImage },
      })
    );

    expect(generateImage).toHaveBeenCalledTimes(2);
    expect(saveImage).toHaveBeenCalledTimes(2);
    expect(shotsRepository.updates).toHaveLength(2);
    expect(result).toEqual<ShotImageTaskResult>({
      generatedKeyFrameImages: 2,
      totalShots: 2,
    });
  });
});
