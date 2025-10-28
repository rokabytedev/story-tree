import type { GeminiJsonClient } from '../gemini/types.js';

export interface StoryConstitution {
  proposedStoryTitle: string;
  storyConstitutionMarkdown: string;
  targetSceneletsPerPath: number;
}

export interface StoryConstitutionLogger {
  debug?(message: string, metadata?: Record<string, unknown>): void;
}

export interface StoryConstitutionOptions {
  geminiClient?: GeminiJsonClient;
  promptLoader?: () => Promise<string>;
  logger?: StoryConstitutionLogger;
}
