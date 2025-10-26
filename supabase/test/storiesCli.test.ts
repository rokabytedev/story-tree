import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createSupabaseServiceClientMock,
  createStoriesRepositoryMock,
  MockStoryNotFoundError,
  MockSupabaseConfigurationError,
} = vi.hoisted(() => {
  return {
    createSupabaseServiceClientMock: vi.fn(),
    createStoriesRepositoryMock: vi.fn(),
    MockStoryNotFoundError: class MockStoryNotFoundError extends Error {},
    MockSupabaseConfigurationError: class MockSupabaseConfigurationError extends Error {},
  };
});

vi.mock('../src/client.js', () => ({
  createSupabaseServiceClient: createSupabaseServiceClientMock,
  SupabaseConfigurationError: MockSupabaseConfigurationError,
}));

vi.mock('../src/storiesRepository.js', () => ({
  createStoriesRepository: createStoriesRepositoryMock,
  StoryNotFoundError: MockStoryNotFoundError,
}));

import {
  buildDisplayName,
  CliParseError,
  parseArguments,
  resolveSupabaseCredentials,
  runCli,
} from '../src/cli/storiesCli.js';

describe('storiesCli parseArguments', () => {
  it('parses create command with name and prompt', () => {
    const invocation = parseArguments(['create', '--name', 'Alpha Story', '--prompt', 'Tell Alpha.']);
    expect(invocation.kind).toBe('create');
    if (invocation.kind === 'create') {
      expect(invocation.displayName).toBe('Alpha Story');
      expect(invocation.initialPrompt).toBe('Tell Alpha.');
      expect(invocation.connection.mode).toBe('local');
    }
  });

  it('parses set-constitution command with inline text', () => {
    const invocation = parseArguments([
      '--mode',
      'remote',
      'set-constitution',
      '--story-id',
      'abc',
      '--constitution',
      '# Heading',
    ]);

    expect(invocation.kind).toBe('set-constitution');
    if (invocation.kind === 'set-constitution') {
      expect(invocation.storyId).toBe('abc');
      expect(invocation.constitutionSource).toEqual({ kind: 'inline', value: '# Heading' });
      expect(invocation.connection.mode).toBe('remote');
    }
  });

  it('throws when constitution source missing', () => {
    expect(() => parseArguments(['set-constitution', '--story-id', 'abc'])).toThrow(CliParseError);
  });

  it('parses show command with positional id', () => {
    const invocation = parseArguments(['show', 'abc']);
    expect(invocation.kind).toBe('show');
    if (invocation.kind === 'show') {
      expect(invocation.storyId).toBe('abc');
    }
  });

  it('parses delete command with positional id', () => {
    const invocation = parseArguments(['delete', 'abc']);
    expect(invocation.kind).toBe('delete');
    if (invocation.kind === 'delete') {
      expect(invocation.storyId).toBe('abc');
    }
  });
});

describe('storiesCli utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-20T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('buildDisplayName falls back to timestamp', () => {
    expect(buildDisplayName(undefined)).toBe('Story 2025-01-20T00:00:00.000Z');
  });

  it('resolveSupabaseCredentials selects local env defaults', () => {
    const creds = resolveSupabaseCredentials(
      { mode: 'local' },
      {
        SUPABASE_SERVICE_ROLE_KEY: 'default-key',
        SUPABASE_URL: 'http://localhost:54321',
      }
    );

    expect(creds).toEqual({
      serviceRoleKey: 'default-key',
      url: 'http://localhost:54321',
    });
  });

  it('resolveSupabaseCredentials throws when remote env missing', () => {
    expect(() =>
      resolveSupabaseCredentials(
        { mode: 'remote' },
        {
          SUPABASE_URL: 'http://localhost:54321',
          SUPABASE_SERVICE_ROLE_KEY: 'local-key',
        }
      )
    ).toThrow(MockSupabaseConfigurationError);
  });

  it('resolveSupabaseCredentials returns remote env values when present', () => {
    const creds = resolveSupabaseCredentials(
      { mode: 'remote' },
      {
        SUPABASE_REMOTE_URL: 'https://remote.supabase.co',
        SUPABASE_REMOTE_SERVICE_ROLE_KEY: 'remote-key',
      }
    );

    expect(creds).toEqual({
      serviceRoleKey: 'remote-key',
      url: 'https://remote.supabase.co',
    });
  });
});

