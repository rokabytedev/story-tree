#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { config as loadEnv } from 'dotenv';

import {
  createSupabaseServiceClient,
  SupabaseConfigurationError,
} from '../client.js';
import {
  createStoriesRepository,
  StoryNotFoundError,
  type StoriesRepository,
} from '../storiesRepository.js';

type ConnectionMode = 'local' | 'remote';

interface ParsedGlobalOptions {
  mode: ConnectionMode;
  supabaseUrlOverride?: string;
  serviceRoleKeyOverride?: string;
  helpRequested: boolean;
}

interface ConnectionOptions {
  mode: ConnectionMode;
  urlOverride?: string;
  serviceRoleKeyOverride?: string;
}

const CLI_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(CLI_DIRECTORY, '../../..');

type ConstitutionSource =
  | { kind: 'inline'; value: string }
  | { kind: 'file'; path: string };

type CliInvocation =
  | { kind: 'help'; connection: ConnectionOptions }
  | { kind: 'create'; connection: ConnectionOptions; displayName?: string; initialPrompt?: string }
  | { kind: 'list'; connection: ConnectionOptions }
  | { kind: 'show'; connection: ConnectionOptions; storyId: string }
  | { kind: 'delete'; connection: ConnectionOptions; storyId: string }
  | {
      kind: 'set-constitution';
      connection: ConnectionOptions;
      storyId: string;
      constitutionSource: ConstitutionSource;
    };

loadEnvironmentVariables();

class CliParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliParseError';
  }
}

function parseArguments(argv: string[]): CliInvocation {
  const { globalOptions, positionals, flagValues } = partitionArgs(argv);

  const connection: ConnectionOptions = {
    mode: globalOptions.mode,
    urlOverride: globalOptions.supabaseUrlOverride,
    serviceRoleKeyOverride: globalOptions.serviceRoleKeyOverride,
  };

  if (globalOptions.helpRequested || positionals.length === 0) {
    return { kind: 'help', connection };
  }

  const command = positionals[0];

  switch (command) {
    case 'create': {
      const displayName = flagValues.get('name') ?? positionals[1];
      const prompt =
        flagValues.get('prompt') ??
        flagValues.get('brief') ??
        flagValues.get('initial-prompt') ??
        positionals[2];
      return { kind: 'create', connection, displayName, initialPrompt: prompt };
    }
    case 'list':
      return { kind: 'list', connection };
    case 'show': {
      const storyId = flagValues.get('story-id') ?? flagValues.get('id') ?? positionals[1];
      if (!storyId || !storyId.trim()) {
        throw new CliParseError('Story id is required. Provide --story-id <id>.');
      }

      return { kind: 'show', connection, storyId };
    }
    case 'delete': {
      const storyId = flagValues.get('story-id') ?? flagValues.get('id') ?? positionals[1];
      if (!storyId || !storyId.trim()) {
        throw new CliParseError('Story id is required. Provide --story-id <id>.');
      }

      return { kind: 'delete', connection, storyId };
    }
    case 'set-constitution': {
      const storyId = flagValues.get('story-id') ?? flagValues.get('id') ?? positionals[1];
      if (!storyId || !storyId.trim()) {
        throw new CliParseError('Story id is required. Provide --story-id <id>.');
      }

      const constitutionText = flagValues.get('constitution');
      const constitutionFile = flagValues.get('constitution-file');

      if (!constitutionText && !constitutionFile) {
        throw new CliParseError('Provide constitution text with --constitution or a file via --constitution-file.');
      }

      if (constitutionText && constitutionFile) {
        throw new CliParseError('Specify only one of --constitution or --constitution-file.');
      }

      const constitutionSource = constitutionText
        ? ({ kind: 'inline', value: constitutionText } as const)
        : ({ kind: 'file', path: constitutionFile! } as const);

      return { kind: 'set-constitution', connection, storyId, constitutionSource };
    }
    default:
      throw new CliParseError(`Unknown command "${command}". Use --help to see available commands.`);
  }
}

