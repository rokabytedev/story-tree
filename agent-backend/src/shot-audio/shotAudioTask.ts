import { assembleBranchAudioPrompt, assembleShotAudioPrompt, buildBranchAudioScript } from './promptAssembler.js';
import { analyzeSpeakers } from './speakerAnalyzer.js';
import { SKIPPED_AUDIO_PLACEHOLDER } from './constants.js';
import {
  ShotAudioTaskError,
  ShotAudioValidationError,
  UnsupportedSpeakerCountError,
} from './errors.js';
import type {
  AudioFileStorage,
  GeminiTtsClient,
  PromptAssembler,
  ShotAudioMode,
  ShotAudioPrompt,
  ShotAudioTaskDependencies,
  ShotAudioTaskResult,
  ShotAudioTaskLogger,
  SpeakerAnalyzer,
} from './types.js';
import type { AudioDesignDocument } from '../audio-design/types.js';
import type { SceneletPersistence, SceneletRecord } from '../interactive-story/types.js';
import type { ShotProductionStoryboardEntry, ShotRecord } from '../shot-production/types.js';

const DEFAULT_MODE: ShotAudioMode = 'default';

interface ShotContext {
  sceneletRef: string;
  sceneletId: string;
  shot: ShotRecord;
}

export async function runShotAudioTask(
  storyId: string,
  dependencies: ShotAudioTaskDependencies
): Promise<ShotAudioTaskResult> {
  const {
    storiesRepository,
    shotsRepository,
    sceneletPersistence,
    promptAssembler: providedPromptAssembler,
    speakerAnalyzer: providedSpeakerAnalyzer,
    geminiClient,
    audioFileStorage,
    logger,
    mode: providedMode,
    targetSceneletId,
    targetShotIndex,
    verbose,
  } = dependencies;

  if (!storiesRepository) {
    throw new ShotAudioTaskError('storiesRepository dependency is required.');
  }

  if (!shotsRepository) {
    throw new ShotAudioTaskError('shotsRepository dependency is required.');
  }

  if (!sceneletPersistence) {
    throw new ShotAudioTaskError('sceneletPersistence dependency is required.');
  }

  if (!geminiClient) {
    throw new ShotAudioTaskError('geminiClient dependency is required for audio generation.');
  }

  if (!audioFileStorage) {
    throw new ShotAudioTaskError('audioFileStorage dependency is required for audio generation.');
  }

  const promptAssembler = providedPromptAssembler ?? assembleShotAudioPrompt;
  const speakerAnalyzer = providedSpeakerAnalyzer ?? analyzeSpeakers;
  const mode = normalizeMode(providedMode);
  const trimmedSceneletId = targetSceneletId?.trim() || undefined;
  const shotIndex = targetShotIndex;

  if (shotIndex !== undefined && !trimmedSceneletId) {
    throw new ShotAudioTaskError('Target shot index requires --scenelet-id to be specified.');
  }

  logger?.debug?.('Starting shot audio task', {
    storyId,
    mode,
    sceneletId: trimmedSceneletId,
    shotIndex,
  });

  const story = await storiesRepository.getStoryById(storyId);
  if (!story) {
    throw new ShotAudioTaskError(`Story not found: ${storyId}`);
  }

  if (story.audioDesignDocument === null || story.audioDesignDocument === undefined) {
    throw new ShotAudioTaskError(
      `Story ${storyId} does not have an audio design document. Run CREATE_AUDIO_DESIGN first.`
    );
  }

  const audioDesign = parseAudioDesignDocument(story.audioDesignDocument);

  const shotsByScenelet = await shotsRepository.getShotsByStory(storyId);
  if (!shotsByScenelet || Object.keys(shotsByScenelet).length === 0) {
    throw new ShotAudioTaskError(`Story ${storyId} does not have generated shots. Run CREATE_SHOT_PRODUCTION first.`);
  }

  const shotQueue = buildShotQueue(shotsByScenelet, trimmedSceneletId, shotIndex);
  const sceneletDisplayIds = buildSceneletDisplayIdMap(shotsByScenelet);
  if (shotQueue.length === 0) {
    const scopeDescription = shotIndex
      ? `scenelet ${trimmedSceneletId} shot ${shotIndex}`
      : trimmedSceneletId
        ? `scenelet ${trimmedSceneletId}`
        : 'story';
    throw new ShotAudioTaskError(`No shots found for ${scopeDescription}.`);
  }

  const totalShots = shotQueue.length;
  const existingAudio = shotQueue.filter(({ shot }) => hasAudio(shot));

  if (mode === 'default' && existingAudio.length > 0) {
    const first = existingAudio[0]!;
    throw new ShotAudioTaskError(
      `Shot ${first.sceneletId}#${first.shot.shotIndex} already has generated audio. Use --resume or --override to continue.`
    );
  }

  const processQueue =
    mode === 'resume' ? shotQueue.filter(({ shot }) => !hasAudio(shot)) : [...shotQueue];

  const skippedShots = totalShots - processQueue.length;
  let skippedShotsWithoutAudio = 0;

  let generatedAudio = 0;
  if (processQueue.length === 0) {
    logger?.debug?.('No shots require audio generation.');
  } else {
    for (const item of processQueue) {
      try {
        const storyboard = parseStoryboardPayload(item.shot.storyboardPayload, storyId, item);
        if (storyboard.audioAndNarrative.length === 0) {
          logger?.debug?.('Skipping shot audio generation: no audio entries in storyboard.', {
            storyId,
            sceneletId: item.sceneletId,
            shotIndex: item.shot.shotIndex,
          });

          const updatedShot = await shotsRepository.updateShotAudioPath(
            storyId,
            item.sceneletId,
            item.shot.shotIndex,
            SKIPPED_AUDIO_PLACEHOLDER
          );

          item.shot.audioFilePath = updatedShot.audioFilePath;
          skippedShotsWithoutAudio += 1;
          continue;
        }

        const analysis = speakerAnalyzer(storyboard.audioAndNarrative);
        const prompt = promptAssembler({
          shot: item.shot,
          audioDesign,
          analysis,
        });

        const audioBuffer = await synthesizeAudio(geminiClient, prompt, {
          verbose: verbose ?? false,
        });

        const storageResult = await audioFileStorage.saveShotAudio({
          storyId,
          sceneletId: item.sceneletId,
          shotIndex: item.shot.shotIndex,
          audioData: audioBuffer,
        });

        const updatedShot = await shotsRepository.updateShotAudioPath(
          storyId,
          item.sceneletId,
          item.shot.shotIndex,
          storageResult.relativePath
        );

        item.shot.audioFilePath = updatedShot.audioFilePath;
        generatedAudio += 1;

        logger?.debug?.('Generated shot audio', {
          storyId,
          sceneletId: item.sceneletId,
          shotIndex: item.shot.shotIndex,
          audioPath: storageResult.relativePath,
        });
      } catch (error) {
        throw enrichError(error, item);
      }
    }
  }

  const branchResult = await processBranchScenelets({
    storyId,
    sceneletPersistence,
    audioDesign,
    geminiClient,
    audioFileStorage,
    logger,
    mode,
    verbose: verbose ?? false,
    targetSceneletId: trimmedSceneletId,
    sceneletDisplayIds,
  });

  logger?.debug?.('Shot audio task completed', {
    storyId,
    generatedShots: generatedAudio,
    skippedShots: skippedShots + skippedShotsWithoutAudio,
    totalShots,
    generatedBranchAudio: branchResult.generated,
    skippedBranchAudio: branchResult.skipped,
    totalBranchScenelets: branchResult.total,
  });

  return {
    generatedAudio,
    skippedShots: skippedShots + skippedShotsWithoutAudio,
    totalShots,
    generatedBranchAudio: branchResult.generated,
    skippedBranchAudio: branchResult.skipped,
    totalBranchScenelets: branchResult.total,
  };
}

