import type { StoryConstitution, StoryConstitutionOptions } from '../story-constitution/types.js';
import type {
  InteractiveStoryGeneratorOptions,
  SceneletPersistence,
} from '../interactive-story/types.js';
import type { StoryTreeSnapshot } from '../story-storage/types.js';
import type { VisualDesignTaskDependencies, VisualDesignTaskRunner } from '../visual-design/types.js';
import type { AudioDesignTaskDependencies, AudioDesignTaskRunner } from '../audio-design/types.js';
import type {
  VisualReferenceTaskDependencies,
  VisualReferenceTaskRunner,
} from '../visual-reference/types.js';
import type {
  ShotProductionTaskDependencies,
  ShotProductionTaskRunner,
  ShotProductionShotsRepository,
} from '../shot-production/types.js';

export interface AgentWorkflowStoryRecord {
  id: string;
  displayName: string;
  initialPrompt: string;
  storyConstitution: unknown | null;
  visualDesignDocument: unknown | null;
  audioDesignDocument: unknown | null;
  visualReferencePackage: unknown | null;
}

export interface AgentWorkflowStoryCreateInput {
  displayName: string;
  initialPrompt: string;
}

export interface AgentWorkflowStoryUpdatePatch {
  displayName?: string;
  storyConstitution?: unknown;
  visualDesignDocument?: unknown;
  audioDesignDocument?: unknown;
  visualReferencePackage?: unknown;
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
  shotsRepository: ShotProductionShotsRepository;
  sceneletPersistence: SceneletPersistence;
  constitutionOptions?: StoryConstitutionOptions;
  interactiveStoryOptions?: Omit<InteractiveStoryGeneratorOptions, 'sceneletPersistence'>;
  resumeInteractiveScript?: boolean;
  generateStoryConstitution?: AgentWorkflowConstitutionGenerator;
  generateInteractiveStoryTree?: AgentWorkflowInteractiveGenerator;
  initialDisplayNameFactory?: (prompt: string) => string;
  logger?: AgentWorkflowLogger;
  storyTreeLoader?: (storyId: string) => Promise<StoryTreeSnapshot>;
  visualDesignTaskOptions?: VisualDesignTaskOptions;
  runVisualDesignTask?: VisualDesignTaskRunner;
  visualReferenceTaskOptions?: VisualReferenceTaskOptions;
  runVisualReferenceTask?: VisualReferenceTaskRunner;
  audioDesignTaskOptions?: AudioDesignTaskOptions;
  runAudioDesignTask?: AudioDesignTaskRunner;
  shotProductionTaskOptions?: ShotProductionTaskOptions;
  runShotProductionTask?: ShotProductionTaskRunner;
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
  | 'CREATE_VISUAL_REFERENCE'
  | 'CREATE_AUDIO_DESIGN'
  | 'CREATE_SHOT_PRODUCTION';

export interface StoryWorkflow {
  readonly storyId: string;
  runTask(task: StoryWorkflowTask): Promise<void>;
  runAllTasks(): Promise<AgentWorkflowResult>;
}

export type VisualDesignTaskOptions = Partial<
  Omit<VisualDesignTaskDependencies, 'storiesRepository' | 'storyTreeLoader'>
>;

export type VisualReferenceTaskOptions = Partial<
  Omit<VisualReferenceTaskDependencies, 'storiesRepository' | 'storyTreeLoader'>
>;

export type AudioDesignTaskOptions = Partial<
  Omit<AudioDesignTaskDependencies, 'storiesRepository' | 'storyTreeLoader'>
>;

export type ShotProductionTaskOptions = Partial<
  Omit<ShotProductionTaskDependencies, 'storiesRepository' | 'shotsRepository' | 'storyTreeLoader'>
>;
