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
import type { ShotCreationInput, ShotProductionShotsRepository } from '../src/shot-production/types.js';

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
  const created: Array<{ storyId: string; sceneletId: string; sceneletSequence: number; shotIndices: number[] }> = [];
  const repository = {
    createSceneletShots: vi.fn(async (
      storyId: string,
      sceneletId: string,
      sceneletSequence: number,
      shots: ShotCreationInput[]
    ) => {
      created.push({
        storyId,
        sceneletId,
        sceneletSequence,
        shotIndices: shots.map((shot) => shot.shotIndex),
      });
    }),
    findSceneletIdsMissingShots: vi.fn(async (_storyId: string, sceneletIds: string[]) => sceneletIds),
  } satisfies ShotProductionShotsRepository & {
    created: Array<{ storyId: string; sceneletId: string; sceneletSequence: number; shotIndices: number[] }>;
  };
  (repository as typeof repository & {
    created: Array<{ storyId: string; sceneletId: string; sceneletSequence: number; shotIndices: number[] }>;
  }).created = created;
  return repository as typeof repository & {
    created: Array<{ storyId: string; sceneletId: string; sceneletSequence: number; shotIndices: number[] }>;
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
    expect(stories[0]?.audioDesignDocument).not.toBeNull();
    expect(shotsRepository.created).toEqual([
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

    const prerequisiteTasks: Array<'CREATE_CONSTITUTION' | 'CREATE_INTERACTIVE_SCRIPT' | 'CREATE_VISUAL_DESIGN' | 'CREATE_AUDIO_DESIGN'> = [
      'CREATE_CONSTITUTION',
      'CREATE_INTERACTIVE_SCRIPT',
      'CREATE_VISUAL_DESIGN',
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
    expect(shotsRepository.created).toEqual([
      { storyId, sceneletId: 'scenelet-1', sceneletSequence: 1, shotIndices: [1, 2] },
      { storyId, sceneletId: 'scenelet-2', sceneletSequence: 2, shotIndices: [1, 2] },
      { storyId, sceneletId: 'scenelet-3', sceneletSequence: 3, shotIndices: [1, 2] },
      { storyId, sceneletId: 'scenelet-4', sceneletSequence: 4, shotIndices: [1, 2] },
      { storyId, sceneletId: 'scenelet-5', sceneletSequence: 5, shotIndices: [1, 2] },
    ]);
    expect(stories[0]?.visualDesignDocument).not.toBeNull();
    expect(stories[0]?.audioDesignDocument).not.toBeNull();
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
    expect(combinedErrors).toContain('CREATE_AUDIO_DESIGN');
  });
});
