import { ScriptwriterScenelet } from './types.js';

const ROOT_INSTRUCTION = 'Now start with the first scenelet of the story.';
const CONTINUE_INSTRUCTION = 'Now continue the story by writing only the immediate next scenelet(s).';

export interface BuildPromptOptions {
  storyConstitution: string;
  pathContext: ScriptwriterScenelet[];
  isRoot: boolean;
}

export function buildInteractiveScriptwriterUserContent(
  options: BuildPromptOptions
): string {
  const { storyConstitution, pathContext, isRoot } = options;
  const trimmedConstitution = storyConstitution.trim();
  const instruction = isRoot ? ROOT_INSTRUCTION : CONTINUE_INSTRUCTION;
  const lines: string[] = [];

  lines.push('## Story Constitution');
  lines.push(trimmedConstitution);
  lines.push('');

  if (!isRoot && pathContext.length > 0) {
    lines.push('## Current Narrative Path');

    const serializedPath = JSON.stringify(pathContext, null, 2);
    lines.push(serializedPath);
    lines.push('');
  }

  lines.push('## Instruction');
  lines.push(instruction);

  return lines.join('\n');
}
