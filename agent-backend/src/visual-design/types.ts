import type { GeminiGenerateJsonOptions, GeminiJsonClient } from '../gemini/types.js';
import type { StoryTreeSnapshot } from '../story-storage/types.js';
import type {
  AgentWorkflowStoriesRepository,
  AgentWorkflowStoryRecord,
} from '../workflow/types.js';

export interface StoryConstitutionPayload {
  proposedStoryTitle: string;
  storyConstitutionMarkdown: string;
  targetSceneletsPerPath: number;
}

export interface VisualDesignTaskLogger {
  debug?(message: string, metadata?: Record<string, unknown>): void;
}

export interface VisualDesignTaskDependencies {
  storiesRepository: AgentWorkflowStoriesRepository;
  storyTreeLoader: (storyId: string) => Promise<StoryTreeSnapshot>;
  promptLoader?: () => Promise<string>;
  geminiClient?: GeminiJsonClient;
  geminiOptions?: GeminiGenerateJsonOptions;
  logger?: VisualDesignTaskLogger;
}

export interface VisualDesignTaskResult {
  storyId: string;
  visualDesignDocument: unknown;
}

export interface VisualDesignGeminiRequest {
  systemInstruction: string;
  userPrompt: string;
}

export interface VisualDesignStoryRecord extends AgentWorkflowStoryRecord {
  visualDesignDocument: unknown | null;
}

export type VisualDesignTaskRunner = (
  storyId: string,
  dependencies: VisualDesignTaskDependencies
) => Promise<VisualDesignTaskResult>;
