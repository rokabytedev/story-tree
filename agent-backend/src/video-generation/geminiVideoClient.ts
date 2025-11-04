import { GoogleGenAI } from '@google/genai';
import type {
  GenerateVideosOperation,
  GenerateVideosParameters,
  VideoGenerationReferenceImage,
  VideoGenerationReferenceType,
} from '@google/genai';

import { GeminiApiError } from '../gemini/errors.js';
import { executeGeminiWithRetry } from '../gemini/retry.js';
import { ensurePositive, normalizeGeminiError, parsePositiveInteger } from '../gemini/common.js';
import type {
  GeminiVideoAspectRatio,
  GeminiVideoClient,
  GeminiVideoGenerationRequest,
  GeminiVideoGenerationResult,
  GeminiVideoReferenceImage,
  GeminiVideoResolution,
} from '../gemini/types.js';

const DEFAULT_VIDEO_MODEL = process.env.GEMINI_VIDEO_MODEL?.trim() || 'veo-3.1-generate-preview';
const DEFAULT_ASPECT_RATIO: GeminiVideoAspectRatio = '16:9';
const DEFAULT_RESOLUTION: GeminiVideoResolution = '1080p';
const DEFAULT_DURATION_SECONDS = 8;
const DEFAULT_POLL_INTERVAL_MS =
  parsePositiveInteger(process.env.GEMINI_VIDEO_POLL_INTERVAL_MS) ?? 5_000;
const MAX_REFERENCE_IMAGES = 3;

export interface GeminiVideoClientOptions {
  apiKey?: string;
  model?: string;
  defaultAspectRatio?: GeminiVideoAspectRatio;
  defaultResolution?: GeminiVideoResolution;
  defaultDurationSeconds?: number;
  pollIntervalMs?: number;
  transport?: GeminiVideoModelTransport;
  verbose?: boolean;
}

export interface GeminiVideoModelTransport {
  generateVideos(params: GenerateVideosParameters): Promise<GenerateVideosOperation>;
  getVideosOperation(operation: GenerateVideosOperation): Promise<GenerateVideosOperation>;
}

export function createGeminiVideoClient(
  options: GeminiVideoClientOptions = {}
): GeminiVideoClient {
  const transport = resolveTransport(options);
  const model = options.model?.trim() || DEFAULT_VIDEO_MODEL;
  const defaultAspectRatio = options.defaultAspectRatio ?? DEFAULT_ASPECT_RATIO;
  const defaultResolution = options.defaultResolution ?? DEFAULT_RESOLUTION;
  const defaultDurationSeconds = ensurePositive(
    options.defaultDurationSeconds ?? DEFAULT_DURATION_SECONDS,
    'defaultDurationSeconds'
  );
  const pollIntervalMs = ensurePositive(
    options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
    'pollIntervalMs'
  );
  const verbose = options.verbose ?? false;
  const requestDefaults = {
    model,
    aspectRatio: defaultAspectRatio,
    resolution: defaultResolution,
    durationSeconds: defaultDurationSeconds,
  } as const;

  return {
    async generateVideo(request: GeminiVideoGenerationRequest): Promise<GeminiVideoGenerationResult> {
      const params = buildGenerateVideosParameters(request, requestDefaults);

      if (verbose) {
        console.log(
          '[gemini-video-client] GenerateVideosParameters:',
          JSON.stringify(redactGenerateVideosParameters(params), null, 2)
        );
      }

      return executeGeminiWithRetry(
        async () => {
          try {
            const operation = await transport.generateVideos(params);
            const completed = await pollOperation(operation, transport, pollIntervalMs, verbose);
            return extractVideoResult(completed);
          } catch (error) {
            throw normalizeGeminiError(error);
          }
        },
        {
          policy: request.retry?.policy,
          logger: request.retry?.logger,
          sleep: request.retry?.sleep,
          random: request.retry?.random,
        }
      );
    },
    previewGenerateVideoRequest(request: GeminiVideoGenerationRequest) {
      const params = buildGenerateVideosParameters(request, requestDefaults);
      return redactGenerateVideosParameters(params);
    },
  };
}

