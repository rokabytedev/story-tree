#!/usr/bin/env node
import process from 'node:process';

import { createSupabaseServiceClient, SupabaseConfigurationError } from '../../../supabase/src/client.js';
import { createSceneletsRepository } from '../../../supabase/src/sceneletsRepository.js';
import type { SceneletsRepository } from '../../../supabase/src/sceneletsRepository.js';
import { createStoriesRepository } from '../../../supabase/src/storiesRepository.js';
import type { StoriesRepository } from '../../../supabase/src/storiesRepository.js';
import { runAgentWorkflow } from '../workflow/runAgentWorkflow.js';
import type { AgentWorkflowLogger } from '../workflow/types.js';
import type { SceneletPersistence, SceneletRecord, CreateSceneletInput } from '../interactive-story/types.js';

interface CliOptions {
  prompt: string;
  displayName?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
}

class CliParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliParseError';
  }
}

class SceneletPersistenceAdapter implements SceneletPersistence {
  constructor(private readonly repository: SceneletsRepository) {}

  async createScenelet(input: CreateSceneletInput): Promise<SceneletRecord> {
    return this.repository.createScenelet({
      storyId: input.storyId,
      parentId: input.parentId ?? null,
      choiceLabelFromParent: input.choiceLabelFromParent ?? null,
      content: input.content,
    });
  }

  async markSceneletAsBranchPoint(sceneletId: string, choicePrompt: string): Promise<void> {
    await this.repository.markSceneletAsBranchPoint(sceneletId, choicePrompt);
  }

  async markSceneletAsTerminal(sceneletId: string): Promise<void> {
    await this.repository.markSceneletAsTerminal(sceneletId);
  }
}

async function main(argv: string[]): Promise<void> {
  try {
    const options = parseArguments(argv);
    const client = createSupabaseServiceClient({
      url: options.supabaseUrl,
      serviceRoleKey: options.supabaseKey,
    });

    const storiesRepository: StoriesRepository = createStoriesRepository(client);
    const sceneletsRepository = createSceneletsRepository(client);
    const persistence = new SceneletPersistenceAdapter(sceneletsRepository);
    const logger: AgentWorkflowLogger = {
      debug(message, metadata) {
        if (process.env.DEBUG?.toLowerCase() === 'true') {
          console.debug(message, metadata ?? {});
        }
      },
    };

    const runResult = await runAgentWorkflow(options.prompt, {
      storiesRepository,
      sceneletPersistence: persistence,
      ...(options.displayName
        ? {
            initialDisplayNameFactory: () => options.displayName as string,
          }
        : {}),
      logger,
    });

    console.log(JSON.stringify(runResult, null, 2));
  } catch (error) {
    handleError(error);
    process.exit(1);
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
  };
}

function printHelp(): void {
  console.log('Agent Workflow CLI');
  console.log('');
  console.log('Usage:');
  console.log('  agent-workflow --prompt "<story brief>" [--name "<display name>"] [--supabase-url <url>] [--supabase-key <key>]');
  console.log('  agent-workflow "<story brief>" ["<display name>"]');
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
  main(process.argv.slice(2));
}
