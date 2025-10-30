import type { GenerateContentParameters, GenerateContentResponse } from '@google/genai';

import type { GeminiRetryOptions } from '../gemini/types.js';

export type ImageAspectRatio =
  | '1:1'
  | '3:4'
  | '4:3'
  | '9:16'
  | '16:9'
  | '2:3'
  | '3:2'
  | '4:5'
  | '5:4'
  | '21:9';

export interface ReferenceImage {
  data: Buffer;
  mimeType: 'image/png' | 'image/jpeg';
  name?: string;
}

export interface ImageGenerationRequest {
  userPrompt: string;
  systemInstruction?: string;
  referenceImages?: ReferenceImage[];
  aspectRatio?: ImageAspectRatio;
  timeoutMs?: number;
  retry?: GeminiRetryOptions;
}

export interface ImageGenerationResult {
  imageData: Buffer;
  mimeType: string;
}

export interface GeminiImageClient {
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

export interface GeminiImageClientOptions {
  apiKey?: string;
  model?: string;
  defaultTimeoutMs?: number;
  defaultAspectRatio?: ImageAspectRatio;
  transport?: GeminiImageModelTransport;
  verbose?: boolean;
}

export interface GeminiImageModelTransport {
  generateContent(params: GenerateContentParameters): Promise<GenerateContentResponse>;
}
