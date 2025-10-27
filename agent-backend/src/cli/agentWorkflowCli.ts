#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

import { config as loadEnv } from 'dotenv';

import {
  createSupabaseServiceClient,
  SupabaseConfigurationError,
} from '../../../supabase/src/client.js';
import {
  createSceneletsRepository,
  type SceneletsRepository,
} from '../../../supabase/src/sceneletsRepository.js';
import { createStoriesRepository } from '../../../supabase/src/storiesRepository.js';
import { createShotsRepository } from '../../../supabase/src/shotsRepository.js';
import type { StoryConstitution } from '../story-constitution/types.js';
import type { GeminiGenerateJsonOptions, GeminiGenerateJsonRequest, GeminiJsonClient } from '../gemini/types.js';
import type { AgentWorkflowOptions, StoryWorkflowTask } from '../workflow/types.js';
import { createWorkflowFromPrompt, resumeWorkflowFromStoryId } from '../workflow/storyWorkflow.js';
import type { SceneletPersistence } from '../interactive-story/types.js';
import type { InteractiveStoryLogger } from '../interactive-story/types.js';
import { loadStoryTreeSnapshot } from '../story-storage/storyTreeSnapshot.js';

const CLI_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(CLI_DIRECTORY, '../..');
const CONSTITUTION_FIXTURE = resolve(REPO_ROOT, 'fixtures/story-constitution/stub-gemini-responses.json');
const INTERACTIVE_FIXTURE = resolve(REPO_ROOT, 'fixtures/interactive-story/stub-gemini-responses.json');
const VISUAL_DESIGN_FIXTURE = resolve(REPO_ROOT, 'fixtures/visual-design/stub-gemini-response.json');
const AUDIO_DESIGN_FIXTURE = resolve(
  REPO_ROOT,
  'fixtures/gemini/audio-design/success.json'
);
const SUPPORTED_TASKS: StoryWorkflowTask[] = [
  'CREATE_CONSTITUTION',
  'CREATE_INTERACTIVE_SCRIPT',
  'CREATE_VISUAL_DESIGN',
  'CREATE_AUDIO_DESIGN',
  'CREATE_SHOT_PRODUCTION',
];

type CliMode = 'stub' | 'real';

interface BaseCliOptions {
  mode: CliMode;
  verbose: boolean;
  supabaseUrl?: string;
  supabaseKey?: string;
  connectionMode: 'local' | 'remote';
}

interface CreateCommandOptions extends BaseCliOptions {
  command: 'create';
  prompt: string;
}

interface RunTaskCommandOptions extends BaseCliOptions {
  command: 'run-task';
  storyId: string;
  task: StoryWorkflowTask;
}

interface RunAllCommandOptions extends BaseCliOptions {
  command: 'run-all';
  prompt?: string;
  storyId?: string;
}

type ParsedCliCommand = CreateCommandOptions | RunTaskCommandOptions | RunAllCommandOptions;

class CliParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliParseError';
  }
}

class SceneletPersistenceAdapter implements SceneletPersistence {
  constructor(private readonly repository: SceneletsRepository) {}

  async createScenelet(input: Parameters<SceneletPersistence['createScenelet']>[0]) {
    const record = await this.repository.createScenelet({
      storyId: input.storyId,
      parentId: input.parentId ?? null,
      choiceLabelFromParent: input.choiceLabelFromParent ?? null,
      content: input.content,
    });

    return {
      id: record.id,
      storyId: record.storyId,
      parentId: record.parentId,
      choiceLabelFromParent: record.choiceLabelFromParent,
      choicePrompt: record.choicePrompt,
      content: record.content,
      isBranchPoint: record.isBranchPoint,
      isTerminalNode: record.isTerminalNode,
      createdAt: record.createdAt,
    };
  }

  async markSceneletAsBranchPoint(sceneletId: string, choicePrompt: string): Promise<void> {
    await this.repository.markSceneletAsBranchPoint(sceneletId, choicePrompt);
  }

  async markSceneletAsTerminal(sceneletId: string): Promise<void> {
    await this.repository.markSceneletAsTerminal(sceneletId);
  }

  async hasSceneletsForStory(storyId: string): Promise<boolean> {
    return this.repository.hasSceneletsForStory(storyId);
  }
}

class FixtureGeminiClient implements GeminiJsonClient {
  private index = 0;

  constructor(private readonly responses: string[]) {}

  async generateJson(
    _request: GeminiGenerateJsonRequest,
    _options?: GeminiGenerateJsonOptions
  ): Promise<string> {
    if (this.index >= this.responses.length) {
      throw new CliParseError('Ran out of stubbed Gemini responses.');
    }

    return this.responses[this.index++] ?? '';
  }
}

