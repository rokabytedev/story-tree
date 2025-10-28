import { createGeminiJsonClient } from '../gemini/client.js';
import type { GeminiJsonClient } from '../gemini/types.js';
import { loadShotDirectorSystemPrompt } from '../prompts/shotDirectorPrompt.js';
import { StoryTreeAssemblyError } from '../story-storage/errors.js';
import type { SceneletDigest, StoryTreeEntry, StoryTreeSnapshot } from '../story-storage/types.js';
import { buildShotProductionUserPrompt } from './promptBuilder.js';
import { parseShotProductionResponse } from './parseGeminiResponse.js';
import { ShotProductionTaskError } from './errors.js';
import type {
  ShotCreationInput,
  ShotProductionSceneletResult,
  ShotProductionStoryRecord,
  ShotProductionTaskDependencies,
  ShotProductionTaskResult,
} from './types.js';

const DEFAULT_TARGET_SCENELETS_PER_PATH = 12;

interface StoryConstitutionPayload {
  proposedStoryTitle: string;
  storyConstitutionMarkdown: string;
  targetSceneletsPerPath: number;
}

export async function runShotProductionTask(
  storyId: string,
  dependencies: ShotProductionTaskDependencies
): Promise<ShotProductionTaskResult> {
  const trimmedStoryId = storyId?.trim() ?? '';
  if (!trimmedStoryId) {
    throw new ShotProductionTaskError('Story id must be provided to run shot production task.');
  }

  const { storiesRepository, shotsRepository, storyTreeLoader, logger } = dependencies;
  if (!storiesRepository) {
    throw new ShotProductionTaskError('Stories repository dependency is required for shot production task.');
  }

  if (!shotsRepository) {
    throw new ShotProductionTaskError('Shots repository dependency is required for shot production task.');
  }

  if (typeof storyTreeLoader !== 'function') {
    throw new ShotProductionTaskError('Story tree loader dependency is required for shot production task.');
  }

  const story = (await storiesRepository.getStoryById(trimmedStoryId)) as ShotProductionStoryRecord | null;
  if (!story) {
    throw new ShotProductionTaskError(`Story ${trimmedStoryId} not found.`);
  }

  const constitution = readPersistedConstitution(story);
  if (!constitution) {
    throw new ShotProductionTaskError(
      `Story ${trimmedStoryId} must have a persisted constitution before generating shot production.`
    );
  }

  if (story.visualDesignDocument === null || story.visualDesignDocument === undefined) {
    throw new ShotProductionTaskError(
      `Story ${trimmedStoryId} must have a persisted visual design document before generating shot production.`
    );
  }

  if (story.audioDesignDocument === null || story.audioDesignDocument === undefined) {
    throw new ShotProductionTaskError(
      `Story ${trimmedStoryId} must have a persisted audio design document before generating shot production.`
    );
  }

  let storyTree: StoryTreeSnapshot;
  try {
    storyTree = await storyTreeLoader(trimmedStoryId);
  } catch (error) {
    if (error instanceof StoryTreeAssemblyError) {
      throw new ShotProductionTaskError(
        `Interactive script must be generated before shot production. ${error.message}`
      );
    }
    throw error;
  }

  const sceneletsInOrder = extractScenelets(storyTree.entries);
  if (sceneletsInOrder.length === 0) {
    throw new ShotProductionTaskError(
      `Story ${trimmedStoryId} must include at least one scenelet before running shot production.`
    );
  }

  const sceneletIds = sceneletsInOrder.map((entry) => entry.data.id);
  const missingSceneletIds = await shotsRepository.findSceneletIdsMissingShots(trimmedStoryId, sceneletIds);
  const missingSet = new Set(missingSceneletIds);

  if (missingSceneletIds.length === 0) {
    throw new ShotProductionTaskError(
      `Story ${trimmedStoryId} already has stored shots for every scenelet. Delete them before rerunning shot production.`
    );
  }

  if (missingSceneletIds.length !== sceneletIds.length) {
    const covered = sceneletIds.filter((id) => !missingSet.has(id));
    throw new ShotProductionTaskError(
      `Shot production currently requires regenerating the full story. Remove existing shots for scenelets: ${covered.join(', ')}.`
    );
  }

  const promptLoader = dependencies.promptLoader ?? loadShotDirectorSystemPrompt;
  const systemInstruction = (await promptLoader()).trim();
  if (!systemInstruction) {
    throw new ShotProductionTaskError('Shot production system prompt is empty.');
  }

  const geminiClient = ensureGeminiClient(dependencies.geminiClient);

  const results: ShotProductionSceneletResult[] = [];
  let totalShots = 0;

  for (const [index, sceneletEntry] of sceneletsInOrder.entries()) {
    const scenelet = sceneletEntry.data;
    const sceneletSequence = index + 1;

    const userPrompt = buildShotProductionUserPrompt({
      constitutionMarkdown: constitution.storyConstitutionMarkdown,
      storyTree,
      visualDesignDocument: story.visualDesignDocument,
      audioDesignDocument: story.audioDesignDocument,
      scenelet,
    });

    logger?.debug?.('Invoking Gemini for shot production', {
      storyId: trimmedStoryId,
      sceneletId: scenelet.id,
      geminiRequest: {
        systemInstruction,
        userContent: userPrompt,
      },
    });

    const startedAt = Date.now();
    const rawResponse = await geminiClient.generateJson(
      {
        systemInstruction,
        userContent: userPrompt,
      },
      dependencies.geminiOptions
    );
    const elapsedMs = Date.now() - startedAt;

    logger?.debug?.('Received Gemini shot production response', {
      storyId: trimmedStoryId,
      sceneletId: scenelet.id,
      elapsedMs,
    });

    const parsed = parseShotProductionResponse(rawResponse, {
      scenelet,
      visualDesignDocument: story.visualDesignDocument,
    });

    const shotInputs = parsed.shots.map<ShotCreationInput>((shot) => ({
      shotIndex: shot.shotIndex,
      storyboardPayload: shot.storyboard,
      firstFramePrompt: shot.prompts.firstFramePrompt,
      keyFramePrompt: shot.prompts.keyFramePrompt,
      videoClipPrompt: shot.prompts.videoClipPrompt,
    }));

    await shotsRepository.createSceneletShots(trimmedStoryId, scenelet.id, sceneletSequence, shotInputs);

    results.push({
      sceneletId: scenelet.id,
      shotCount: shotInputs.length,
    });
    totalShots += shotInputs.length;
  }

  return {
    storyId: trimmedStoryId,
    scenelets: results,
    totalShots,
  };
}

function ensureGeminiClient(client?: GeminiJsonClient): GeminiJsonClient {
  if (client) {
    return client;
  }
  return createGeminiJsonClient();
}

function extractScenelets(entries: StoryTreeEntry[]): Array<{ data: SceneletDigest }> {
  return entries.filter(
    (entry): entry is { kind: 'scenelet'; data: SceneletDigest } => entry.kind === 'scenelet'
  );
}

function readPersistedConstitution(story: ShotProductionStoryRecord): StoryConstitutionPayload | null {
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

  const target =
    typeof record.targetSceneletsPerPath === 'number'
      ? Math.trunc(record.targetSceneletsPerPath)
      : typeof record.target_scenelets_per_path === 'number'
        ? Math.trunc(record.target_scenelets_per_path)
        : DEFAULT_TARGET_SCENELETS_PER_PATH;

  const normalizedTarget =
    Number.isFinite(target) && target >= 1 ? target : DEFAULT_TARGET_SCENELETS_PER_PATH;

  return {
    proposedStoryTitle: proposedTitle,
    storyConstitutionMarkdown: markdown,
    targetSceneletsPerPath: normalizedTarget,
  };
}
