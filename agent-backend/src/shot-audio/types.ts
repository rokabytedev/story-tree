import type { AudioDesignDocument } from '../audio-design/types.js';
import type { SceneletPersistence } from '../interactive-story/types.js';
import type {
  AudioNarrativeEntry,
  ShotProductionShotsRepository,
  ShotRecord,
} from '../shot-production/types.js';
import type { AgentWorkflowStoriesRepository } from '../workflow/types.js';

export type ShotAudioMode = 'default' | 'resume' | 'override';

export type ShotAudioSpeakerMode = 'single' | 'multi';

export interface ShotAudioTaskOptions {
  mode?: ShotAudioMode;
  targetSceneletId?: string;
  targetShotIndex?: number;
  verbose?: boolean;
}

export interface ShotAudioTaskLogger {
  debug?(message: string, metadata?: Record<string, unknown>): void;
}

export interface GeminiTtsSpeakerConfig {
  speaker: string;
  voiceName: string;
}

export interface GeminiTtsRequest {
  prompt: string;
  mode: ShotAudioSpeakerMode;
  speakers: GeminiTtsSpeakerConfig[];
  verbose?: boolean;
  timeoutMs?: number;
}

export interface GeminiTtsClient {
  synthesize(request: GeminiTtsRequest): Promise<Buffer>;
}

export interface ShotAudioPrompt {
  prompt: string;
  speakers: GeminiTtsSpeakerConfig[];
  mode: ShotAudioSpeakerMode;
}

export interface SpeakerAnalysis {
  mode: ShotAudioSpeakerMode;
  speakers: string[];
}

export type SpeakerAnalyzer = (entries: AudioNarrativeEntry[]) => SpeakerAnalysis;

export interface PromptAssemblerDependencies {
  shot: ShotRecord;
  audioDesign: AudioDesignDocument;
  analysis: SpeakerAnalysis;
}

export type PromptAssembler = (dependencies: PromptAssemblerDependencies) => ShotAudioPrompt;

export interface SaveShotAudioOptions {
  storyId: string;
  sceneletId: string;
  shotIndex: number;
  audioData: Buffer;
}

export interface SaveBranchAudioOptions {
  storyId: string;
  sceneletId: string;
  audioData: Buffer;
}

export interface AudioFileStorageResult {
  relativePath: string;
  absolutePath: string;
}

export interface AudioFileStorage {
  saveShotAudio(options: SaveShotAudioOptions): Promise<AudioFileStorageResult>;
  saveBranchAudio(options: SaveBranchAudioOptions): Promise<AudioFileStorageResult>;
}

export interface ShotAudioTaskDependencies {
  storiesRepository: AgentWorkflowStoriesRepository;
  shotsRepository: ShotProductionShotsRepository;
  sceneletPersistence: SceneletPersistence;
  promptAssembler?: PromptAssembler;
  speakerAnalyzer?: SpeakerAnalyzer;
  geminiClient?: GeminiTtsClient;
  audioFileStorage?: AudioFileStorage;
  mode?: ShotAudioMode;
  targetSceneletId?: string;
  targetShotIndex?: number;
  verbose?: boolean;
  logger?: ShotAudioTaskLogger;
}

export interface ShotAudioTaskResult {
  generatedAudio: number;
  skippedShots: number;
  totalShots: number;
  generatedBranchAudio: number;
  skippedBranchAudio: number;
  totalBranchScenelets: number;
}

export type ShotAudioTaskRunner = (
  storyId: string,
  dependencies: ShotAudioTaskDependencies
) => Promise<ShotAudioTaskResult>;
