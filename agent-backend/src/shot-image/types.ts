import type { ShotProductionShotsRepository } from '../shot-production/types.js';
import type { AgentWorkflowStoriesRepository } from '../workflow/types.js';

export interface GeminiImageClient {
  generateImage(request: {
    userPrompt: string;
    referenceImages?: ReferenceImage[];
    aspectRatio?: string;
  }): Promise<{
    imageData: Buffer;
    mimeType: string;
  }>;
}

export interface ReferenceImage {
  data: Buffer;
  mimeType: string;
}

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
  referenceImageLoader?: ReferenceImageLoader;
  logger?: ShotImageTaskLogger;
  targetSceneletId?: string;
  targetShotIndex?: number;
  aspectRatio?: string;
  verbose?: boolean;
}

export interface ShotImageTaskLogger {
  debug?(message: string, metadata?: Record<string, unknown>): void;
}

export interface ShotImageTaskResult {
  generatedFirstFrameImages: number;
  generatedKeyFrameImages: number;
  totalShots: number;
}

export type ShotImageTaskRunner = (
  storyId: string,
  dependencies: ShotImageTaskDependencies
) => Promise<ShotImageTaskResult>;

export interface ReferenceImageLoader {
  loadCharacterReferences(
    storyId: string,
    characterNames: string[],
    maxImages: number
  ): Promise<Map<string, string[]>>;
}