function partitionArgs(argv: string[]): {
  globalOptions: ParsedGlobalOptions;
  positionals: string[];
  flagValues: Map<string, string>;
} {
  const positionals: string[] = [];
  const flagValues = new Map<string, string>();

  let helpRequested = false;
  let mode: ConnectionMode = 'local';
  let supabaseUrlOverride: string | undefined;
  let serviceRoleKeyOverride: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === '--help' || token === '-h') {
      helpRequested = true;
      continue;
    }

    if (token.startsWith('--')) {
      const equalsIndex = token.indexOf('=');
      const hasValue = equalsIndex !== -1;
      const flagName = token.substring(2, hasValue ? equalsIndex : undefined);
      const value = hasValue ? token.substring(equalsIndex + 1) : argv[i + 1];

      switch (flagName) {
        case 'remote':
          mode = 'remote';
          if (!hasValue) {
            continue;
          }
          break;
        case 'mode': {
          const normalized = (value ?? '').toLowerCase();
          if (normalized === 'remote') {
            mode = 'remote';
          } else if (normalized === 'local') {
            mode = 'local';
          } else {
            throw new CliParseError('Invalid --mode value. Use "local" or "remote".');
          }
          if (!hasValue) {
            i += 1;
          }
          continue;
        }
        case 'url': {
          const flagValue = resolveFlagValue(flagName, value, hasValue, argv, i);
          supabaseUrlOverride = flagValue;
          i += hasValue ? 0 : 1;
          continue;
        }
        case 'service-role-key': {
          const flagValue = resolveFlagValue(flagName, value, hasValue, argv, i);
          serviceRoleKeyOverride = flagValue;
          i += hasValue ? 0 : 1;
          continue;
        }
        default: {
          const flagValue = resolveFlagValue(flagName, value, hasValue, argv, i);
          flagValues.set(flagName, flagValue);
          i += hasValue ? 0 : 1;
          continue;
        }
      }

      if (!hasValue) {
        i += 1;
      }
      continue;
    }

    if (token.startsWith('-') && token !== '-') {
      throw new CliParseError(`Unsupported short flag "${token}". Use long form flags (e.g. --help).`);
    }

    positionals.push(token);
  }

  const globalOptions: ParsedGlobalOptions = {
    mode,
    supabaseUrlOverride,
    serviceRoleKeyOverride,
    helpRequested,
  };

  return { globalOptions, positionals, flagValues };
}

function loadEnvironmentVariables(): void {
  const searchRoots = Array.from(new Set([process.cwd(), REPO_ROOT]));
  const envFiles = ['.env', '.env.local'];

  for (const root of searchRoots) {
    for (const fileName of envFiles) {
      const path = resolve(root, fileName);
      if (existsSync(path)) {
        loadEnv({ path, override: true });
      }
    }
  }
}

function resolveFlagValue(
  flagName: string,
  value: string | undefined,
  hasValue: boolean,
  argv: string[],
  index: number
): string {
  if (hasValue) {
    return value ?? '';
  }

  const next = argv[index + 1];
  if (!next || next.startsWith('--')) {
    throw new CliParseError(`Flag --${flagName} requires a value.`);
  }
  return next;
}

async function runCli(argv: string[], env: NodeJS.ProcessEnv): Promise<void> {
  let invocation: CliInvocation;

  try {
    invocation = parseArguments(argv);
  } catch (parseError) {
    handleError(parseError);
    process.exitCode = 1;
    return;
  }

  if (invocation.kind === 'help') {
    printHelp();
    return;
  }

  let repository: StoriesRepository;

  try {
    repository = createRepository(invocation.connection, env);
  } catch (configError) {
    handleError(configError);
    process.exitCode = 1;
    return;
  }

  try {
    switch (invocation.kind) {
      case 'create': {
        const displayName = buildDisplayName(invocation.displayName);
        const initialPrompt = buildInitialPrompt(invocation.initialPrompt);
        const record = await repository.createStory({ displayName, initialPrompt });
        console.log(record.id);
        break;
      }
      case 'list': {
        const stories = await repository.listStories();
        if (stories.length > 0) {
          console.log('ID\tDisplay Name');
          for (const story of stories) {
            console.log(`${story.id}\t${story.displayName}`);
          }
        }
        break;
      }
      case 'show': {
        const story = await repository.getStoryById(invocation.storyId);
        if (!story) {
          handleError(new StoryNotFoundError(`Story ${invocation.storyId} not found.`));
          process.exitCode = 1;
          return;
        }

        console.log(JSON.stringify(story, null, 2));
        break;
      }
      case 'delete': {
        await repository.deleteStoryById(invocation.storyId);
        console.log(`Deleted story ${invocation.storyId}`);
        break;
      }
      case 'set-constitution': {
        const constitution = await loadConstitution(invocation.constitutionSource);
        await repository.updateStoryArtifacts(invocation.storyId, {
          storyConstitution: constitution,
        });
        console.log(`Updated story ${invocation.storyId}`);
        break;
      }
    }
  } catch (error) {
    if (error instanceof StoryNotFoundError) {
      handleError(error);
      process.exitCode = 1;
      return;
    }

    handleError(error);
    process.exitCode = 1;
  }
}

function createRepository(connection: ConnectionOptions, env: NodeJS.ProcessEnv): StoriesRepository {
  const { url, serviceRoleKey } = resolveSupabaseCredentials(connection, env);
  const client = createSupabaseServiceClient({ url, serviceRoleKey });
  return createStoriesRepository(client);
}