export async function runCli(argv: string[], env: NodeJS.ProcessEnv): Promise<void> {
  loadEnvironmentVariables();

  try {
    const parsed = parseArguments(argv);
    const result = await executeCommand(parsed, env);

    if (result !== undefined) {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    handleError(error);
    process.exitCode = 1;
  }
}

async function executeCommand(
  command: ParsedCliCommand,
  env: NodeJS.ProcessEnv
): Promise<unknown> {
  const workflowOptions = await buildWorkflowDependencies(command, env);

  switch (command.command) {
    case 'create': {
      const workflow = await createWorkflowFromPrompt(command.prompt, workflowOptions);
      return { storyId: workflow.storyId };
    }
    case 'run-task': {
      const workflow = await resumeWorkflowFromStoryId(command.storyId, workflowOptions);
      await workflow.runTask(command.task);
      return { storyId: workflow.storyId, task: command.task, status: 'completed' };
    }
    case 'run-all': {
      if (command.prompt) {
        const workflow = await createWorkflowFromPrompt(command.prompt, workflowOptions);
        const result = await workflow.runAllTasks();
        return result;
      }

      if (!command.storyId) {
        throw new CliParseError('Provide either --prompt or --story-id for run-all.');
      }

      const workflow = await resumeWorkflowFromStoryId(command.storyId, workflowOptions);
      return workflow.runAllTasks();
    }
    default:
      throw new CliParseError(`Unsupported command: ${(command as ParsedCliCommand).command}`);
  }
}

async function buildWorkflowDependencies(
  options: ParsedCliCommand,
  env: NodeJS.ProcessEnv
): Promise<AgentWorkflowOptions> {
  const { mode, verbose, supabaseKey, supabaseUrl, connectionMode } = options;

  const credentials = resolveSupabaseCredentials(
    { supabaseKey, supabaseUrl, connectionMode },
    env
  );

  const client = createSupabaseServiceClient(credentials);
  const storiesRepository = createStoriesRepository(client);
  const shotsRepository = createShotsRepository(client);
  const sceneletsRepository = createSceneletsRepository(client);
  const sceneletPersistence = new SceneletPersistenceAdapter(sceneletsRepository);
  const logger = createDebugLogger(verbose);
  const storyTreeLoader = (storyId: string) =>
    loadStoryTreeSnapshot(storyId, { sceneletsRepository });

  const workflowOptions: AgentWorkflowOptions = {
    storiesRepository,
    shotsRepository,
    sceneletPersistence,
    logger,
    constitutionOptions: {
      logger,
    },
    interactiveStoryOptions: {
      logger,
    },
    storyTreeLoader,
    visualDesignTaskOptions: {
      logger,
    },
    audioDesignTaskOptions: {
      logger,
    },
    shotProductionTaskOptions: {
      logger,
    },
  };

  if (mode === 'stub') {
    const interactiveResponses = await loadInteractiveResponses();
    const geminiClient = new FixtureGeminiClient(interactiveResponses);
    workflowOptions.generateStoryConstitution = async (prompt) => loadStubConstitution(prompt);
    workflowOptions.interactiveStoryOptions = {
      geminiClient,
      promptLoader: async () => 'Stub interactive scriptwriter prompt',
      logger,
    };
    workflowOptions.visualDesignTaskOptions = {
      logger,
      promptLoader: async () => 'Stub visual design system prompt',
      geminiClient: new FixtureGeminiClient([
        await loadVisualDesignResponse(),
      ]),
    };
    const audioResponse = await loadAudioDesignResponse();
    workflowOptions.audioDesignTaskOptions = {
      logger,
      promptLoader: async () => 'Stub audio design system prompt',
      geminiClient: new FixtureGeminiClient([audioResponse]),
    };
    const shotProductionResponse = JSON.stringify({
      scenelet_id: 'scenelet-1',
      shots: [
        {
          shot_index: 1,
          storyboard_entry: {
            framing_and_angle: 'Extended framing description exceeding eighty characters to satisfy validation requirements.',
            composition_and_content: 'Comprehensive composition details outlining subjects, props, and background to exceed limits.',
            character_action_and_emotion: 'Character actions and emotions articulated with sufficient depth beyond the threshold length.',
            dialogue: [],
            camera_dynamics: 'Camera glides slowly across the scene with descriptive pacing beyond the minimum requirement.',
            lighting_and_atmosphere: 'Lighting notes covering warmth, contrast, and volumetric effects in lengthy prose.',
            continuity_notes: 'Continuity guidance capturing prop placement and performer marks surpassing eighty characters.',
          },
          generation_prompts: {
            first_frame_prompt: 'First frame prompt elaborating on palette, mood, and staging across a richly detailed description.',
            key_frame_storyboard_prompt: 'Storyboard prompt covering blocking, motion beats, and environment cues in exhaustive prose.',
            video_clip_prompt: 'Video clip prompt describing pacing, transitions, and tone with clarity. No background music.',
          },
        },
      ],
    });
    const shotProductionGeminiClient: GeminiJsonClient = {
      async generateJson(request) {
        const content = (request as { userContent?: string } | undefined)?.userContent ?? '';
        const match = content.match(/- scenelet_id:\s*(\S+)/);
        const sceneletId = match?.[1] ?? 'scenelet-1';
        const parsed = JSON.parse(shotProductionResponse) as { scenelet_id: string };
        parsed.scenelet_id = sceneletId;
        return JSON.stringify(parsed);
      },
    };
    workflowOptions.shotProductionTaskOptions = {
      logger,
      promptLoader: async () => 'Stub shot production system prompt',
      geminiClient: shotProductionGeminiClient,
    };
  }

  return workflowOptions;
}

function parseArguments(argv: string[]): ParsedCliCommand {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const [commandToken, ...rest] = argv;
  const modeOptions: BaseCliOptions = {
    mode: 'stub',
    verbose: false,
    connectionMode: 'local',
  };

  let prompt: string | undefined;
  let storyId: string | undefined;
  let taskName: string | undefined;

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('-')) {
      continue;
    }

    switch (token) {
      case '--prompt':
        prompt = rest[++index];
        break;
      case '--story-id':
        storyId = rest[++index];
        break;
      case '--task':
        taskName = rest[++index];
        break;
      case '--mode': {
        const value = rest[++index];
        if (!value) {
          throw new CliParseError('Missing value for --mode flag. Use "stub" or "real".');
        }
        const normalized = value.trim().toLowerCase();
        if (normalized === 'stub' || normalized === 'real') {
          modeOptions.mode = normalized;
        } else {
          throw new CliParseError('Invalid mode. Use "stub" or "real".');
        }
        break;
      }
      case '--stub':
        modeOptions.mode = 'stub';
        break;
      case '--real':
        modeOptions.mode = 'real';
        break;
      case '--supabase-url':
        modeOptions.supabaseUrl = rest[++index];
        break;
      case '--supabase-key':
        modeOptions.supabaseKey = rest[++index];
        break;
      case '--remote':
        modeOptions.connectionMode = 'remote';
        break;
      case '--verbose':
      case '-v':
        modeOptions.verbose = true;
        break;
      default:
        throw new CliParseError(`Unknown flag: ${token}`);
    }
  }

  switch (commandToken) {
    case 'create': {
      const trimmedPrompt = prompt?.trim() ?? '';
      if (!trimmedPrompt) {
        throw new CliParseError('Provide a story prompt via --prompt "<text>".');
      }
      return {
        command: 'create',
        prompt: trimmedPrompt,
        ...modeOptions,
      };
    }
    case 'run-task': {
      const trimmedStoryId = storyId?.trim() ?? '';
      if (!trimmedStoryId) {
        throw new CliParseError('Provide --story-id when running a task.');
      }
      const task = normalizeTask(taskName);
      return {
        command: 'run-task',
        storyId: trimmedStoryId,
        task,
        ...modeOptions,
      };
    }
    case 'run-all': {
      const trimmedPrompt = prompt?.trim() ?? '';
      const trimmedStoryId = storyId?.trim() ?? '';
      if (!trimmedPrompt && !trimmedStoryId) {
        throw new CliParseError('Provide either --prompt or --story-id for run-all.');
      }
      return {
        command: 'run-all',
        prompt: trimmedPrompt || undefined,
        storyId: trimmedStoryId || undefined,
        ...modeOptions,
      };
    }
    default:
      throw new CliParseError(`Unknown command: ${commandToken}`);
  }
}

