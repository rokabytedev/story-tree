import type { GeminiGenerateJsonOptions, GeminiJsonClient } from '../gemini/types.js';
import type { SceneletDigest, StoryTreeSnapshot } from '../story-storage/types.js';
import type {
  AgentWorkflowStoriesRepository,
  AgentWorkflowStoryRecord,
} from '../workflow/types.js';

export interface UpdateShotImagePathsInput {
  firstFrameImagePath?: string;
  keyFrameImagePath?: string;
}

export interface ShotsMissingImages {
  sceneletId: string;
  shotIndex: number;
  missingFirstFrame: boolean;
  missingKeyFrame: boolean;
}

export interface ShotRecord {
  sceneletSequence: number;
  shotIndex: number;
  storyboardPayload: unknown;
  firstFramePrompt: string;
  keyFramePrompt: string;
  videoClipPrompt: string;
  firstFrameImagePath?: string;
  keyFrameImagePath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShotProductionShotsRepository {
  createSceneletShots(
    storyId: string,
    sceneletId: string,
    sceneletSequence: number,
    shots: ShotCreationInput[]
  ): Promise<void>;
  findSceneletIdsMissingShots(storyId: string, sceneletIds: string[]): Promise<string[]>;
  getShotsByStory(storyId: string): Promise<Record<string, ShotRecord[]>>;
  findShotsMissingImages(storyId: string): Promise<ShotsMissingImages[]>;
  updateShotImagePaths(
    storyId: string,
    sceneletId: string,
    shotIndex: number,
    paths: UpdateShotImagePathsInput
  ): Promise<void>;
}

export const REQUIRED_VIDEO_CLIP_PHRASE = 'No background music.';
export const MIN_PROMPT_LENGTH = 80;

export interface ShotProductionPromptBuilderOptions {
  constitutionMarkdown: string;
  storyTree: StoryTreeSnapshot;
  visualDesignDocument: unknown;
  audioDesignDocument: unknown;
  scenelet: SceneletDigest;
}

export interface ShotProductionResponseValidationContext {
  scenelet: SceneletDigest;
  visualDesignDocument: unknown;
}

export interface ShotCreationInput {
  shotIndex: number;
  storyboardPayload: unknown;
  firstFramePrompt: string;
  keyFramePrompt: string;
  videoClipPrompt: string;
}

export interface ShotProductionDialogueLine {
  character: string;
  line: string;
}

export interface ShotProductionStoryboardEntry {
  framingAndAngle: string;
  compositionAndContent: string;
  characterActionAndEmotion: string;
  dialogue: ShotProductionDialogueLine[];
  cameraDynamics: string;
  lightingAndAtmosphere: string;
  continuityNotes: string;
}

export interface ShotGenerationPrompts {
  firstFramePrompt: string;
  keyFramePrompt: string;
  videoClipPrompt: string;
}

export interface ShotProductionShotRecord {
  shotIndex: number;
  storyboard: ShotProductionStoryboardEntry;
  prompts: ShotGenerationPrompts;
}

export interface ShotProductionValidationResult {
  sceneletId: string;
  shots: ShotProductionShotRecord[];
}

export interface ShotProductionTaskLogger {
  debug?(message: string, metadata?: Record<string, unknown>): void;
}

export interface ShotProductionTaskDependencies {
  storiesRepository: AgentWorkflowStoriesRepository;
  shotsRepository: ShotProductionShotsRepository;
  storyTreeLoader: (storyId: string) => Promise<StoryTreeSnapshot>;
  promptLoader?: () => Promise<string>;
  geminiClient?: GeminiJsonClient;
  geminiOptions?: GeminiGenerateJsonOptions;
  logger?: ShotProductionTaskLogger;
  resumeExisting?: boolean;
}

export interface ShotProductionTaskResult {
  storyId: string;
  scenelets: ShotProductionSceneletResult[];
  totalShots: number;
}

export interface ShotProductionSceneletResult {
  sceneletId: string;
  shotCount: number;
}

export interface ShotProductionStoryRecord extends AgentWorkflowStoryRecord {
  visualDesignDocument: unknown | null;
  audioDesignDocument: unknown | null;
}
