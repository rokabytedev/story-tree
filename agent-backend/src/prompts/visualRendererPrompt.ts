import { readFile } from 'node:fs/promises';
import path from 'node:path';

const systemPromptPath = path.resolve(
  __dirname,
  '../../../system_prompts/create_shot_images.md'
);

let cachedPrompt: string | undefined;

export async function loadVisualRendererSystemPrompt(): Promise<string> {
  if (cachedPrompt) {
    return cachedPrompt;
  }

  cachedPrompt = await readFile(systemPromptPath, 'utf8');
  return cachedPrompt;
}
