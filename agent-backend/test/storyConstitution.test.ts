import { ApiError } from '@google/genai';
import type { GenerateContentParameters, GenerateContentResponse } from '@google/genai';
import { describe, expect, it } from 'vitest';

import { createGeminiJsonClient } from '../src/gemini/client.js';
import { GeminiRateLimitError } from '../src/gemini/errors.js';
import { generateStoryConstitution } from '../src/story-constitution/generateStoryConstitution.js';
import { StoryConstitutionParsingError } from '../src/story-constitution/errors.js';

function makeClient(responseFactory: () => GenerateContentResponse | Promise<GenerateContentResponse>) {
  const transport = {
    async generateContent(_params: GenerateContentParameters): Promise<GenerateContentResponse> {
      return await responseFactory();
    },
  };

  return createGeminiJsonClient({ transport });
}

describe('generateStoryConstitution', () => {
  it('returns parsed story constitution from valid Gemini JSON', async () => {
    const brief = 'A daring explorer maps an enchanted forest.';
    const jsonResponse = JSON.stringify({
      proposed_story_title: 'Enchanted Trails',
      story_constitution_markdown: '### **Story Constitution: Enchanted Trails**\n\nStub markdown.',
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
      })
    ).rejects.toBeInstanceOf(GeminiRateLimitError);
  });
});
