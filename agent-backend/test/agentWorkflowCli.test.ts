import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createSupabaseServiceClientMock,
  createStoriesRepositoryMock,
  createSceneletsRepositoryMock,
  createShotsRepositoryMock,
  MockSupabaseConfigurationError,
} = vi.hoisted(() => {
  return {
    createSupabaseServiceClientMock: vi.fn(),
    createStoriesRepositoryMock: vi.fn(),
    createSceneletsRepositoryMock: vi.fn(),
    createShotsRepositoryMock: vi.fn(),
    MockSupabaseConfigurationError: class MockSupabaseConfigurationError extends Error {},
  };
});

vi.mock(new URL('../../supabase/src/client.js', import.meta.url).pathname, () => ({
  createSupabaseServiceClient: createSupabaseServiceClientMock,
  SupabaseConfigurationError: MockSupabaseConfigurationError,
}));

vi.mock(new URL('../../supabase/src/storiesRepository.js', import.meta.url).pathname, () => ({
  createStoriesRepository: createStoriesRepositoryMock,
}));

vi.mock(new URL('../../supabase/src/sceneletsRepository.js', import.meta.url).pathname, () => ({
  createSceneletsRepository: createSceneletsRepositoryMock,
}));

vi.mock(new URL('../../supabase/src/shotsRepository.js', import.meta.url).pathname, () => ({
  createShotsRepository: createShotsRepositoryMock,
}));

import { runCli } from '../src/cli/agentWorkflowCli.js';
import type { ShotCreationInput, ShotProductionShotsRepository, ShotRecord } from '../src/shot-production/types.js';
import type { AgentWorkflowOptions, StoryWorkflow } from '../src/workflow/types.js';

interface StubStory {
  id: string;
  displayName: string;
  initialPrompt: string;
  storyConstitution: unknown | null;
  visualDesignDocument: unknown | null;
  audioDesignDocument: unknown | null;
  visualReferencePackage: unknown | null;
}

function createStoriesRepositoryStub(initialStories: StubStory[] = []): {
  repository: {
    createStory: ReturnType<typeof vi.fn>;
    updateStoryArtifacts: ReturnType<typeof vi.fn>;
    getStoryById: ReturnType<typeof vi.fn>;
  };
  stories: StubStory[];
} {
  const stories = initialStories.map((story) => ({
    visualDesignDocument: null,
    audioDesignDocument: null,
    visualReferencePackage: null,
    ...story,
  }));

  const repository = {
    createStory: vi.fn(
      async ({
        displayName,
        initialPrompt,
      }: {
        displayName: string;
        initialPrompt: string;
      }) => {
        const story: StubStory = {
          id: `story-${stories.length + 1}`,
          displayName,
          initialPrompt,
          storyConstitution: null,
          visualDesignDocument: null,
          audioDesignDocument: null,
          visualReferencePackage: null,
        };
        stories.push(story);
        return story;
      }
    ),
    updateStoryArtifacts: vi.fn(async (storyId: string, patch: { displayName?: string; storyConstitution?: unknown }) => {
      const story = stories.find((row) => row.id === storyId);
      if (!story) {
        throw new Error(`Story ${storyId} not found.`);
      }
      if (patch.displayName !== undefined) {
        story.displayName = patch.displayName;
      }
      if (patch.storyConstitution !== undefined) {
        story.storyConstitution = patch.storyConstitution;
      }
      if ((patch as { visualDesignDocument?: unknown }).visualDesignDocument !== undefined) {
        story.visualDesignDocument = (patch as { visualDesignDocument?: unknown }).visualDesignDocument;
      }
      if ((patch as { audioDesignDocument?: unknown }).audioDesignDocument !== undefined) {
        story.audioDesignDocument = (patch as { audioDesignDocument?: unknown }).audioDesignDocument;
      }
      if ((patch as { visualReferencePackage?: unknown }).visualReferencePackage !== undefined) {
        story.visualReferencePackage = (patch as { visualReferencePackage?: unknown }).visualReferencePackage;
      }
      return story;
    }),
    getStoryById: vi.fn(async (storyId: string) => stories.find((row) => row.id === storyId) ?? null),
  };

  return { repository, stories };
}

type SceneletStubRecord = {
  id: string;
  storyId: string;
  parentId: string | null;
  choiceLabelFromParent: string | null;
  choicePrompt: string | null;
  branchAudioFilePath?: string | null;
  content: unknown;
  isBranchPoint: boolean;
  isTerminalNode: boolean;
  createdAt: string;
};

