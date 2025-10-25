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
  it('parses create command with optional name', () => {
    const invocation = parseArguments(['create', '--name', 'Alpha Story']);
    expect(invocation.kind).toBe('create');
    if (invocation.kind === 'create') {
      expect(invocation.displayName).toBe('Alpha Story');
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
      resolveSupabaseCredentials({ mode: 'remote' }, { SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' })
    ).toThrow(MockSupabaseConfigurationError);
  });
});

describe('storiesCli runCli', () => {
  const createStoryMock = vi.fn();
  const updateStoryArtifactsMock = vi.fn();
  const logs: string[] = [];
  const errors: string[] = [];

  beforeEach(() => {
    createSupabaseServiceClientMock.mockReturnValue({});
    createStoriesRepositoryMock.mockReturnValue({
      createStory: createStoryMock,
      updateStoryArtifacts: updateStoryArtifactsMock,
      getStoryById: vi.fn(),
    });

    createStoryMock.mockResolvedValue({ id: 'generated-id' });
    updateStoryArtifactsMock.mockResolvedValue({ id: 'story-id' });

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
    await runCli(['create', '--name', 'CLI Story'], {
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'local-key',
    });

    expect(createSupabaseServiceClientMock).toHaveBeenCalledWith({
      serviceRoleKey: 'local-key',
      url: 'http://localhost:54321',
    });
    expect(createStoryMock).toHaveBeenCalledWith({ displayName: 'CLI Story' });
    expect(logs).toContain('generated-id');
    expect(process.exitCode).toBeUndefined();
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
});
