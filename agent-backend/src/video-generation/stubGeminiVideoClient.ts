import { readFileSync } from 'node:fs';
import path from 'node:path';

import type {
  GeminiVideoClient,
  GeminiVideoGenerationRequest,
  GeminiVideoGenerationResult,
  GeminiVideoRequestPreview,
} from '../gemini/types.js';
import { GeminiApiError } from '../gemini/errors.js';

const DEFAULT_FIXTURE_PATH = path.resolve(
  process.cwd(),
  'agent-backend/fixtures/videos/stub-shot.mp4'
);

const DEFAULT_MODEL = process.env.GEMINI_VIDEO_MODEL?.trim() || 'veo-3.1-generate-preview';
const DEFAULT_ASPECT_RATIO: '16:9' | '9:16' | '1:1' = '16:9';
const DEFAULT_RESOLUTION: '720p' | '1080p' = '1080p';
const DEFAULT_DURATION_SECONDS = 8;

export interface StubGeminiVideoClientOptions {
  fixturePath?: string;
}

export function createStubGeminiVideoClient(
  options: StubGeminiVideoClientOptions = {}
): GeminiVideoClient {
  const fixturePath = options.fixturePath
    ? path.resolve(options.fixturePath)
    : DEFAULT_FIXTURE_PATH;

  let cachedBuffer: Buffer | null = null;

  function loadFixture(): Buffer {
    if (cachedBuffer) {
      return cachedBuffer;
    }

    try {
      cachedBuffer = readFileSync(fixturePath);
      if (!cachedBuffer || cachedBuffer.length === 0) {
        throw new GeminiApiError(
          `Stub Gemini video fixture is empty: ${fixturePath}`
        );
      }
      return cachedBuffer;
    } catch (error) {
      if (error instanceof GeminiApiError) {
        throw error;
      }
      throw new GeminiApiError(
        `Failed to load stub Gemini video fixture from ${fixturePath}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return {
    async generateVideo(_request: GeminiVideoGenerationRequest): Promise<GeminiVideoGenerationResult> {
      const buffer = loadFixture();
      return {
        videoData: buffer,
        mimeType: 'video/mp4',
      };
    },
    previewGenerateVideoRequest(request: GeminiVideoGenerationRequest): GeminiVideoRequestPreview {
      const userPrompt = request.userPrompt?.trim();
      if (!userPrompt) {
        throw new GeminiApiError('Video generation requires a non-empty user prompt.');
      }

      const referenceImages = request.referenceImages ?? [];

      return {
        model: request.model?.trim() || DEFAULT_MODEL,
        source: {
          prompt: userPrompt,
        },
        config: {
          numberOfVideos: 1,
          aspectRatio: request.aspectRatio ?? DEFAULT_ASPECT_RATIO,
          resolution: request.resolution ?? DEFAULT_RESOLUTION,
          durationSeconds: request.durationSeconds ?? DEFAULT_DURATION_SECONDS,
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
    },
  };
}
