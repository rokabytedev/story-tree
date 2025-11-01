import type { GeminiGenerateJsonOptions, GeminiJsonClient } from '../gemini/types.js';
import type { SceneletDigest, StoryTreeSnapshot } from '../story-storage/types.js';
import type {
  AgentWorkflowStoriesRepository,
  AgentWorkflowStoryRecord,
} from '../workflow/types.js';

export interface UpdateShotImagePathsInput {
  keyFrameImagePath?: string | null;
}

export interface ShotsMissingImages {
  sceneletId: string;
  shotIndex: number;
  missingKeyFrame: boolean;
}

export interface ShotRecord {
  sceneletRef: string;
  sceneletId: string;
  sceneletSequence: number;
  shotIndex: number;
  storyboardPayload: unknown;
  keyFrameImagePath?: string;
  audioFilePath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShotProductionShotsRepository {
  createSceneletShots(
    storyId: string,
    sceneletRef: string,
    sceneletId: string,
    sceneletSequence: number,
    shots: ShotCreationInput[]
  ): Promise<void>;
  getShotsBySceneletRef(sceneletRef: string): Promise<ShotRecord[]>;
  findSceneletIdsMissingShots(storyId: string, sceneletIds: string[]): Promise<string[]>;
  getShotsByStory(storyId: string): Promise<Record<string, ShotRecord[]>>;
  findShotsMissingImages(storyId: string): Promise<ShotsMissingImages[]>;
  updateShotImagePaths(
    storyId: string,
    sceneletId: string,
    shotIndex: number,
    paths: UpdateShotImagePathsInput
  ): Promise<void>;
  updateShotAudioPath(
    storyId: string,
    sceneletId: string,
    shotIndex: number,
    audioFilePath: string | null
  ): Promise<ShotRecord>;
}

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
}

export interface AudioNarrativeEntry {
  type: 'monologue' | 'dialogue';
  source: string;
  line: string;
  delivery: string;
}

export interface ReferencedDesigns {
  characters: string[];
  environments: string[];
}

export interface ShotProductionStoryboardEntry {
  framingAndAngle: string;
  compositionAndContent: string;
  characterActionAndEmotion: string;
  cameraDynamics: string;
  lightingAndAtmosphere: string;
  continuityNotes: string;
  referencedDesigns: ReferencedDesigns;
  audioAndNarrative: AudioNarrativeEntry[];
}

export interface ShotProductionShotRecord {
  shotIndex: number;
  storyboard: ShotProductionStoryboardEntry;
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
