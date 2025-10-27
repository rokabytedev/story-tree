import { createGeminiJsonClient } from '../gemini/client.js';
import type { GeminiJsonClient } from '../gemini/types.js';
import { loadVisualDesignSystemPrompt } from '../prompts/visualDesignPrompt.js';
import { StoryTreeAssemblyError } from '../story-storage/errors.js';
import type { StoryTreeSnapshot } from '../story-storage/types.js';
import { VisualDesignTaskError } from './errors.js';
import { buildVisualDesignUserPrompt } from './promptBuilder.js';
import { parseVisualDesignResponse } from './parseGeminiResponse.js';
import type {
  StoryConstitutionPayload,
  VisualDesignGeminiRequest,
  VisualDesignTaskDependencies,
  VisualDesignTaskResult,
  VisualDesignStoryRecord,
} from './types.js';

export async function runVisualDesignTask(
  storyId: string,
  dependencies: VisualDesignTaskDependencies
): Promise<VisualDesignTaskResult> {
  const trimmedStoryId = storyId?.trim() ?? '';
  if (!trimmedStoryId) {
    throw new VisualDesignTaskError('Story id must be provided to run visual design task.');
  }

  const { storiesRepository, storyTreeLoader, logger } = dependencies;
  if (!storiesRepository) {
    throw new VisualDesignTaskError('Stories repository dependency is required for visual design task.');
  }

  if (typeof storyTreeLoader !== 'function') {
    throw new VisualDesignTaskError('Story tree loader dependency is required for visual design task.');
  }

  const story = (await storiesRepository.getStoryById(trimmedStoryId)) as VisualDesignStoryRecord | null;
  if (!story) {
    throw new VisualDesignTaskError(`Story ${trimmedStoryId} not found.`);
  }

  const constitution = readPersistedConstitution(story);
  if (!constitution) {
    throw new VisualDesignTaskError(
      `Story ${trimmedStoryId} must have a persisted constitution before generating visual design.`
    );
  }

  if (story.visualDesignDocument !== null && story.visualDesignDocument !== undefined) {
    throw new VisualDesignTaskError(
      `Story ${trimmedStoryId} already has a visual design document. Delete it before rerunning the task.`
    );
  }

  let storyTree: StoryTreeSnapshot;
  try {
    storyTree = await storyTreeLoader(trimmedStoryId);
  } catch (error) {
    if (error instanceof StoryTreeAssemblyError) {
      throw new VisualDesignTaskError(
        `Interactive script must be generated before visual design. ${error.message}`
      );
    }
    throw error;
  }

  const promptLoader = dependencies.promptLoader ?? loadVisualDesignSystemPrompt;
  const systemInstruction = (await promptLoader()).trim();
  if (!systemInstruction) {
    throw new VisualDesignTaskError('Visual design system prompt is empty.');
  }

  const userPrompt = buildVisualDesignUserPrompt({
    constitutionMarkdown: constitution.storyConstitutionMarkdown,
    storyTree,
  });

  const geminiClient = ensureGeminiClient(dependencies.geminiClient);
  const request: VisualDesignGeminiRequest = {
    systemInstruction,
    userPrompt,
  };

  logger?.debug?.('Invoking Gemini for visual design task', {
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

  logger?.debug?.('Received Gemini visual design response', {
    storyId: trimmedStoryId,
  });

  const parsed = parseVisualDesignResponse(rawResponse);

  await storiesRepository.updateStoryArtifacts(trimmedStoryId, {
    visualDesignDocument: parsed.visualDesignDocument,
  });

  return {
    storyId: trimmedStoryId,
    visualDesignDocument: parsed.visualDesignDocument,
  };
}

function ensureGeminiClient(client?: GeminiJsonClient): GeminiJsonClient {
  if (client) {
    return client;
  }
  return createGeminiJsonClient();
}

function readPersistedConstitution(story: VisualDesignStoryRecord): StoryConstitutionPayload | null {
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
