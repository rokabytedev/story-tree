#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import process from 'node:process';

import { createSupabaseServiceClient, SupabaseConfigurationError } from '../../../supabase/src/client.js';
import { createSceneletsRepository } from '../../../supabase/src/sceneletsRepository.js';
import type { SceneletsRepository, SceneletRecord } from '../../../supabase/src/sceneletsRepository.js';
import { createStoriesRepository, type StoriesRepository, type StoryRecord } from '../../../supabase/src/storiesRepository.js';
import type { StoryArtifactPatch } from '../../../supabase/src/storiesRepository.js';
import { runAgentWorkflow } from '../workflow/runAgentWorkflow.js';
import type {
  AgentWorkflowLogger,
  AgentWorkflowOptions,
  AgentWorkflowResult,
} from '../workflow/types.js';
import type {
  SceneletPersistence,
  CreateSceneletInput,
  SceneletRecord as GeneratedSceneletRecord,
  InteractiveStoryLogger,
} from '../interactive-story/types.js';
import type { StoryConstitution } from '../story-constitution/types.js';
import type { GeminiGenerateJsonOptions, GeminiGenerateJsonRequest, GeminiJsonClient } from '../gemini/types.js';

const CLI_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(CLI_DIRECTORY, '../..');
const CONSTITUTION_FIXTURE = resolve(REPO_ROOT, 'fixtures/story-constitution/stub-gemini-responses.json');
const INTERACTIVE_FIXTURE = resolve(REPO_ROOT, 'fixtures/interactive-story/stub-gemini-responses.json');

interface CliOptions {
  prompt: string;
  displayName?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  stubMode: boolean;
  verbose: boolean;
}

class CliParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliParseError';
  }
}

class SceneletPersistenceAdapter implements SceneletPersistence {
  constructor(private readonly repository: SceneletsRepository) {}

  async createScenelet(input: CreateSceneletInput): Promise<GeneratedSceneletRecord> {
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
}

class InMemoryStoriesRepository implements StoriesRepository {
  private rows: StoryRecord[] = [];

  async createStory(input: { displayName: string; initialPrompt: string }): Promise<StoryRecord> {
    const now = new Date().toISOString();
    const record: StoryRecord = {
      id: randomUUID(),
      displayName: input.displayName,
      displayNameUpper: input.displayName.toUpperCase(),
      initialPrompt: input.initialPrompt,
      createdAt: now,
      updatedAt: now,
      storyConstitution: null,
      visualDesignDocument: null,
      audioDesignDocument: null,
      visualReferencePackage: null,
      storyboardBreakdown: null,
      generationPrompts: null,
    };

    this.rows.push(record);
    return record;
  }

  async updateStoryArtifacts(storyId: string, patch: StoryArtifactPatch): Promise<StoryRecord> {
    const record = this.rows.find((row) => row.id === storyId);
    if (!record) {
      throw new Error(`Story ${storyId} not found.`);
    }

    if (patch.displayName) {
      record.displayName = patch.displayName;
      record.displayNameUpper = patch.displayName.toUpperCase();
    }
    if (patch.storyConstitution !== undefined) {
      record.storyConstitution = patch.storyConstitution ?? null;
    }
    if (patch.visualDesignDocument !== undefined) {
      record.visualDesignDocument = patch.visualDesignDocument ?? null;
    }
    if (patch.audioDesignDocument !== undefined) {
      record.audioDesignDocument = patch.audioDesignDocument ?? null;
    }
    if (patch.visualReferencePackage !== undefined) {
      record.visualReferencePackage = patch.visualReferencePackage ?? null;
    }
    if (patch.storyboardBreakdown !== undefined) {
      record.storyboardBreakdown = patch.storyboardBreakdown ?? null;
    }
    if (patch.generationPrompts !== undefined) {
      record.generationPrompts = patch.generationPrompts ?? null;
    }

    record.updatedAt = new Date().toISOString();
    return record;
  }

  async getStoryById(storyId: string): Promise<StoryRecord | null> {
    return this.rows.find((row) => row.id === storyId) ?? null;
  }

  async listStories(): Promise<StoryRecord[]> {
    return [...this.rows];
  }

  async deleteStoryById(storyId: string): Promise<void> {
    this.rows = this.rows.filter((row) => row.id !== storyId);
  }

  dump(): StoryRecord[] {
    return [...this.rows];
  }
}

class InMemorySceneletPersistence implements SceneletPersistence {
  private records: GeneratedSceneletRecord[] = [];

  constructor(private readonly clock = () => new Date().toISOString()) {}

  async createScenelet(input: CreateSceneletInput): Promise<GeneratedSceneletRecord> {
    const record: GeneratedSceneletRecord = {
      id: randomUUID(),
      storyId: input.storyId,
      parentId: input.parentId ?? null,
      choiceLabelFromParent: input.choiceLabelFromParent ?? null,
      choicePrompt: null,
      content: input.content,
      isBranchPoint: false,
      isTerminalNode: false,
      createdAt: this.clock(),
    };
    this.records.push(record);
    return record;
  }

  async markSceneletAsBranchPoint(sceneletId: string, choicePrompt: string): Promise<void> {
    const record = this.records.find((row) => row.id === sceneletId);
    if (record) {
      record.isBranchPoint = true;
      record.choicePrompt = choicePrompt;
    }
  }

