import { readFile } from 'node:fs/promises';
import path from 'node:path';

const systemPromptPath = path.resolve(
  __dirname,
  '../../../system_prompts/create_visual_reference.md'
);

let cachedPrompt: string | undefined;

export async function loadVisualReferenceSystemPrompt(): Promise<string> {
  if (cachedPrompt) {
    return cachedPrompt;
  }

  cachedPrompt = await readFile(systemPromptPath, 'utf8');
  return cachedPrompt;
}
