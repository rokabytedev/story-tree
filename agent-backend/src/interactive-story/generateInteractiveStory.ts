import { createGeminiJsonClient } from '../gemini/client.js';
import type { GeminiGenerateJsonOptions, GeminiRetryEvent, GeminiRetryOptions } from '../gemini/types.js';
import { loadInteractiveScriptwriterPrompt } from '../prompts/interactiveScriptwriterPrompt.js';
import { InteractiveStoryError } from './errors.js';
import { buildInteractiveScriptwriterUserContent } from './promptBuilder.js';
import { parseInteractiveScriptwriterResponse } from './parseGeminiResponse.js';
import { cloneScenelet } from './sceneletUtils.js';
import {
  CreateSceneletInput,
  GenerationTask,
  InteractiveStoryGeneratorOptions,
  InteractiveStoryLogger,
  InteractiveStoryResumeState,
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

  const normalizedResume = normalizeResumeState(trimmedStoryId, options.resumeState);
  const resumeMode = normalizedResume.isResume;
  const pendingTaskCount = normalizedResume.tasks.length;
  const retryOptions = buildRetryOptions(options);
  const invocationOptions = buildGeminiInvocationOptions(options.timeoutMs, retryOptions);

  options.logger?.debug?.('Starting interactive story generation', {
    storyId: trimmedStoryId,
    resumeMode,
    pendingTaskCount,
  });

  if (resumeMode && pendingTaskCount === 0) {
    options.logger?.debug?.('Interactive story resume found complete story tree; skipping.', {
      storyId: trimmedStoryId,
    });
    return;
  }

  const stack: GenerationTask[] =
    pendingTaskCount > 0
      ? [...normalizedResume.tasks].reverse()
      : [
          {
            storyId: trimmedStoryId,
            parentSceneletId: null,
            pathContext: [],
          },
        ];

  let createdScenelets = 0;

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
      invocationOptions
    );

    options.logger?.debug?.('Interactive story Gemini response', {
      storyId: task.storyId,
      parentSceneletId: task.parentSceneletId,
      rawResponse,
    });

    const parsedResponse = parseInteractiveScriptwriterResponse(rawResponse);

    if (parsedResponse.branch_point) {
      const created = await handleBranchResponse(
        persistence,
        task,
        parsedResponse.next_scenelets,
        parsedResponse.choice_prompt,
        stack
      );
      createdScenelets += created;
      continue;
    }

    if (parsedResponse.is_concluding_scene) {
      await handleConcludingResponse(persistence, task, parsedResponse.next_scenelets[0]);
      createdScenelets += 1;
      continue;
    }

    await handleLinearResponse(persistence, task, parsedResponse.next_scenelets[0], stack);
    createdScenelets += 1;
  }

  options.logger?.debug?.('Interactive story generation complete', {
    storyId: trimmedStoryId,
    resumeMode,
    createdScenelets,
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
    pathContext: [...task.pathContext, cloneScenelet(scenelet)],
  });
}

async function handleBranchResponse(
  persistence: SceneletPersistence,
  task: GenerationTask,
  scenelets: ScriptwriterScenelet[],
  choicePrompt: string,
  stack: GenerationTask[]
): Promise<number> {
  if (!task.parentSceneletId) {
    throw new InteractiveStoryError(
      'Branch response requires a parent scenelet id to mark as branch point.'
    );
  }

  await persistence.markSceneletAsBranchPoint(task.parentSceneletId, choicePrompt);

  let created = 0;
  for (let index = scenelets.length - 1; index >= 0; index -= 1) {
    const scenelet = scenelets[index];
    const record = await persistence.createScenelet(
      createSceneletInput(task.storyId, task.parentSceneletId, scenelet)
    );

    created += 1;
    stack.push({
      storyId: task.storyId,
      parentSceneletId: record.id,
      pathContext: [...task.pathContext, cloneScenelet(scenelet)],
    });
  }

  return created;
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
    content: cloneScenelet(scenelet),
  };
}

