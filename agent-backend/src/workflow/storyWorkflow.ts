import { generateStoryConstitution } from '../story-constitution/generateStoryConstitution.js';
import type { StoryConstitution, StoryConstitutionOptions } from '../story-constitution/types.js';
import { generateInteractiveStoryTree } from '../interactive-story/generateInteractiveStory.js';
import type { InteractiveStoryGeneratorOptions, SceneletPersistence } from '../interactive-story/types.js';
import type {
  AgentWorkflowConstitutionGenerator,
  AgentWorkflowInteractiveGenerator,
  AgentWorkflowLogger,
  AgentWorkflowOptions,
  AgentWorkflowResult,
  AgentWorkflowStoryRecord,
  AgentWorkflowStoriesRepository,
  StoryWorkflow,
  StoryWorkflowTask,
} from './types.js';
import { AgentWorkflowError } from './errors.js';

const DEFAULT_DISPLAY_NAME = 'Untitled Story';
const TASK_SEQUENCE: StoryWorkflowTask[] = ['CREATE_CONSTITUTION', 'CREATE_INTERACTIVE_SCRIPT'];

interface StoryWorkflowDependencies extends AgentWorkflowOptions {
  storiesRepository: Required<AgentWorkflowStoriesRepository>;
}

export async function createWorkflowFromPrompt(
  prompt: string,
  options: AgentWorkflowOptions
): Promise<StoryWorkflow> {
  const trimmedPrompt = prompt?.trim() ?? '';
  if (!trimmedPrompt) {
    throw new AgentWorkflowError('Story prompt must not be empty.');
  }

  const normalized = normalizeDependencies(options);
  const displayNameFactory = normalized.initialDisplayNameFactory ?? defaultDisplayNameFactory;
  const initialDisplayName = normalizeDisplayName(displayNameFactory(trimmedPrompt));

  normalized.logger?.debug?.('Creating story record', {
    displayName: initialDisplayName,
  });

  const createdStory = await normalized.storiesRepository.createStory({
    displayName: initialDisplayName,
    initialPrompt: trimmedPrompt,
  });

  return new StoryWorkflowImpl(createdStory.id, normalized);
}

export async function resumeWorkflowFromStoryId(
  storyId: string,
  options: AgentWorkflowOptions
): Promise<StoryWorkflow> {
  const trimmedStoryId = storyId?.trim() ?? '';
  if (!trimmedStoryId) {
    throw new AgentWorkflowError('Story id must not be empty.');
  }

  const normalized = normalizeDependencies(options);
  const story = await normalized.storiesRepository.getStoryById(trimmedStoryId);

  if (!story) {
    throw new AgentWorkflowError(`Story ${trimmedStoryId} not found.`);
  }

  return new StoryWorkflowImpl(trimmedStoryId, normalized);
}

class StoryWorkflowImpl implements StoryWorkflow {
  public readonly storyId: string;
  private readonly storiesRepository: AgentWorkflowStoriesRepository;
  private readonly sceneletPersistence: SceneletPersistence;
  private readonly constitutionGenerator: AgentWorkflowConstitutionGenerator;
  private readonly interactiveGenerator: AgentWorkflowInteractiveGenerator;
  private readonly constitutionOptions?: StoryConstitutionOptions;
  private readonly interactiveOptions?: Omit<InteractiveStoryGeneratorOptions, 'sceneletPersistence'>;
  private readonly logger?: AgentWorkflowLogger;

  constructor(storyId: string, dependencies: StoryWorkflowDependencies) {
    this.storyId = storyId;
    this.storiesRepository = dependencies.storiesRepository;
    this.sceneletPersistence = dependencies.sceneletPersistence;
    this.constitutionGenerator =
      dependencies.generateStoryConstitution ?? generateStoryConstitution;
    this.interactiveGenerator =
      dependencies.generateInteractiveStoryTree ?? generateInteractiveStoryTree;
    this.constitutionOptions = dependencies.constitutionOptions
      ? { ...dependencies.constitutionOptions }
      : undefined;
    this.interactiveOptions = dependencies.interactiveStoryOptions
      ? { ...dependencies.interactiveStoryOptions }
      : undefined;
    this.logger = dependencies.logger;
  }

  async runTask(task: StoryWorkflowTask): Promise<void> {
    switch (task) {
      case 'CREATE_CONSTITUTION':
        await this.runConstitutionTask();
        return;
      case 'CREATE_INTERACTIVE_SCRIPT':
        await this.runInteractiveScriptTask();
        return;
      default:
        throw new AgentWorkflowError(`Unsupported workflow task: ${String(task)}.`);
    }
  }

  async runAllTasks(): Promise<AgentWorkflowResult> {
    let constitutionOutcome: StoryConstitution | null = null;

    for (const task of TASK_SEQUENCE) {
      if (task === 'CREATE_CONSTITUTION') {
        constitutionOutcome = await this.runConstitutionTask();
      } else {
        await this.runInteractiveScriptTask();
      }
    }

    if (!constitutionOutcome) {
      const story = await this.ensureStory();
      const persisted = readPersistedConstitution(story);
      if (!persisted) {
        throw new AgentWorkflowError(
          `Story ${this.storyId} missing constitution after workflow execution.`
        );
      }
      constitutionOutcome = {
        proposedStoryTitle: persisted.proposedStoryTitle,
        storyConstitutionMarkdown: persisted.storyConstitutionMarkdown,
      };
    }

    return {
      storyId: this.storyId,
      storyTitle: constitutionOutcome.proposedStoryTitle,
      storyConstitutionMarkdown: constitutionOutcome.storyConstitutionMarkdown,
    };
  }

