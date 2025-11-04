import type { GeminiRetryOptions, GeminiVideoClient } from '../gemini/types.js';
import type { ShotProductionShotsRepository } from '../shot-production/types.js';
import type { AgentWorkflowStoriesRepository } from '../workflow/types.js';
import type { ReferenceImageRecommenderOptions } from '../reference-images/types.js';

export type ShotVideoTaskMode = 'default' | 'resume' | 'override';

export interface VideoStorage {
  saveVideo(videoData: Buffer, storyId: string, category: string, filename: string): Promise<string>;
}

export interface ShotVideoTaskLogger {
  debug?(message: string, metadata?: Record<string, unknown>): void;
}

export interface ShotVideoTaskDependencies {
  storiesRepository: AgentWorkflowStoriesRepository;
  shotsRepository: ShotProductionShotsRepository;
  geminiVideoClient?: GeminiVideoClient;
  videoStorage?: VideoStorage;
  logger?: ShotVideoTaskLogger;
  targetSceneletId?: string;
  targetShotIndex?: number;
  mode?: ShotVideoTaskMode;
  dryRun?: boolean;
  retry?: GeminiRetryOptions;
  verbose?: boolean;
  basePublicPath?: string;
  referenceRecommenderOptions?: Partial<ReferenceImageRecommenderOptions>;
  referenceImageLimit?: number;
}

export interface ShotVideoTaskResult {
  generatedVideos: number;
  skippedExisting: number;
  totalShots: number;
}

export type ShotVideoTaskRunner = (
  storyId: string,
  dependencies: ShotVideoTaskDependencies
) => Promise<ShotVideoTaskResult>;