interface NormalizedResumeState {
  isResume: boolean;
  tasks: GenerationTask[];
}

function normalizeResumeState(
  storyId: string,
  resumeState: InteractiveStoryResumeState | null | undefined
): NormalizedResumeState {
  if (!resumeState || !Array.isArray(resumeState.pendingTasks)) {
    return { isResume: false, tasks: [] };
  }

  const tasks = resumeState.pendingTasks.map((task, index) => {
    if (!task || typeof task !== 'object') {
      throw new InteractiveStoryError(
        `Resume task at index ${index} must be an object with storyId, parentSceneletId, and pathContext.`
      );
    }

    if (task.storyId !== storyId) {
      throw new InteractiveStoryError(
        `Resume task at index ${index} targets story ${task.storyId}, expected ${storyId}.`
      );
    }

    if (task.parentSceneletId !== null && typeof task.parentSceneletId !== 'string') {
      throw new InteractiveStoryError(
        `Resume task at index ${index} has invalid parentSceneletId.`
      );
    }

    if (!Array.isArray(task.pathContext)) {
      throw new InteractiveStoryError(
        `Resume task at index ${index} must include a pathContext array.`
      );
    }

    return {
      storyId,
      parentSceneletId: task.parentSceneletId,
      pathContext: task.pathContext.map((scenelet, pathIndex) => {
        if (!scenelet || typeof scenelet !== 'object') {
          throw new InteractiveStoryError(
            `Resume task ${index} pathContext[${pathIndex}] must be a scenelet object.`
          );
        }
        return cloneScenelet(scenelet as ScriptwriterScenelet);
      }),
    };
  });

  return {
    isResume: true,
    tasks,
  };
}

function buildGeminiInvocationOptions(
  timeoutMs: number | undefined,
  retryOptions: GeminiRetryOptions | undefined
): GeminiGenerateJsonOptions | undefined {
  const options: GeminiGenerateJsonOptions = {};
  if (typeof timeoutMs === 'number') {
    options.timeoutMs = timeoutMs;
  }
  if (retryOptions) {
    options.retry = retryOptions;
  }

  if (Object.keys(options).length === 0) {
    return undefined;
  }

  return options;
}

function buildRetryOptions(
  options: InteractiveStoryGeneratorOptions
): GeminiRetryOptions | undefined {
  const base: GeminiRetryOptions = options.retryOptions ?? {};
  const logger = composeRetryLogger(options.logger, base.logger);

  if (
    base.policy === undefined &&
    base.sleep === undefined &&
    base.random === undefined &&
    !logger
  ) {
    return undefined;
  }

  const retryOptions: GeminiRetryOptions = {};

  if (base.policy !== undefined) {
    retryOptions.policy = base.policy;
  }

  if (base.sleep) {
    retryOptions.sleep = base.sleep;
  }

  if (base.random) {
    retryOptions.random = base.random;
  }

  if (logger) {
    retryOptions.logger = logger;
  }

  return retryOptions;
}

function composeRetryLogger(
  interactiveLogger: InteractiveStoryLogger | undefined,
  customLogger: GeminiRetryOptions['logger']
): GeminiRetryOptions['logger'] | undefined {
  const interactiveHook = interactiveLogger?.debug
    ? (event: GeminiRetryEvent) => {
        interactiveLogger.debug?.('Interactive story Gemini retry', {
          attempt: event.attempt,
          maxAttempts: event.maxAttempts,
          willRetry: event.willRetry,
          delayMs: event.delayMs,
          errorType: event.errorType,
          errorName:
            event.error instanceof Error ? event.error.name : typeof event.error,
        });
      }
    : undefined;

  if (customLogger && interactiveHook) {
    return (event) => {
      customLogger(event);
      interactiveHook(event);
    };
  }

  return customLogger ?? interactiveHook;
}