interface BranchSceneletProcessingOptions {
  storyId: string;
  sceneletPersistence: SceneletPersistence;
  audioDesign: AudioDesignDocument;
  geminiClient: GeminiTtsClient;
  audioFileStorage: AudioFileStorage;
  logger?: ShotAudioTaskLogger;
  mode: ShotAudioMode;
  verbose: boolean;
  targetSceneletId?: string;
  sceneletDisplayIds: Map<string, string>;
}

interface BranchProcessingResult {
  generated: number;
  skipped: number;
  total: number;
}

async function processBranchScenelets(options: BranchSceneletProcessingOptions): Promise<BranchProcessingResult> {
  const {
    storyId,
    sceneletPersistence,
    audioDesign,
    geminiClient,
    audioFileStorage,
    logger,
    mode,
    verbose,
    targetSceneletId,
    sceneletDisplayIds,
  } = options;

  const scenelets = await sceneletPersistence.listSceneletsByStory(storyId);
  if (!Array.isArray(scenelets) || scenelets.length === 0) {
    return { generated: 0, skipped: 0, total: 0 };
  }

  const branchScenelets = scenelets.filter((scenelet) => scenelet.isBranchPoint);
  if (branchScenelets.length === 0) {
    return { generated: 0, skipped: 0, total: 0 };
  }

  const scopedScenelets = branchScenelets
    .filter((scenelet) => isSceneletInScope(scenelet, targetSceneletId, sceneletDisplayIds))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  if (scopedScenelets.length === 0) {
    return { generated: 0, skipped: 0, total: 0 };
  }

  const totalBranchScenelets = scopedScenelets.length;
  const choiceLookup = buildChoiceLookup(scenelets);

  const conflicting = scopedScenelets.find(hasBranchAudio);
  if (mode === 'default' && conflicting) {
    const displayId = sceneletDisplayIds.get(conflicting.id) ?? conflicting.id;
    throw new ShotAudioTaskError(
      `Branch scenelet ${displayId} already has generated audio. Use --resume or --override to continue.`
    );
  }

  const resumeSkips =
    mode === 'resume'
      ? scopedScenelets.filter(
          (scenelet) => hasBranchAudio(scenelet) || isSkippedBranchAudio(scenelet)
        ).length
      : 0;

  const branchQueue =
    mode === 'resume'
      ? scopedScenelets.filter(
          (scenelet) => !hasBranchAudio(scenelet) && !isSkippedBranchAudio(scenelet)
        )
      : [...scopedScenelets];

  let skippedBranchAudio = resumeSkips;
  let generatedBranchAudio = 0;

  if (branchQueue.length === 0) {
    logger?.debug?.('No branch scenelets require audio generation.');
    return {
      generated: 0,
      skipped: skippedBranchAudio,
      total: totalBranchScenelets,
    };
  }

  for (const scenelet of branchQueue) {
    const displayId = sceneletDisplayIds.get(scenelet.id) ?? scenelet.id;
    const prompt = scenelet.choicePrompt?.trim();
    const choiceLabels = collectChoiceLabels(choiceLookup, scenelet.id);

    if (!prompt || choiceLabels.length < 2) {
      await sceneletPersistence.updateBranchAudioPath(
        storyId,
        scenelet.id,
        SKIPPED_AUDIO_PLACEHOLDER
      );
      scenelet.branchAudioFilePath = SKIPPED_AUDIO_PLACEHOLDER;
      skippedBranchAudio += 1;
      logger?.debug?.('Skipping branch audio generation: missing prompt or choice labels.', {
        storyId,
        sceneletId: displayId,
        branchSceneletId: scenelet.id,
      });
      continue;
    }

    try {
      const script = buildBranchAudioScript(prompt, choiceLabels);
      const promptPayload = assembleBranchAudioPrompt(audioDesign, script);
      const audioBuffer = await synthesizeAudio(geminiClient, promptPayload, { verbose });
      const storageResult = await audioFileStorage.saveBranchAudio({
        storyId,
        sceneletId: displayId,
        audioData: audioBuffer,
      });
      const updatedScenelet = await sceneletPersistence.updateBranchAudioPath(
        storyId,
        scenelet.id,
        storageResult.relativePath
      );
      scenelet.branchAudioFilePath = updatedScenelet.branchAudioFilePath;
      generatedBranchAudio += 1;
      logger?.debug?.('Generated branch audio', {
        storyId,
        sceneletId: displayId,
        branchSceneletId: scenelet.id,
        audioPath: storageResult.relativePath,
      });
    } catch (error) {
      throw enrichBranchError(error, scenelet, sceneletDisplayIds.get(scenelet.id) ?? scenelet.id);
    }
  }

  return {
    generated: generatedBranchAudio,
    skipped: skippedBranchAudio,
    total: totalBranchScenelets,
  };
}

