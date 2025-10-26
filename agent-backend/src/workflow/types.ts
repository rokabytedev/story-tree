import type { StoryConstitution, StoryConstitutionOptions } from '../story-constitution/types.js';
import type {
  InteractiveStoryGeneratorOptions,
  SceneletPersistence,
} from '../interactive-story/types.js';

export interface AgentWorkflowStoryRecord {
  id: string;
  displayName: string;
  initialPrompt: string;
  storyConstitution: unknown | null;
}

export interface AgentWorkflowStoryCreateInput {
  displayName: string;
  initialPrompt: string;
}

export interface AgentWorkflowStoryUpdatePatch {
  displayName?: string;
  storyConstitution?: unknown;
}

export interface AgentWorkflowStoriesRepository {
  createStory(input: AgentWorkflowStoryCreateInput): Promise<AgentWorkflowStoryRecord>;
  updateStoryArtifacts(storyId: string, patch: AgentWorkflowStoryUpdatePatch): Promise<AgentWorkflowStoryRecord>;
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
}

export interface AgentWorkflowResult {
  storyId: string;
  storyTitle: string;
  storyConstitutionMarkdown: string;
}
