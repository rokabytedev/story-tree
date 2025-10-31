import { assembleShotAudioPrompt } from './promptAssembler.js';
import { analyzeSpeakers } from './speakerAnalyzer.js';
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
  SpeakerAnalyzer,
} from './types.js';
import type { AudioDesignDocument } from '../audio-design/types.js';
import type { ShotProductionStoryboardEntry, ShotRecord } from '../shot-production/types.js';

const DEFAULT_MODE: ShotAudioMode = 'default';

interface ShotContext {
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

  if (processQueue.length === 0) {
    logger?.debug?.('No shots require audio generation.');
    return {
      generatedAudio: 0,
      skippedShots,
      totalShots,
    };
  }

  let generatedAudio = 0;

  for (const item of processQueue) {
    try {
      const storyboard = parseStoryboardPayload(item.shot.storyboardPayload, storyId, item);
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

  return {
    generatedAudio,
    skippedShots,
    totalShots,
  };
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

  return raw as AudioDesignDocument;
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

  for (const [sceneletId, shots] of Object.entries(shotsByScenelet)) {
    if (targetSceneletId && sceneletId !== targetSceneletId) {
      continue;
    }

    for (const shot of shots ?? []) {
      if (targetShotIndex !== undefined && shot.shotIndex !== targetShotIndex) {
        continue;
      }

      entries.push({
        sceneletId,
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
  return Boolean(path);
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
