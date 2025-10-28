#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { generateInteractiveStoryTree } from '../interactive-story/generateInteractiveStory.js';
import { InteractiveStoryError } from '../interactive-story/errors.js';
import type {
  InteractiveStoryGeneratorOptions,
  InteractiveStoryLogger,
  SceneletPersistence,
  ScriptwriterScenelet,
} from '../interactive-story/types.js';
import type { GeminiGenerateJsonOptions, GeminiGenerateJsonRequest, GeminiJsonClient } from '../gemini/types.js';

interface CliInvocation {
  storyId: string;
  storyConstitution: string;
  responsesPath: string;
  verbose: boolean;
}

class CliParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliParseError';
  }
}

async function main(argv: string[]): Promise<void> {
  try {
    const invocation = await parseArguments(argv);
    const responses = await loadResponses(invocation.responsesPath);
    const logger = invocation.verbose ? createVerboseLogger() : undefined;
    const geminiClient = new FixtureGeminiClient(responses, logger);
    const persistence = new InMemorySceneletPersistence();

    await generateInteractiveStoryTree(invocation.storyId, invocation.storyConstitution, {
      geminiClient,
      promptLoader: async () => 'Stub interactive scriptwriter prompt',
      sceneletPersistence: persistence,
      ...(logger ? { logger } : {}),
    } satisfies InteractiveStoryGeneratorOptions);

    printSummary(persistence.getScenelets());
  } catch (error) {
    if (error instanceof CliParseError || error instanceof InteractiveStoryError) {
      console.error(error.message);
      process.exit(1);
      return;
    }

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error('Unexpected error running interactive story CLI.');
    }
    process.exit(1);
  }
}

async function parseArguments(args: string[]): Promise<CliInvocation> {
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  let storyId: string | undefined;
  let constitution: string | undefined;
  let constitutionFile: string | undefined;
  let responsesPath: string | undefined;
  let verbose = false;

  const positional: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--') {
      positional.push(...args.slice(index + 1));
      break;
    }

    if (!arg.startsWith('-')) {
      positional.push(arg);
      continue;
    }

    switch (arg) {
      case '--story-id':
        storyId = args[++index];
        break;
      case '--constitution':
        constitution = args[++index];
        break;
      case '--constitution-file':
        constitutionFile = args[++index];
        break;
      case '--responses-file':
        responsesPath = args[++index];
        break;
      case '--verbose':
      case '-v':
        verbose = true;
        break;
      default:
        throw new CliParseError(`Unknown flag: ${arg}`);
    }
  }

  if (!storyId && positional.length > 0) {
    storyId = positional.shift();
  }

  if (!storyId?.trim()) {
    throw new CliParseError('Missing --story-id argument.');
  }

  const storyConstitution = await resolveConstitution(constitution, constitutionFile);

  if (!responsesPath) {
    throw new CliParseError('Missing --responses-file argument pointing to fixture JSON.');
  }

  return {
    storyId: storyId.trim(),
    storyConstitution,
    responsesPath,
    verbose,
  } satisfies CliInvocation;
}

async function resolveConstitution(
  inline: string | undefined,
  filePath: string | undefined
): Promise<string> {
  if (inline?.trim()) {
    return inline.trim();
  }

  if (filePath) {
    const absolute = path.resolve(process.cwd(), filePath);
    const raw = await readFile(absolute, 'utf8');
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new CliParseError('Constitution file is empty.');
    }
    return trimmed;
  }

  throw new CliParseError('Provide a story constitution via --constitution or --constitution-file.');
}

async function loadResponses(location: string): Promise<string[]> {
  const absolute = path.resolve(process.cwd(), location);
  const raw = await readFile(absolute, 'utf8');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new CliParseError(`Responses file must contain JSON array. ${(error as Error).message}`);
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new CliParseError('Responses file must be a non-empty JSON array.');
  }

  return parsed.map((entry, index) => {
    if (typeof entry === 'string') {
      return entry;
    }
    if (typeof entry === 'object' && entry !== null) {
      return JSON.stringify(entry);
    }
    throw new CliParseError(`Response at index ${index} must be an object or string.`);
  });
}

class FixtureGeminiClient implements GeminiJsonClient {
  private index = 0;

  constructor(
    private readonly responses: string[],
    private readonly logger?: InteractiveStoryLogger
  ) {}

