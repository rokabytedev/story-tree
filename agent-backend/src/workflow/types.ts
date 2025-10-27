import type { StoryConstitution, StoryConstitutionOptions } from '../story-constitution/types.js';
import type {
  InteractiveStoryGeneratorOptions,
  SceneletPersistence,
} from '../interactive-story/types.js';
import type { StoryTreeSnapshot } from '../story-storage/types.js';
import type {
  VisualDesignTaskDependencies,
  VisualDesignTaskRunner,
} from '../visual-design/types.js';
import type { StoryboardTaskDependencies, StoryboardTaskRunner } from '../storyboard/types.js';
import type { AudioDesignTaskDependencies, AudioDesignTaskRunner } from '../audio-design/types.js';

export interface AgentWorkflowStoryRecord {
  id: string;
  displayName: string;
  initialPrompt: string;
  storyConstitution: unknown | null;
  visualDesignDocument: unknown | null;
  storyboardBreakdown: unknown | null;
  audioDesignDocument: unknown | null;
}

export interface AgentWorkflowStoryCreateInput {
  displayName: string;
  initialPrompt: string;
}

export interface AgentWorkflowStoryUpdatePatch {
  displayName?: string;
  storyConstitution?: unknown;
  visualDesignDocument?: unknown;
  storyboardBreakdown?: unknown;
  audioDesignDocument?: unknown;
}

export interface AgentWorkflowStoriesRepository {
  createStory(input: AgentWorkflowStoryCreateInput): Promise<AgentWorkflowStoryRecord>;
  updateStoryArtifacts(storyId: string, patch: AgentWorkflowStoryUpdatePatch): Promise<AgentWorkflowStoryRecord>;
  getStoryById(storyId: string): Promise<AgentWorkflowStoryRecord | null>;
}

export type AgentWorkflowConstitutionGenerator = (
  prompt: string,
  options?: StoryConstitutionOptions
) => Promise<StoryConstitution>;

export type AgentWorkflowInteractiveGenerator = (
  storyId: string,
  storyConstitutionMarkdown: string,
  options: InteractiveStoryGeneratorOptions
) => Promise<void>;

export interface AgentWorkflowLogger {
  debug?(message: string, metadata?: Record<string, unknown>): void;
}

export interface AgentWorkflowOptions {
  storiesRepository: AgentWorkflowStoriesRepository;
  sceneletPersistence: SceneletPersistence;
  constitutionOptions?: StoryConstitutionOptions;
  interactiveStoryOptions?: Omit<InteractiveStoryGeneratorOptions, 'sceneletPersistence'>;
  generateStoryConstitution?: AgentWorkflowConstitutionGenerator;
  generateInteractiveStoryTree?: AgentWorkflowInteractiveGenerator;
  initialDisplayNameFactory?: (prompt: string) => string;
  logger?: AgentWorkflowLogger;
  storyTreeLoader?: (storyId: string) => Promise<StoryTreeSnapshot>;
  visualDesignTaskOptions?: VisualDesignTaskOptions;
  runVisualDesignTask?: VisualDesignTaskRunner;
  storyboardTaskOptions?: StoryboardTaskOptions;
  runStoryboardTask?: StoryboardTaskRunner;
  audioDesignTaskOptions?: AudioDesignTaskOptions;
  runAudioDesignTask?: AudioDesignTaskRunner;
}

export interface AgentWorkflowResult {
  storyId: string;
  storyTitle: string;
  storyConstitutionMarkdown: string;
}

export type StoryWorkflowTask =
  | 'CREATE_CONSTITUTION'
  | 'CREATE_INTERACTIVE_SCRIPT'
  | 'CREATE_VISUAL_DESIGN'
  | 'CREATE_STORYBOARD'
  | 'CREATE_AUDIO_DESIGN';

export interface StoryWorkflow {
  readonly storyId: string;
  runTask(task: StoryWorkflowTask): Promise<void>;
  runAllTasks(): Promise<AgentWorkflowResult>;
}

export type VisualDesignTaskOptions = Partial<
  Omit<VisualDesignTaskDependencies, 'storiesRepository' | 'storyTreeLoader'>
>;

export type StoryboardTaskOptions = Partial<
  Omit<StoryboardTaskDependencies, 'storiesRepository' | 'storyTreeLoader'>
>;

export type AudioDesignTaskOptions = Partial<
  Omit<AudioDesignTaskDependencies, 'storiesRepository' | 'storyTreeLoader'>
>;
