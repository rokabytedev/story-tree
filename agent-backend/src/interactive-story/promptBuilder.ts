import { ScriptwriterScenelet } from './types.js';

const ROOT_INSTRUCTION = 'Now start with the first scenelet of the story.';
const CONTINUE_INSTRUCTION = 'Now continue the story by writing only the immediate next scenelet(s).';

export interface BuildPromptOptions {
  storyConstitution: string;
  pathContext: ScriptwriterScenelet[];
  isRoot: boolean;
  targetSceneletsPerPath: number;
}

export function buildInteractiveScriptwriterUserContent(
  options: BuildPromptOptions
): string {
  const { storyConstitution, pathContext, isRoot, targetSceneletsPerPath } = options;
  const trimmedConstitution = storyConstitution.trim();
  const instruction = isRoot ? ROOT_INSTRUCTION : CONTINUE_INSTRUCTION;
  const lines: string[] = [];

  lines.push('## Story Constitution');
  lines.push(trimmedConstitution);
  lines.push('');

  const currentCount = pathContext.length;
  const remainingCount = Math.max(targetSceneletsPerPath - currentCount, 0);

  lines.push('## Current Narrative Path');
  lines.push(`Target scenelets per path: ${targetSceneletsPerPath}`);
  lines.push(`Current scenelets in this path: ${currentCount}`);
  lines.push(
    `Reminder: Aim to conclude this path within ${targetSceneletsPerPath} scenelets. Approximately ${remainingCount} scenelets remain.`
  );

  if (pathContext.length === 0) {
    lines.push('No scenelets have been written on this path yet.');
  } else {
    const serializedPath = JSON.stringify(pathContext, null, 2);
    lines.push('');
    lines.push(serializedPath);
  }

  lines.push('');

  lines.push('## Instruction');
  lines.push(instruction);

  return lines.join('\n');
}
