import { describe, expect, it, vi } from 'vitest';

import { executeGeminiWithRetry } from '../src/gemini/retry.js';
import { GeminiApiError, GeminiRateLimitError } from '../src/gemini/errors.js';

describe('executeGeminiWithRetry', () => {
  it('retries retryable API errors and succeeds', async () => {
    let attempts = 0;
    const operation = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new GeminiApiError('Service unavailable', {
          isRetryable: true,
        });
      }
      return 'success';
    });

    const sleep = vi.fn(async () => {});
    const logger = vi.fn();

    const result = await executeGeminiWithRetry(operation, {
      policy: {
        maxAttempts: 3,
        initialDelayMs: 100,
        multiplier: 2,
        maxDelayMs: 1_000,
      },
      sleep,
      random: () => 0.5,
      logger,
    });

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(logger).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 1,
        willRetry: true,
        delayMs: expect.any(Number),
        errorType: 'api-error',
      })
    );
  });

  it('respects retry-after metadata for rate limits', async () => {
    let attempts = 0;
    const operation = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new GeminiRateLimitError('Rate limited', { retryAfterMs: 4_000 });
      }
      return 'success';
    });

    const sleep = vi.fn(async () => {});

    await executeGeminiWithRetry(operation, {
      policy: {
        maxAttempts: 3,
        initialDelayMs: 1_000,
        multiplier: 2,
        maxDelayMs: 10_000,
      },
      sleep,
      random: () => 0,
    });

    expect(sleep).toHaveBeenCalledWith(4_000);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('bubbles non-retryable errors without sleeping', async () => {
    const operation = vi.fn(async () => {
      throw new GeminiApiError('Validation failed', { isRetryable: false });
    });
    const sleep = vi.fn(async () => {});

    await expect(
      executeGeminiWithRetry(operation, {
        policy: {
          maxAttempts: 3,
          initialDelayMs: 100,
          multiplier: 2,
          maxDelayMs: 1_000,
        },
        sleep,
      })
    ).rejects.toBeInstanceOf(GeminiApiError);

    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
