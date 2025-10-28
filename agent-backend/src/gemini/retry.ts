import { GeminiApiError, GeminiRateLimitError } from './errors.js';
import type {
  GeminiRetryEvent,
  GeminiRetryOptions,
  GeminiRetryPolicy,
} from './types.js';

const DEFAULT_RETRY_POLICY: GeminiRetryPolicy = {
  maxAttempts: 5,
  initialDelayMs: 2_000,
  multiplier: 2,
  maxDelayMs: 30_000,
};

const DEFAULT_SLEEP = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    if (ms <= 0) {
      resolve();
      return;
    }
    setTimeout(resolve, ms);
  });

const HALF_JITTER = 0.5;

export async function executeGeminiWithRetry<T>(
  operation: () => Promise<T>,
  options: GeminiRetryOptions = {}
): Promise<T> {
  const policy = resolvePolicy(options.policy);
  const sleep = options.sleep ?? DEFAULT_SLEEP;
  const random = options.random ?? Math.random;
  const logger = options.logger;

  let attempt = 1;

  while (attempt <= policy.maxAttempts) {
    try {
      return await operation();
    } catch (error) {
      const errorType = classifyError(error);
      const retryable = shouldRetry(error);
      const isLastAttempt = attempt >= policy.maxAttempts;

      if (!retryable || isLastAttempt) {
        logger?.({
          attempt,
          maxAttempts: policy.maxAttempts,
          willRetry: false,
          delayMs: 0,
          error,
          errorType,
        });
        throw error;
      }

      const delayMs = computeDelayMs(policy, attempt, random, error);

      logger?.({
        attempt,
        maxAttempts: policy.maxAttempts,
        willRetry: true,
        delayMs,
        error,
        errorType,
      });

      if (delayMs > 0) {
        await sleep(delayMs);
      }

      attempt += 1;
    }
  }

  // Should be unreachable because loop throws on final failure.
  throw new GeminiApiError('Gemini retry loop exhausted unexpectedly.');
}

function resolvePolicy(policy: GeminiRetryOptions['policy']): GeminiRetryPolicy {
  if (policy === null) {
    return {
      ...DEFAULT_RETRY_POLICY,
      maxAttempts: 1,
    };
  }

  if (!policy) {
    return { ...DEFAULT_RETRY_POLICY };
  }

  return {
    maxAttempts: Math.max(1, policy.maxAttempts ?? DEFAULT_RETRY_POLICY.maxAttempts),
    initialDelayMs:
      policy.initialDelayMs !== undefined ? Math.max(0, policy.initialDelayMs) : DEFAULT_RETRY_POLICY.initialDelayMs,
    multiplier: policy.multiplier !== undefined ? Math.max(1, policy.multiplier) : DEFAULT_RETRY_POLICY.multiplier,
    maxDelayMs:
      policy.maxDelayMs !== undefined ? Math.max(0, policy.maxDelayMs) : DEFAULT_RETRY_POLICY.maxDelayMs,
  };
}

function shouldRetry(error: unknown): boolean {
  if (error instanceof GeminiRateLimitError) {
    return true;
  }

  if (error instanceof GeminiApiError) {
    return error.isRetryable;
  }

  return false;
}

function classifyError(error: unknown): GeminiRetryEvent['errorType'] {
  if (error instanceof GeminiRateLimitError) {
    return 'rate-limit';
  }

  if (error instanceof GeminiApiError) {
    return 'api-error';
  }

  return 'unknown';
}

function computeDelayMs(
  policy: GeminiRetryPolicy,
  attempt: number,
  random: () => number,
  error: unknown
): number {
  const baseDelay = Math.min(
    policy.maxDelayMs,
    policy.initialDelayMs * Math.pow(policy.multiplier, attempt - 1)
  );

  const jitterRatio = HALF_JITTER + random();
  let delayMs = Math.min(policy.maxDelayMs, Math.round(baseDelay * jitterRatio));

  if (error instanceof GeminiRateLimitError && error.retryAfterMs && error.retryAfterMs > delayMs) {
    delayMs = Math.round(error.retryAfterMs);
  }

  if (delayMs < 0) {
    return 0;
  }

  return delayMs;
}
