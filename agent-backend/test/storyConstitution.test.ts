import { ApiError } from '@google/genai';
import type { GenerateContentResponse } from '@google/genai';
import { describe, expect, it, vi } from 'vitest';

import { createGeminiJsonClient } from '../src/gemini/client.js';
import { GeminiRateLimitError } from '../src/gemini/errors.js';
import { generateStoryConstitution } from '../src/story-constitution/generateStoryConstitution.js';
import { StoryConstitutionParsingError } from '../src/story-constitution/errors.js';

function makeClient(responseFactory: () => GenerateContentResponse | Promise<GenerateContentResponse>) {
  const transport = {
    async generateContent(): Promise<GenerateContentResponse> {
      return await responseFactory();
    },
  };

  const baseClient = createGeminiJsonClient({ transport });

  return {
    async generateJson(request: Parameters<typeof baseClient.generateJson>[0], options?: Parameters<typeof baseClient.generateJson>[1]) {
      return baseClient.generateJson(request, {
        ...options,
        retry: {
          ...(options?.retry ?? {}),
          policy: null,
          sleep: async () => {},
        },
      });
    },
  };
}

describe('generateStoryConstitution', () => {
  it('returns parsed story constitution from valid Gemini JSON', async () => {
    const brief = 'A daring explorer maps an enchanted forest.';
    const jsonResponse = JSON.stringify({
      proposed_story_title: 'Enchanted Trails',
      story_constitution_markdown: '### **Story Constitution: Enchanted Trails**\n\nStub markdown.',
      target_scenelets_per_path: 18,
    });

    const client = makeClient(
      () => ({ text: jsonResponse } as unknown as GenerateContentResponse)
    );

    const result = await generateStoryConstitution(brief, {
      geminiClient: client,
      promptLoader: async () => 'system prompt',
    });

    expect(result.proposedStoryTitle).toBe('Enchanted Trails');
    expect(result.storyConstitutionMarkdown).toContain('Stub markdown.');
    expect(result.targetSceneletsPerPath).toBe(18);
  });

  it('logs Gemini request payload when logger is provided', async () => {
    const brief = 'A reflective prompt';
    const jsonResponse = JSON.stringify({
      proposed_story_title: 'Reflective Tale',
      story_constitution_markdown: '## Tale',
      target_scenelets_per_path: 12,
    });

    const client = makeClient(
      () => ({ text: jsonResponse } as unknown as GenerateContentResponse)
    );
    const logger = { debug: vi.fn() };

    await generateStoryConstitution(brief, {
      geminiClient: client,
      promptLoader: async () => 'constitution system prompt',
      logger: logger as any,
    } as any);

    expect(logger.debug).toHaveBeenCalledWith(
      'Story constitution Gemini request',
      expect.objectContaining({
        geminiRequest: {
          systemInstruction: 'constitution system prompt',
          userContent: brief,
        },
      })
    );
  });

  it('throws a parsing error when Gemini returns malformed JSON', async () => {
    const client = makeClient(
      () => ({ text: 'not a json payload' } as unknown as GenerateContentResponse)
    );

    await expect(
      generateStoryConstitution('Idea', {
        geminiClient: client,
        promptLoader: async () => 'system prompt',
      })
    ).rejects.toBeInstanceOf(StoryConstitutionParsingError);
  });

  it('surfaces Gemini rate limit errors as retryable errors', async () => {
    const apiError = new ApiError({
      status: 429,
      message: JSON.stringify({
        error: {
          status: 'RESOURCE_EXHAUSTED',
          message: 'Quota exceeded',
          code: 429,
          details: [{ retryDelay: '5s' }],
        },
      }),
    });

    const client = makeClient(() => {
      throw apiError;
    });

    await expect(
      generateStoryConstitution('Idea', {
        geminiClient: client,
        promptLoader: async () => 'system prompt',
        retryOptions: { policy: null, sleep: async () => {} },
      })
    ).rejects.toBeInstanceOf(GeminiRateLimitError);
  });
});

describe('story constitution target scenelet handling', () => {
  it('honours explicit target length values from Gemini', async () => {
    const brief = 'Adventure prompt';
    const jsonResponse = JSON.stringify({
      proposed_story_title: 'Chosen Length',
      story_constitution_markdown: '## Markdown',
      target_scenelets_per_path: 22,
    });

    const client = makeClient(
      () => ({ text: jsonResponse } as unknown as GenerateContentResponse)
    );

    const result = await generateStoryConstitution(brief, {
      geminiClient: client,
      promptLoader: async () => 'system prompt',
    });

    expect(result.targetSceneletsPerPath).toBe(22);
  });

  it('defaults target length to 12 when Gemini omits the field', async () => {
    const brief = 'Missing length prompt';
    const jsonResponse = JSON.stringify({
      proposed_story_title: 'Default Length',
      story_constitution_markdown: '## Markdown',
    });

    const client = makeClient(
      () => ({ text: jsonResponse } as unknown as GenerateContentResponse)
    );

    const result = await generateStoryConstitution(brief, {
      geminiClient: client,
      promptLoader: async () => 'system prompt',
    });

    expect(result.targetSceneletsPerPath).toBe(12);
  });
});
