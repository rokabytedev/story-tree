import type { GeminiGenerateJsonOptions, GeminiJsonClient } from '../gemini/types.js';
import type { StoryTreeSnapshot } from '../story-storage/types.js';
import type {
  AgentWorkflowStoriesRepository,
  AgentWorkflowStoryRecord,
} from '../workflow/types.js';

export interface StoryboardTaskLogger {
  debug?(message: string, metadata?: Record<string, unknown>): void;
}

export interface StoryboardTaskDependencies {
  storiesRepository: AgentWorkflowStoriesRepository;
  storyTreeLoader: (storyId: string) => Promise<StoryTreeSnapshot>;
  promptLoader?: () => Promise<string>;
  geminiClient?: GeminiJsonClient;
  geminiOptions?: GeminiGenerateJsonOptions;
  logger?: StoryboardTaskLogger;
}

export interface StoryboardTaskResult {
  storyId: string;
  storyboardBreakdown: unknown;
}

export interface StoryboardGeminiRequest {
  systemInstruction: string;
  userPrompt: string;
}

export interface StoryboardStoryRecord extends AgentWorkflowStoryRecord {
  visualDesignDocument: unknown | null;
  storyboardBreakdown: unknown | null;
}

export interface StoryboardDialogueLine {
  character: string;
  line: string;
}

export interface StoryboardShotRecord {
  scenelet_id: string;
  shot_index: number;
  framing_and_angle: string;
  composition_and_content: string;
  character_action_and_emotion: string;
  dialogue: StoryboardDialogueLine[];
  camera_dynamics: string;
  lighting_and_atmosphere: string;
}

export interface StoryboardValidationResult {
  storyboardBreakdown: StoryboardShotRecord[];
}

export type StoryboardTaskRunner = (
  storyId: string,
  dependencies: StoryboardTaskDependencies
) => Promise<StoryboardTaskResult>;