function buildSceneletDisplayIdMap(
  shotsByScenelet: Record<string, ShotRecord[]>
): Map<string, string> {
  const map = new Map<string, string>();

  for (const [sceneletRef, shots] of Object.entries(shotsByScenelet)) {
    for (const shot of shots ?? []) {
      const ref = sceneletRef?.trim();
      const sceneletId = shot.sceneletId?.trim();
      if (ref && sceneletId && !map.has(ref)) {
        map.set(ref, sceneletId);
      }
    }
  }

  return map;
}

function buildChoiceLookup(scenelets: SceneletRecord[]): Map<string, SceneletRecord[]> {
  const lookup = new Map<string, SceneletRecord[]>();
  for (const scenelet of scenelets) {
    const parentId = scenelet.parentId?.trim();
    if (!parentId) {
      continue;
    }
    const list = lookup.get(parentId) ?? [];
    list.push(scenelet);
    lookup.set(parentId, list);
  }

  for (const children of lookup.values()) {
    children.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  return lookup;
}

function collectChoiceLabels(
  lookup: Map<string, SceneletRecord[]>,
  parentId: string
): string[] {
  const children = lookup.get(parentId) ?? [];
  return children
    .map((child) => child.choiceLabelFromParent?.trim())
    .filter((label): label is string => Boolean(label));
}

function isSceneletInScope(
  scenelet: SceneletRecord,
  targetSceneletId: string | undefined,
  displayIds: Map<string, string>
): boolean {
  if (!targetSceneletId) {
    return true;
  }

  const displayId = displayIds.get(scenelet.id) ?? scenelet.id;
  return displayId === targetSceneletId || scenelet.id === targetSceneletId;
}

function hasBranchAudio(scenelet: SceneletRecord): boolean {
  const path = scenelet.branchAudioFilePath?.trim();
  if (!path) {
    return false;
  }
  return path.toUpperCase() !== SKIPPED_AUDIO_PLACEHOLDER;
}

function isSkippedBranchAudio(scenelet: SceneletRecord): boolean {
  const path = scenelet.branchAudioFilePath?.trim();
  if (!path) {
    return false;
  }
  return path.toUpperCase() === SKIPPED_AUDIO_PLACEHOLDER;
}

function enrichBranchError(
  error: unknown,
  scenelet: SceneletRecord,
  displayId: string
): Error {
  if (error instanceof ShotAudioValidationError) {
    return new ShotAudioValidationError(`Branch ${displayId}: ${error.message}`);
  }

  return error instanceof Error
    ? new ShotAudioTaskError(
        `Failed to generate audio for branch ${displayId}: ${error.message}`
      )
    : new ShotAudioTaskError(`Failed to generate audio for branch ${displayId}.`);
}

function normalizeMode(mode?: ShotAudioMode): ShotAudioMode {
  if (!mode) {
    return DEFAULT_MODE;
  }

  if (mode !== 'default' && mode !== 'resume' && mode !== 'override') {
    throw new ShotAudioTaskError(`Unsupported shot audio mode: ${mode}`);
  }

  return mode;
}

function parseAudioDesignDocument(raw: unknown): AudioDesignDocument {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as AudioDesignDocument;
    } catch (error) {
      throw new ShotAudioTaskError('Audio design document is not valid JSON.');
    }
  }

  if (!raw || typeof raw !== 'object') {
    throw new ShotAudioTaskError('Audio design document must be an object.');
  }

  const record = raw as Record<string, unknown>;
  const nested = record.audio_design_document ?? record.audioDesignDocument;

  if (nested !== undefined) {
    if (!nested || typeof nested !== 'object') {
      throw new ShotAudioTaskError(
        'Persisted audio design document payload must be an object.'
      );
    }
    // Persisted Supabase rows keep the sanitized document under audio_design_document.
    return nested as AudioDesignDocument;
  }

  return record as AudioDesignDocument;
}