describe('storiesCli runCli', () => {
  const createStoryMock = vi.fn();
  const updateStoryArtifactsMock = vi.fn();
  const listStoriesMock = vi.fn();
  const getStoryByIdMock = vi.fn();
  const deleteStoryByIdMock = vi.fn();
  const logs: string[] = [];
  const errors: string[] = [];

  beforeEach(() => {
    createSupabaseServiceClientMock.mockReturnValue({});
    createStoriesRepositoryMock.mockReturnValue({
      createStory: createStoryMock,
      updateStoryArtifacts: updateStoryArtifactsMock,
      getStoryById: getStoryByIdMock,
      listStories: listStoriesMock,
      deleteStoryById: deleteStoryByIdMock,
    });

    createStoryMock.mockResolvedValue({ id: 'generated-id' });
    updateStoryArtifactsMock.mockResolvedValue({ id: 'story-id' });
    listStoriesMock.mockResolvedValue([]);
    getStoryByIdMock.mockResolvedValue(null);
    deleteStoryByIdMock.mockResolvedValue(undefined);

    logs.length = 0;
    errors.length = 0;

    vi.spyOn(console, 'log').mockImplementation((value?: unknown) => {
      logs.push(String(value ?? ''));
    });
    vi.spyOn(console, 'error').mockImplementation((value?: unknown) => {
      errors.push(String(value ?? ''));
    });
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    process.exitCode = undefined;
  });

  it('runs create command and prints id', async () => {
    await runCli(['create', '--name', 'CLI Story', '--prompt', 'Tell me a story.'], {
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'local-key',
    });

    expect(createSupabaseServiceClientMock).toHaveBeenCalledWith({
      serviceRoleKey: 'local-key',
      url: 'http://localhost:54321',
    });
    expect(createStoryMock).toHaveBeenCalledWith({
      displayName: 'CLI Story',
      initialPrompt: 'Tell me a story.',
    });
    expect(logs).toContain('generated-id');
    expect(process.exitCode).toBeUndefined();
  });

  it('requires a prompt for create command', async () => {
    await runCli(['create', '--name', 'CLI Story'], {
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'local-key',
    });

    expect(process.exitCode).toBe(1);
    expect(errors.some((line) => line.includes('Initial prompt is required'))).toBe(true);
  });

  it('runs set-constitution with file content', async () => {
    const tempPath = join(tmpdir(), `constitution-${Date.now()}.md`);
    await writeFile(tempPath, '# Constitution');

    await runCli(
      ['set-constitution', '--story-id', 'abc', '--constitution-file', tempPath],
      {
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_SERVICE_ROLE_KEY: 'local-key',
      }
    );

    expect(updateStoryArtifactsMock).toHaveBeenCalledWith('abc', {
      storyConstitution: '# Constitution',
    });
    expect(logs.some((line) => line.includes('Updated story abc'))).toBe(true);
  });

  it('sets exitCode when story not found', async () => {
    updateStoryArtifactsMock.mockRejectedValueOnce(new MockStoryNotFoundError('missing'));

    await runCli(
      ['set-constitution', '--story-id', 'abc', '--constitution', 'content'],
      {
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_SERVICE_ROLE_KEY: 'local-key',
      }
    );

    expect(process.exitCode).toBe(1);
    expect(errors).toContain('missing');
  });

  it('runs list command and prints summaries', async () => {
    listStoriesMock.mockResolvedValueOnce([
      {
        id: 'id-1',
        displayName: 'Alpha',
        displayNameUpper: 'ALPHA',
        initialPrompt: 'Tell Alpha.',
        createdAt: '',
        updatedAt: '',
        storyConstitution: null,
        visualDesignDocument: null,
        audioDesignDocument: null,
        visualReferencePackage: null,
        storyboardBreakdown: null,
        generationPrompts: null,
      },
      {
        id: 'id-2',
        displayName: 'Beta',
        displayNameUpper: 'BETA',
        initialPrompt: 'Tell Beta.',
        createdAt: '',
        updatedAt: '',
        storyConstitution: null,
        visualDesignDocument: null,
        audioDesignDocument: null,
        visualReferencePackage: null,
        storyboardBreakdown: null,
        generationPrompts: null,
      },
    ]);

    await runCli(['list'], {
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'local-key',
    });

    expect(listStoriesMock).toHaveBeenCalled();
    expect(logs[0]).toBe('ID\tDisplay Name');
    expect(logs[1]).toBe('id-1\tAlpha');
    expect(logs[2]).toBe('id-2\tBeta');
  });

  it('list command emits no output when empty', async () => {
    listStoriesMock.mockResolvedValueOnce([]);

    await runCli(['list'], {
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'local-key',
    });

    expect(logs).toHaveLength(0);
  });

  it('runs show command and prints JSON', async () => {
    getStoryByIdMock.mockResolvedValueOnce({
      id: 'abc',
      displayName: 'Alpha',
      displayNameUpper: 'ALPHA',
      initialPrompt: 'Tell Alpha.',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-02',
      storyConstitution: null,
      visualDesignDocument: null,
      audioDesignDocument: null,
      visualReferencePackage: null,
      storyboardBreakdown: null,
      generationPrompts: null,
    });

    await runCli(['show', 'abc'], {
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'local-key',
    });

    expect(getStoryByIdMock).toHaveBeenCalledWith('abc');
    expect(JSON.parse(logs[0])).toMatchObject({ id: 'abc', displayName: 'Alpha' });
  });

  it('show command sets exit code when story missing', async () => {
    getStoryByIdMock.mockResolvedValueOnce(null);

    await runCli(['show', '--story-id', 'abc'], {
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'local-key',
    });

    expect(process.exitCode).toBe(1);
    expect(errors).toContain('Story abc not found.');
  });

  it('runs delete command and prints confirmation', async () => {
    await runCli(['delete', 'abc'], {
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'local-key',
    });

    expect(deleteStoryByIdMock).toHaveBeenCalledWith('abc');
    expect(logs).toContain('Deleted story abc');
    expect(process.exitCode).toBeUndefined();
  });

  it('delete command surfaces StoryNotFoundError', async () => {
    deleteStoryByIdMock.mockRejectedValueOnce(new MockStoryNotFoundError('missing story'));

    await runCli(['delete', '--story-id', 'abc'], {
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'local-key',
    });

    expect(process.exitCode).toBe(1);
    expect(errors).toContain('missing story');
  });
});
