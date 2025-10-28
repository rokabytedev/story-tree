import type { GeminiGenerateJsonOptions, GeminiJsonClient } from '../gemini/types.js';
import type { StoryTreeSnapshot } from '../story-storage/types.js';
import type {
  AgentWorkflowStoriesRepository,
  AgentWorkflowStoryRecord,
} from '../workflow/types.js';

export interface VisualReferenceTaskLogger {
  debug?(message: string, metadata?: Record<string, unknown>): void;
}

export interface VisualReferenceTaskDependencies {
  storiesRepository: AgentWorkflowStoriesRepository;
  storyTreeLoader: (storyId: string) => Promise<StoryTreeSnapshot>;
  promptLoader?: () => Promise<string>;
  geminiClient?: GeminiJsonClient;
  geminiOptions?: GeminiGenerateJsonOptions;
  logger?: VisualReferenceTaskLogger;
  minimumPromptLength?: number;
}

export interface VisualReferenceTaskResult {
  storyId: string;
  visualReferencePackage: unknown;
}

export interface VisualReferenceGeminiRequest {
  systemInstruction: string;
  userPrompt: string;
}

export interface VisualReferenceStoryRecord extends AgentWorkflowStoryRecord {
  visualDesignDocument: unknown | null;
  visualReferencePackage: unknown | null;
}

export type VisualReferenceTaskRunner = (
  storyId: string,
  dependencies: VisualReferenceTaskDependencies
) => Promise<VisualReferenceTaskResult>;