function createSceneletsRepositoryStub(): {
  repository: {
    createScenelet: ReturnType<typeof vi.fn>;
    markSceneletAsBranchPoint: ReturnType<typeof vi.fn>;
    markSceneletAsTerminal: ReturnType<typeof vi.fn>;
    updateBranchAudioPath: ReturnType<typeof vi.fn>;
    hasSceneletsForStory: ReturnType<typeof vi.fn>;
    listSceneletsByStory: ReturnType<typeof vi.fn>;
  };
  scenelets: SceneletStubRecord[];
} {
  const scenelets: SceneletStubRecord[] = [];
  let createdAtSeed = Date.now();

  const repository = {
    createScenelet: vi.fn(async (input: {
      storyId: string;
      parentId?: string | null;
      choiceLabelFromParent?: string | null;
      content?: unknown;
    }) => {
      createdAtSeed += 1;
      const record: SceneletStubRecord = {
        id: `scenelet-${scenelets.length + 1}`,
        storyId: input.storyId,
        parentId: input.parentId ?? null,
        choiceLabelFromParent: input.choiceLabelFromParent ?? null,
        choicePrompt: null,
        content: input.content ?? {},
        isBranchPoint: false,
        isTerminalNode: false,
        createdAt: new Date(createdAtSeed).toISOString(),
      };
      scenelets.push(record);
      return {
        ...record,
      };
    }),
    markSceneletAsBranchPoint: vi.fn(async (sceneletId: string, choicePrompt: string) => {
      const target = scenelets.find((row) => row.id === sceneletId);
      if (target) {
        target.isBranchPoint = true;
        target.choicePrompt = choicePrompt;
      }
    }),
    markSceneletAsTerminal: vi.fn(async (sceneletId: string) => {
      const target = scenelets.find((row) => row.id === sceneletId);
      if (target) {
        target.isTerminalNode = true;
      }
    }),
    updateBranchAudioPath: vi.fn(async (storyId: string, sceneletId: string, filePath: string | null) => {
      const target = scenelets.find((row) => row.id === sceneletId && row.storyId === storyId);
      if (!target) {
        throw new Error(`Scenelet ${sceneletId} not found for story ${storyId}.`);
      }
      target.branchAudioFilePath = filePath;
      return {
        ...target,
      };
    }),
    hasSceneletsForStory: vi.fn(async (storyId: string) => scenelets.some((row) => row.storyId === storyId)),
    listSceneletsByStory: vi.fn(async (storyId: string) =>
      scenelets
        .filter((row) => row.storyId === storyId)
        .map((row) => ({
          id: row.id,
          storyId: row.storyId,
          parentId: row.parentId,
          choiceLabelFromParent: row.choiceLabelFromParent,
          choicePrompt: row.choicePrompt,
          branchAudioFilePath: row.branchAudioFilePath ?? undefined,
          content: row.content,
          isBranchPoint: row.isBranchPoint,
          isTerminalNode: row.isTerminalNode,
          createdAt: row.createdAt,
        }))
    ),
  };

  return { repository, scenelets };
}

