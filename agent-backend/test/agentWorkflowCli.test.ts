import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createSupabaseServiceClientMock,
  createStoriesRepositoryMock,
  createSceneletsRepositoryMock,
  MockSupabaseConfigurationError,
} = vi.hoisted(() => {
  return {
    createSupabaseServiceClientMock: vi.fn(),
    createStoriesRepositoryMock: vi.fn(),
    createSceneletsRepositoryMock: vi.fn(),
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

import { runCli } from '../src/cli/agentWorkflowCli.js';

interface StubStory {
  id: string;
  displayName: string;
  initialPrompt: string;
  storyConstitution: unknown | null;
  visualDesignDocument: unknown | null;
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
    ...story,
  }));

  const repository = {
    createStory: vi.fn(async ({ displayName, initialPrompt }: { displayName: string; initialPrompt: string }) => {
      const story: StubStory = {
        id: `story-${stories.length + 1}`,
        displayName,
        initialPrompt,
        storyConstitution: null,
        visualDesignDocument: null,
      };
      stories.push(story);
      return story;
    }),
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

  const repository = {
    createScenelet: vi.fn(async (input: {
      storyId: string;
      parentId?: string | null;
      choiceLabelFromParent?: string | null;
      content?: unknown;
    }) => {
      const record: SceneletStubRecord = {
        id: `scenelet-${scenelets.length + 1}`,
        storyId: input.storyId,
        parentId: input.parentId ?? null,
        choiceLabelFromParent: input.choiceLabelFromParent ?? null,
        choicePrompt: null,
        content: input.content ?? {},
        isBranchPoint: false,
        isTerminalNode: false,
        createdAt: new Date().toISOString(),
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

describe('agentWorkflow CLI', () => {
  const logs: string[] = [];
  const errors: string[] = [];

  beforeEach(() => {
    createSupabaseServiceClientMock.mockReset();
    createStoriesRepositoryMock.mockReset();
    createSceneletsRepositoryMock.mockReset();

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

    createSupabaseServiceClientMock.mockReturnValue({});
    createStoriesRepositoryMock.mockReturnValue(repository);
    createSceneletsRepositoryMock.mockReturnValue(sceneletsRepository);

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

    createSupabaseServiceClientMock.mockReturnValue({});
    createStoriesRepositoryMock.mockReturnValue(repository);
    createSceneletsRepositoryMock.mockReturnValue(sceneletsRepository);

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
  });

  it('fails gracefully when story missing for run-task', async () => {
    const { repository } = createStoriesRepositoryStub();
    const { repository: sceneletsRepository } = createSceneletsRepositoryStub();

    createSupabaseServiceClientMock.mockReturnValue({});
    createStoriesRepositoryMock.mockReturnValue(repository);
    createSceneletsRepositoryMock.mockReturnValue(sceneletsRepository);

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

    createSupabaseServiceClientMock.mockReturnValue({});
    createStoriesRepositoryMock.mockReturnValue(repository);
    createSceneletsRepositoryMock.mockReturnValue(sceneletsRepository);

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
  });
});
