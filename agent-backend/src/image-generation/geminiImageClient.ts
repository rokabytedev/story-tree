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
  const verbose = options.verbose ?? false;

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
        imageConfig: {
          aspectRatio,
        },
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
      };

      if (verbose) {
        console.log('[gemini-image-client] GenerateContentParameters:', JSON.stringify(redactImageData(parameters), null, 2));
      }

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
      // Store name as metadata for verbose logging (not sent to Gemini)
      ...(reference.name && { _imageName: reference.name }),
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

function redactImageData(parameters: GenerateContentParameters): unknown {
  const redacted = JSON.parse(JSON.stringify(parameters));

  if (redacted.contents && Array.isArray(redacted.contents)) {
    for (const content of redacted.contents) {
      if (content.parts && Array.isArray(content.parts)) {
        for (const part of content.parts) {
          if (part.inlineData && part.inlineData.data) {
            const dataLength = part.inlineData.data.length;
            const sizeKB = Math.round(dataLength / 1024);
            const imageName = part._imageName ? ` (${part._imageName})` : '';
            part.inlineData.data = `<base64 image data redacted, ~${sizeKB}KB${imageName}>`;
            // Remove the metadata field from the redacted output
            delete part._imageName;
          }
        }
      }
    }
  }

  return redacted;
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