  private async runConstitutionTask(): Promise<StoryConstitution> {
    const story = await this.ensureStory();
    if (story.storyConstitution) {
      throw new AgentWorkflowError(`Story ${this.storyId} already has a constitution.`);
    }

    const prompt = story.initialPrompt?.trim?.() ?? '';
    if (!prompt) {
      throw new AgentWorkflowError(
        `Story ${this.storyId} is missing an initial prompt required for constitution generation.`
      );
    }

    this.logger?.debug?.('Generating story constitution', {
      storyId: this.storyId,
    });

    const constitution = await this.constitutionGenerator(prompt, this.constitutionOptions);
    const storyTitle = constitution.proposedStoryTitle?.trim?.() ?? '';

    const displayName = normalizeDisplayName(storyTitle);
    const constitutionPayload = {
      proposedStoryTitle: displayName,
      storyConstitutionMarkdown: constitution.storyConstitutionMarkdown,
    };

    this.logger?.debug?.('Persisting constitution', {
      storyId: this.storyId,
      storyTitle: displayName,
    });

    await this.storiesRepository.updateStoryArtifacts(this.storyId, {
      displayName,
      storyConstitution: constitutionPayload,
    });

    return {
      proposedStoryTitle: displayName,
      storyConstitutionMarkdown: constitution.storyConstitutionMarkdown,
    };
  }

  private async runInteractiveScriptTask(): Promise<void> {
    const story = await this.ensureStory();
    const constitution = readPersistedConstitution(story);

    if (!constitution) {
      throw new AgentWorkflowError(
        `Story ${this.storyId} must have a constitution before generating interactive content.`
      );
    }

    const alreadyGenerated = await this.sceneletPersistence.hasSceneletsForStory(this.storyId);
    if (alreadyGenerated) {
      throw new AgentWorkflowError(
        `Interactive script already generated for story ${this.storyId}.`
      );
    }

    this.logger?.debug?.('Launching interactive script generation', {
      storyId: this.storyId,
    });

    const interactiveOptions: InteractiveStoryGeneratorOptions = {
      ...(this.interactiveOptions ?? {}),
      sceneletPersistence: this.sceneletPersistence,
    };

    await this.interactiveGenerator(
      this.storyId,
      constitution.storyConstitutionMarkdown,
      interactiveOptions
    );
  }

  private async ensureStory(): Promise<AgentWorkflowStoryRecord> {
    const story = await this.storiesRepository.getStoryById(this.storyId);
    if (!story) {
      throw new AgentWorkflowError(`Story ${this.storyId} not found.`);
    }
    return story;
  }
}

function normalizeDependencies(options: AgentWorkflowOptions): StoryWorkflowDependencies {
  if (!options || typeof options !== 'object') {
    throw new AgentWorkflowError('Agent workflow options must be provided.');
  }

  const { storiesRepository, sceneletPersistence } = options;
  if (!storiesRepository) {
    throw new AgentWorkflowError('Stories repository dependency is required.');
  }

  if (!sceneletPersistence) {
    throw new AgentWorkflowError('Scenelet persistence dependency is required.');
  }

  if (typeof sceneletPersistence.hasSceneletsForStory !== 'function') {
    throw new AgentWorkflowError(
      'Scenelet persistence must implement hasSceneletsForStory(storyId).'
    );
  }

  return {
    ...options,
    storiesRepository,
    sceneletPersistence,
  };
}

function defaultDisplayNameFactory(_: string): string {
  return DEFAULT_DISPLAY_NAME;
}

function normalizeDisplayName(value: string): string {
  const trimmed = value?.trim?.() ?? '';
  if (trimmed) {
    return trimmed;
  }
  return DEFAULT_DISPLAY_NAME;
}

function readPersistedConstitution(
  story: AgentWorkflowStoryRecord
): { proposedStoryTitle: string; storyConstitutionMarkdown: string } | null {
  const raw = story.storyConstitution;
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const proposed =
    typeof (raw as Record<string, unknown>).proposedStoryTitle === 'string'
      ? (raw as Record<string, unknown>).proposedStoryTitle
      : typeof (raw as Record<string, unknown>).proposed_story_title === 'string'
        ? (raw as Record<string, unknown>).proposed_story_title
        : null;

  const markdown =
    typeof (raw as Record<string, unknown>).storyConstitutionMarkdown === 'string'
      ? (raw as Record<string, unknown>).storyConstitutionMarkdown
      : typeof (raw as Record<string, unknown>).story_constitution_markdown === 'string'
        ? (raw as Record<string, unknown>).story_constitution_markdown
        : null;

  if (!proposed || !markdown) {
    return null;
  }

  return {
    proposedStoryTitle: proposed,
    storyConstitutionMarkdown: markdown,
  };
}
