import type { GeminiGenerateJsonOptions, GeminiJsonClient } from '../gemini/types.js';
import type { StoryTreeSnapshot } from '../story-storage/types.js';
import type {
  AgentWorkflowStoriesRepository,
  AgentWorkflowStoryRecord,
} from '../workflow/types.js';

export interface AudioDesignTaskLogger {
  debug?(message: string, metadata?: Record<string, unknown>): void;
}

export interface AudioDesignTaskDependencies {
  storiesRepository: AgentWorkflowStoriesRepository;
  storyTreeLoader: (storyId: string) => Promise<StoryTreeSnapshot>;
  promptLoader?: () => Promise<string>;
  geminiClient?: GeminiJsonClient;
  geminiOptions?: GeminiGenerateJsonOptions;
  logger?: AudioDesignTaskLogger;
}

export interface AudioDesignTaskResult {
  storyId: string;
  audioDesignDocument: unknown;
}

export interface AudioDesignGeminiRequest {
  systemInstruction: string;
  userPrompt: string;
}

export interface AudioDesignStoryRecord extends AgentWorkflowStoryRecord {
  visualDesignDocument: unknown | null;
  audioDesignDocument: unknown | null;
}

export interface AudioSonicIdentity {
  musical_direction: string;
  sound_effect_philosophy: string;
}

export interface AudioVoiceProfile {
  character_id: string;
  character_name: string;
  voice_name: string;
  voice_profile?: string;
  [key: string]: unknown;
}

export interface NarratorVoiceProfile {
  character_id: 'narrator';
  voice_name: string;
  voice_profile: string;
  [key: string]: unknown;
}

export interface AudioMusicCue {
  cue_name: string;
  associated_scenelet_ids: string[];
  cue_description: string;
  music_generation_prompt: string;
  [key: string]: unknown;
}

export interface AudioDesignDocument {
  sonic_identity: AudioSonicIdentity;
  narrator_voice_profile: NarratorVoiceProfile;
  character_voice_profiles: AudioVoiceProfile[];
  music_and_ambience_cues: AudioMusicCue[];
}

export interface AudioDesignValidationResult {
  audioDesignDocument: AudioDesignDocument;
}

export type AudioDesignTaskRunner = (
  storyId: string,
  dependencies: AudioDesignTaskDependencies
) => Promise<AudioDesignTaskResult>;
