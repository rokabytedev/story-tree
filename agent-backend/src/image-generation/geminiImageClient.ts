import { GoogleGenAI } from '@google/genai';
import type {
  Content,
  GenerateContentConfig,
  GenerateContentParameters,
  GenerateContentResponse,
  Part,
} from '@google/genai';

import { GeminiApiError } from '../gemini/errors.js';
import { executeGeminiWithRetry } from '../gemini/retry.js';
import { ensurePositive, normalizeGeminiError, parsePositiveInteger } from '../gemini/common.js';
import type {
  GeminiImageClient,
  GeminiImageClientOptions,
  GeminiImageModelTransport,
  ImageAspectRatio,
  ImageGenerationRequest,
  ImageGenerationResult,
  ReferenceImage,
} from './types.js';

const DEFAULT_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL?.trim() || 'gemini-2.5-flash-image';
const DEFAULT_TIMEOUT_MS = parsePositiveInteger(process.env.GEMINI_IMAGE_TIMEOUT_MS) ?? 60_000;
const DEFAULT_ASPECT_RATIO: ImageAspectRatio = '16:9';
const MAX_REFERENCE_IMAGES = 3;
const SUPPORTED_REFERENCE_MIME_TYPES = new Set<ReferenceImage['mimeType']>(['image/png', 'image/jpeg']);

export function createGeminiImageClient(options: GeminiImageClientOptions = {}): GeminiImageClient {
  const transport = resolveTransport(options);
  const model = options.model?.trim() || DEFAULT_IMAGE_MODEL;
  const defaultTimeoutMs = options.defaultTimeoutMs ?? ensurePositive(DEFAULT_TIMEOUT_MS, 'GEMINI_IMAGE_TIMEOUT_MS');
  const defaultAspectRatio = options.defaultAspectRatio ?? DEFAULT_ASPECT_RATIO;

  return {
    async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
      const userPrompt = request.userPrompt?.trim();
      if (!userPrompt) {
        throw new GeminiApiError('Image generation requires a non-empty user prompt.');
      }

      const aspectRatio = request.aspectRatio ?? defaultAspectRatio;
      const timeoutMs = request.timeoutMs ?? defaultTimeoutMs;
      const referenceImages = request.referenceImages ?? [];

      validateReferenceImages(referenceImages);

      const contents = buildContents(userPrompt, referenceImages);
      const config: GenerateContentConfig = {
        httpOptions: {
          timeout: timeoutMs,
        },
        responseModalities: ['IMAGE'],
      };

      if (request.systemInstruction?.trim()) {
        config.systemInstruction = {
          role: 'system',
          parts: [{ text: request.systemInstruction }],
        };
      }

      const parameters: GenerateContentParameters = {
        model,
        contents,
        config,
        imageConfig: {
          aspectRatio,
        },
      };

      return executeGeminiWithRetry(
        async () => {
          try {
            const response = await transport.generateContent(parameters);
            return extractImageResult(response);
          } catch (error) {
            throw normalizeGeminiError(error);
          }
        },
        {
          policy: request.retry?.policy,
          logger: request.retry?.logger,
          sleep: request.retry?.sleep,
          random: request.retry?.random,
        },
      );
    },
  };
}

function resolveTransport(options: GeminiImageClientOptions): GeminiImageModelTransport {
  if (options.transport) {
    return options.transport;
  }

  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiApiError('Missing GEMINI_API_KEY. Set it before generating images.');
  }

  const ai = new GoogleGenAI({ apiKey });
  return {
    generateContent: (params) => ai.models.generateContent(params),
  };
}

function buildContents(userPrompt: string, referenceImages: ReferenceImage[]): Content[] {
  const parts: Part[] = [];

  for (const reference of referenceImages) {
    parts.push({
      inlineData: {
        data: reference.data.toString('base64'),
        mimeType: reference.mimeType,
      },
    });
  }

  parts.push({ text: userPrompt });

  return [
    {
      role: 'user',
      parts,
    },
  ];
}

function validateReferenceImages(referenceImages: ReferenceImage[]): void {
  if (referenceImages.length > MAX_REFERENCE_IMAGES) {
    throw new GeminiApiError('A maximum of 3 reference images is supported.');
  }

  for (const reference of referenceImages) {
    if (!SUPPORTED_REFERENCE_MIME_TYPES.has(reference.mimeType)) {
      throw new GeminiApiError(`Unsupported reference image MIME type: ${reference.mimeType}.`);
    }

    if (!Buffer.isBuffer(reference.data) || reference.data.length === 0) {
      throw new GeminiApiError('Reference image data must be a non-empty Buffer.');
    }
  }
}

function extractImageResult(response: GenerateContentResponse): ImageGenerationResult {
  const candidate = response.candidates?.[0];
  if (!candidate?.content) {
    throw new GeminiApiError('Gemini response did not include an image candidate.');
  }

  const parts = candidate.content.parts ?? [];
  for (const part of parts) {
    const inlineData = (part as Part).inlineData;
    if (!inlineData) {
      continue;
    }

    const { data, mimeType } = inlineData;
    if (typeof data === 'string' && data && typeof mimeType === 'string' && mimeType) {
      return {
        imageData: Buffer.from(data, 'base64'),
        mimeType,
      };
    }
  }

  throw new GeminiApiError('Gemini response did not contain image data.');
}