function parseStoryboardPayload(
  payload: unknown,
  storyId: string,
  context: ShotContext
): ShotProductionStoryboardEntry {
  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload) as ShotProductionStoryboardEntry;
      ensureAudioNarrative(parsed, storyId, context);
      return parsed;
    } catch (error) {
      throw new ShotAudioTaskError(
        `Shot ${context.sceneletId}#${context.shot.shotIndex} storyboard payload is not valid JSON.`
      );
    }
  }

  if (!payload || typeof payload !== 'object') {
    throw new ShotAudioTaskError(
      `Shot ${context.sceneletId}#${context.shot.shotIndex} storyboard payload must be an object.`
    );
  }

  const storyboard = payload as ShotProductionStoryboardEntry;
  ensureAudioNarrative(storyboard, storyId, context);
  return storyboard;
}

function ensureAudioNarrative(
  storyboard: ShotProductionStoryboardEntry,
  storyId: string,
  context: ShotContext
): void {
  if (!Array.isArray(storyboard.audioAndNarrative)) {
    throw new ShotAudioTaskError(
      `Shot ${context.sceneletId}#${context.shot.shotIndex} in story ${storyId} is missing audioAndNarrative data.`
    );
  }
}

function buildShotQueue(
  shotsByScenelet: Record<string, ShotRecord[]>,
  targetSceneletId?: string,
  targetShotIndex?: number
): ShotContext[] {
  const entries: ShotContext[] = [];

  for (const shots of Object.values(shotsByScenelet)) {
    for (const shot of shots ?? []) {
      if (targetSceneletId && shot.sceneletId !== targetSceneletId) {
        continue;
      }

      if (targetShotIndex !== undefined && shot.shotIndex !== targetShotIndex) {
        continue;
      }

      entries.push({
        sceneletRef: shot.sceneletRef,
        sceneletId: shot.sceneletId,
        shot,
      });
    }
  }

  entries.sort((a, b) => {
    if (a.shot.sceneletSequence !== b.shot.sceneletSequence) {
      return a.shot.sceneletSequence - b.shot.sceneletSequence;
    }
    if (a.sceneletId !== b.sceneletId) {
      return a.sceneletId.localeCompare(b.sceneletId);
    }
    return a.shot.shotIndex - b.shot.shotIndex;
  });

  return entries;
}

