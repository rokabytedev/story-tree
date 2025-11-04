export interface GeminiGenerateJsonRequest {
  systemInstruction: string;
  userContent: string;
}

export interface GeminiGenerateJsonOptions {
  timeoutMs?: number;
  thinkingBudget?: number;
  retry?: GeminiRetryOptions;
}

export interface GeminiJsonClient {
  generateJson(
    request: GeminiGenerateJsonRequest,
    options?: GeminiGenerateJsonOptions
  ): Promise<string>;
}

export interface GeminiRetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  multiplier: number;
  maxDelayMs: number;
}

export interface GeminiRetryEvent {
  attempt: number;
  maxAttempts: number;
  willRetry: boolean;
  delayMs: number;
  error: unknown;
  errorType: 'rate-limit' | 'api-error' | 'unknown';
}

export interface GeminiRetryOptions {
  /**
   * Override default retry behaviour. Set to `null` to disable retries.
   */
  policy?: Partial<GeminiRetryPolicy> | null;
  /**
   * Hook invoked after each attempt with retry metadata.
   */
  logger?: (event: GeminiRetryEvent) => void;
  /**
   * Override sleep implementation (e.g., to skip delays in tests).
   */
  sleep?: (delayMs: number) => Promise<void>;
  /**
   * Override random source used for jitter (enables deterministic testing).
   */
  random?: () => number;
}

export type GeminiVideoAspectRatio = '16:9' | '9:16' | '1:1';

export type GeminiVideoResolution = '720p' | '1080p';

export interface GeminiVideoReferenceImage {
  data: Buffer;
  mimeType: 'image/png' | 'image/jpeg';
}

export interface GeminiVideoGenerationRequest {
  userPrompt: string;
  referenceImages?: GeminiVideoReferenceImage[];
  model?: string;
  aspectRatio?: GeminiVideoAspectRatio;
  resolution?: GeminiVideoResolution;
  durationSeconds?: number;
  retry?: GeminiRetryOptions;
}

export interface GeminiVideoGenerationResult {
  videoData: Buffer;
  mimeType: 'video/mp4';
}

export type GeminiVideoRequestPreview = Record<string, unknown>;

export interface GeminiVideoClient {
  generateVideo(options: GeminiVideoGenerationRequest): Promise<GeminiVideoGenerationResult>;
  previewGenerateVideoRequest?(
    request: GeminiVideoGenerationRequest
  ): GeminiVideoRequestPreview;
}