  async generateJson(
    request: GeminiGenerateJsonRequest,
    options?: GeminiGenerateJsonOptions
  ): Promise<string> {
    if (this.index >= this.responses.length) {
      throw new CliParseError('Ran out of fixture responses while generating the story.');
    }

    this.logger?.debug?.('Gemini request payload', {
      callIndex: this.index + 1,
      systemInstruction: request.systemInstruction,
      userContent: request.userContent,
      timeoutMs: options?.timeoutMs ?? null,
    });

    const response = this.responses[this.index];
    this.index += 1;
    this.logger?.debug?.('Gemini stub response', {
      callIndex: this.index,
      responseJson: response,
    });
    return response;
  }
}

interface SceneletRecordSummary {
  id: string;
  storyId: string;
  parentId: string | null;
  choiceLabelFromParent: string | null;
  choicePrompt: string | null;
  isBranchPoint: boolean;
  isTerminalNode: boolean;
  content: ScriptwriterScenelet;
  createdAt: string;
}

class InMemorySceneletPersistence implements SceneletPersistence {
  private counter = 0;
  private readonly scenelets = new Map<string, SceneletRecordSummary>();

  async createScenelet(input: {
    storyId: string;
    parentId: string | null;
    choiceLabelFromParent?: string | null;
    content: ScriptwriterScenelet;
  }) {
    this.counter += 1;
    const id = `scenelet-${this.counter}`;
    const createdAt = new Date().toISOString();
    const record: SceneletRecordSummary = {
      id,
      storyId: input.storyId,
      parentId: input.parentId ?? null,
      choiceLabelFromParent: input.choiceLabelFromParent ?? null,
      choicePrompt: null,
      isBranchPoint: false,
      isTerminalNode: false,
      content: input.content,
      createdAt,
    };

    this.scenelets.set(id, record);

    return {
      id,
      storyId: input.storyId,
      parentId: input.parentId ?? null,
      choiceLabelFromParent: record.choiceLabelFromParent,
      choicePrompt: record.choicePrompt,
      content: record.content,
      isBranchPoint: record.isBranchPoint,
      isTerminalNode: record.isTerminalNode,
      createdAt: record.createdAt,
    };
  }

  async markSceneletAsBranchPoint(sceneletId: string, choicePrompt: string): Promise<void> {
    const record = this.scenelets.get(sceneletId);
    if (!record) {
      throw new CliParseError(`Scenelet ${sceneletId} missing in memory.`);
    }
    record.isBranchPoint = true;
    record.choicePrompt = choicePrompt;
  }

  async markSceneletAsTerminal(sceneletId: string): Promise<void> {
    const record = this.scenelets.get(sceneletId);
    if (!record) {
      throw new CliParseError(`Scenelet ${sceneletId} missing in memory.`);
    }
    record.isTerminalNode = true;
  }

  async hasSceneletsForStory(_storyId: string): Promise<boolean> {
    return this.scenelets.size > 0;
  }

  async listSceneletsByStory(storyId: string) {
    return Array.from(this.scenelets.values())
      .filter((record) => record.storyId === storyId)
      .map((record) => ({
        id: record.id,
        storyId: record.storyId,
        parentId: record.parentId,
        choiceLabelFromParent: record.choiceLabelFromParent,
        choicePrompt: record.choicePrompt,
        content: record.content,
        isBranchPoint: record.isBranchPoint,
        isTerminalNode: record.isTerminalNode,
        createdAt: record.createdAt,
      }));
  }

  getScenelets(): SceneletRecordSummary[] {
    return Array.from(this.scenelets.values());
  }
}

function createVerboseLogger(): InteractiveStoryLogger {
  return {
    debug(message, metadata) {
      if (metadata && Object.keys(metadata).length > 0) {
        console.error(`[interactive-story:debug] ${message}`, metadata);
        return;
      }
      console.error(`[interactive-story:debug] ${message}`);
    },
  };
}

function printSummary(scenelets: SceneletRecordSummary[]): void {
  console.log(JSON.stringify(scenelets, null, 2));
}

function printHelp(): void {
  console.log(`Usage: npm run interactive-story:cli -- --story-id <id> --constitution-file story.md --responses-file responses.json

Options:
  --story-id <id>           Story identifier used for logging.
  --constitution <text>     Provide constitution inline (mutually exclusive with --constitution-file).
  --constitution-file <path>Load constitution markdown from a file.
  --responses-file <path>   Path to JSON array of Gemini responses to replay.
  --verbose, -v             Print Gemini request and response debug information.
  --help, -h                Show this help message.`);
}

void main(process.argv.slice(2));
