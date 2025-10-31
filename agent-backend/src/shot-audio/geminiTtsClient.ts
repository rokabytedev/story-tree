import { GoogleGenAI } from '@google/genai';
import type {
  GenerateContentConfig,
  GenerateContentParameters,
  GenerateContentResponse,
  Part,
} from '@google/genai';

import { GeminiApiError } from '../gemini/errors.js';
import { executeGeminiWithRetry } from '../gemini/retry.js';
import { normalizeGeminiError, parsePositiveInteger } from '../gemini/common.js';
import type { GeminiRetryOptions } from '../gemini/types.js';
import type { GeminiTtsClient, GeminiTtsRequest, GeminiTtsSpeakerConfig } from './types.js';

const DEFAULT_TTS_MODEL = process.env.GEMINI_TTS_MODEL?.trim() || 'gemini-2.5-flash-preview-tts';
const DEFAULT_TIMEOUT_MS = parsePositiveInteger(process.env.GEMINI_TTS_TIMEOUT_MS) ?? 60_000;

export interface GeminiTtsClientOptions {
  model?: string;
  apiKey?: string;
  defaultTimeoutMs?: number;
  verbose?: boolean;
  transport?: GeminiTtsTransport;
  retry?: GeminiRetryOptions;
}

export interface GeminiTtsTransport {
  generateContent(params: GenerateContentParameters): Promise<GenerateContentResponse>;
}

export function createGeminiTtsClient(options: GeminiTtsClientOptions = {}): GeminiTtsClient {
  const transport = resolveTransport(options);
  const model = options.model?.trim() || DEFAULT_TTS_MODEL;
  const defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const verbose = options.verbose ?? false;
  const retryOptions = options.retry;

  return {
    async synthesize(request: GeminiTtsRequest): Promise<Buffer> {
      const prompt = request.prompt?.trim();
      if (!prompt) {
        throw new GeminiApiError('Shot audio generation requires a non-empty prompt.');
      }

      if (!Array.isArray(request.speakers) || request.speakers.length === 0) {
        throw new GeminiApiError('Shot audio generation requires at least one speaker configuration.');
      }

      const timeoutMs = request.timeoutMs ?? defaultTimeoutMs;
      const config: GenerateContentConfig = {
        httpOptions: {
          timeout: timeoutMs,
        },
        responseModalities: ['AUDIO'],
        speechConfig: buildSpeechConfig(request.mode, request.speakers),
      };

      const parameters: GenerateContentParameters = {
        model,
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        config,
      };

      if (verbose || request.verbose) {
        console.log('[gemini-tts-client] Request:', {
          model,
          mode: request.mode,
          speakers: request.speakers,
          timeoutMs,
        });
      }

      const response = await executeGeminiWithRetry(
        async () => {
          try {
            return await transport.generateContent(parameters);
          } catch (error) {
            throw normalizeGeminiError(error);
          }
        },
        retryOptions
      );

      const audioBuffer = extractAudioBuffer(response);

      if (verbose || request.verbose) {
        console.log('[gemini-tts-client] Response:', {
          promptBytes: Buffer.byteLength(prompt, 'utf8'),
          audioBytes: audioBuffer.length,
          audioPreviewHex: audioBuffer.subarray(0, 50).toString('hex'),
        });
      }

      return audioBuffer;
    },
  };
}

function resolveTransport(options: GeminiTtsClientOptions): GeminiTtsTransport {
  if (options.transport) {
    return options.transport;
  }

  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiApiError('Missing GEMINI_API_KEY. Set it before generating audio.');
  }

  const ai = new GoogleGenAI({ apiKey });
  return {
    generateContent: (params) => ai.models.generateContent(params),
  };
}

function buildSpeechConfig(mode: GeminiTtsRequest['mode'], speakers: GeminiTtsSpeakerConfig[]) {
  if (mode === 'single') {
    const [speaker] = speakers;
    if (!speaker) {
      throw new GeminiApiError('Single-speaker mode requires one speaker configuration.');
    }

    return {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: speaker.voiceName,
        },
      },
    };
  }

  if (speakers.length !== 2) {
    throw new GeminiApiError('Multi-speaker mode requires exactly two speaker configurations.');
  }

  return {
    multiSpeakerVoiceConfig: {
      speakerVoiceConfigs: speakers.map((entry) => ({
        speaker: entry.speaker,
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: entry.voiceName,
          },
        },
      })),
    },
  };
}

function extractAudioBuffer(response: GenerateContentResponse): Buffer {
  const candidate = response.candidates?.[0]?.content;
  if (!candidate) {
    throw new GeminiApiError('Gemini TTS response did not include audio content.');
  }

  for (const part of candidate.parts ?? []) {
    const inlineData = (part as Part).inlineData;
    if (inlineData?.data) {
      return Buffer.from(inlineData.data, 'base64');
    }
  }

  throw new GeminiApiError('Gemini TTS response did not contain inline audio data.');
}