function hasAudio(shot: ShotRecord): boolean {
  const path = shot.audioFilePath?.trim();
  if (!path) {
    return false;
  }
  return path !== SKIPPED_AUDIO_PLACEHOLDER;
}

async function synthesizeAudio(
  client: GeminiTtsClient,
  prompt: ShotAudioPrompt,
  options: { verbose: boolean }
): Promise<Buffer> {
  return client.synthesize({
    prompt: prompt.prompt,
    mode: prompt.mode,
    speakers: prompt.speakers,
    verbose: options.verbose,
  });
}

function enrichError(error: unknown, context: ShotContext): Error {
  if (error instanceof UnsupportedSpeakerCountError) {
    return new ShotAudioValidationError(
      `Shot ${context.sceneletId}#${context.shot.shotIndex} contains ${error.speakerCount} speakers. Gemini TTS supports up to two speakers.`
    );
  }

  if (error instanceof ShotAudioValidationError) {
    return new ShotAudioValidationError(
      `Shot ${context.sceneletId}#${context.shot.shotIndex}: ${error.message}`
    );
  }

  return error instanceof Error
    ? new ShotAudioTaskError(
        `Failed to generate audio for shot ${context.sceneletId}#${context.shot.shotIndex}: ${error.message}`
      )
    : new ShotAudioTaskError(
        `Failed to generate audio for shot ${context.sceneletId}#${context.shot.shotIndex}.`
      );
}