function resolveSupabaseCredentials(
  connection: ConnectionOptions,
  env: NodeJS.ProcessEnv
): { url: string; serviceRoleKey: string } {
  const urlSources: Array<string | undefined> =
    connection.mode === 'remote'
      ? [connection.urlOverride, env.SUPABASE_REMOTE_URL]
      : [connection.urlOverride, env.SUPABASE_LOCAL_URL, env.SUPABASE_URL];

  const keySources: Array<string | undefined> =
    connection.mode === 'remote'
      ? [connection.serviceRoleKeyOverride, env.SUPABASE_REMOTE_SERVICE_ROLE_KEY]
      : [connection.serviceRoleKeyOverride, env.SUPABASE_LOCAL_SERVICE_ROLE_KEY, env.SUPABASE_SERVICE_ROLE_KEY];

  const url = firstNonEmptyValue(urlSources);
  const serviceRoleKey = firstNonEmptyValue(keySources);

  if (!url) {
    const message =
      connection.mode === 'remote'
        ? 'Missing remote Supabase URL. Provide --url or set SUPABASE_REMOTE_URL.'
        : 'Missing local Supabase URL. Provide --url or set SUPABASE_LOCAL_URL (fallback SUPABASE_URL).';
    throw new SupabaseConfigurationError(message);
  }

  if (!serviceRoleKey) {
    const message =
      connection.mode === 'remote'
        ? 'Missing remote Supabase service role key. Provide --service-role-key or set SUPABASE_REMOTE_SERVICE_ROLE_KEY.'
        : 'Missing local Supabase service role key. Provide --service-role-key or set SUPABASE_LOCAL_SERVICE_ROLE_KEY (fallback SUPABASE_SERVICE_ROLE_KEY).';
    throw new SupabaseConfigurationError(message);
  }

  return { url, serviceRoleKey };
}

function firstNonEmptyValue(values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function buildDisplayName(proposed?: string): string {
  const trimmed = proposed?.trim();
  if (trimmed) {
    return trimmed;
  }
  return `Story ${new Date().toISOString()}`;
}

function buildInitialPrompt(proposed?: string): string {
  const trimmed = proposed?.trim();
  if (!trimmed) {
    throw new CliParseError('Initial prompt is required. Provide --prompt <text>.');
  }
  return trimmed;
}

async function loadConstitution(source: ConstitutionSource): Promise<string> {
  if (source.kind === 'inline') {
    const value = source.value.trim();
    if (!value) {
      throw new CliParseError('Constitution text cannot be empty.');
    }
    return value;
  }

  const fileContents = await readFile(source.path, 'utf8');
  const trimmed = fileContents.trim();
  if (!trimmed) {
    throw new CliParseError(`Constitution file "${source.path}" is empty.`);
  }
  return trimmed;
}

function printHelp(): void {
  const lines = [
    'Supabase Stories CLI',
    '',
    'Usage:',
    '  stories-cli create --prompt <story_prompt> [--name <display_name>] [--mode <local|remote>] [--url <url>] [--service-role-key <key>]',
    '  stories-cli list [--mode <local|remote>] [--url <url>] [--service-role-key <key>]',
    '  stories-cli show --story-id <id> [--mode <local|remote>] [--url <url>] [--service-role-key <key>]',
    '  stories-cli delete --story-id <id> [--mode <local|remote>] [--url <url>] [--service-role-key <key>]',
    '  stories-cli set-constitution --story-id <id> (--constitution <text> | --constitution-file <path>) [--mode <local|remote>] [--url <url>] [--service-role-key <key>]',
    '  stories-cli --help',
    '',
    'Flags:',
    '  --mode               Connection mode (local default, remote requires remote credentials).',
    '  --remote             Shortcut for --mode remote.',
    '  --url                Override Supabase URL for the selected mode.',
    '  --service-role-key   Override Supabase service role key for the selected mode.',
    '  --name               Optional display name for `create` command.',
    '  --story-id           Target story id for `set-constitution` and `delete`.',
    '  --constitution       Inline constitution markdown text.',
    '  --constitution-file  Path to file containing constitution markdown.',
    '  -h, --help           Show this message.',
    '',
    'Environment variables:',
    '  Local mode (default): SUPABASE_LOCAL_URL, SUPABASE_LOCAL_SERVICE_ROLE_KEY (fallback SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY).',
    '  Remote mode: SUPABASE_REMOTE_URL, SUPABASE_REMOTE_SERVICE_ROLE_KEY.',
  ];

  console.log(lines.join('\n'));
}

function handleError(error: unknown): void {
  if (error instanceof CliParseError) {
    console.error(error.message);
    return;
  }

  if (error instanceof Error) {
    console.error(error.message);
    return;
  }

  console.error('An unknown error occurred.');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  runCli(process.argv.slice(2), process.env).catch((error) => {
    handleError(error);
    process.exitCode = 1;
  });
}

export {
  buildDisplayName,
  CliParseError,
  parseArguments,
  partitionArgs,
  resolveSupabaseCredentials,
  runCli,
};
