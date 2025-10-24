export class GeminiRateLimitError extends Error {
  readonly retryAfterMs?: number;

  constructor(message: string, options: { retryAfterMs?: number; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'GeminiRateLimitError';
    this.retryAfterMs = options.retryAfterMs;
  }
}

export class GeminiApiError extends Error {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'GeminiApiError';
  }
}
