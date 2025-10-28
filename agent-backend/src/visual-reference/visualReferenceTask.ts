import { createGeminiJsonClient } from '../gemini/client.js';
import type { GeminiJsonClient } from '../gemini/types.js';
import { loadVisualReferenceSystemPrompt } from '../prompts/visualReferencePrompt.js';
import { StoryTreeAssemblyError } from '../story-storage/errors.js';
import type { StoryTreeSnapshot } from '../story-storage/types.js';
import { VisualReferenceTaskError } from './errors.js';
import { buildVisualReferenceUserPrompt } from './promptBuilder.js';
import { validateVisualReferenceResponse } from './validateVisualReferenceResponse.js';
import type {
  VisualReferenceGeminiRequest,
  VisualReferenceStoryRecord,
  VisualReferenceTaskDependencies,
  VisualReferenceTaskResult,
} from './types.js';

const DEFAULT_MINIMUM_PROMPT_LENGTH = 80;

export async function runVisualReferenceTask(
  storyId: string,
  dependencies: VisualReferenceTaskDependencies
): Promise<VisualReferenceTaskResult> {
  const trimmedStoryId = storyId?.trim() ?? '';
  if (!trimmedStoryId) {
    throw new VisualReferenceTaskError('Story id must be provided to run visual reference task.');
  }

  const { storiesRepository, storyTreeLoader, logger } = dependencies;
  if (!storiesRepository) {
    throw new VisualReferenceTaskError('Stories repository dependency is required for visual reference task.');
  }

  if (typeof storyTreeLoader !== 'function') {
    throw new VisualReferenceTaskError('Story tree loader dependency is required for visual reference task.');
  }

  const story = (await storiesRepository.getStoryById(trimmedStoryId)) as VisualReferenceStoryRecord | null;
  if (!story) {
    throw new VisualReferenceTaskError(`Story ${trimmedStoryId} not found.`);
  }

  const constitution = readPersistedConstitution(story);
  if (!constitution) {
    throw new VisualReferenceTaskError(
      `Story ${trimmedStoryId} must have a persisted constitution before generating visual references.`
    );
  }

  if (story.visualDesignDocument === null || story.visualDesignDocument === undefined) {
    throw new VisualReferenceTaskError(
      `Story ${trimmedStoryId} must have a persisted visual design document before generating visual references.`
    );
  }

  if (story.visualReferencePackage !== null && story.visualReferencePackage !== undefined) {
    throw new VisualReferenceTaskError(
      `Story ${trimmedStoryId} already has a visual reference package. Delete it before rerunning the task.`
    );
  }

  let storyTree: StoryTreeSnapshot;
  try {
    storyTree = await storyTreeLoader(trimmedStoryId);
  } catch (error) {
    if (error instanceof StoryTreeAssemblyError) {
      throw new VisualReferenceTaskError(
        `Interactive script must be generated before visual references. ${error.message}`
      );
    }
    throw error;
  }

  const promptLoader = dependencies.promptLoader ?? loadVisualReferenceSystemPrompt;
  const systemInstruction = (await promptLoader()).trim();
  if (!systemInstruction) {
    throw new VisualReferenceTaskError('Visual reference system prompt is empty.');
  }

  const userPrompt = buildVisualReferenceUserPrompt({
    constitutionMarkdown: constitution.storyConstitutionMarkdown,
    storyTree,
    visualDesignDocument: story.visualDesignDocument,
  });

  const geminiClient = ensureGeminiClient(dependencies.geminiClient);
  const request: VisualReferenceGeminiRequest = {
    systemInstruction,
    userPrompt,
  };

  logger?.debug?.('Invoking Gemini for visual reference task', {
    storyId: trimmedStoryId,
    geminiRequest: {
      systemInstruction: request.systemInstruction,
      userContent: request.userPrompt,
    },
  });

  const rawResponse = await geminiClient.generateJson(
    {
      systemInstruction: request.systemInstruction,
      userContent: request.userPrompt,
    },
    dependencies.geminiOptions
  );

  logger?.debug?.('Received Gemini visual reference response', {
    storyId: trimmedStoryId,
  });

  const validated = validateVisualReferenceResponse(rawResponse, {
    visualDesignDocument: story.visualDesignDocument,
    minimumPromptLength: dependencies.minimumPromptLength ?? DEFAULT_MINIMUM_PROMPT_LENGTH,
  });

  await storiesRepository.updateStoryArtifacts(trimmedStoryId, {
    visualReferencePackage: validated.visualReferencePackage,
  });

  return {
    storyId: trimmedStoryId,
    visualReferencePackage: validated.visualReferencePackage,
  };
}

function ensureGeminiClient(client?: GeminiJsonClient): GeminiJsonClient {
  if (client) {
    return client;
  }
  return createGeminiJsonClient();
}

interface StoryConstitutionPayload {
  proposedStoryTitle: string;
  storyConstitutionMarkdown: string;
}

function readPersistedConstitution(story: VisualReferenceStoryRecord): StoryConstitutionPayload | null {
  const raw = story.storyConstitution;
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const proposedTitle =
    typeof record.proposedStoryTitle === 'string'
      ? record.proposedStoryTitle
      : typeof record.proposed_story_title === 'string'
        ? record.proposed_story_title
        : null;

  const markdown =
    typeof record.storyConstitutionMarkdown === 'string'
      ? record.storyConstitutionMarkdown
      : typeof record.story_constitution_markdown === 'string'
        ? record.story_constitution_markdown
        : null;

  if (!proposedTitle || !markdown) {
    return null;
  }

  return {
    proposedStoryTitle: proposedTitle,
    storyConstitutionMarkdown: markdown,
  };
}
