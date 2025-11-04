import { basename } from 'node:path';

import { ShotVideoTaskError } from './errors.js';
import type { ShotVideoTaskDependencies, ShotVideoTaskResult, ShotVideoTaskMode } from './types.js';
import { assembleShotVideoPrompt } from './promptAssembler.js';
import {
  selectVideoReferenceImages,
  type VideoReferenceSelection,
} from './referenceSelector.js';
import { normalizeNameForPath } from '../image-generation/normalizeNameForPath.js';
import { loadReferenceImagesFromPaths, ReferenceImageLoadError } from '../image-generation/index.js';
import type { ShotRecord } from '../shot-production/types.js';
import type { VisualDesignDocument } from '../visual-design/types.js';
import type { AudioDesignDocument } from '../audio-design/types.js';
import type { GeminiVideoClient, GeminiVideoGenerationRequest } from '../gemini/types.js';

const FALLBACK_VIDEO_MODEL = process.env.GEMINI_VIDEO_MODEL?.trim() || 'veo-3.1-generate-preview';
const FALLBACK_VIDEO_ASPECT_RATIO = '16:9';
const FALLBACK_VIDEO_RESOLUTION = '1080p';
const FALLBACK_VIDEO_DURATION_SECONDS = 8;

export async function runShotVideoTask(
  storyId: string,
  dependencies: ShotVideoTaskDependencies
): Promise<ShotVideoTaskResult> {
  const {
    storiesRepository,
    shotsRepository,
    geminiVideoClient,
    videoStorage,
    logger,
    targetSceneletId,
    targetShotIndex,
    mode = 'default',
    dryRun = false,
    retry,
    verbose = false,
  } = dependencies;

  if (!storiesRepository || !shotsRepository) {
    throw new ShotVideoTaskError('storiesRepository and shotsRepository dependencies are required.');
  }

  if (!dryRun && !geminiVideoClient) {
    throw new ShotVideoTaskError('geminiVideoClient is required for shot video generation.');
  }

  if (!dryRun && !videoStorage) {
    throw new ShotVideoTaskError('videoStorage is required for shot video generation.');
  }

  const story = await storiesRepository.getStoryById(storyId);
  if (!story) {
    throw new ShotVideoTaskError(`Story not found: ${storyId}`);
  }

  if (story.visualDesignDocument === null || story.visualDesignDocument === undefined) {
    throw new ShotVideoTaskError(
      `Story ${storyId} does not have a visual design document. Run CREATE_VISUAL_DESIGN first.`
    );
  }

  const visualDesignDocument = parseVisualDesignDocument(story.visualDesignDocument, storyId);

  if (story.audioDesignDocument === null || story.audioDesignDocument === undefined) {
    throw new ShotVideoTaskError(
      `Story ${storyId} does not have an audio design document. Run CREATE_AUDIO_DESIGN first.`
    );
  }

  const audioDesignDocument = parseAudioDesignDocument(story.audioDesignDocument);

  logger?.debug?.('Starting shot video generation task', {
    storyId,
    mode,
    dryRun,
    targetSceneletId,
    targetShotIndex,
  });

  const shotsByScenelet = await shotsRepository.getShotsByStory(storyId);
  const sceneletMap = mapShotsBySceneletId(shotsByScenelet);

  const normalizedSceneletId = targetSceneletId?.trim();
  const targetedShots = collectTargetedShots(sceneletMap, normalizedSceneletId, targetShotIndex);

  if (targetedShots.length === 0) {
    const descriptor = normalizedSceneletId
      ? targetShotIndex !== undefined
        ? `shot ${targetShotIndex} in scenelet "${normalizedSceneletId}"`
        : `scenelet "${normalizedSceneletId}"`
      : targetShotIndex !== undefined
      ? `shot with index ${targetShotIndex}`
      : 'any shots';
    throw new ShotVideoTaskError(`No ${descriptor} found for story ${storyId}.`);
  }

  const hasVideo = (shot: ShotRecord) =>
    typeof shot.videoFilePath === 'string' && shot.videoFilePath.trim().length > 0;

  const shotsWithExistingVideo = targetedShots.filter(hasVideo);
  const shotsWithoutVideo = targetedShots.filter((shot) => !hasVideo(shot));

  const executionMode: ShotVideoTaskMode = dryRun ? 'resume' : mode;
  let shotsToProcess: ShotRecord[];
  let skippedExisting = 0;

  switch (executionMode) {
    case 'override':
      shotsToProcess = targetedShots;
      skippedExisting = 0;
      break;
    case 'resume':
      shotsToProcess = shotsWithoutVideo;
      skippedExisting = shotsWithExistingVideo.length;
      break;
    case 'default':
    default:
      if (shotsWithExistingVideo.length > 0) {
        const conflictingShot = shotsWithExistingVideo[0];
        throw new ShotVideoTaskError(
          `Shot ${conflictingShot.sceneletId}#${conflictingShot.shotIndex} already has a video file path. Use resume or override mode to regenerate.`
        );
      }
      shotsToProcess = shotsWithoutVideo;
      skippedExisting = 0;
      break;
  }

  if (shotsToProcess.length === 0) {
    logger?.debug?.('No shots require video generation', {
      storyId,
      mode: executionMode,
      dryRun,
    });
    return {
      generatedVideos: 0,
      skippedExisting,
      totalShots: 0,
    };
  }

  const effectiveVideoStorage = videoStorage ?? {
    async saveVideo() {
      throw new ShotVideoTaskError('videoStorage dependency is required when not running in dry-run mode.');
    },
  };

  let generatedVideos = 0;

  for (const shot of shotsToProcess) {
    const promptObject = assembleShotVideoPrompt(shot, visualDesignDocument, audioDesignDocument);
    const promptJson = JSON.stringify(promptObject, null, 2);

    let referenceSelections: VideoReferenceSelection[] = [];
    try {
      referenceSelections = selectVideoReferenceImages({
        storyId,
        shot,
        visualDesignDocument,
        basePublicPath: dependencies.basePublicPath,
        recommenderOptions: dependencies.referenceRecommenderOptions,
        validateFileExistence:
          dependencies.referenceRecommenderOptions?.validateFileExistence ?? !dryRun,
        maxImages: dependencies.referenceImageLimit,
      });
    } catch (error) {
      throw new ShotVideoTaskError(
        `Failed to determine reference images for shot ${shot.sceneletId}#${shot.shotIndex}.`,
        error instanceof Error ? error : undefined
      );
    }

    let referenceBuffers: Array<{ data: Buffer; mimeType: 'image/png' | 'image/jpeg' }> = [];
    try {
      const referencePaths = referenceSelections.map((selection) => selection.path);
      referenceBuffers = loadReferenceImagesFromPaths(referencePaths);
    } catch (error) {
      if (error instanceof ReferenceImageLoadError) {
        if (dryRun) {
          referenceBuffers = [];
          logger?.debug?.('Dry-run reference load warning', {
            storyId,
            sceneletId: shot.sceneletId,
            shotIndex: shot.shotIndex,
            warning: error.message,
          });
        } else {
          throw new ShotVideoTaskError(
            `Failed to load reference images for shot ${shot.sceneletId}#${shot.shotIndex}: ${error.message}`,
            error
          );
        }
      } else {
        throw error;
      }
    }

    const geminiRequest: GeminiVideoGenerationRequest = {
      userPrompt: promptJson,
      referenceImages: referenceBuffers,
      retry,
    };

    const referenceMetadata = buildReferenceMetadata(referenceSelections, referenceBuffers);
    const geminiRequestPreview = buildGeminiRequestPreview(geminiRequest, geminiVideoClient);

    if (verbose || dryRun) {
      logger?.debug?.('Shot video prompt prepared', {
        storyId,
        sceneletId: shot.sceneletId,
        shotIndex: shot.shotIndex,
        dryRun,
        prompt: promptJson,
        references: referenceMetadata,
      });
    }

    if (dryRun) {
      if (verbose) {
        const retryPreview = sanitizeRetryOptions(retry);
        const metadata: Record<string, unknown> = {
          storyId,
          sceneletId: shot.sceneletId,
          shotIndex: shot.shotIndex,
          request: geminiRequestPreview,
          references: referenceMetadata,
        };
        if (retryPreview) {
          metadata.retry = retryPreview;
        }
        logger?.debug?.('Dry-run Gemini video request', metadata);
      }
      continue;
    }

    const normalizedScenelet = normalizeNameForPath(shot.sceneletId);
    const filename = `shot-${shot.shotIndex}.mp4`;

    const result = await geminiVideoClient!.generateVideo(geminiRequest);

    const relativeVideoPath = await effectiveVideoStorage.saveVideo(
      result.videoData,
      storyId,
      `shots/${normalizedScenelet}`,
      filename
    );

    await shotsRepository.updateShotVideoPath(storyId, shot.sceneletId, shot.shotIndex, relativeVideoPath);

    generatedVideos += 1;

    logger?.debug?.('Generated shot video', {
      storyId,
      sceneletId: shot.sceneletId,
      shotIndex: shot.shotIndex,
      videoFilePath: relativeVideoPath,
    });
  }

  return {
    generatedVideos,
    skippedExisting,
    totalShots: shotsToProcess.length,
  };
}

