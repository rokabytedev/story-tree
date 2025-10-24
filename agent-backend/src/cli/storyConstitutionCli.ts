#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { generateStoryConstitution } from '../story-constitution/generateStoryConstitution.js';
import { StoryConstitutionError } from '../story-constitution/errors.js';
import { createGeminiJsonClient } from '../gemini/client.js';
import {
  GeminiGenerateJsonOptions,
  GeminiGenerateJsonRequest,
  GeminiJsonClient,
} from '../gemini/types.js';

const fixturePath = path.resolve(__dirname, '../../fixtures/story-constitution-sample.json');

loadEnvironment();

async function main(argv: string[]): Promise<void> {
  try {
    const { brief, useStub } = parseCliOptions(argv);
    const client = useStub ? new StubGeminiClient() : createGeminiJsonClient();

    const result = await generateStoryConstitution(brief, {
      geminiClient: client,
    });

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    if (error instanceof StoryConstitutionError) {
      console.error(error.message);
      process.exit(1);
    }

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error('Unexpected error executing CLI.');
    }
    process.exit(1);
  }
}

class StubGeminiClient implements GeminiJsonClient {
  private cachedTemplate?: Record<string, unknown>;

  async generateJson(
    request: GeminiGenerateJsonRequest,
    _options?: GeminiGenerateJsonOptions
  ): Promise<string> {
    const template = await this.loadTemplate();
    const storyBrief = request.userContent;
    const storyTitle = template['proposed_story_title'];
    const markdown = template['story_constitution_markdown'];

    const finalTitle =
      typeof storyTitle === 'string'
        ? storyTitle
        : `Stubbed Story for "${truncate(storyBrief, 40)}"`;

    const finalMarkdown =
      typeof markdown === 'string'
        ? markdown.replaceAll('{{BRIEF}}', storyBrief)
        : `### **Story Constitution: ${finalTitle}**\n\n${storyBrief}`;

    return JSON.stringify({
      proposed_story_title: finalTitle,
      story_constitution_markdown: finalMarkdown,
    });
  }

  private async loadTemplate(): Promise<Record<string, unknown>> {
    if (this.cachedTemplate) {
      return this.cachedTemplate;
    }

    const raw = await readFile(fixturePath, 'utf8');
    this.cachedTemplate = JSON.parse(raw) as Record<string, unknown>;
    return this.cachedTemplate;
  }
}

interface CliOptions {
  brief: string;
  useStub: boolean;
}

function parseCliOptions(args: string[]): CliOptions {
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  let brief: string | undefined;
  let useStub = false;
  const positional: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--') {
      positional.push(...args.slice(index + 1));
      break;
    }

    if (arg === '--stub' || arg === '--use-stub') {
      useStub = true;
      continue;
    }

    if (arg === '--brief' || arg === '-b') {
      const next = args[index + 1];
      if (!next) {
        throw new StoryConstitutionError('Expected value after --brief flag.');
      }
      brief = next;
      index += 1;
      continue;
    }

    if (arg.startsWith('--brief=')) {
      const value = arg.slice('--brief='.length);
      if (!value) {
        throw new StoryConstitutionError('Expected value after --brief=');
      }
      brief = value;
      continue;
    }

    if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  if (!brief && positional.length > 0) {
    brief = positional.join(' ');
  }

  if (!brief) {
    throw new StoryConstitutionError(
      'Missing story brief. Pass it as a positional argument or via --brief "<text>".'
    );
  }

  return { brief, useStub };
}

function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function loadEnvironment(): void {
  const maybeProcess = process as { loadEnvFile?: () => void };
  if (typeof maybeProcess.loadEnvFile === 'function') {
    try {
      maybeProcess.loadEnvFile();
      return;
    } catch {
      // fall back to manual loading if automatic loading fails
    }
  }

  const candidateRoots = [
    process.cwd(),
    path.resolve(process.cwd(), 'agent-backend'),
    path.resolve(__dirname, '../../'),
    path.resolve(__dirname, '../../..'),
  ];

  const seen = new Set<string>();

  for (const root of candidateRoots) {
    const envPath = path.resolve(root, '.env');
    if (seen.has(envPath) || !existsSync(envPath)) {
      continue;
    }

    seen.add(envPath);

    let raw: string;
    try {
      raw = readFileSync(envPath, 'utf8');
    } catch {
      continue;
    }

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const delimiterIndex = trimmed.indexOf('=');
      if (delimiterIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, delimiterIndex).trim();
      if (!key || key in process.env) {
        continue;
      }

      let value = trimmed.slice(delimiterIndex + 1).trim();
      const firstChar = value.charCodeAt(0);
      const lastChar = value.charCodeAt(value.length - 1);
      if (
        (firstChar === 34 && lastChar === 34) || // double quotes
        (firstChar === 39 && lastChar === 39) // single quotes
      ) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  }
}

function printHelp(): void {
  console.log(`Usage: npm run story-constitution:cli -- --brief "idea"

Options:
  --brief, -b <text>   Provide the story brief.
  --stub               Use the stubbed Gemini response (no API call).
  --help, -h           Show this help message.

Positional arguments are also accepted. By default the CLI calls the live Gemini API, so ensure GEMINI_API_KEY is configured. Use --stub to work offline.`);
}

void main(process.argv.slice(2));
