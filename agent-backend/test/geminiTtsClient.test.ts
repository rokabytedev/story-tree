import { describe, expect, it, vi } from 'vitest';

import { createGeminiTtsClient, type GeminiTtsTransport } from '../src/shot-audio/geminiTtsClient.js';

describe('createGeminiTtsClient', () => {
  it('wraps raw PCM audio into a WAV container when mimeType indicates PCM data', async () => {
    const rawPcm = Buffer.from([0x00, 0x10, 0xff, 0xef]);
    const transport: GeminiTtsTransport = {
      generateContent: vi.fn(async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    data: rawPcm.toString('base64'),
                    mimeType: 'audio/raw; rate=16000; channels=2; bits=16',
                  },
                },
              ],
            },
          },
        ],
      })),
    };

    const client = createGeminiTtsClient({ transport });
    const buffer = await client.synthesize({
      prompt: 'Test prompt',
      mode: 'single',
      speakers: [{ speaker: 'narrator', voiceName: 'Kore' }],
    });

    expect(buffer.slice(0, 4).toString()).toBe('RIFF');
    expect(buffer.length).toBe(44 + rawPcm.length);
    expect(buffer.readUInt32LE(24)).toBe(16_000);
    expect(buffer.readUInt16LE(22)).toBe(2);
    expect(buffer.readUInt16LE(34)).toBe(16);
  });

  it('returns inline WAV audio data without modification', async () => {
    const samples = Buffer.from([0x00, 0x20, 0x30, 0x40]);
    const wavBuffer = buildTestWavBuffer(samples, { sampleRate: 24_000, channels: 1, bitsPerSample: 16 });

    const transport: GeminiTtsTransport = {
      generateContent: vi.fn(async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    data: wavBuffer.toString('base64'),
                    mimeType: 'audio/wav',
                  },
                },
              ],
            },
          },
        ],
      })),
    };

    const client = createGeminiTtsClient({ transport });
    const buffer = await client.synthesize({
      prompt: 'Another prompt',
      mode: 'single',
      speakers: [{ speaker: 'narrator', voiceName: 'Kore' }],
    });

    expect(buffer.equals(wavBuffer)).toBe(true);
  });
});

function buildTestWavBuffer(
  samples: Buffer,
  options: { sampleRate: number; channels: number; bitsPerSample: number }
): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = options.sampleRate * options.channels * (options.bitsPerSample / 8);
  const blockAlign = options.channels * (options.bitsPerSample / 8);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + samples.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(options.channels, 22);
  header.writeUInt32LE(options.sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(options.bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(samples.length, 40);

  return Buffer.concat([header, samples]);
}
