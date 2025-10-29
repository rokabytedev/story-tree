import type { GeminiRetryOptions } from '../gemini/types.js';
import type { GeminiImageClient, ImageAspectRatio } from '../image-generation/types.js';
import type {
  AgentWorkflowStoriesRepository,
  AgentWorkflowStoryRecord,
} from '../workflow/types.js';

export interface VisualReferenceImageTaskLogger {
  debug?(message: string, metadata?: Record<string, unknown>): void;
}

export interface VisualReferenceImageStorage {
  saveImage(buffer: Buffer, storyId: string, category: string, filename: string): Promise<string>;
}

export interface VisualReferenceImageTaskDependencies {
  storiesRepository: AgentWorkflowStoriesRepository;
  geminiImageClient?: GeminiImageClient;
  imageStorage?: VisualReferenceImageStorage;
  logger?: VisualReferenceImageTaskLogger;
  characterAspectRatio?: ImageAspectRatio;
  environmentAspectRatio?: ImageAspectRatio;
  timeoutMs?: number;
  retry?: GeminiRetryOptions;
}

export interface VisualReferenceImageTaskResult {
  storyId: string;
  visualReferencePackage: VisualReferencePackage;
  generatedCharacterImages: number;
  generatedEnvironmentImages: number;
}

export interface VisualReferenceImageStoryRecord extends AgentWorkflowStoryRecord {
  visualReferencePackage: unknown | null;
}

export interface VisualReferenceCharacterPlate extends Record<string, unknown> {
  plate_description: string;
  type: string;
  image_generation_prompt: string;
  image_path?: string | null;
}

export interface VisualReferenceCharacterSheet extends Record<string, unknown> {
  character_name: string;
  reference_plates: VisualReferenceCharacterPlate[];
}

export interface VisualReferenceEnvironmentKeyframe extends Record<string, unknown> {
  keyframe_description: string;
  image_generation_prompt: string;
  image_path?: string | null;
}

export interface VisualReferenceEnvironmentEntry extends Record<string, unknown> {
  environment_name: string;
  keyframes: VisualReferenceEnvironmentKeyframe[];
}

export interface VisualReferencePackage extends Record<string, unknown> {
  character_model_sheets: VisualReferenceCharacterSheet[];
  environment_keyframes: VisualReferenceEnvironmentEntry[];
}

