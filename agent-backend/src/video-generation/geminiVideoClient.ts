import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

import { GoogleGenAI } from '@google/genai';
import type {
  GenerateVideosOperation,
  GenerateVideosParameters,
  VideoGenerationReferenceImage,
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
  downloadVideo?: (uri: string) => Promise<Buffer>;
}

export interface GeminiVideoModelTransport {
  generateVideos(params: GenerateVideosParameters): Promise<GenerateVideosOperation>;
  getVideosOperation(operation: GenerateVideosOperation): Promise<GenerateVideosOperation>;
}

interface ResolvedTransport {
  transport: GeminiVideoModelTransport;
  apiKey?: string;
}

const DEFAULT_VIDEO_MIME_TYPE: GeminiVideoGenerationResult['mimeType'] = 'video/mp4';

export function createGeminiVideoClient(
  options: GeminiVideoClientOptions = {}
): GeminiVideoClient {
  const { transport, apiKey: resolvedApiKey } = resolveTransport(options);
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
  const downloadVideo =
    options.downloadVideo ?? createDefaultVideoDownloader(resolvedApiKey, verbose);
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
            return await extractVideoResult(completed, downloadVideo, verbose);
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
    async downloadVideoByUri(uri: string): Promise<GeminiVideoGenerationResult> {
      const trimmed = uri?.trim?.();
      if (!trimmed) {
        throw new GeminiApiError('Gemini video download requires a non-empty URI.');
      }

      if (verbose) {
        console.log('[gemini-video-client] Downloading Gemini video from URI', { uri: trimmed });
      }

      console.log(trimmed);

      let videoData: Buffer;
      try {
        videoData = await downloadVideo(trimmed);
      } catch (error) {
        throw normalizeGeminiError(error);
      }

      return {
        videoData,
        mimeType: DEFAULT_VIDEO_MIME_TYPE,
        downloadUri: trimmed,
      };
    },
  };
}