function parseVisualDesignDocument(raw: unknown, storyId: string): VisualDesignDocument {
  if (raw === null || raw === undefined) {
    throw new ShotVideoTaskError(
      `Story ${storyId} does not have a visual design document. Run CREATE_VISUAL_DESIGN first.`
    );
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new ShotVideoTaskError(
        `Story ${storyId} has an empty visual design document. Run CREATE_VISUAL_DESIGN first.`
      );
    }

    try {
      return JSON.parse(trimmed) as VisualDesignDocument;
    } catch (error) {
      throw new ShotVideoTaskError('Failed to parse visual design document JSON.', error as Error);
    }
  }

  if (typeof raw === 'object') {
    return raw as VisualDesignDocument;
  }

  throw new ShotVideoTaskError('Visual design document must be a JSON object.');
}

function parseAudioDesignDocument(raw: unknown): AudioDesignDocument {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new ShotVideoTaskError('Audio design document is empty. Run CREATE_AUDIO_DESIGN first.');
    }

    try {
      return JSON.parse(trimmed) as AudioDesignDocument;
    } catch (error) {
      throw new ShotVideoTaskError('Audio design document is not valid JSON.', error as Error);
    }
  }

  if (!raw || typeof raw !== 'object') {
    throw new ShotVideoTaskError('Audio design document must be an object.');
  }

  const record = raw as Record<string, unknown>;
  const nested = record.audio_design_document ?? record.audioDesignDocument;

  if (nested !== undefined) {
    if (!nested || typeof nested !== 'object') {
      throw new ShotVideoTaskError('Persisted audio design document payload must be an object.');
    }
    return nested as AudioDesignDocument;
  }

  return record as AudioDesignDocument;
}

