import { createGeminiJsonClient } from '../gemini/client.js';
import type { GeminiJsonClient } from '../gemini/types.js';
import { loadAudioDesignSystemPrompt } from '../prompts/audioDesignPrompt.js';
import { StoryTreeAssemblyError } from '../story-storage/errors.js';
import type { StoryTreeSnapshot } from '../story-storage/types.js';
import { buildAudioDesignUserPrompt } from './promptBuilder.js';
import { parseAudioDesignResponse } from './parseGeminiResponse.js';
import { AudioDesignTaskError } from './errors.js';
import type {
  AudioDesignGeminiRequest,
  AudioDesignStoryRecord,
  AudioDesignTaskDependencies,
  AudioDesignTaskResult,
} from './types.js';

interface StoryConstitutionPayload {
  proposedStoryTitle: string;
  storyConstitutionMarkdown: string;
}

export async function runAudioDesignTask(
  storyId: string,
  dependencies: AudioDesignTaskDependencies
): Promise<AudioDesignTaskResult> {
  const trimmedStoryId = storyId?.trim() ?? '';
  if (!trimmedStoryId) {
    throw new AudioDesignTaskError('Story id must be provided to run audio design task.');
  }

  const { storiesRepository, storyTreeLoader, logger } = dependencies;
  if (!storiesRepository) {
    throw new AudioDesignTaskError('Stories repository dependency is required for audio design task.');
  }

  if (typeof storyTreeLoader !== 'function') {
    throw new AudioDesignTaskError('Story tree loader dependency is required for audio design task.');
  }

  const story = (await storiesRepository.getStoryById(trimmedStoryId)) as AudioDesignStoryRecord | null;
  if (!story) {
    throw new AudioDesignTaskError(`Story ${trimmedStoryId} not found.`);
  }

  const constitution = readPersistedConstitution(story);
  if (!constitution) {
    throw new AudioDesignTaskError(
      `Story ${trimmedStoryId} must have a persisted constitution before generating the audio design.`
    );
  }

  if (story.visualDesignDocument === null || story.visualDesignDocument === undefined) {
    throw new AudioDesignTaskError(
      `Story ${trimmedStoryId} must have a persisted visual design document before generating the audio design.`
    );
  }

  if (story.audioDesignDocument !== null && story.audioDesignDocument !== undefined) {
    throw new AudioDesignTaskError(
      `Story ${trimmedStoryId} already has an audio design document. Delete it before rerunning the task.`
    );
  }

  let storyTree: StoryTreeSnapshot;
  try {
    storyTree = await storyTreeLoader(trimmedStoryId);
  } catch (error) {
    if (error instanceof StoryTreeAssemblyError) {
      throw new AudioDesignTaskError(
        `Interactive script must be generated before audio design. ${error.message}`
      );
    }
    throw error;
  }

  const promptLoader = dependencies.promptLoader ?? loadAudioDesignSystemPrompt;
  const systemInstruction = (await promptLoader()).trim();
  if (!systemInstruction) {
    throw new AudioDesignTaskError('Audio design system prompt is empty.');
  }

  const userPrompt = buildAudioDesignUserPrompt({
    constitutionMarkdown: constitution.storyConstitutionMarkdown,
    storyTree,
    visualDesignDocument: story.visualDesignDocument,
  });

  const geminiClient = ensureGeminiClient(dependencies.geminiClient);
  const request: AudioDesignGeminiRequest = {
    systemInstruction,
    userPrompt,
  };

  logger?.debug?.('Invoking Gemini for audio design task', {
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

  logger?.debug?.('Received Gemini audio design response', {
    storyId: trimmedStoryId,
  });

  const parsed = parseAudioDesignResponse(rawResponse, {
    storyTree,
    visualDesignDocument: story.visualDesignDocument,
  });

  await storiesRepository.updateStoryArtifacts(trimmedStoryId, {
    audioDesignDocument: {
      audio_design_document: parsed.audioDesignDocument,
    },
  });

  return {
    storyId: trimmedStoryId,
    audioDesignDocument: {
      audio_design_document: parsed.audioDesignDocument,
    },
  };
}

function ensureGeminiClient(client?: GeminiJsonClient): GeminiJsonClient {
  if (client) {
    return client;
  }
  return createGeminiJsonClient();
}

function readPersistedConstitution(story: AudioDesignStoryRecord): StoryConstitutionPayload | null {
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
