import { GoogleGenAI } from '@google/genai';
import type { GenerateContentParameters, GenerateContentResponse } from '@google/genai';

import { GeminiApiError } from './errors.js';
import {
  GeminiGenerateJsonOptions,
  GeminiGenerateJsonRequest,
  GeminiJsonClient,
} from './types.js';
import { executeGeminiWithRetry } from './retry.js';
import {
  ensureInteger,
  ensurePositive,
  normalizeGeminiError,
  parseInteger,
  parsePositiveInteger,
} from './common.js';

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

      return executeGeminiWithRetry(
        async () => {
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
        {
          policy: invocationOptions.retry?.policy,
          logger: invocationOptions.retry?.logger,
          sleep: invocationOptions.retry?.sleep,
          random: invocationOptions.retry?.random,
        }
      );
    },
  };
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