function mapShotsBySceneletId(shotsByScenelet: Record<string, ShotRecord[]>): Map<string, ShotRecord[]> {
  const map = new Map<string, ShotRecord[]>();
  for (const shots of Object.values(shotsByScenelet)) {
    if (!Array.isArray(shots) || shots.length === 0) {
      continue;
    }

    const sceneletId = shots[0]?.sceneletId;
    if (sceneletId) {
      map.set(sceneletId, shots);
    }
  }
  return map;
}

function collectTargetedShots(
  sceneletMap: Map<string, ShotRecord[]>,
  sceneletId?: string,
  shotIndex?: number
): ShotRecord[] {
  const allShots: ShotRecord[] = [];

  if (!sceneletId) {
    for (const shots of sceneletMap.values()) {
      allShots.push(...shots);
    }
  } else {
    const shots = sceneletMap.get(sceneletId);
    if (shots) {
      allShots.push(...shots);
    }
  }

  if (shotIndex === undefined) {
    return allShots;
  }

  return allShots.filter((shot) => shot.shotIndex === shotIndex);
}

function buildReferenceMetadata(
  selections: VideoReferenceSelection[],
  buffers: Array<{ data: Buffer; mimeType: 'image/png' | 'image/jpeg' }>
): Array<Record<string, unknown>> {
  return selections.map((selection, index) => {
    const buffer = buffers[index];
    const metadata: Record<string, unknown> = {
      type: selection.type,
      path: selection.path,
      fileName: basename(selection.path),
    };

    if (selection.id) {
      metadata.id = selection.id;
    }

    if (buffer) {
      metadata.mimeType = buffer.mimeType;
      metadata.byteLength = buffer.data.length;
    }

    return metadata;
  });
}

function buildGeminiRequestPreview(
  request: GeminiVideoGenerationRequest,
  geminiVideoClient?: GeminiVideoClient
): Record<string, unknown> {
  if (geminiVideoClient?.previewGenerateVideoRequest) {
    try {
      return geminiVideoClient.previewGenerateVideoRequest(request);
    } catch (error) {
      // Fall back to locally constructed preview if client-provided preview fails.
      console.warn('[shot-video] Failed to preview Gemini request via client, falling back.', {
        error,
      });
    }
  }

  return buildFallbackGeminiRequestPreview(request);
}

function buildFallbackGeminiRequestPreview(
  request: GeminiVideoGenerationRequest
): Record<string, unknown> {
  const referenceImages = request.referenceImages ?? [];

  return {
    model: request.model?.trim() || FALLBACK_VIDEO_MODEL,
    source: {
      prompt: request.userPrompt,
    },
    config: {
      numberOfVideos: 1,
      aspectRatio: request.aspectRatio ?? FALLBACK_VIDEO_ASPECT_RATIO,
      resolution: request.resolution ?? FALLBACK_VIDEO_RESOLUTION,
      durationSeconds: request.durationSeconds ?? FALLBACK_VIDEO_DURATION_SECONDS,
      referenceImages: referenceImages.length
        ? referenceImages.map((reference) => ({
            referenceType: 'ASSET',
            image: {
              mimeType: reference.mimeType,
              imageBytes: `<Buffer ${reference.data.length} bytes redacted>`,
            },
          }))
        : undefined,
    },
  };
}

function sanitizeRetryOptions(retry: ShotVideoTaskDependencies['retry']): Record<string, unknown> | undefined {
  if (!retry) {
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};

  if (retry.policy !== undefined) {
    sanitized.policy = retry.policy;
  }

  if (typeof retry.logger === 'function') {
    sanitized.logger = '[function]';
  }

  if (typeof retry.sleep === 'function') {
    sanitized.sleep = '[function]';
  }

  if (typeof retry.random === 'function') {
    sanitized.random = '[function]';
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}