function createShotsRepositoryStub() {
  const created: Array<{
    storyId: string;
    sceneletRef: string;
    sceneletId: string;
    sceneletSequence: number;
    shotIndices: number[];
  }> = [];
  const shotsByStory = new Map<string, Record<string, ShotRecord[]>>();
  const repository = {
    createSceneletShots: vi.fn(async (
      storyId: string,
      sceneletRef: string,
      sceneletId: string,
      sceneletSequence: number,
      shots: ShotCreationInput[]
    ) => {
      created.push({
        storyId,
        sceneletRef,
        sceneletId,
        sceneletSequence,
        shotIndices: shots.map((shot) => shot.shotIndex),
      });

      const records = shots.map<ShotRecord>((shot) => {
        const payload = shot.storyboardPayload ?? {};
        const audioAndNarrative = Array.isArray((payload as Record<string, unknown>).audioAndNarrative) &&
          (payload as Record<string, unknown>).audioAndNarrative &&
          (payload as Record<string, unknown>).audioAndNarrative instanceof Array &&
          ((payload as Record<string, unknown>).audioAndNarrative as unknown[]).length > 0
            ? (payload as Record<string, unknown>).audioAndNarrative
            : [
                {
                  type: 'monologue',
                  source: 'narrator',
                  line: 'Narration',
                  delivery: 'calm',
                },
              ];

        return {
          sceneletRef,
          sceneletId,
          sceneletSequence,
          shotIndex: shot.shotIndex,
          storyboardPayload: {
            ...payload,
            audioAndNarrative,
          },
          keyFrameImagePath: undefined,
          videoFilePath: undefined,
          audioFilePath: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      const existingShots = shotsByStory.get(storyId) ?? {};
      existingShots[sceneletRef] = records;
      shotsByStory.set(storyId, existingShots);
    }),
    findSceneletIdsMissingShots: vi.fn(async (_storyId: string, sceneletIds: string[]) => sceneletIds),
    getShotsByStory: vi.fn(async (storyId: string) => shotsByStory.get(storyId) ?? {}),
    getShotsBySceneletRef: vi.fn(async (sceneletRef: string) => {
      for (const storyShots of shotsByStory.values()) {
        if (storyShots[sceneletRef]) {
          return storyShots[sceneletRef];
        }
      }
      return [];
    }),
    findShotsMissingImages: vi.fn(async (_storyId: string) => []),
    findShotsMissingVideos: vi.fn(async (_storyId: string) => []),
    updateShotImagePaths: vi.fn(async (_storyId: string, _sceneletId: string, _shotIndex: number, _paths: unknown) => {}),
    updateShotAudioPath: vi.fn(async (storyId: string, sceneletId: string, shotIndex: number, audioPath: string | null) => {
      const storyShots = shotsByStory.get(storyId);
      if (storyShots) {
        for (const records of Object.values(storyShots)) {
          for (const record of records) {
            if (record.sceneletId === sceneletId && record.shotIndex === shotIndex) {
              record.audioFilePath = audioPath ?? null;
              record.updatedAt = new Date().toISOString();
              return record;
            }
          }
        }
      }
      return {
        sceneletRef: 'mock-ref',
        sceneletId,
        sceneletSequence: 1,
        shotIndex,
        storyboardPayload: {},
        videoFilePath: undefined,
        audioFilePath: audioPath ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as ShotRecord;
    }),
    updateShotVideoPath: vi.fn(async (storyId: string, sceneletId: string, shotIndex: number, videoPath: string | null) => {
      const storyShots = shotsByStory.get(storyId);
      if (storyShots) {
        for (const records of Object.values(storyShots)) {
          for (const record of records) {
            if (record.sceneletId === sceneletId && record.shotIndex === shotIndex) {
              record.videoFilePath = videoPath ?? undefined;
              record.updatedAt = new Date().toISOString();
              return record;
            }
          }
        }
      }
      return {
        sceneletRef: 'mock-ref',
        sceneletId,
        sceneletSequence: 1,
        shotIndex,
        storyboardPayload: {},
        videoFilePath: videoPath ?? undefined,
        audioFilePath: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as ShotRecord;
    }),
  } satisfies ShotProductionShotsRepository & {
    created: Array<{ storyId: string; sceneletRef: string; sceneletId: string; sceneletSequence: number; shotIndices: number[] }>;
  };
  (repository as typeof repository & {
    created: Array<{ storyId: string; sceneletRef: string; sceneletId: string; sceneletSequence: number; shotIndices: number[] }>;
  }).created = created;
  return repository as typeof repository & {
    created: Array<{ storyId: string; sceneletRef: string; sceneletId: string; sceneletSequence: number; shotIndices: number[] }>;
  };
}

describe('agentWorkflow CLI', () => {
  const logs: string[] = [];
  const errors: string[] = [];

  beforeEach(() => {
    createSupabaseServiceClientMock.mockReset();
    createStoriesRepositoryMock.mockReset();
    createSceneletsRepositoryMock.mockReset();
    createShotsRepositoryMock.mockReset();

    vi.spyOn(console, 'log').mockImplementation((value?: unknown) => {
      logs.push(String(value ?? ''));
    });
    vi.spyOn(console, 'error').mockImplementation((value?: unknown) => {
      errors.push(String(value ?? ''));
    });
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    logs.length = 0;
    errors.length = 0;
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('creates a story workflow in stub mode', async () => {
    const { repository } = createStoriesRepositoryStub();
    const { repository: sceneletsRepository } = createSceneletsRepositoryStub();
    const shotsRepository = createShotsRepositoryStub();

    createSupabaseServiceClientMock.mockReturnValue({});
    createStoriesRepositoryMock.mockReturnValue(repository);
    createSceneletsRepositoryMock.mockReturnValue(sceneletsRepository);
    createShotsRepositoryMock.mockReturnValue(shotsRepository);

    await runCli(['create', '--prompt', 'Stub adventure'], {
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    });

    expect(errors).toEqual([]);
    expect(process.exitCode).toBeUndefined();
    expect(createSupabaseServiceClientMock).toHaveBeenCalledWith({
      url: 'http://localhost:54321',
      serviceRoleKey: 'service-role',
    });
    expect(repository.createStory).toHaveBeenCalledWith({
      displayName: 'Untitled Story',
      initialPrompt: 'Stub adventure',
    });
    const response = JSON.parse(logs[0]);
    expect(response.storyId).toMatch(/^story-/);
  });

  it('runs all tasks with stub generators', async () => {
    const { repository, stories } = createStoriesRepositoryStub();
    const { repository: sceneletsRepository, scenelets } = createSceneletsRepositoryStub();
    const shotsRepository = createShotsRepositoryStub();

    createSupabaseServiceClientMock.mockReturnValue({});
    createStoriesRepositoryMock.mockReturnValue(repository);
    createSceneletsRepositoryMock.mockReturnValue(sceneletsRepository);
    createShotsRepositoryMock.mockReturnValue(shotsRepository);

    await runCli(['run-all', '--prompt', 'Hybrid voyage', '--mode', 'stub'], {
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    });

    expect(errors).toEqual([]);
    const output = JSON.parse(logs[0]);
    expect(output.storyTitle).toBeDefined();
    expect(output.storyConstitutionMarkdown).toContain('Hybrid voyage');
    expect(stories[0]?.storyConstitution).not.toBeNull();
    expect(scenelets.length).toBeGreaterThan(0);
    expect(stories[0]?.visualDesignDocument).not.toBeNull();
    expect(stories[0]?.visualReferencePackage).not.toBeNull();
    expect(stories[0]?.audioDesignDocument).not.toBeNull();
    expect(
      shotsRepository.created.map(({ storyId, sceneletId, sceneletSequence, shotIndices }) => ({
        storyId,
        sceneletId,
        sceneletSequence,
        shotIndices,
      }))
    ).toEqual([
      { storyId: stories[0]!.id, sceneletId: 'scenelet-1', sceneletSequence: 1, shotIndices: [1, 2] },
      { storyId: stories[0]!.id, sceneletId: 'scenelet-2', sceneletSequence: 2, shotIndices: [1, 2] },
      { storyId: stories[0]!.id, sceneletId: 'scenelet-3', sceneletSequence: 3, shotIndices: [1, 2] },
      { storyId: stories[0]!.id, sceneletId: 'scenelet-4', sceneletSequence: 4, shotIndices: [1, 2] },
      { storyId: stories[0]!.id, sceneletId: 'scenelet-5', sceneletSequence: 5, shotIndices: [1, 2] },
    ]);
  });

  it('runs shot production task through run-task with stub fixtures', async () => {
    const { repository, stories } = createStoriesRepositoryStub();
    const { repository: sceneletsRepository } = createSceneletsRepositoryStub();
    const shotsRepository = createShotsRepositoryStub();

    createSupabaseServiceClientMock.mockReturnValue({});
    createStoriesRepositoryMock.mockReturnValue(repository);
    createSceneletsRepositoryMock.mockReturnValue(sceneletsRepository);
    createShotsRepositoryMock.mockReturnValue(shotsRepository);

    const env = {
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    };

    await runCli(['create', '--prompt', 'Shot production workflow', '--mode', 'stub'], env);
    expect(errors).toEqual([]);
    const createdStory = JSON.parse(logs[0]);
    const storyId = createdStory.storyId;
    logs.length = 0;

    const prerequisiteTasks: Array<
      'CREATE_CONSTITUTION' | 'CREATE_INTERACTIVE_SCRIPT' | 'CREATE_VISUAL_DESIGN' | 'CREATE_VISUAL_REFERENCE' | 'CREATE_AUDIO_DESIGN'
    > = [
      'CREATE_CONSTITUTION',
      'CREATE_INTERACTIVE_SCRIPT',
      'CREATE_VISUAL_DESIGN',
      'CREATE_VISUAL_REFERENCE',
      'CREATE_AUDIO_DESIGN',
    ];

    for (const task of prerequisiteTasks) {
      await runCli(['run-task', '--task', task, '--story-id', storyId, '--mode', 'stub'], env);
      expect(process.exitCode).toBeUndefined();
      expect(errors).toEqual([]);
      expect(shotsRepository.created).toEqual([]);
      logs.length = 0;
    }

    await runCli(['run-task', '--task', 'CREATE_SHOT_PRODUCTION', '--story-id', storyId, '--mode', 'stub'], env);

    expect(process.exitCode).toBeUndefined();
    expect(errors).toEqual([]);
    const result = JSON.parse(logs[0]);
    expect(result).toEqual({ storyId, task: 'CREATE_SHOT_PRODUCTION', status: 'completed' });
    expect(
      shotsRepository.created.map(({ storyId: id, sceneletId, sceneletSequence, shotIndices }) => ({
        storyId: id,
        sceneletId,
        sceneletSequence,
        shotIndices,
      }))
    ).toEqual([
      { storyId, sceneletId: 'scenelet-1', sceneletSequence: 1, shotIndices: [1, 2] },
      { storyId, sceneletId: 'scenelet-2', sceneletSequence: 2, shotIndices: [1, 2] },
      { storyId, sceneletId: 'scenelet-3', sceneletSequence: 3, shotIndices: [1, 2] },
      { storyId, sceneletId: 'scenelet-4', sceneletSequence: 4, shotIndices: [1, 2] },
      { storyId, sceneletId: 'scenelet-5', sceneletSequence: 5, shotIndices: [1, 2] },
    ]);
    expect(stories[0]?.visualDesignDocument).not.toBeNull();
    expect(stories[0]?.audioDesignDocument).not.toBeNull();
  });

  it('resumes interactive script when resume flag is provided', async () => {
    const storyId = 'story-1';
    const { repository, stories } = createStoriesRepositoryStub([
      {
        id: storyId,
        displayName: 'Existing Story',
        initialPrompt: 'Prompt',
        storyConstitution: {
          proposedStoryTitle: 'Existing Story',
          storyConstitutionMarkdown: '# Constitution',
          targetSceneletsPerPath: 12,
        },
        visualDesignDocument: null,
        audioDesignDocument: null,
        visualReferencePackage: null,
      },
    ]);
    const { repository: sceneletsRepository, scenelets } = createSceneletsRepositoryStub();
    const shotsRepository = createShotsRepositoryStub();

    scenelets.push(
      {
        id: 'scenelet-root',
        storyId,
        parentId: null,
        choiceLabelFromParent: null,
        choicePrompt: null,
        content: {
          description: 'Existing root',
          dialogue: [],
          shot_suggestions: ['Root shot'],
        },
        isBranchPoint: false,
        isTerminalNode: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'scenelet-leaf',
        storyId,
        parentId: 'scenelet-root',
        choiceLabelFromParent: null,
        choicePrompt: null,
        content: {
          description: 'Existing leaf',
          dialogue: [],
          shot_suggestions: ['Leaf shot'],
        },
        isBranchPoint: false,
        isTerminalNode: false,
        createdAt: new Date().toISOString(),
      }
    );

    createSupabaseServiceClientMock.mockReturnValue({});
    createStoriesRepositoryMock.mockReturnValue(repository);
    createSceneletsRepositoryMock.mockReturnValue(sceneletsRepository);
    createShotsRepositoryMock.mockReturnValue(shotsRepository);

    logs.length = 0;
    errors.length = 0;

    const env = {
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    };

    await runCli(
      [
        'run-task',
        '--task',
        'CREATE_INTERACTIVE_SCRIPT',
        '--story-id',
        storyId,
        '--mode',
        'stub',
        '--resume',
      ],
      env
    );

    expect(process.exitCode).toBeUndefined();
    expect(errors).toEqual([]);
    expect(sceneletsRepository.listSceneletsByStory).toHaveBeenCalledWith(storyId);
    const output = JSON.parse(logs[0]);
    expect(output).toEqual({ storyId, task: 'CREATE_INTERACTIVE_SCRIPT', status: 'completed' });
    expect(stories[0]?.storyConstitution).not.toBeNull();
  });

  it('executes environment reference task and persists generated path in stub mode', async () => {
    const storyId = 'story-1';
    const { repository, stories } = createStoriesRepositoryStub([
      {
        id: storyId,
        displayName: 'Storyboard',
        initialPrompt: 'Prompt',
        storyConstitution: null,
        visualDesignDocument: {
          global_aesthetic: { palette: [] },
          environment_designs: [
            {
              environment_id: 'forest-clearing',
              detailed_description: {
                overall_description: 'A clearing in the forest.',
                lighting_and_atmosphere: 'Soft morning light.',
                color_tones: 'Greens and warm sunlight.',
                key_elements: 'Trees, mist, soft grass.',
              },
            },
          ],
        },
        audioDesignDocument: null,
        visualReferencePackage: null,
      },
    ]);
    const { repository: sceneletsRepository } = createSceneletsRepositoryStub();
    const shotsRepository = createShotsRepositoryStub();

    createSupabaseServiceClientMock.mockReturnValue({});
    createStoriesRepositoryMock.mockReturnValue(repository);
    createSceneletsRepositoryMock.mockReturnValue(sceneletsRepository);
    createShotsRepositoryMock.mockReturnValue(shotsRepository);

    logs.length = 0;
    errors.length = 0;
    process.exitCode = undefined;

    await runCli(
      [
        'run-task',
        '--task',
        'CREATE_ENVIRONMENT_REFERENCE_IMAGE',
        '--story-id',
        storyId,
        '--mode',
        'stub',
      ],
      {
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      }
    );

    expect(process.exitCode).toBeUndefined();
    expect(errors).toEqual([]);
    const output = JSON.parse(logs[0]);
    expect(output).toEqual({
      storyId,
      task: 'CREATE_ENVIRONMENT_REFERENCE_IMAGE',
      status: 'completed',
    });
    const updatedDoc = stories[0]?.visualDesignDocument as {
      environment_designs: Array<{ environment_reference_image_path?: string }>;
    };
    expect(
      updatedDoc.environment_designs[0]?.environment_reference_image_path
    ).toMatch(/^generated\//);
  });

  it('rejects resume flag for irrelevant tasks', async () => {
    const { repository } = createStoriesRepositoryStub();
    const { repository: sceneletsRepository } = createSceneletsRepositoryStub();
    const shotsRepository = createShotsRepositoryStub();

    createSupabaseServiceClientMock.mockReturnValue({});
    createStoriesRepositoryMock.mockReturnValue(repository);
    createSceneletsRepositoryMock.mockReturnValue(sceneletsRepository);
    createShotsRepositoryMock.mockReturnValue(shotsRepository);

    errors.length = 0;

    await runCli(
      [
        'run-task',
        '--task',
        'CREATE_CONSTITUTION',
        '--story-id',
        'story-1',
        '--resume',
      ],
      {
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      }
    );

    expect(process.exitCode).toBe(1);
    expect(errors.join(' ')).toContain(
      '--resume can only be used with CREATE_INTERACTIVE_SCRIPT, CREATE_SHOT_PRODUCTION, CREATE_SHOT_IMAGES, CREATE_SHOT_VIDEO, CREATE_SHOT_AUDIO, or CREATE_ENVIRONMENT_REFERENCE_IMAGE.'
    );
  });

  it('accepts --resume for CREATE_SHOT_IMAGES tasks', async () => {
    const { repository } = createStoriesRepositoryStub([
      {
        id: 'story-1',
        displayName: 'Test Story',
        initialPrompt: 'Test prompt',
        storyConstitution: null,
        visualDesignDocument: {},
        audioDesignDocument: null,
        visualReferencePackage: null,
      },
    ]);
    const { repository: sceneletsRepository } = createSceneletsRepositoryStub();
    const shotsRepository = createShotsRepositoryStub();

    createSupabaseServiceClientMock.mockReturnValue({});
    createStoriesRepositoryMock.mockReturnValue(repository);
    createSceneletsRepositoryMock.mockReturnValue(sceneletsRepository);
    createShotsRepositoryMock.mockReturnValue(shotsRepository);

    errors.length = 0;
    logs.length = 0;
    process.exitCode = undefined;

    await runCli(
      [
        'run-task',
        '--task',
        'CREATE_SHOT_IMAGES',
        '--story-id',
        'story-1',
        '--resume',
        '--mode',
        'stub',
      ],
      {
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      }
    );

    expect(process.exitCode).toBeUndefined();
    expect(errors).toEqual([]);
    const output = JSON.parse(logs[0]);
    expect(output).toEqual({
      storyId: 'story-1',
      task: 'CREATE_SHOT_IMAGES',
      status: 'completed',
    });
  });

  it('accepts --resume-shot-video flag for CREATE_SHOT_VIDEO tasks', async () => {
    const { repository } = createStoriesRepositoryStub([
      {
        id: 'story-1',
        displayName: 'Test Story',
        initialPrompt: 'Test prompt',
        storyConstitution: null,
        visualDesignDocument: {},
        audioDesignDocument: null,
        visualReferencePackage: null,
      },
    ]);
    const { repository: sceneletsRepository } = createSceneletsRepositoryStub();
    const shotsRepository = createShotsRepositoryStub();

    createSupabaseServiceClientMock.mockReturnValue({});
    createStoriesRepositoryMock.mockReturnValue(repository);
    createSceneletsRepositoryMock.mockReturnValue(sceneletsRepository);
    createShotsRepositoryMock.mockReturnValue(shotsRepository);

    const workflowModule = await import('../src/workflow/storyWorkflow.js');
    const runTask = vi.fn<StoryWorkflow['runTask']>(async (task) => {
      expect(task).toBe('CREATE_SHOT_VIDEO');
    });

    const workflow: StoryWorkflow = {
      storyId: 'story-1',
      runTask,
      async runAllTasks() {
        throw new Error('not implemented');
      },
    };

    const resumeCalls: Array<[string, AgentWorkflowOptions]> = [];
    const resumeSpy = vi
      .spyOn(workflowModule, 'resumeWorkflowFromStoryId')
      .mockImplementation(async (storyId: string, options: AgentWorkflowOptions) => {
        resumeCalls.push([storyId, options]);
        return workflow;
      });

    try {
      await runCli(
        [
          'run-task',
          '--task',
          'CREATE_SHOT_VIDEO',
          '--story-id',
          'story-1',
          '--resume-shot-video',
          '--mode',
          'stub',
        ],
        {
          SUPABASE_URL: 'http://localhost:54321',
          SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        }
      );
    } finally {
      resumeSpy.mockRestore();
    }

    expect(resumeCalls).toHaveLength(1);
    const [, workflowOptions] = resumeCalls[0] ?? [];
    expect(workflowOptions.shotVideoTaskOptions?.mode).toBe('resume');
    expect(runTask).toHaveBeenCalledTimes(1);
  });

  it('passes override flag to shot image task options', async () => {
    const { repository } = createStoriesRepositoryStub([
      {
        id: 'story-1',
        displayName: 'Test Story',
        initialPrompt: 'Test prompt',
        storyConstitution: null,
        visualDesignDocument: {},
        audioDesignDocument: null,
        visualReferencePackage: null,
      },
    ]);
    const { repository: sceneletsRepository } = createSceneletsRepositoryStub();
    const shotsRepository = createShotsRepositoryStub();

    createSupabaseServiceClientMock.mockReturnValue({});
    createStoriesRepositoryMock.mockReturnValue(repository);
    createSceneletsRepositoryMock.mockReturnValue(sceneletsRepository);
    createShotsRepositoryMock.mockReturnValue(shotsRepository);

    const workflowModule = await import('../src/workflow/storyWorkflow.js');
    const runTask = vi.fn<StoryWorkflow['runTask']>(async (task) => {
      expect(task).toBe('CREATE_SHOT_IMAGES');
    });

    const workflow: StoryWorkflow = {
      storyId: 'story-1',
      runTask,
      async runAllTasks() {
        return {
          storyId: 'story-1',
          storyTitle: 'Test Story',
          storyConstitutionMarkdown: '# Constitution',
        };
      },
    };

    const resumeCalls: Array<[string, AgentWorkflowOptions]> = [];
    const resumeSpy = vi
      .spyOn(workflowModule, 'resumeWorkflowFromStoryId')
      .mockImplementation(async (storyId: string, options: AgentWorkflowOptions) => {
        resumeCalls.push([storyId, options]);
        return workflow;
      });

    try {
      await runCli(
        [
          'run-task',
          '--task',
          'CREATE_SHOT_IMAGES',
          '--story-id',
          'story-1',
          '--scenelet-id',
          'scenelet-1',
          '--shot-index',
          '2',
          '--override',
          '--mode',
          'stub',
        ],
        {
          SUPABASE_URL: 'http://localhost:54321',
          SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        }
      );
    } finally {
      resumeSpy.mockRestore();
    }

    expect(resumeCalls).toHaveLength(1);
    const [, workflowOptions] = resumeCalls[0] ?? [];
    expect(workflowOptions.shotImageTaskOptions?.override).toBe(true);
    expect(workflowOptions.shotImageTaskOptions?.targetSceneletId).toBe('scenelet-1');
    expect(workflowOptions.shotImageTaskOptions?.targetShotIndex).toBe(2);
    expect(runTask).toHaveBeenCalledTimes(1);
    const output = JSON.parse(logs[0]);
    expect(output).toEqual({
      storyId: 'story-1',
      task: 'CREATE_SHOT_IMAGES',
      status: 'completed',
    });
    expect(errors).toEqual([]);
  });

  it('accepts --dry-run for CREATE_SHOT_VIDEO tasks', async () => {
    const { repository } = createStoriesRepositoryStub([
      {
        id: 'story-1',
        displayName: 'Test Story',
        initialPrompt: 'Test prompt',
        storyConstitution: null,
        visualDesignDocument: {},
        audioDesignDocument: null,
        visualReferencePackage: null,
      },
    ]);
    const { repository: sceneletsRepository } = createSceneletsRepositoryStub();
    const shotsRepository = createShotsRepositoryStub();

    createSupabaseServiceClientMock.mockReturnValue({});
    createStoriesRepositoryMock.mockReturnValue(repository);
    createSceneletsRepositoryMock.mockReturnValue(sceneletsRepository);
    createShotsRepositoryMock.mockReturnValue(shotsRepository);

    const workflowModule = await import('../src/workflow/storyWorkflow.js');
    const runTask = vi.fn<StoryWorkflow['runTask']>(async (task) => {
      expect(task).toBe('CREATE_SHOT_VIDEO');
    });

    const workflow: StoryWorkflow = {
      storyId: 'story-1',
      runTask,
      async runAllTasks() {
        throw new Error('not implemented');
      },
    };

    const resumeCalls: Array<[string, AgentWorkflowOptions]> = [];
    const resumeSpy = vi
      .spyOn(workflowModule, 'resumeWorkflowFromStoryId')
      .mockImplementation(async (storyId: string, options: AgentWorkflowOptions) => {
        resumeCalls.push([storyId, options]);
        return workflow;
      });

    try {
      await runCli(
        [
          'run-task',
          '--task',
          'CREATE_SHOT_VIDEO',
          '--story-id',
          'story-1',
          '--scenelet-id',
          'scenelet-1',
          '--dry-run',
          '--mode',
          'real',
        ],
        {
          SUPABASE_URL: 'http://localhost:54321',
          SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        }
      );
    } finally {
      resumeSpy.mockRestore();
    }

    expect(resumeCalls).toHaveLength(1);
    const [, workflowOptions] = resumeCalls[0] ?? [];
    expect(workflowOptions.shotVideoTaskOptions?.dryRun).toBe(true);
    expect(workflowOptions.shotVideoTaskOptions?.targetSceneletId).toBe('scenelet-1');
    expect(runTask).toHaveBeenCalledTimes(1);
  });

  it('rejects --dry-run for non video tasks', async () => {
    createSupabaseServiceClientMock.mockReturnValue({});
    createStoriesRepositoryMock.mockReturnValue({
      getStoryById: vi.fn(async () => ({})),
      createStory: vi.fn(),
      updateStoryArtifacts: vi.fn(),
    } as any);
    createSceneletsRepositoryMock.mockReturnValue({
      createScenelet: vi.fn(),
      markSceneletAsBranchPoint: vi.fn(),
      markSceneletAsTerminal: vi.fn(),
      hasSceneletsForStory: vi.fn(async () => true),
      listSceneletsByStory: vi.fn(async () => []),
    } as any);
    createShotsRepositoryMock.mockReturnValue(createShotsRepositoryStub());

    await runCli(
      [
        'run-task',
        '--task',
        'CREATE_SHOT_IMAGES',
        '--story-id',
        'story-1',
        '--dry-run',
      ],
      {
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      }
    );

    expect(process.exitCode).toBe(1);
    expect(errors.join(' ')).toContain('--dry-run is only supported with CREATE_SHOT_VIDEO task.');
  });

  it('throws when shot-index flag is missing "--" prefix', async () => {
    createSupabaseServiceClientMock.mockReturnValue({});
    createStoriesRepositoryMock.mockReturnValue({
      getStoryById: vi.fn(async () => ({})),
      createStory: vi.fn(),
      updateStoryArtifacts: vi.fn(),
    } as any);
    createSceneletsRepositoryMock.mockReturnValue({
      createScenelet: vi.fn(),
      markSceneletAsBranchPoint: vi.fn(),
      markSceneletAsTerminal: vi.fn(),
      hasSceneletsForStory: vi.fn(async () => true),
      listSceneletsByStory: vi.fn(async () => []),
    } as any);
    createShotsRepositoryMock.mockReturnValue({
      getShotsByStory: vi.fn(async () => ({})),
      getShotsBySceneletRef: vi.fn(async () => []),
      createSceneletShots: vi.fn(),
      findSceneletIdsMissingShots: vi.fn(async () => []),
      findShotsMissingImages: vi.fn(async () => []),
      findShotsMissingVideos: vi.fn(async () => []),
      updateShotImagePaths: vi.fn(),
      updateShotAudioPath: vi.fn(),
      updateShotVideoPath: vi.fn(),
    } as any);

    errors.length = 0;
    logs.length = 0;
    process.exitCode = undefined;

    await runCli(
      [
        'run-task',
        '--task',
        'CREATE_SHOT_IMAGES',
        '--story-id',
        'story-1',
        '--scenelet-id',
        'scenelet-1',
        'shot-index',
        '2',
      ],
      {
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      }
    );

    expect(process.exitCode).toBe(1);
    expect(errors.join('\n')).toContain('Unexpected argument "shot-index"');
    expect(logs).toEqual([]);
  });

  it('throws when --scenelet-id value is missing', async () => {
    createSupabaseServiceClientMock.mockReturnValue({});
    createStoriesRepositoryMock.mockReturnValue({
      getStoryById: vi.fn(async () => ({})),
      createStory: vi.fn(),
      updateStoryArtifacts: vi.fn(),
    } as any);
    createSceneletsRepositoryMock.mockReturnValue({
      createScenelet: vi.fn(),
      markSceneletAsBranchPoint: vi.fn(),
      markSceneletAsTerminal: vi.fn(),
      hasSceneletsForStory: vi.fn(async () => true),
      listSceneletsByStory: vi.fn(async () => []),
    } as any);
    createShotsRepositoryMock.mockReturnValue({
      getShotsByStory: vi.fn(async () => ({})),
      getShotsBySceneletRef: vi.fn(async () => []),
      createSceneletShots: vi.fn(),
      findSceneletIdsMissingShots: vi.fn(async () => []),
      findShotsMissingImages: vi.fn(async () => []),
      findShotsMissingVideos: vi.fn(async () => []),
      updateShotImagePaths: vi.fn(),
      updateShotAudioPath: vi.fn(),
      updateShotVideoPath: vi.fn(),
    } as any);

    errors.length = 0;
    logs.length = 0;
    process.exitCode = undefined;

    await runCli(
      [
        'run-task',
        '--task',
        'CREATE_SHOT_IMAGES',
        '--story-id',
        'story-1',
        '--scenelet-id',
        '--override',
      ],
      {
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      }
    );

    expect(process.exitCode).toBe(1);
    expect(errors.join('\n')).toContain('Missing value for --scenelet-id flag.');
    expect(logs).toEqual([]);
  });

  it('accepts --resume for CREATE_SHOT_AUDIO tasks', async () => {
    const storiesRepository = {
      getStoryById: vi.fn(async () => null),
      createStory: vi.fn(),
      updateStoryArtifacts: vi.fn(),
    };
    const sceneletsRepository = {
      createScenelet: vi.fn(),
      markSceneletAsBranchPoint: vi.fn(),
      markSceneletAsTerminal: vi.fn(),
      hasSceneletsForStory: vi.fn(async () => true),
      listSceneletsByStory: vi.fn(async () => []),
    };
    const shotsRepository = {
      getShotsByStory: vi.fn(async () => ({})),
      getShotsBySceneletRef: vi.fn(async () => []),
      createSceneletShots: vi.fn(),
      findSceneletIdsMissingShots: vi.fn(async () => []),
      findShotsMissingImages: vi.fn(async () => []),
      updateShotImagePaths: vi.fn(),
      updateShotAudioPath: vi.fn(),
    };

    createSupabaseServiceClientMock.mockReturnValue({});
    createStoriesRepositoryMock.mockReturnValue(storiesRepository as any);
    createSceneletsRepositoryMock.mockReturnValue(sceneletsRepository as any);
    createShotsRepositoryMock.mockReturnValue(shotsRepository as any);

    errors.length = 0;

    await runCli(
      [
        'run-task',
        '--task',
        'CREATE_SHOT_AUDIO',
        '--story-id',
        'story-1',
        '--resume',
        '--mode',
        'stub',
      ],
      {
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      }
    );

    expect(errors.join(' ')).not.toContain('--resume can only be used');
  });

  it('fails gracefully when story missing for run-task', async () => {
    const { repository } = createStoriesRepositoryStub();
    const { repository: sceneletsRepository } = createSceneletsRepositoryStub();
    const shotsRepository = createShotsRepositoryStub();

    createSupabaseServiceClientMock.mockReturnValue({});
    createStoriesRepositoryMock.mockReturnValue(repository);
    createSceneletsRepositoryMock.mockReturnValue(sceneletsRepository);
    createShotsRepositoryMock.mockReturnValue(shotsRepository);

    await runCli(['run-task', '--task', 'CREATE_CONSTITUTION', '--story-id', 'story-missing'], {
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    });

    expect(process.exitCode).toBe(1);
    expect(errors.some((line) => line.includes('Story story-missing not found.'))).toBe(true);
  });

  it('uses remote Supabase credentials when --remote flag provided', async () => {
    const { repository } = createStoriesRepositoryStub();
    const { repository: sceneletsRepository } = createSceneletsRepositoryStub();
    const shotsRepository = createShotsRepositoryStub();

    createSupabaseServiceClientMock.mockReturnValue({});
    createStoriesRepositoryMock.mockReturnValue(repository);
    createSceneletsRepositoryMock.mockReturnValue(sceneletsRepository);
    createShotsRepositoryMock.mockReturnValue(shotsRepository);

    await runCli(['create', '--prompt', 'Remote workflow', '--remote'], {
      SUPABASE_REMOTE_URL: 'https://remote.example',
      SUPABASE_REMOTE_SERVICE_ROLE_KEY: 'remote-key',
      SUPABASE_URL: 'https://fallback.example',
      SUPABASE_SERVICE_ROLE_KEY: 'fallback-key',
    });

    expect(createSupabaseServiceClientMock).toHaveBeenCalledWith({
      url: 'https://remote.example',
      serviceRoleKey: 'remote-key',
    });
  });

  it('lists available tasks when --task flag is missing', async () => {
    await runCli(['run-task', '--story-id', 'story-1'], {
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    });

    expect(process.exitCode).toBe(1);
    const combinedErrors = errors.join(' ');
    expect(combinedErrors).toContain('CREATE_CONSTITUTION');
    expect(combinedErrors).toContain('CREATE_INTERACTIVE_SCRIPT');
    expect(combinedErrors).toContain('CREATE_VISUAL_DESIGN');
    expect(combinedErrors).toContain('CREATE_SHOT_PRODUCTION');
    expect(combinedErrors).toContain('CREATE_SHOT_VIDEO');
    expect(combinedErrors).toContain('CREATE_AUDIO_DESIGN');
  });

  it('rejects resume flag with environment id for environment reference task', async () => {
    errors.length = 0;
    await runCli(
      [
        'run-task',
        '--task',
        'CREATE_ENVIRONMENT_REFERENCE_IMAGE',
        '--story-id',
        'story-1',
        '--environment-id',
        'forest-clearing',
        '--resume',
      ],
      {
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      }
    );

    expect(process.exitCode).toBe(1);
    expect(errors.join(' ')).toContain(
      '--resume cannot be combined with --environment-id for CREATE_ENVIRONMENT_REFERENCE_IMAGE.'
    );
  });
});