  async markSceneletAsTerminal(sceneletId: string): Promise<void> {
    const record = this.records.find((row) => row.id === sceneletId);
    if (record) {
      record.isTerminalNode = true;
    }
  }

  dump(): GeneratedSceneletRecord[] {
    return [...this.records];
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
  try {
    const options = parseArguments(argv);
    if (options.stubMode) {
      await runStubWorkflow(options);
      return;
    }

    const runResult = await runRealWorkflow(options, env);
    console.log(JSON.stringify(runResult, null, 2));
  } catch (error) {
    handleError(error);
    process.exitCode = 1;
  }
}

function parseArguments(argv: string[]): CliOptions {
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  let prompt: string | undefined;
  let displayName: string | undefined;
  let supabaseUrl: string | undefined;
  let supabaseKey: string | undefined;
  let stubMode = false;
  let verbose = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('-')) {
      if (!prompt) {
        prompt = token;
      } else if (!displayName) {
        displayName = token;
      }
      continue;
    }

    switch (token) {
      case '--prompt':
        prompt = argv[++index];
        break;
      case '--name':
        displayName = argv[++index];
        break;
      case '--supabase-url':
        supabaseUrl = argv[++index];
        break;
      case '--supabase-key':
        supabaseKey = argv[++index];
        break;
      case '--stub':
        stubMode = true;
        break;
      case '--verbose':
      case '-v':
        verbose = true;
        break;
      default:
        throw new CliParseError(`Unknown flag: ${token}`);
    }
  }

  const trimmedPrompt = prompt?.trim() ?? '';
  if (!trimmedPrompt) {
    throw new CliParseError('Provide a story prompt via --prompt "<text>" or as the first positional argument.');
  }

  return {
    prompt: trimmedPrompt,
    displayName: displayName?.trim() ?? undefined,
    supabaseUrl: supabaseUrl?.trim() ?? undefined,
    supabaseKey: supabaseKey?.trim() ?? undefined,
    stubMode,
    verbose,
  };
}

async function runRealWorkflow(options: CliOptions, env: NodeJS.ProcessEnv): Promise<AgentWorkflowResult> {
  const client = createSupabaseServiceClient({
    url: options.supabaseUrl ?? env.SUPABASE_URL,
    serviceRoleKey: options.supabaseKey ?? env.SUPABASE_SERVICE_ROLE_KEY,
  });

  const storiesRepository: StoriesRepository = createStoriesRepository(client);
  const sceneletsRepository = createSceneletsRepository(client);
  const persistence = new SceneletPersistenceAdapter(sceneletsRepository);
  const logger = createDebugLogger(options.verbose || env.DEBUG?.toLowerCase() === 'true');

  const workflowOptions: AgentWorkflowOptions = {
    storiesRepository,
    sceneletPersistence: persistence,
    ...(options.displayName
      ? {
          initialDisplayNameFactory: () => options.displayName as string,
        }
      : {}),
    logger,
    interactiveStoryOptions: {
      logger,
    },
  };

  return runAgentWorkflow(options.prompt, workflowOptions);
}

async function runStubWorkflow(options: CliOptions): Promise<void> {
  const storiesRepository = new InMemoryStoriesRepository();
  const sceneletPersistence = new InMemorySceneletPersistence();
  const constitution = await loadStubConstitution(options.prompt);
  const interactiveResponses = await loadInteractiveResponses();
  const geminiClient = new FixtureGeminiClient(interactiveResponses);
  const logger = createDebugLogger(options.verbose);

  const workflowOptions: AgentWorkflowOptions = {
    storiesRepository,
    sceneletPersistence,
    generateStoryConstitution: async () => constitution,
    interactiveStoryOptions: {
      geminiClient,
      promptLoader: async () => 'Stub interactive scriptwriter prompt',
      logger,
    },
    ...(options.displayName
      ? {
          initialDisplayNameFactory: () => options.displayName as string,
        }
      : {}),
    logger,
  };

  const result = await runAgentWorkflow(options.prompt, workflowOptions);

  console.log(JSON.stringify(result, null, 2));
  console.log('--- Stub Stories Table ---');
  console.log(JSON.stringify(storiesRepository.dump(), null, 2));
  console.log('--- Stub Scenelets Table ---');
  console.log(JSON.stringify(sceneletPersistence.dump(), null, 2));
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

function printHelp(): void {
  console.log('Agent Workflow CLI');
  console.log('');
  console.log('Usage:');
  console.log('  agent-workflow --prompt "<story brief>" [--name "<display name>"] [--supabase-url <url>] [--supabase-key <key>] [--verbose]');
  console.log('  agent-workflow "<story brief>" ["<display name>"] [--verbose]');
  console.log('');
  console.log('Flags:');
  console.log('  --stub               Run with local fixtures and in-memory persistence.');
  console.log('  --verbose (-v)       Print debug logs (Gemini requests, workflow milestones).');
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

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli(process.argv.slice(2), process.env);
}

function createDebugLogger(enabled: boolean | undefined): AgentWorkflowLogger & InteractiveStoryLogger {
  const isEnabled = Boolean(enabled);
  return {
    debug: isEnabled
      ? (message: string, metadata?: Record<string, unknown>) => {
          console.log(`[agent-workflow] ${message}`, metadata ?? {});
        }
      : undefined,
  };
}
