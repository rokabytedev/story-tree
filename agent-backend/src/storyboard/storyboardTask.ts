import { createGeminiJsonClient } from '../gemini/client.js';
import type { GeminiJsonClient } from '../gemini/types.js';
import { loadStoryboardSystemPrompt } from '../prompts/storyboardPrompt.js';
import { StoryTreeAssemblyError } from '../story-storage/errors.js';
import type { StoryTreeSnapshot } from '../story-storage/types.js';
import { buildStoryboardUserPrompt } from './promptBuilder.js';
import { parseStoryboardResponse } from './parseGeminiResponse.js';
import { StoryboardTaskError } from './errors.js';
import type {
  StoryboardGeminiRequest,
  StoryboardStoryRecord,
  StoryboardTaskDependencies,
  StoryboardTaskResult,
} from './types.js';

interface StoryConstitutionPayload {
  proposedStoryTitle: string;
  storyConstitutionMarkdown: string;
}

export async function runStoryboardTask(
  storyId: string,
  dependencies: StoryboardTaskDependencies
): Promise<StoryboardTaskResult> {
  const trimmedStoryId = storyId?.trim() ?? '';
  if (!trimmedStoryId) {
    throw new StoryboardTaskError('Story id must be provided to run storyboard task.');
  }

  const { storiesRepository, storyTreeLoader, logger } = dependencies;
  if (!storiesRepository) {
    throw new StoryboardTaskError('Stories repository dependency is required for storyboard task.');
  }

  if (typeof storyTreeLoader !== 'function') {
    throw new StoryboardTaskError('Story tree loader dependency is required for storyboard task.');
  }

  const story = (await storiesRepository.getStoryById(trimmedStoryId)) as StoryboardStoryRecord | null;
  if (!story) {
    throw new StoryboardTaskError(`Story ${trimmedStoryId} not found.`);
  }

  const constitution = readPersistedConstitution(story);
  if (!constitution) {
    throw new StoryboardTaskError(
      `Story ${trimmedStoryId} must have a persisted constitution before generating the storyboard.`
    );
  }

  if (story.visualDesignDocument === null || story.visualDesignDocument === undefined) {
    throw new StoryboardTaskError(
      `Story ${trimmedStoryId} must have a persisted visual design document before generating the storyboard.`
    );
  }

  if (story.storyboardBreakdown !== null && story.storyboardBreakdown !== undefined) {
    throw new StoryboardTaskError(
      `Story ${trimmedStoryId} already has a storyboard breakdown. Delete it before rerunning the task.`
    );
  }

  let storyTree: StoryTreeSnapshot;
  try {
    storyTree = await storyTreeLoader(trimmedStoryId);
  } catch (error) {
    if (error instanceof StoryTreeAssemblyError) {
      throw new StoryboardTaskError(
        `Interactive script must be generated before storyboard. ${error.message}`
      );
    }
    throw error;
  }

  const promptLoader = dependencies.promptLoader ?? loadStoryboardSystemPrompt;
  const systemInstruction = (await promptLoader()).trim();
  if (!systemInstruction) {
    throw new StoryboardTaskError('Storyboard system prompt is empty.');
  }

  const userPrompt = buildStoryboardUserPrompt({
    constitutionMarkdown: constitution.storyConstitutionMarkdown,
    storyTree,
    visualDesignDocument: story.visualDesignDocument,
  });

  const geminiClient = ensureGeminiClient(dependencies.geminiClient);
  const request: StoryboardGeminiRequest = {
    systemInstruction,
    userPrompt,
  };

  logger?.debug?.('Invoking Gemini for storyboard task', {
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

  logger?.debug?.('Received Gemini storyboard response', {
    storyId: trimmedStoryId,
  });

  const parsed = parseStoryboardResponse(rawResponse, {
    storyTree,
    visualDesignDocument: story.visualDesignDocument,
  });

  await storiesRepository.updateStoryArtifacts(trimmedStoryId, {
    storyboardBreakdown: {
      storyboard_breakdown: parsed.storyboardBreakdown,
    },
  });

  return {
    storyId: trimmedStoryId,
    storyboardBreakdown: {
      storyboard_breakdown: parsed.storyboardBreakdown,
    },
  };
}

function ensureGeminiClient(client?: GeminiJsonClient): GeminiJsonClient {
  if (client) {
    return client;
  }
  return createGeminiJsonClient();
}

function readPersistedConstitution(story: StoryboardStoryRecord): StoryConstitutionPayload | null {
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
