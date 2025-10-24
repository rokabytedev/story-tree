import { ApiError, GoogleGenAI } from '@google/genai';
import type { GenerateContentParameters, GenerateContentResponse } from '@google/genai';

import { GeminiApiError, GeminiRateLimitError } from './errors.js';
import {
  GeminiGenerateJsonOptions,
  GeminiGenerateJsonRequest,
  GeminiJsonClient,
} from './types.js';

const DEFAULT_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-pro';
const DEFAULT_TIMEOUT_MS = parsePositiveInteger(process.env.GEMINI_TIMEOUT_MS) ?? 240_000;
const DEFAULT_THINKING_BUDGET = parseInteger(process.env.GEMINI_THINKING_BUDGET_TOKENS) ?? -1;

export interface GeminiClientFactoryOptions {
  apiKey?: string;
  model?: string;
  defaultTimeoutMs?: number;
  defaultThinkingBudget?: number;
  transport?: GeminiModelTransport;
}

export function createGeminiJsonClient(
  options: GeminiClientFactoryOptions = {}
): GeminiJsonClient {
  const transport = resolveTransport(options);
  const model = options.model?.trim() || DEFAULT_MODEL;
  const defaultTimeoutMs =
    options.defaultTimeoutMs ?? ensurePositive(DEFAULT_TIMEOUT_MS, 'DEFAULT_TIMEOUT_MS');
  const defaultThinkingBudget =
    options.defaultThinkingBudget ??
    ensureInteger(DEFAULT_THINKING_BUDGET, 'DEFAULT_THINKING_BUDGET');

  return {
    async generateJson(
      request: GeminiGenerateJsonRequest,
      invocationOptions: GeminiGenerateJsonOptions = {}
    ): Promise<string> {
      const timeoutMs = invocationOptions.timeoutMs ?? defaultTimeoutMs;
      const thinkingBudget = invocationOptions.thinkingBudget ?? defaultThinkingBudget;

      try {
        const response = await transport.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [{ text: request.userContent }],
            },
          ],
          config: {
            httpOptions: {
              timeout: timeoutMs,
            },
            systemInstruction: {
              role: 'system',
              parts: [{ text: request.systemInstruction }],
            },
            responseMimeType: 'application/json',
            thinkingConfig: {
              thinkingBudget,
              includeThoughts: false,
            },
          },
        });

        if (!response.text) {
          throw new GeminiApiError('Gemini returned an empty response.');
        }

        return response.text;
      } catch (error) {
        throw normalizeGeminiError(error);
      }
    },
  };
}

function normalizeGeminiError(error: unknown): GeminiApiError | GeminiRateLimitError {
  if (error instanceof GeminiRateLimitError || error instanceof GeminiApiError) {
    return error;
  }

  if (error instanceof ApiError) {
    const parsed = tryParseJson(error.message);
    const root = typeof parsed === 'object' && parsed !== null ? parsed : {};
    const err = typeof root === 'object' && root !== null ? (root as Record<string, unknown>) : {};
    const errorPayload =
      typeof err.error === 'object' && err.error !== null ? (err.error as Record<string, unknown>) : err;

    const statusText = String(
      errorPayload.status ?? errorPayload.message ?? error.status ?? 'UNKNOWN_ERROR'
    );
    const message =
      typeof errorPayload.message === 'string'
        ? errorPayload.message
        : `Gemini request failed with status ${error.status}`;
    const retryAfterMs = extractRetryAfter(errorPayload.details);

    if (isRateLimitStatus(error.status, errorPayload.status)) {
      return new GeminiRateLimitError(
        `Gemini rate limit exceeded: ${message}`,
        {
          retryAfterMs,
          cause: error,
        }
      );
    }

    return new GeminiApiError(`Gemini invocation failed: ${statusText}: ${message}`, {
      cause: error,
    });
  }

  return new GeminiApiError('Unexpected error while calling Gemini.', { cause: error });
}

function resolveTransport(options: GeminiClientFactoryOptions): GeminiModelTransport {
  if (options.transport) {
    return options.transport;
  }

  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiApiError(
      'Missing GEMINI_API_KEY. Set it in the environment before invoking Gemini.'
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  return {
    generateContent: (params: GenerateContentParameters) =>
      ai.models.generateContent(params),
  };
}

interface GeminiModelTransport {
  generateContent(
    params: GenerateContentParameters
  ): Promise<GenerateContentResponse>;
}

function isRateLimitStatus(statusCode?: number, statusText?: unknown): boolean {
  if (statusCode === 429 || statusCode === 503) {
    return true;
  }

  const normalizedStatus =
    typeof statusText === 'string' ? statusText.toUpperCase() : undefined;

  return normalizedStatus === 'RESOURCE_EXHAUSTED' || normalizedStatus === 'RATE_LIMIT_EXCEEDED';
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

function ensurePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new GeminiApiError(`Invalid positive number for ${label}.`);
  }
  return value;
}

function ensureInteger(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new GeminiApiError(`Invalid integer for ${label}.`);
  }
  return Math.trunc(value);
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  const parsed = parseInteger(value);
  if (parsed !== undefined && parsed > 0) {
    return parsed;
  }
  return undefined;
}

function parseInteger(value: string | undefined): number | undefined {
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
