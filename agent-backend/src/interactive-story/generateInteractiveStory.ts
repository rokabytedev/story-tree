import { createGeminiJsonClient } from '../gemini/client.js';
import { loadInteractiveScriptwriterPrompt } from '../prompts/interactiveScriptwriterPrompt.js';
import { InteractiveStoryError } from './errors.js';
import { buildInteractiveScriptwriterUserContent } from './promptBuilder.js';
import { parseInteractiveScriptwriterResponse } from './parseGeminiResponse.js';
import {
  CreateSceneletInput,
  GenerationTask,
  InteractiveStoryGeneratorOptions,
  SceneletPersistence,
  ScriptwriterScenelet,
} from './types.js';

export async function generateInteractiveStoryTree(
  storyId: string,
  storyConstitution: string,
  options: InteractiveStoryGeneratorOptions = {}
): Promise<void> {
  const trimmedStoryId = storyId?.trim() ?? '';
  if (!trimmedStoryId) {
    throw new InteractiveStoryError('Story id must not be empty.');
  }

  const trimmedConstitution = storyConstitution?.trim() ?? '';
  if (!trimmedConstitution) {
    throw new InteractiveStoryError('Story constitution must not be empty.');
  }

  const persistence = options.sceneletPersistence;
  if (!persistence) {
    throw new InteractiveStoryError('Scenelet persistence implementation is required.');
  }

  const promptLoader = options.promptLoader ?? loadInteractiveScriptwriterPrompt;
  const geminiClient = options.geminiClient ?? createGeminiJsonClient();

  const systemInstruction = await promptLoader();
  if (!systemInstruction.trim()) {
    throw new InteractiveStoryError('Interactive scriptwriter system prompt is empty.');
  }

  const stack: GenerationTask[] = [
    {
      storyId: trimmedStoryId,
      parentSceneletId: null,
      pathContext: [],
    },
  ];

  options.logger?.debug?.('Starting interactive story generation', {
    storyId: trimmedStoryId,
  });

  while (stack.length > 0) {
    const task = stack.pop() as GenerationTask;
    const isRoot = task.parentSceneletId === null && task.pathContext.length === 0;

    const userContent = buildInteractiveScriptwriterUserContent({
      storyConstitution: trimmedConstitution,
      pathContext: task.pathContext,
      isRoot,
    });

    options.logger?.debug?.('Interactive story Gemini request', {
      storyId: task.storyId,
      parentSceneletId: task.parentSceneletId,
      isRoot,
      pathContextLength: task.pathContext.length,
      geminiRequest: {
        systemInstruction,
        userContent,
      },
    });

    const rawResponse = await geminiClient.generateJson(
      {
        systemInstruction,
        userContent,
      },
      options.timeoutMs ? { timeoutMs: options.timeoutMs } : undefined
    );

    options.logger?.debug?.('Interactive story Gemini response', {
      storyId: task.storyId,
      parentSceneletId: task.parentSceneletId,
      rawResponse,
    });

    const parsedResponse = parseInteractiveScriptwriterResponse(rawResponse);

    if (parsedResponse.branch_point) {
      await handleBranchResponse(persistence, task, parsedResponse.next_scenelets, parsedResponse.choice_prompt, stack);
      continue;
    }

    if (parsedResponse.is_concluding_scene) {
      await handleConcludingResponse(persistence, task, parsedResponse.next_scenelets[0]);
      continue;
    }

    await handleLinearResponse(persistence, task, parsedResponse.next_scenelets[0], stack);
  }

  options.logger?.debug?.('Interactive story generation complete', {
    storyId: trimmedStoryId,
  });
}

async function handleLinearResponse(
  persistence: SceneletPersistence,
  task: GenerationTask,
  scenelet: ScriptwriterScenelet,
  stack: GenerationTask[]
): Promise<void> {
  const record = await persistence.createScenelet(
    createSceneletInput(task.storyId, task.parentSceneletId, scenelet)
  );

  stack.push({
    storyId: task.storyId,
    parentSceneletId: record.id,
    pathContext: [...task.pathContext, deepCopyScenelet(scenelet)],
  });
}

async function handleBranchResponse(
  persistence: SceneletPersistence,
  task: GenerationTask,
  scenelets: ScriptwriterScenelet[],
  choicePrompt: string,
  stack: GenerationTask[]
): Promise<void> {
  if (!task.parentSceneletId) {
    throw new InteractiveStoryError(
      'Branch response requires a parent scenelet id to mark as branch point.'
    );
  }

  await persistence.markSceneletAsBranchPoint(task.parentSceneletId, choicePrompt);

  for (let index = scenelets.length - 1; index >= 0; index -= 1) {
    const scenelet = scenelets[index];
    const record = await persistence.createScenelet(
      createSceneletInput(task.storyId, task.parentSceneletId, scenelet)
    );

    stack.push({
      storyId: task.storyId,
      parentSceneletId: record.id,
      pathContext: [...task.pathContext, deepCopyScenelet(scenelet)],
    });
  }
}

async function handleConcludingResponse(
  persistence: SceneletPersistence,
  task: GenerationTask,
  scenelet: ScriptwriterScenelet
): Promise<void> {
  const record = await persistence.createScenelet(
    createSceneletInput(task.storyId, task.parentSceneletId, scenelet)
  );

  await persistence.markSceneletAsTerminal(record.id);
}

function createSceneletInput(
  storyId: string,
  parentId: string | null,
  scenelet: ScriptwriterScenelet
): CreateSceneletInput {
  return {
    storyId,
    parentId,
    choiceLabelFromParent: scenelet.choice_label ?? null,
    content: deepCopyScenelet(scenelet),
  };
}

function deepCopyScenelet(scenelet: ScriptwriterScenelet): ScriptwriterScenelet {
  return {
    description: scenelet.description,
    dialogue: scenelet.dialogue.map((line) => ({ ...line })),
    shot_suggestions: [...scenelet.shot_suggestions],
    ...(scenelet.choice_label ? { choice_label: scenelet.choice_label } : {}),
  };
}
