import type { GeminiRetryOptions } from '../gemini/types.js';
import type { GeminiImageClient } from '../image-generation/types.js';
import type { ShotProductionShotsRepository } from '../shot-production/types.js';
import type { AgentWorkflowStoriesRepository } from '../workflow/types.js';

export interface ImageStorage {
  saveImage(
    imageData: Buffer,
    storyId: string,
    category: string,
    filename: string
  ): Promise<string>;
}

export interface ShotImageTaskDependencies {
  storiesRepository: AgentWorkflowStoriesRepository;
  shotsRepository: ShotProductionShotsRepository;
  geminiImageClient?: GeminiImageClient;
  imageStorage?: ImageStorage;
  logger?: ShotImageTaskLogger;
  targetSceneletId?: string;
  targetShotIndex?: number;
  aspectRatio?: string;
  retry?: GeminiRetryOptions;
  verbose?: boolean;
}

export interface ShotImageTaskLogger {
  debug?(message: string, metadata?: Record<string, unknown>): void;
}

export interface ShotImageTaskResult {
  generatedKeyFrameImages: number;
  totalShots: number;
}

export type ShotImageTaskRunner = (
  storyId: string,
  dependencies: ShotImageTaskDependencies
) => Promise<ShotImageTaskResult>;