function normalizeTask(taskName: string | undefined): StoryWorkflowTask {
  if (!taskName) {
    throw new CliParseError(
      `Provide --task <TASK_NAME> (options: ${SUPPORTED_TASKS.join(', ')}) when running a workflow task.`
    );
  }

  const normalized = taskName.trim().toUpperCase();
  const match = SUPPORTED_TASKS.find((value) => value === normalized);
  if (!match) {
    throw new CliParseError(
      `Unsupported task "${taskName}". Supported tasks: ${SUPPORTED_TASKS.join(', ')}.`
    );
  }

  return match;
}

async function loadStubConstitution(prompt: string): Promise<StoryConstitution> {
  const raw = await readFile(CONSTITUTION_FIXTURE, 'utf8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  const title =
    typeof parsed.proposed_story_title === 'string'
      ? parsed.proposed_story_title
      : typeof parsed.proposedStoryTitle === 'string'
        ? parsed.proposedStoryTitle
        : null;
  const markdownRaw =
    typeof parsed.story_constitution_markdown === 'string'
      ? parsed.story_constitution_markdown
      : typeof parsed.storyConstitutionMarkdown === 'string'
        ? parsed.storyConstitutionMarkdown
        : null;

  if (!title || !markdownRaw) {
    throw new CliParseError('Stub constitution fixture must include title and markdown fields.');
  }

  return {
    proposedStoryTitle: title,
    storyConstitutionMarkdown: markdownRaw.replace('{{BRIEF}}', prompt),
  };
}

async function loadInteractiveResponses(): Promise<string[]> {
  const raw = await readFile(INTERACTIVE_FIXTURE, 'utf8');
  const parsed = JSON.parse(raw) as Array<unknown>;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new CliParseError('Interactive story fixture must be a non-empty JSON array.');
  }

  return parsed.map((entry, index) => {
    if (typeof entry === 'string') {
      return entry;
    }
    if (typeof entry === 'object' && entry !== null) {
      return JSON.stringify(entry);
    }
    throw new CliParseError(`Interactive story fixture entry at index ${index} is invalid.`);
  });
}

