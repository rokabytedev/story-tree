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
const DEFAULT_SAMPLE_RATE = 24_000;
const DEFAULT_CHANNELS = 1;
const DEFAULT_BITS_PER_SAMPLE = 16;

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
        console.log(
          '[gemini-tts-client] Raw request parameters:',
          JSON.stringify(parameters, null, 2)
        );
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

      const audioBuffer = extractAudioBuffer(response, {
        verbose: verbose || request.verbose || false,
      });

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

function extractAudioBuffer(
  response: GenerateContentResponse,
  options: { verbose: boolean }
): Buffer {
  const candidate = response.candidates?.[0]?.content;
  if (!candidate) {
    throw new GeminiApiError('Gemini TTS response did not include audio content.');
  }

  for (const part of candidate.parts ?? []) {
    const inlineData = (part as Part).inlineData;
    if (inlineData?.data) {
      const mimeType = inlineData.mimeType?.trim();
      const buffer = Buffer.from(inlineData.data, 'base64');

      if (options.verbose) {
        console.log('[gemini-tts-client] Inline audio metadata:', {
          mimeType,
          audioBytes: buffer.length,
        });
      }

      return normalizeAudioBuffer(buffer, mimeType, options);
    }
  }

  throw new GeminiApiError('Gemini TTS response did not contain inline audio data.');
}

function normalizeAudioBuffer(
  buffer: Buffer,
  mimeType: string | undefined,
  options: { verbose: boolean }
): Buffer {
  if (!mimeType) {
    return buffer;
  }

  const baseType = extractMimeTypeBase(mimeType);

  if (isWaveMimeType(baseType)) {
    return buffer;
  }

  if (isPcmMimeType(baseType, mimeType)) {
    const format = parseRawAudioFormat(mimeType);

    if (options.verbose) {
      console.log('[gemini-tts-client] Converting raw PCM to WAV header:', {
        mimeType,
        ...format,
      });
    }

    const header = createWavHeader(buffer.length, format);
    return Buffer.concat([header, buffer]);
  }

  return buffer;
}

function extractMimeTypeBase(mimeType: string): string {
  return mimeType.split(';')[0]?.trim().toLowerCase() ?? '';
}

function isWaveMimeType(baseType: string): boolean {
  return baseType === 'audio/wav' || baseType === 'audio/x-wav' || baseType === 'audio/wave';
}

function isPcmMimeType(baseType: string, fullMimeType: string): boolean {
  if (baseType === 'audio/raw' || baseType === 'audio/pcm' || baseType === 'audio/l16') {
    return true;
  }

  const normalized = fullMimeType.toLowerCase();
  return normalized.includes('linear16') || normalized.includes('pcm');
}

interface RawAudioFormat {
  sampleRate: number;
  numChannels: number;
  bitsPerSample: number;
}

function parseRawAudioFormat(mimeType: string): RawAudioFormat {
  const defaults: RawAudioFormat = {
    sampleRate: DEFAULT_SAMPLE_RATE,
    numChannels: DEFAULT_CHANNELS,
    bitsPerSample: DEFAULT_BITS_PER_SAMPLE,
  };

  const [base, ...rawParams] = mimeType.split(';').map((value) => value.trim()).filter(Boolean);
  const result: RawAudioFormat = { ...defaults };

  if (base) {
    const formatMatch = base.match(/l(\d{2})/i);
    if (formatMatch) {
      const parsed = Number.parseInt(formatMatch[1] ?? '', 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        result.bitsPerSample = parsed;
      }
    }
  }

  for (const param of rawParams) {
    const [rawKey, rawValue] = param.split('=').map((value) => value.trim());
    if (!rawKey || !rawValue) {
      continue;
    }

    const key = rawKey.toLowerCase();
    const value = rawValue.replace(/^"+|"+$/g, '');

    if (key === 'rate' || key === 'sample_rate' || key === 'samplerate' || key === 'hz') {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        result.sampleRate = parsed;
      }
      continue;
    }

    if (key === 'channels' || key === 'channel_count' || key === 'ch') {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        result.numChannels = parsed;
      }
      continue;
    }

    if (key === 'bits' || key === 'bitdepth' || key === 'bits_per_sample') {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        result.bitsPerSample = parsed;
      }
      continue;
    }

    if (key === 'encoding') {
      const linearMatch = value.match(/linear(\d{1,2})/i);
      if (linearMatch) {
        const parsed = Number.parseInt(linearMatch[1] ?? '', 10);
        if (Number.isFinite(parsed) && parsed > 0) {
          result.bitsPerSample = parsed;
        }
      } else if (value.toLowerCase() === 'pcm') {
        result.bitsPerSample = DEFAULT_BITS_PER_SAMPLE;
      }
    }
  }

  return result;
}

function createWavHeader(dataLength: number, format: RawAudioFormat): Buffer {
  const { sampleRate, numChannels, bitsPerSample } = format;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);

  return header;
}
