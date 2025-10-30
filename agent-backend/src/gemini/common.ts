import { ApiError } from '@google/genai';

import { GeminiApiError, GeminiRateLimitError } from './errors.js';

export function ensurePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new GeminiApiError(`Invalid positive number for ${label}.`);
  }
  return value;
}

export function ensureInteger(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new GeminiApiError(`Invalid integer for ${label}.`);
  }
  return Math.trunc(value);
}

export function parsePositiveInteger(value: string | undefined): number | undefined {
  const parsed = parseInteger(value);
  if (parsed !== undefined && parsed > 0) {
    return parsed;
  }
  return undefined;
}

export function parseInteger(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizeGeminiError(error: unknown): GeminiApiError | GeminiRateLimitError {
  if (error instanceof GeminiRateLimitError || error instanceof GeminiApiError) {
    return error;
  }

  if (error instanceof ApiError) {
    const parsed = tryParseJson(error.message);
    const root = typeof parsed === 'object' && parsed !== null ? parsed : {};
    const err = typeof root === 'object' && root !== null ? (root as Record<string, unknown>) : {};
    const errorPayload =
      typeof err.error === 'object' && err.error !== null ? (err.error as Record<string, unknown>) : err;

    const statusSummary = String(errorPayload.status ?? errorPayload.message ?? error.status ?? 'UNKNOWN_ERROR');
    const message =
      typeof errorPayload.message === 'string'
        ? errorPayload.message
        : `Gemini request failed with status ${error.status}`;
    const retryAfterMs = extractRetryAfter(errorPayload.details);

    const statusCode = error.status;
    const statusTextRaw = typeof errorPayload.status === 'string' ? errorPayload.status : undefined;

    if (isRateLimitStatus(statusCode, errorPayload.status)) {
      return new GeminiRateLimitError(`Gemini rate limit exceeded: ${message}`, {
        retryAfterMs,
        cause: error,
      });
    }

    return new GeminiApiError(`Gemini invocation failed: ${statusSummary}: ${message}`, {
      cause: error,
      statusCode,
      statusText: statusTextRaw,
      isRetryable: isRetryableStatus(statusCode, statusTextRaw),
    });
  }

  return new GeminiApiError('Unexpected error while calling Gemini.', {
    cause: error,
    isRetryable: false,
  });
}

function extractRetryAfter(details: unknown): number | undefined {
  if (!details) {
    return undefined;
  }

  const detailList = Array.isArray(details) ? details : [details];

  for (const detail of detailList) {
    if (typeof detail !== 'object' || detail === null) {
      continue;
    }

    const record = detail as Record<string, unknown>;
    const retryDelay = record.retryDelay ?? record['retry-after'] ?? record.retryAfter;

    if (typeof retryDelay === 'string') {
      const parsed = parseDurationSeconds(retryDelay);
      if (parsed !== undefined) {
        return parsed * 1000;
      }
    } else if (typeof retryDelay === 'number' && Number.isFinite(retryDelay)) {
      return retryDelay * 1000;
    } else if (typeof retryDelay === 'object' && retryDelay !== null) {
      const delayRecord = retryDelay as Record<string, unknown>;
      const seconds = toNumber(delayRecord.seconds);
      const nanos = toNumber(delayRecord.nanos);
      if (seconds !== undefined || nanos !== undefined) {
        return (seconds ?? 0) * 1000 + Math.round((nanos ?? 0) / 1_000_000);
      }
    }
  }

  return undefined;
}

function parseDurationSeconds(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const match = /^(-?\d+(?:\.\d+)?)s$/i.exec(trimmed);
  if (!match) {
    return undefined;
  }

  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function tryParseJson(text: unknown): unknown {
  if (typeof text !== 'string') {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isRateLimitStatus(statusCode?: number, statusText?: unknown): boolean {
  if (statusCode === 429 || statusCode === 503) {
    return true;
  }

  const normalizedStatus = typeof statusText === 'string' ? statusText.toUpperCase() : undefined;

  return normalizedStatus === 'RESOURCE_EXHAUSTED' || normalizedStatus === 'RATE_LIMIT_EXCEEDED';
}

function isRetryableStatus(statusCode?: number, statusText?: string): boolean {
  if (typeof statusCode === 'number' && statusCode >= 500) {
    return true;
  }

  if (typeof statusText === 'string') {
    const normalized = statusText.toUpperCase();
    if (normalized === 'UNAVAILABLE') {
      return true;
    }
  }

  return false;
}