function resolveTransport(options: GeminiVideoClientOptions): ResolvedTransport {
  const candidateApiKey = options.apiKey ?? process.env.GEMINI_API_KEY;

  if (options.transport) {
    return {
      transport: options.transport,
      apiKey: candidateApiKey,
    };
  }

  const apiKey = candidateApiKey;
  if (!apiKey) {
    throw new GeminiApiError(
      'Missing GEMINI_API_KEY. Set it in the environment before generating videos.'
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  return {
    transport: {
      generateVideos: (params) => ai.models.generateVideos(params),
      getVideosOperation: (operation) =>
        ai.operations.getVideosOperation({
          operation,
        }),
    },
    apiKey,
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
    referenceType: 'ASSET',
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

async function extractVideoResult(
  operation: GenerateVideosOperation,
  downloadVideo: (uri: string) => Promise<Buffer>,
  verbose: boolean
): Promise<GeminiVideoGenerationResult> {
  const response = operation.response;
  if (!response || !Array.isArray(response.generatedVideos) || response.generatedVideos.length === 0) {
    throw new GeminiApiError('Gemini video generation did not return any video data.');
  }

  const video = response.generatedVideos[0]?.video;
  if (!video) {
    throw new GeminiApiError('Gemini video generation response did not include a video payload.');
  }

  if (video.videoBytes) {
    const mimeType =
      typeof video.mimeType === 'string' && video.mimeType.trim()
        ? video.mimeType
        : DEFAULT_VIDEO_MIME_TYPE;

    return {
      videoData: Buffer.from(video.videoBytes, 'base64'),
      mimeType: normalizeMimeType(mimeType),
    };
  }

  if (video.uri) {
    const trimmedUri = video.uri.trim();

    if (verbose) {
      console.log('[gemini-video-client] Gemini returned video URI', { uri: trimmedUri });
    }

    console.log(trimmedUri);

    try {
      const videoData = await downloadVideo(trimmedUri);
      const mimeType =
        typeof video.mimeType === 'string' && video.mimeType.trim()
          ? video.mimeType
          : DEFAULT_VIDEO_MIME_TYPE;

      return {
        videoData,
        mimeType: normalizeMimeType(mimeType),
        downloadUri: trimmedUri,
      };
    } catch (error) {
      if (error instanceof GeminiApiError) {
        throw error;
      }
      throw new GeminiApiError(
        `Failed to download Gemini video from URI ${trimmedUri}.`,
        error instanceof Error ? error : undefined
      );
    }
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
      referenceImages: referenceImages.length
        ? referenceImages.map(convertReferenceImage)
        : undefined,
    },
  };
}

function normalizeMimeType(value: string): GeminiVideoGenerationResult['mimeType'] {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'video/mp4' || normalized === 'mp4') {
    return 'video/mp4';
  }
  return 'video/mp4';
}

function createDefaultVideoDownloader(
  apiKey: string | undefined,
  verbose: boolean
): (uri: string) => Promise<Buffer> {
  return async (uri: string) => {
    const trimmed = uri?.trim?.();
    if (!trimmed) {
      throw new GeminiApiError('Gemini video download URI must be a non-empty string.');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(trimmed);
    } catch {
      throw new GeminiApiError(`Gemini video download URI is invalid: ${trimmed}`);
    }

    const requestFactory =
      parsedUrl.protocol === 'http:' ? httpRequest : parsedUrl.protocol === 'https:' ? httpsRequest : null;
    if (!requestFactory) {
      throw new GeminiApiError(
        `Unsupported protocol "${parsedUrl.protocol}" for Gemini video download.`
      );
    }

    if (!apiKey) {
      throw new GeminiApiError(
        'GEMINI_API_KEY is required to download video assets from Gemini storage URIs.'
      );
    }

    if (!parsedUrl.searchParams.has('key')) {
      parsedUrl.searchParams.set('key', apiKey);
    }

    const requestHeaders: Record<string, string> = {};
    if (apiKey) {
      requestHeaders['x-goog-api-key'] = apiKey;
      if (apiKey.startsWith('ya29.')) {
        requestHeaders.Authorization = `Bearer ${apiKey}`;
      }
    }

    if (verbose) {
      const sanitizedUrl = apiKey ? parsedUrl.toString().replaceAll(apiKey, '<redacted>') : parsedUrl.toString();
      const sanitizedHeaders = Object.entries(requestHeaders).reduce<Record<string, string>>((acc, [key, value]) => {
        acc[key] = key.toLowerCase().includes('key') || key.toLowerCase() === 'authorization' ? '<redacted>' : value;
        return acc;
      }, {});
      console.log('[gemini-video-client] Download request', {
        method: 'GET',
        url: sanitizedUrl,
        headers: sanitizedHeaders,
      });
    }

    return new Promise<Buffer>((resolve, reject) => {
      const handleError = (error: unknown) => {
        if (error instanceof GeminiApiError) {
          reject(error);
          return;
        }
        reject(
          new GeminiApiError(
            `Failed to download Gemini video from ${trimmed}: ${
              error instanceof Error ? error.message : String(error)
            }`
          )
        );
      };

      const req = requestFactory(
        {
          method: 'GET',
          hostname: parsedUrl.hostname,
          path: `${parsedUrl.pathname}${parsedUrl.search}`,
          port: parsedUrl.port ? Number(parsedUrl.port) : undefined,
          headers: requestHeaders,
        },
        (res) => {
          const statusCode = res.statusCode ?? 0;
          const location = res.headers.location;

          if (statusCode >= 300 && statusCode < 400 && location) {
            res.resume();
            let redirectUri: string;
            try {
              redirectUri = new URL(location, parsedUrl).toString();
            } catch {
              handleError(
                new GeminiApiError(
                  `Gemini video download received invalid redirect location: ${location}`
                )
              );
              return;
            }

            createDefaultVideoDownloader(apiKey, verbose)(redirectUri)
              .then(resolve)
              .catch(reject);
            return;
          }

          if (statusCode < 200 || statusCode >= 300) {
            res.resume();
            handleError(
              new GeminiApiError(
                `Gemini video download failed with status ${statusCode} ${res.statusMessage ?? ''}`.trim()
              )
            );
            return;
          }

          const chunks: Buffer[] = [];

          res.on('data', (chunk) => {
            if (typeof chunk === 'string') {
              chunks.push(Buffer.from(chunk));
            } else {
              chunks.push(chunk);
            }
          });

          res.on('error', handleError);

          res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            if (buffer.length === 0) {
              handleError(new GeminiApiError('Downloaded Gemini video is empty.'));
              return;
            }

            if (verbose) {
              console.log('[gemini-video-client] Downloaded Gemini video bytes', {
                uri: trimmed,
                size: buffer.length,
              });
            }

            resolve(buffer);
          });
        }
      );

      req.on('error', handleError);
      req.end();
    });
  };
}
