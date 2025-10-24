import { createGeminiJsonClient } from '../gemini/client.js';
import { GeminiJsonClient } from '../gemini/types.js';
import { loadStoryConstitutionPrompt } from '../prompts/storyConstitutionPrompt.js';
import { StoryConstitutionError, StoryConstitutionParsingError } from './errors.js';
import { StoryConstitution, StoryConstitutionOptions } from './types.js';

const RESPONSE_TITLE_KEY = 'proposed_story_title';
const RESPONSE_MARKDOWN_KEY = 'story_constitution_markdown';

export async function generateStoryConstitution(
  brief: string,
  options: StoryConstitutionOptions = {}
): Promise<StoryConstitution> {
  const trimmedBrief = brief?.trim() ?? '';
  if (!trimmedBrief) {
    throw new StoryConstitutionError('Story brief must not be empty.');
  }

  const promptLoader = options.promptLoader ?? loadStoryConstitutionPrompt;
  const client: GeminiJsonClient =
    options.geminiClient ?? createGeminiJsonClient();

  const systemInstruction = await promptLoader();
  if (!systemInstruction.trim()) {
    throw new StoryConstitutionError('Story constitution system prompt is empty.');
  }

  const rawResponse = await client.generateJson({
    systemInstruction,
    userContent: trimmedBrief,
  });

  return parseStoryConstitution(rawResponse);
}

function parseStoryConstitution(rawResponse: string): StoryConstitution {
  try {
    const parsed = JSON.parse(rawResponse);
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Gemini response is not a JSON object.');
    }

    const record = parsed as Record<string, unknown>;
    const title = record[RESPONSE_TITLE_KEY];
    const markdown = record[RESPONSE_MARKDOWN_KEY];

    if (typeof title !== 'string' || !title.trim()) {
      throw new Error(`Missing "${RESPONSE_TITLE_KEY}" in Gemini response.`);
    }

    if (typeof markdown !== 'string' || !markdown.trim()) {
      throw new Error(`Missing "${RESPONSE_MARKDOWN_KEY}" in Gemini response.`);
    }

    return {
      proposedStoryTitle: title.trim(),
      storyConstitutionMarkdown: markdown,
    };
  } catch (error) {
    throw new StoryConstitutionParsingError(
      'Failed to parse Gemini story constitution JSON response.',
      rawResponse,
      { cause: error }
    );
  }
}
