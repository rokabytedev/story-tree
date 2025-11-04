import { readFile } from 'node:fs/promises';
import path from 'node:path';

const promptPath = path.resolve(
  __dirname,
  '../../../system_prompts/create_environment_reference_image.md'
);

let cachedPrompt: string | undefined;

export async function loadEnvironmentReferencePromptInstructions(): Promise<string> {
  if (cachedPrompt) {
    return cachedPrompt;
  }

  cachedPrompt = await readFile(promptPath, 'utf8');
  return cachedPrompt;
}