async function loadVisualDesignResponse(): Promise<string> {
  return loadJsonFixture(
    VISUAL_DESIGN_FIXTURE,
    'Visual design fixture must not be empty.',
    'Visual design fixture must contain valid JSON.'
  );
}

async function loadAudioDesignResponse(): Promise<string> {
  return loadJsonFixture(
    AUDIO_DESIGN_FIXTURE,
    'Audio design fixture must not be empty.',
    'Audio design fixture must contain valid JSON.'
  );
}

async function loadJsonFixture(path: string, emptyMessage: string, invalidMessage: string): Promise<string> {
  const raw = await readFile(path, 'utf8');
  if (!raw.trim()) {
    throw new CliParseError(emptyMessage);
  }
  try {
    JSON.parse(raw);
  } catch {
    throw new CliParseError(invalidMessage);
  }
  return raw;
}

function resolveSupabaseCredentials(
  options: { supabaseUrl?: string; supabaseKey?: string; connectionMode: 'local' | 'remote' },
  env: NodeJS.ProcessEnv
): { url?: string; serviceRoleKey?: string } {
  const urlCandidates = [
    options.supabaseUrl,
    ...(options.connectionMode === 'remote'
      ? [env.SUPABASE_REMOTE_URL, env.SUPABASE_URL]
      : [env.SUPABASE_LOCAL_URL, env.SUPABASE_URL]),
  ];

  const keyCandidates = [
    options.supabaseKey,
    ...(options.connectionMode === 'remote'
      ? [env.SUPABASE_REMOTE_SERVICE_ROLE_KEY, env.SUPABASE_SERVICE_ROLE_KEY]
      : [env.SUPABASE_LOCAL_SERVICE_ROLE_KEY, env.SUPABASE_SERVICE_ROLE_KEY]),
  ];

  return {
    url: firstNonEmptyValue(urlCandidates),
    serviceRoleKey: firstNonEmptyValue(keyCandidates),
  };
}

function firstNonEmptyValue(values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function handleError(error: unknown): void {
  if (error instanceof CliParseError || error instanceof SupabaseConfigurationError) {
    console.error(error.message);
    return;
  }

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error('Unexpected error running agent workflow.');
  }
}

function printHelp(): void {
  console.log('Agent Workflow CLI');
  console.log('');
  console.log('Commands:');
  console.log(
    `  create   --prompt "<story brief>" [--mode stub|real] [--supabase-url <url>] [--supabase-key <key>]`
  );
  console.log(
    `  run-task --task <TASK> (options: ${SUPPORTED_TASKS.join(', ')}) --story-id <id> [--mode stub|real] [--supabase-url <url>] [--supabase-key <key>]`
  );
  console.log(
    `  run-all  (--prompt "<story brief>" | --story-id <id>) [--mode stub|real] [--supabase-url <url>] [--supabase-key <key>]`
  );
  console.log('');
  console.log('Flags:');
  console.log('  --mode <stub|real>      Choose Gemini mode (stub uses fixtures). Default: stub.');
  console.log('  --supabase-url <url>    Supabase URL override (falls back to SUPABASE_URL env).');
  console.log('  --supabase-key <key>    Supabase service role key override (falls back to env).');
  console.log('  --remote                Use remote Supabase credentials (default is local).');
  console.log('  --verbose (-v)          Print debug logs.');
  console.log('  --help (-h)             Show this help message.');
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

function createDebugLogger(enabled: boolean | undefined): AgentWorkflowOptions['logger'] & InteractiveStoryLogger {
  const isEnabled = Boolean(enabled);
  return {
    debug: isEnabled
      ? (message: string, metadata?: Record<string, unknown>) => {
          console.log(`[agent-workflow] ${message}`, metadata ?? {});
        }
      : undefined,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli(process.argv.slice(2), process.env);
}
