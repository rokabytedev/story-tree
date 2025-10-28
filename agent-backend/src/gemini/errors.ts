export class GeminiRateLimitError extends Error {
  readonly retryAfterMs?: number;

  constructor(message: string, options: { retryAfterMs?: number; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'GeminiRateLimitError';
    this.retryAfterMs = options.retryAfterMs;
  }
}

export class GeminiApiError extends Error {
  readonly statusCode?: number;
  readonly statusText?: string;
  readonly isRetryable: boolean;

  constructor(
    message: string,
    options: {
      cause?: unknown;
      statusCode?: number;
      statusText?: string;
      isRetryable?: boolean;
    } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = 'GeminiApiError';
    this.statusCode = options.statusCode;
    this.statusText = options.statusText;
    this.isRetryable = Boolean(options.isRetryable);
  }
}
