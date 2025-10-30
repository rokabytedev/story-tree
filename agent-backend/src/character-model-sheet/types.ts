import type { GeminiRetryOptions } from '../gemini/types.js';
import type { GeminiImageClient } from '../image-generation/types.js';
import type {
  AgentWorkflowStoriesRepository,
  AgentWorkflowStoryRecord,
} from '../workflow/types.js';

export interface CharacterModelSheetTaskLogger {
  debug?(message: string, metadata?: Record<string, unknown>): void;
}

export interface CharacterModelSheetImageStorage {
  saveImage(buffer: Buffer, storyId: string, category: string, filename: string): Promise<string>;
}

export interface CharacterModelSheetTaskDependencies {
  storiesRepository: AgentWorkflowStoriesRepository;
  geminiImageClient?: GeminiImageClient;
  imageStorage?: CharacterModelSheetImageStorage;
  logger?: CharacterModelSheetTaskLogger;
  timeoutMs?: number;
  retry?: GeminiRetryOptions;
  targetCharacterId?: string;
  override?: boolean;
  resume?: boolean;
  verbose?: boolean;
}

export interface CharacterModelSheetTaskResult {
  storyId: string;
  generatedCount: number;
  skippedCount: number;
  errors: Array<{ characterId: string; error: string }>;
}

export interface CharacterModelSheetStoryRecord extends AgentWorkflowStoryRecord {
  visualDesignDocument: unknown | null;
}

export type CharacterModelSheetTaskRunner = (
  storyId: string,
  dependencies: CharacterModelSheetTaskDependencies
) => Promise<CharacterModelSheetTaskResult>;