function resolveTransport(options: GeminiVideoClientOptions): GeminiVideoModelTransport {
  if (options.transport) {
    return options.transport;
  }

  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiApiError(
      'Missing GEMINI_API_KEY. Set it in the environment before generating videos.'
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  return {
    generateVideos: (params) => ai.models.generateVideos(params),
    getVideosOperation: (operation) =>
      ai.operations.getVideosOperation({
        operation,
      }),
  };
}

function validateReferenceImages(referenceImages: GeminiVideoReferenceImage[]): void {
  if (referenceImages.length > MAX_REFERENCE_IMAGES) {
    throw new GeminiApiError(
      `A maximum of ${MAX_REFERENCE_IMAGES} reference images is supported for video generation.`
    );
  }

  for (const reference of referenceImages) {
    if (!Buffer.isBuffer(reference.data) || reference.data.length === 0) {
      throw new GeminiApiError('Reference image data must be a non-empty Buffer.');
    }

    if (reference.mimeType !== 'image/png' && reference.mimeType !== 'image/jpeg') {
      throw new GeminiApiError(
        `Unsupported reference image MIME type '${reference.mimeType}'. Only image/png and image/jpeg are supported.`
      );
    }
  }
}

function convertReferenceImage(
  reference: GeminiVideoReferenceImage
): VideoGenerationReferenceImage {
  return {
    referenceType: VideoGenerationReferenceType.ASSET,
    image: {
      imageBytes: reference.data.toString('base64'),
      mimeType: reference.mimeType,
    },
  };
}

async function pollOperation(
  operation: GenerateVideosOperation,
  transport: GeminiVideoModelTransport,
  pollIntervalMs: number,
  verbose: boolean
): Promise<GenerateVideosOperation> {
  let current = operation;

  while (!current.done) {
    if (verbose) {
      console.log('[gemini-video-client] Waiting for video operation to complete', {
        name: current.name,
      });
    }

    await sleep(pollIntervalMs);
    current = await transport.getVideosOperation(current);
  }

  if (current.error) {
    const message =
      typeof current.error === 'object' && current.error !== null
        ? JSON.stringify(current.error)
        : String(current.error);
    throw new GeminiApiError(`Gemini video generation failed: ${message}`);
  }

  return current;
}

function extractVideoResult(operation: GenerateVideosOperation): GeminiVideoGenerationResult {
  const response = operation.response;
  if (!response || !Array.isArray(response.generatedVideos) || response.generatedVideos.length === 0) {
    throw new GeminiApiError('Gemini video generation did not return any video data.');
  }

  const video = response.generatedVideos[0]?.video;
  if (!video) {
    throw new GeminiApiError('Gemini video generation response did not include a video payload.');
  }

  if (video.videoBytes) {
    const mimeType = typeof video.mimeType === 'string' && video.mimeType.trim()
      ? video.mimeType
      : 'video/mp4';

    return {
      videoData: Buffer.from(video.videoBytes, 'base64'),
      mimeType,
    };
  }

  if (video.uri) {
    throw new GeminiApiError(
      `Gemini returned a video URI (${video.uri}) instead of inline bytes. Configure the client to request inline data or provide storage integration.`
    );
  }

  throw new GeminiApiError('Gemini video generation response did not contain usable video data.');
}

function redactGenerateVideosParameters(params: GenerateVideosParameters): unknown {
  const clone = JSON.parse(JSON.stringify(params)) as Record<string, unknown>;

  const config = clone.config as Record<string, unknown> | undefined;
  if (config?.referenceImages && Array.isArray(config.referenceImages)) {
    config.referenceImages = config.referenceImages.map((ref) => {
      if (!ref || typeof ref !== 'object') {
        return ref;
      }
      const sanitized = { ...ref } as Record<string, unknown>;
      if (sanitized.image && typeof sanitized.image === 'object') {
        const image = { ...(sanitized.image as Record<string, unknown>) };
        if (typeof image.imageBytes === 'string') {
          image.imageBytes = `<base64 image data redacted, ${image.imageBytes.length} chars>`;
        }
        sanitized.image = image;
      }
      return sanitized;
    });
  }

  return clone;
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

interface GenerateVideosDefaults {
  model: string;
  aspectRatio: GeminiVideoAspectRatio;
  resolution: GeminiVideoResolution;
  durationSeconds: number;
}

function buildGenerateVideosParameters(
  request: GeminiVideoGenerationRequest,
  defaults: GenerateVideosDefaults
): GenerateVideosParameters {
  const userPrompt = request.userPrompt?.trim();
  if (!userPrompt) {
    throw new GeminiApiError('Video generation requires a non-empty user prompt.');
  }

  const aspectRatio = request.aspectRatio ?? defaults.aspectRatio;
  const resolution = request.resolution ?? defaults.resolution;
  const durationSeconds = ensurePositive(
    request.durationSeconds ?? defaults.durationSeconds,
    'durationSeconds'
  );

  const referenceImages = request.referenceImages ?? [];
  validateReferenceImages(referenceImages);

  return {
    model: request.model?.trim() || defaults.model,
    source: {
      prompt: userPrompt,
    },
    config: {
      numberOfVideos: 1,
      aspectRatio,
      resolution,
      durationSeconds,
      generateAudio: false,
      referenceImages: referenceImages.length
        ? referenceImages.map(convertReferenceImage)
        : undefined,
    },
  };
}
