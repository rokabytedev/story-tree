import { ApiError } from '@google/genai';
import { describe, expect, it, vi } from 'vitest';

import { GeminiApiError, GeminiRateLimitError } from '../src/gemini/errors.js';
import { createGeminiImageClient } from '../src/image-generation/geminiImageClient.js';
import type { GeminiImageClient } from '../src/image-generation/types.js';

function createClient(overrides: Partial<Parameters<typeof createGeminiImageClient>[0]> = {}): GeminiImageClient {
  const transport = overrides.transport ?? {
    generateContent: vi.fn(),
  };

  return createGeminiImageClient({
    transport,
    ...overrides,
  });
}

describe('createGeminiImageClient', () => {
  it('invokes Gemini with prompt, references, and configuration then returns image data', async () => {
    const referenceBuffer = Buffer.from('reference-data');
    const generatedBuffer = Buffer.from('generated-image');
    const transport = {
      generateContent: vi.fn(async () => ({
        candidates: [
          {
            content: {
              role: 'model',
              parts: [
                {
                  inlineData: {
                    data: generatedBuffer.toString('base64'),
                    mimeType: 'image/png',
                  },
                },
              ],
            },
          },
        ],
      })),
    };
    const client = createGeminiImageClient({ transport });

    const result = await client.generateImage({
      userPrompt: 'Create a cinematic shot of a hero.',
      systemInstruction: 'Keep the lighting moody.',
      referenceImages: [{ data: referenceBuffer, mimeType: 'image/png' }],
      aspectRatio: '4:3',
      timeoutMs: 30_000,
    });

    expect(result.mimeType).toBe('image/png');
    expect(result.imageData.equals(generatedBuffer)).toBe(true);
    expect(transport.generateContent).toHaveBeenCalledTimes(1);

    const request = transport.generateContent.mock.calls[0][0] as any;
    expect(request.model).toBe('gemini-2.5-flash-image');
    expect(request.config?.httpOptions?.timeout).toBe(30_000);
    expect(request.config?.systemInstruction?.parts?.[0]?.text).toBe('Keep the lighting moody.');
    const parts = request.contents[0].parts as any[];
    expect(Array.isArray(parts)).toBe(true);
    expect(parts[0].inlineData?.data).toBe(referenceBuffer.toString('base64'));
    expect(parts[1].text).toBe('Create a cinematic shot of a hero.');
    expect(request.imageConfig?.aspectRatio).toBe('4:3');
  });

  it('rejects requests with more than three reference images', async () => {
    const client = createClient({
      transport: { generateContent: vi.fn() },
    });
    const references = Array.from({ length: 4 }, () => ({ data: Buffer.from('x'), mimeType: 'image/png' as const }));

    await expect(
      client.generateImage({
        userPrompt: 'Prompt',
        referenceImages: references,
      }),
    ).rejects.toThrowError('A maximum of 3 reference images is supported.');
  });

  it('rejects unsupported reference image MIME types', async () => {
    const client = createClient({
      transport: { generateContent: vi.fn() },
    });

    await expect(
      client.generateImage({
        userPrompt: 'Prompt',
        referenceImages: [{ data: Buffer.from('data'), mimeType: 'image/gif' as never }],
      }),
    ).rejects.toThrowError('Unsupported reference image MIME type: image/gif.');
  });

  it('throws GeminiApiError when response lacks inline image data', async () => {
    const client = createClient({
      transport: {
        generateContent: vi.fn(async () => ({
          candidates: [
            {
              content: {
                role: 'model',
                parts: [{ text: 'No image generated' }],
              },
            },
          ],
        })),
      },
    });

    await expect(
      client.generateImage({
        userPrompt: 'Describe a scene',
      }),
    ).rejects.toBeInstanceOf(GeminiApiError);
  });

  it('converts ApiError responses to GeminiRateLimitError', async () => {
    const apiError = new ApiError({
      message: JSON.stringify({
        error: { status: 'RESOURCE_EXHAUSTED', message: 'Too many requests' },
      }),
      status: 429,
    });
    const client = createClient({
      transport: {
        generateContent: vi.fn(async () => {
          throw apiError;
        }),
      },
    });

    await expect(
      client.generateImage({
        userPrompt: 'Prompt',
        retry: { policy: { maxAttempts: 1 } },
      }),
    ).rejects.toBeInstanceOf(GeminiRateLimitError);
  });
});
