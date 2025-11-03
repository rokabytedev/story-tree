import { readFile } from 'node:fs/promises';
import path from 'node:path';

const systemPromptPath = path.resolve(
  __dirname,
  '../../../system_prompts/create_interactive_script.md'
);

let cachedPrompt: string | undefined;

export async function loadInteractiveScriptwriterPrompt(): Promise<string> {
  if (cachedPrompt) {
    return cachedPrompt;
  }

  cachedPrompt = await readFile(systemPromptPath, 'utf8');
  return cachedPrompt;
}
