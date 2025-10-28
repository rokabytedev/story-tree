import { GeminiJsonClient, GeminiRetryOptions } from '../gemini/types.js';

export interface DialogueLine {
  character: string;
  line: string;
}

export interface ScriptwriterScenelet {
  description: string;
  dialogue: DialogueLine[];
  shot_suggestions: string[];
  choice_label?: string;
}

export interface InteractiveScriptwriterResponseBase {
  branch_point: boolean;
  is_concluding_scene: boolean;
  next_scenelets: ScriptwriterScenelet[];
}

export interface InteractiveScriptwriterBranchResponse extends InteractiveScriptwriterResponseBase {
  branch_point: true;
  is_concluding_scene: false;
  choice_prompt: string;
  next_scenelets: [ScriptwriterScenelet, ScriptwriterScenelet, ...ScriptwriterScenelet[]];
}

export interface InteractiveScriptwriterLinearResponse extends InteractiveScriptwriterResponseBase {
  branch_point: false;
  is_concluding_scene: false;
  next_scenelets: [ScriptwriterScenelet];
}

export interface InteractiveScriptwriterConcludingResponse extends InteractiveScriptwriterResponseBase {
  branch_point: false;
  is_concluding_scene: true;
  next_scenelets: [ScriptwriterScenelet];
}

export type InteractiveScriptwriterResponse =
  | InteractiveScriptwriterBranchResponse
  | InteractiveScriptwriterLinearResponse
  | InteractiveScriptwriterConcludingResponse;

export interface SceneletRecord {
  id: string;
  storyId: string;
  parentId: string | null;
  choiceLabelFromParent: string | null;
  choicePrompt: string | null;
  content: unknown;
  isBranchPoint: boolean;
  isTerminalNode: boolean;
  createdAt: string;
}

export interface CreateSceneletInput {
  storyId: string;
  parentId: string | null;
  choiceLabelFromParent?: string | null;
  content: ScriptwriterScenelet;
}

export interface SceneletPersistence {
  createScenelet(input: CreateSceneletInput): Promise<SceneletRecord>;
  markSceneletAsBranchPoint(sceneletId: string, choicePrompt: string): Promise<void>;
  markSceneletAsTerminal(sceneletId: string): Promise<void>;
  hasSceneletsForStory(storyId: string): Promise<boolean>;
  listSceneletsByStory(storyId: string): Promise<SceneletRecord[]>;
}

export interface GenerationTask {
  storyId: string;
  parentSceneletId: string | null;
  pathContext: ScriptwriterScenelet[];
}

export interface InteractiveStoryResumeState {
  pendingTasks: GenerationTask[];
}

export interface InteractiveStoryLogger {
  debug?(message: string, metadata?: Record<string, unknown>): void;
}

export interface InteractiveStoryGeneratorOptions {
  geminiClient?: GeminiJsonClient;
  promptLoader?: () => Promise<string>;
  sceneletPersistence?: SceneletPersistence;
  logger?: InteractiveStoryLogger;
  timeoutMs?: number;
  resumeState?: InteractiveStoryResumeState | null;
  retryOptions?: GeminiRetryOptions;
  targetSceneletsPerPath?: number;
}
