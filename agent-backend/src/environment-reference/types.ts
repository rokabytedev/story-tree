import type { GeminiRetryOptions } from '../gemini/types.js';
import type { GeminiImageClient } from '../image-generation/types.js';
import type {
  AgentWorkflowStoriesRepository,
  AgentWorkflowStoryRecord,
} from '../workflow/types.js';

export interface EnvironmentReferenceTaskLogger {
  debug?(message: string, metadata?: Record<string, unknown>): void;
}

export interface EnvironmentReferenceImageStorage {
  saveImage(buffer: Buffer, storyId: string, category: string, filename: string): Promise<string>;
}

export interface EnvironmentReferenceTaskDependencies {
  storiesRepository: AgentWorkflowStoriesRepository;
  geminiImageClient?: GeminiImageClient;
  imageStorage?: EnvironmentReferenceImageStorage;
  logger?: EnvironmentReferenceTaskLogger;
  timeoutMs?: number;
  retry?: GeminiRetryOptions;
  targetEnvironmentId?: string;
  override?: boolean;
  resume?: boolean;
  verbose?: boolean;
}

export interface EnvironmentReferenceTaskResult {
  storyId: string;
  generatedCount: number;
  skippedCount: number;
  errors: Array<{ environmentId: string; error: string }>;
}

export interface EnvironmentReferenceStoryRecord extends AgentWorkflowStoryRecord {
  visualDesignDocument: unknown | null;
}

export type EnvironmentReferenceTaskRunner = (
  storyId: string,
  dependencies: EnvironmentReferenceTaskDependencies
) => Promise<EnvironmentReferenceTaskResult>;

export type EnvironmentReferenceTaskOptions = Partial<
  Omit<EnvironmentReferenceTaskDependencies, 'storiesRepository'>
>;
