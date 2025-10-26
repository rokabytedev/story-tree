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

describe('agentWorkflow CLI', () => {
  const logs: string[] = [];
  const errors: string[] = [];

  beforeEach(() => {
    createSupabaseServiceClientMock.mockReset();
    createStoriesRepositoryMock.mockReset();
    createSceneletsRepositoryMock.mockReset();

    createSupabaseServiceClientMock.mockImplementation(() => {
      throw new Error('createSupabaseServiceClient should not be called in stub mode.');
    });
    createStoriesRepositoryMock.mockImplementation(() => {
      throw new Error('createStoriesRepository should not be called in stub mode.');
    });
    createSceneletsRepositoryMock.mockImplementation(() => {
      throw new Error('createSceneletsRepository should not be called in stub mode.');
    });

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
    createSupabaseServiceClientMock.mockReset();
    createStoriesRepositoryMock.mockReset();
    createSceneletsRepositoryMock.mockReset();
    process.exitCode = undefined;
  });

  it('runs in stub mode and prints final tables', async () => {
    await runCli(['--prompt', 'Stub adventure', '--stub'], {});

    expect(errors).toEqual([]);
    expect(process.exitCode).toBeUndefined();
    expect(logs.length).toBeGreaterThanOrEqual(3);
    const result = JSON.parse(logs[0]);
    expect(result.storyTitle).toBe('Stubbed Story Constitution');
    expect(result.storyConstitutionMarkdown).toContain('Stub adventure');
    expect(logs).toContain('--- Stub Stories Table ---');
    expect(logs).toContain('--- Stub Scenelets Table ---');
  });

  it('errors when prompt missing', async () => {
    await runCli(['--stub'], {});

    expect(process.exitCode).toBe(1);
    expect(errors.some((line) => line.includes('Provide a story prompt'))).toBe(true);
  });

  it('prints debug logs when verbose flag enabled', async () => {
    await runCli(['--prompt', 'Stub adventure', '--stub', '--verbose'], {});

    expect(logs.some((line) => line.includes('[agent-workflow]'))).toBe(true);
    expect(logs.some((line) => line.includes('Interactive story Gemini request'))).toBe(true);
  });

  it('runs hybrid mode with stubbed Gemini and Supabase persistence', async () => {
    const createStoryMock = vi
      .fn()
      .mockResolvedValue({
        id: 'story-123',
        displayName: 'Untitled Story',
        displayNameUpper: 'UNTITLED STORY',
        initialPrompt: 'Hybrid voyage',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        storyConstitution: null,
        visualDesignDocument: null,
        audioDesignDocument: null,
        visualReferencePackage: null,
        storyboardBreakdown: null,
        generationPrompts: null,
      });

    const updateStoryArtifactsMock = vi.fn().mockImplementation(async (_storyId, patch) => ({
      id: 'story-123',
      displayName: patch.displayName ?? 'Stubbed Story Constitution',
      displayNameUpper: (patch.displayName ?? 'Stubbed Story Constitution').toUpperCase(),
      initialPrompt: 'Hybrid voyage',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      storyConstitution: patch.storyConstitution ?? null,
      visualDesignDocument: null,
      audioDesignDocument: null,
      visualReferencePackage: null,
      storyboardBreakdown: null,
      generationPrompts: null,
    }));

    createStoriesRepositoryMock.mockReturnValue({
      createStory: createStoryMock,
      updateStoryArtifacts: updateStoryArtifactsMock,
      getStoryById: vi.fn(),
      listStories: vi.fn(),
      deleteStoryById: vi.fn(),
    });

    const createSceneletMock = vi.fn().mockImplementation(async ({ storyId, parentId, content }) => ({
      id: `scenelet-${createSceneletMock.mock.calls.length + 1}`,
      storyId,
      parentId: parentId ?? null,
      choiceLabelFromParent: content.choice_label ?? null,
      choicePrompt: null,
      content,
      isBranchPoint: false,
      isTerminalNode: false,
      createdAt: '2025-01-01T00:00:00.000Z',
    }));
    const markSceneletAsBranchPointMock = vi.fn().mockResolvedValue(undefined);
    const markSceneletAsTerminalMock = vi.fn().mockResolvedValue(undefined);
    createSceneletsRepositoryMock.mockReturnValue({
      createScenelet: createSceneletMock,
      markSceneletAsBranchPoint: markSceneletAsBranchPointMock,
      markSceneletAsTerminal: markSceneletAsTerminalMock,
    });

    createSupabaseServiceClientMock.mockReturnValue({});

    await runCli(['--prompt', 'Hybrid voyage', '--hybrid'], {
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    });

    expect(errors).toEqual([]);
    expect(process.exitCode).toBeUndefined();
    expect(createSupabaseServiceClientMock).toHaveBeenCalledWith({
      url: 'http://localhost:54321',
      serviceRoleKey: 'service-role-key',
    });
    expect(createStoryMock).toHaveBeenCalledWith({
      displayName: 'Untitled Story',
      initialPrompt: 'Hybrid voyage',
    });
    expect(updateStoryArtifactsMock).toHaveBeenCalled();
    expect(createSceneletMock).toHaveBeenCalled();
    expect(markSceneletAsBranchPointMock).toHaveBeenCalled();
    expect(markSceneletAsTerminalMock).toHaveBeenCalled();
    const result = JSON.parse(logs[0]);
    expect(result.storyTitle).toBe('Stubbed Story Constitution');
  });
});
