import { generateStoryConstitution } from '../story-constitution/generateStoryConstitution.js';
import type { StoryConstitution, StoryConstitutionOptions } from '../story-constitution/types.js';
import { generateInteractiveStoryTree } from '../interactive-story/generateInteractiveStory.js';
import { buildResumePlanFromScenelets } from '../interactive-story/resumePlanner.js';
import type {
  InteractiveStoryGeneratorOptions,
  InteractiveStoryResumeState,
  SceneletPersistence,
} from '../interactive-story/types.js';
import { runVisualDesignTask } from '../visual-design/visualDesignTask.js';
import type {
  VisualDesignTaskOptions,
  VisualDesignTaskRunner,
  VisualDesignTaskDependencies,
} from '../visual-design/types.js';
import { runAudioDesignTask } from '../audio-design/audioDesignTask.js';
import type {
  AudioDesignTaskOptions,
  AudioDesignTaskRunner,
  AudioDesignTaskDependencies,
} from '../audio-design/types.js';
import { runVisualReferenceTask as runVisualReferenceTaskImpl } from '../visual-reference/visualReferenceTask.js';
import type {
  VisualReferenceTaskOptions,
  VisualReferenceTaskRunner,
  VisualReferenceTaskDependencies,
} from '../visual-reference/types.js';
import { runVisualReferenceImageTask as runVisualReferenceImageTaskImpl } from '../visual-reference-image/visualReferenceImageTask.js';
import type {
  VisualReferenceImageTaskOptions,
  VisualReferenceImageTaskRunner,
  VisualReferenceImageTaskDependencies,
} from '../visual-reference-image/types.js';
import { runEnvironmentReferenceTask as runEnvironmentReferenceTaskImpl } from '../environment-reference/environmentReferenceTask.js';
import type {
  EnvironmentReferenceTaskDependencies,
  EnvironmentReferenceTaskOptions,
  EnvironmentReferenceTaskRunner,
} from '../environment-reference/types.js';
import { runShotProductionTask } from '../shot-production/shotProductionTask.js';
import type {
  ShotProductionTaskOptions,
  ShotProductionTaskRunner,
  ShotProductionTaskDependencies,
  ShotProductionShotsRepository,
} from '../shot-production/types.js';
import { runShotImageTask } from '../shot-image/shotImageTask.js';
import type {
  ShotImageTaskOptions,
  ShotImageTaskRunner,
  ShotImageTaskDependencies,
} from '../shot-image/types.js';
import { runShotAudioTask } from '../shot-audio/shotAudioTask.js';
import type {
  ShotAudioTaskOptions,
  ShotAudioTaskRunner,
  ShotAudioTaskDependencies,
} from '../shot-audio/types.js';
import { runCharacterModelSheetTask } from '../character-model-sheet/characterModelSheetTask.js';
import type {
  CharacterModelSheetTaskOptions,
  CharacterModelSheetTaskRunner,
  CharacterModelSheetTaskDependencies,
} from '../character-model-sheet/types.js';
import { runPlayerBundleTask as runPlayerBundleTaskImpl } from '../bundle/playerBundleTask.js';
import type { PlayerBundleTaskOptions, PlayerBundleTaskResult } from '../bundle/types.js';
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
const DEFAULT_TARGET_SCENELETS_PER_PATH = 12;
const TASK_SEQUENCE: StoryWorkflowTask[] = [
  'CREATE_CONSTITUTION',
  'CREATE_INTERACTIVE_SCRIPT',
  'CREATE_VISUAL_DESIGN',
  'CREATE_VISUAL_REFERENCE',
  'CREATE_VISUAL_REFERENCE_IMAGES',
  'CREATE_AUDIO_DESIGN',
  'CREATE_SHOT_PRODUCTION',
  'CREATE_SHOT_IMAGES',
  'CREATE_SHOT_AUDIO',
];

interface StoryWorkflowDependencies extends AgentWorkflowOptions {
  storiesRepository: Required<AgentWorkflowStoriesRepository>;
  storyTreeLoader: NonNullable<AgentWorkflowOptions['storyTreeLoader']>;
  shotsRepository: ShotProductionShotsRepository;
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
  private readonly resumeInteractiveScript: boolean;
  private readonly resumeShotProduction: boolean;
  private readonly constitutionOptions?: StoryConstitutionOptions;
  private readonly interactiveOptions?: Omit<InteractiveStoryGeneratorOptions, 'sceneletPersistence'>;
  private readonly logger?: AgentWorkflowLogger;
  private readonly storyTreeLoader: NonNullable<AgentWorkflowOptions['storyTreeLoader']>;
  private readonly shotsRepository: ShotProductionShotsRepository;
  private readonly visualDesignTaskRunner: VisualDesignTaskRunner;
  private readonly visualDesignOptions?: VisualDesignTaskOptions;
  private readonly visualReferenceTaskRunner: VisualReferenceTaskRunner;
  private readonly visualReferenceOptions?: VisualReferenceTaskOptions;
  private readonly visualReferenceImageTaskRunner: VisualReferenceImageTaskRunner;
  private readonly visualReferenceImageOptions?: VisualReferenceImageTaskOptions;
  private readonly audioDesignTaskRunner: AudioDesignTaskRunner;
  private readonly audioDesignOptions?: AudioDesignTaskOptions;
  private readonly shotProductionTaskRunner: ShotProductionTaskRunner;
  private readonly shotProductionOptions?: ShotProductionTaskOptions;
  private readonly shotImageTaskRunner: ShotImageTaskRunner;
  private readonly shotImageOptions?: ShotImageTaskOptions;
  private readonly shotAudioTaskRunner: ShotAudioTaskRunner;
  private readonly shotAudioOptions?: ShotAudioTaskOptions;
  private readonly characterModelSheetTaskRunner: CharacterModelSheetTaskRunner;
  private readonly characterModelSheetOptions?: CharacterModelSheetTaskOptions;
  private readonly environmentReferenceTaskRunner: EnvironmentReferenceTaskRunner;
  private readonly environmentReferenceOptions?: EnvironmentReferenceTaskOptions;
  private readonly playerBundleTaskRunner?: (
    storyId: string,
    options?: PlayerBundleTaskOptions
  ) => Promise<PlayerBundleTaskResult>;
  private readonly playerBundleOptions?: PlayerBundleTaskOptions;

  constructor(storyId: string, dependencies: StoryWorkflowDependencies) {
    this.storyId = storyId;
    this.storiesRepository = dependencies.storiesRepository;
    this.sceneletPersistence = dependencies.sceneletPersistence;
    this.constitutionGenerator =
      dependencies.generateStoryConstitution ?? generateStoryConstitution;
    this.interactiveGenerator =
      dependencies.generateInteractiveStoryTree ?? generateInteractiveStoryTree;
    this.resumeInteractiveScript = Boolean(dependencies.resumeInteractiveScript);
    this.resumeShotProduction = Boolean(dependencies.resumeShotProduction);
    this.constitutionOptions = dependencies.constitutionOptions
      ? { ...dependencies.constitutionOptions }
      : undefined;
    this.interactiveOptions = dependencies.interactiveStoryOptions
      ? { ...dependencies.interactiveStoryOptions }
      : undefined;
    this.logger = dependencies.logger;
    this.storyTreeLoader = dependencies.storyTreeLoader;
    this.shotsRepository = dependencies.shotsRepository;
    this.visualDesignTaskRunner =
      dependencies.runVisualDesignTask ?? runVisualDesignTask;
    this.visualDesignOptions = dependencies.visualDesignTaskOptions
      ? { ...dependencies.visualDesignTaskOptions }
      : undefined;
    this.visualReferenceTaskRunner =
      dependencies.runVisualReferenceTask ?? runVisualReferenceTaskImpl;
    this.visualReferenceOptions = dependencies.visualReferenceTaskOptions
      ? { ...dependencies.visualReferenceTaskOptions }
      : undefined;
    this.visualReferenceImageTaskRunner =
      dependencies.runVisualReferenceImageTask ?? runVisualReferenceImageTaskImpl;
    this.visualReferenceImageOptions = dependencies.visualReferenceImageTaskOptions
      ? { ...dependencies.visualReferenceImageTaskOptions }
      : undefined;
    this.audioDesignTaskRunner =
      dependencies.runAudioDesignTask ?? runAudioDesignTask;
    this.audioDesignOptions = dependencies.audioDesignTaskOptions
      ? { ...dependencies.audioDesignTaskOptions }
      : undefined;
    this.shotProductionTaskRunner =
      dependencies.runShotProductionTask ?? runShotProductionTask;
    this.shotProductionOptions = dependencies.shotProductionTaskOptions
      ? { ...dependencies.shotProductionTaskOptions }
      : undefined;
    this.shotImageTaskRunner =
      dependencies.runShotImageTask ?? runShotImageTask;
    this.shotImageOptions = dependencies.shotImageTaskOptions
      ? { ...dependencies.shotImageTaskOptions }
      : undefined;
    this.shotAudioTaskRunner =
      dependencies.runShotAudioTask ?? runShotAudioTask;
    this.shotAudioOptions = dependencies.shotAudioTaskOptions
      ? { ...dependencies.shotAudioTaskOptions }
      : undefined;
    this.characterModelSheetTaskRunner =
      dependencies.runCharacterModelSheetTask ?? runCharacterModelSheetTask;
    this.characterModelSheetOptions = dependencies.characterModelSheetTaskOptions
      ? { ...dependencies.characterModelSheetTaskOptions }
      : undefined;
    this.environmentReferenceTaskRunner =
      dependencies.runEnvironmentReferenceTask ?? runEnvironmentReferenceTaskImpl;
    this.environmentReferenceOptions = dependencies.environmentReferenceTaskOptions
      ? { ...dependencies.environmentReferenceTaskOptions }
      : undefined;
    this.playerBundleOptions = dependencies.playerBundleTaskOptions
      ? { ...dependencies.playerBundleTaskOptions }
      : undefined;
    this.playerBundleTaskRunner =
      dependencies.runPlayerBundleTask ??
      ((storyId, overrideOptions) =>
        runPlayerBundleTaskImpl(
          storyId,
          {
            storiesRepository: this.storiesRepository,
            sceneletPersistence: this.sceneletPersistence,
            shotsRepository: this.shotsRepository,
            logger: this.logger
              ? {
                  debug: this.logger.debug?.bind(this.logger),
                }
              : undefined,
          },
          { ...this.playerBundleOptions, ...overrideOptions }
        ));
  }

  async runTask(task: StoryWorkflowTask): Promise<void> {
    switch (task) {
      case 'CREATE_CONSTITUTION':
        await this.runConstitutionTask();
        return;
      case 'CREATE_INTERACTIVE_SCRIPT':
        await this.runInteractiveScriptTask();
        return;
      case 'CREATE_VISUAL_DESIGN':
        await this.runVisualDesignTask();
        return;
      case 'CREATE_VISUAL_REFERENCE':
        await this.runVisualReferenceTask();
        return;
      case 'CREATE_VISUAL_REFERENCE_IMAGES':
        await this.runVisualReferenceImagesTask();
        return;
      case 'CREATE_AUDIO_DESIGN':
        await this.runAudioDesignTask();
        return;
      case 'CREATE_SHOT_PRODUCTION':
        await this.runShotProductionTask();
        return;
      case 'CREATE_SHOT_IMAGES':
        await this.runShotImagesTask();
        return;
      case 'CREATE_SHOT_AUDIO':
        await this.runShotAudioGenerationTask();
        return;
      case 'CREATE_CHARACTER_MODEL_SHEETS':
        await this.runCharacterModelSheetsTask();
        return;
      case 'CREATE_ENVIRONMENT_REFERENCE_IMAGE':
        await this.runEnvironmentReferenceImageTask();
        return;
      case 'CREATE_PLAYER_BUNDLE':
        await this.runPlayerBundleGenerationTask();
        return;
      default:
        throw new AgentWorkflowError(`Unsupported workflow task: ${String(task)}.`);
    }
  }

  async runAllTasks(): Promise<AgentWorkflowResult> {
    let constitutionOutcome: StoryConstitution | null = null;

    for (const task of TASK_SEQUENCE) {
      switch (task) {
        case 'CREATE_CONSTITUTION':
          constitutionOutcome = await this.runConstitutionTask();
          break;
        case 'CREATE_INTERACTIVE_SCRIPT':
          await this.runInteractiveScriptTask();
          break;
        case 'CREATE_VISUAL_DESIGN':
          await this.runVisualDesignTask();
          break;
        case 'CREATE_VISUAL_REFERENCE':
          await this.runVisualReferenceTask();
          break;
        case 'CREATE_AUDIO_DESIGN':
          await this.runAudioDesignTask();
          break;
        case 'CREATE_SHOT_PRODUCTION':
          await this.runShotProductionTask();
          break;
        case 'CREATE_SHOT_IMAGES':
          await this.runShotImagesTask();
          break;
        case 'CREATE_SHOT_AUDIO':
          await this.runShotAudioGenerationTask();
          break;
        default:
          break;
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
        targetSceneletsPerPath: persisted.targetSceneletsPerPath,
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
      targetSceneletsPerPath: constitution.targetSceneletsPerPath,
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
      targetSceneletsPerPath: constitution.targetSceneletsPerPath,
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
    let resumeState: InteractiveStoryResumeState | undefined;

    if (alreadyGenerated && !this.resumeInteractiveScript) {
      throw new AgentWorkflowError(
        `Interactive script already generated for story ${this.storyId}.`
      );
    }

    if (alreadyGenerated && this.resumeInteractiveScript) {
      const scenelets = await this.sceneletPersistence.listSceneletsByStory(this.storyId);
      const plan = buildResumePlanFromScenelets(this.storyId, scenelets);

      if (plan.pendingTasks.length === 0) {
        this.logger?.debug?.('Interactive script resume detected completed tree; skipping task.', {
          storyId: this.storyId,
        });
        return;
      }

      resumeState = {
        pendingTasks: plan.pendingTasks,
      };

      this.logger?.debug?.('Resuming interactive script generation', {
        storyId: this.storyId,
        pendingTaskCount: plan.pendingTasks.length,
      });
    } else {
      this.logger?.debug?.('Launching interactive script generation', {
        storyId: this.storyId,
      });
    }

    const interactiveOptions: InteractiveStoryGeneratorOptions = {
      ...(this.interactiveOptions ?? {}),
      sceneletPersistence: this.sceneletPersistence,
      targetSceneletsPerPath: constitution.targetSceneletsPerPath,
      ...(resumeState ? { resumeState } : {}),
    };

    await this.interactiveGenerator(
      this.storyId,
      constitution.storyConstitutionMarkdown,
      interactiveOptions
    );
  }

  private async runVisualDesignTask(): Promise<void> {
    const dependencies = this.buildVisualDesignDependencies();
    await this.visualDesignTaskRunner(this.storyId, dependencies);
  }

  private async runVisualReferenceTask(): Promise<void> {
    const dependencies = this.buildVisualReferenceDependencies();
    await this.visualReferenceTaskRunner(this.storyId, dependencies);
  }

  private async runVisualReferenceImagesTask(): Promise<void> {
    const dependencies = this.buildVisualReferenceImageDependencies();
    await this.visualReferenceImageTaskRunner(this.storyId, dependencies);
  }

  private async runAudioDesignTask(): Promise<void> {
    const dependencies = this.buildAudioDesignDependencies();
    await this.audioDesignTaskRunner(this.storyId, dependencies);
  }

  private async runShotProductionTask(): Promise<void> {
    const dependencies = this.buildShotProductionDependencies();
    await this.shotProductionTaskRunner(this.storyId, dependencies);
  }

  private async runShotImagesTask(): Promise<void> {
    const dependencies = this.buildShotImageDependencies();
    await this.shotImageTaskRunner(this.storyId, dependencies);
  }

  private async runShotAudioGenerationTask(): Promise<void> {
    const dependencies = this.buildShotAudioDependencies();
    await this.shotAudioTaskRunner(this.storyId, dependencies);
  }

  private async runCharacterModelSheetsTask(): Promise<void> {
    const dependencies = this.buildCharacterModelSheetDependencies();
    await this.characterModelSheetTaskRunner(this.storyId, dependencies);
  }

  private async runEnvironmentReferenceImageTask(): Promise<void> {
    const dependencies = this.buildEnvironmentReferenceDependencies();
    await this.environmentReferenceTaskRunner(this.storyId, dependencies);
  }

  private async runPlayerBundleGenerationTask(): Promise<void> {
    if (!this.playerBundleTaskRunner) {
      throw new AgentWorkflowError('Player bundle task is not configured.');
    }

    await this.playerBundleTaskRunner(this.storyId, this.playerBundleOptions);
  }

  private buildVisualDesignDependencies(): VisualDesignTaskDependencies {
    const overrides = this.visualDesignOptions;
    const dependencies: VisualDesignTaskDependencies = {
      storiesRepository: this.storiesRepository,
      storyTreeLoader: this.storyTreeLoader,
    };

    if (overrides?.promptLoader) {
      dependencies.promptLoader = overrides.promptLoader;
    }

    if (overrides?.geminiClient) {
      dependencies.geminiClient = overrides.geminiClient;
    }

    if (overrides?.geminiOptions) {
      dependencies.geminiOptions = overrides.geminiOptions;
    }

    if (overrides?.resumeExisting !== undefined) {
      dependencies.resumeExisting = overrides.resumeExisting;
    }

    const logger = overrides?.logger ?? this.logger;
    if (logger) {
      dependencies.logger = logger;
    }

    return dependencies;
  }

  private buildVisualReferenceDependencies(): VisualReferenceTaskDependencies {
    const overrides = this.visualReferenceOptions;
    const dependencies: VisualReferenceTaskDependencies = {
      storiesRepository: this.storiesRepository,
      storyTreeLoader: this.storyTreeLoader,
    };

    if (overrides?.promptLoader) {
      dependencies.promptLoader = overrides.promptLoader;
    }

    if (overrides?.geminiClient) {
      dependencies.geminiClient = overrides.geminiClient;
    }

    if (overrides?.geminiOptions) {
      dependencies.geminiOptions = overrides.geminiOptions;
    }

    if (typeof overrides?.minimumPromptLength === 'number') {
      dependencies.minimumPromptLength = overrides.minimumPromptLength;
    }

    const logger = overrides?.logger ?? this.logger;
    if (logger) {
      dependencies.logger = logger;
    }

    return dependencies;
  }

  private buildVisualReferenceImageDependencies(): VisualReferenceImageTaskDependencies {
    const overrides = this.visualReferenceImageOptions;
    const dependencies: VisualReferenceImageTaskDependencies = {
      storiesRepository: this.storiesRepository,
    };

    if (overrides?.geminiImageClient) {
      dependencies.geminiImageClient = overrides.geminiImageClient;
    }

    if (overrides?.imageStorage) {
      dependencies.imageStorage = overrides.imageStorage;
    }

    if (overrides?.characterAspectRatio) {
      dependencies.characterAspectRatio = overrides.characterAspectRatio;
    }

    if (overrides?.environmentAspectRatio) {
      dependencies.environmentAspectRatio = overrides.environmentAspectRatio;
    }

    if (overrides?.timeoutMs !== undefined) {
      dependencies.timeoutMs = overrides.timeoutMs;
    }

    if (overrides?.retry !== undefined) {
      dependencies.retry = overrides.retry;
    }

    if (overrides?.targetCharacterId) {
      dependencies.targetCharacterId = overrides.targetCharacterId;
    }

    if (overrides?.targetEnvironmentId) {
      dependencies.targetEnvironmentId = overrides.targetEnvironmentId;
    }

    if (overrides?.targetIndex !== undefined) {
      dependencies.targetIndex = overrides.targetIndex;
    }

    const logger = overrides?.logger ?? this.logger;
    if (logger) {
      dependencies.logger = logger;
    }

    return dependencies;
  }

  private buildAudioDesignDependencies(): AudioDesignTaskDependencies {
    const overrides = this.audioDesignOptions;
    const dependencies: AudioDesignTaskDependencies = {
      storiesRepository: this.storiesRepository,
      storyTreeLoader: this.storyTreeLoader,
    };

    if (overrides?.promptLoader) {
      dependencies.promptLoader = overrides.promptLoader;
    }

    if (overrides?.geminiClient) {
      dependencies.geminiClient = overrides.geminiClient;
    }

    if (overrides?.geminiOptions) {
      dependencies.geminiOptions = overrides.geminiOptions;
    }

    const logger = overrides?.logger ?? this.logger;
    if (logger) {
      dependencies.logger = logger;
    }

    return dependencies;
  }

  private buildShotProductionDependencies(): ShotProductionTaskDependencies {
    const overrides = this.shotProductionOptions;
    const dependencies: ShotProductionTaskDependencies = {
      storiesRepository: this.storiesRepository,
      shotsRepository: this.shotsRepository,
      storyTreeLoader: this.storyTreeLoader,
      resumeExisting: this.resumeShotProduction,
    };

    if (overrides?.promptLoader) {
      dependencies.promptLoader = overrides.promptLoader;
    }

    if (overrides?.geminiClient) {
      dependencies.geminiClient = overrides.geminiClient;
    }

    if (overrides?.geminiOptions) {
      dependencies.geminiOptions = overrides.geminiOptions;
    }

    const logger = overrides?.logger ?? this.logger;
    if (logger) {
      dependencies.logger = logger;
    }

    return dependencies;
  }

  private buildShotImageDependencies(): ShotImageTaskDependencies {
    const overrides = this.shotImageOptions;
    const dependencies: ShotImageTaskDependencies = {
      storiesRepository: this.storiesRepository,
      shotsRepository: this.shotsRepository,
    };

    if (overrides?.geminiImageClient) {
      dependencies.geminiImageClient = overrides.geminiImageClient;
    }

    if (overrides?.imageStorage) {
      dependencies.imageStorage = overrides.imageStorage;
    }

    if (overrides?.targetSceneletId) {
      dependencies.targetSceneletId = overrides.targetSceneletId;
    }

    if (overrides?.targetShotIndex !== undefined) {
      dependencies.targetShotIndex = overrides.targetShotIndex;
    }

    if (overrides?.retry) {
      dependencies.retry = overrides.retry;
    }

    if (overrides?.override !== undefined) {
      dependencies.override = overrides.override;
    }

    const logger = overrides?.logger ?? this.logger;
    if (logger) {
      dependencies.logger = logger;
    }

    return dependencies;
  }

  private buildShotAudioDependencies(): ShotAudioTaskDependencies {
    const overrides = this.shotAudioOptions;
    const dependencies: ShotAudioTaskDependencies = {
      storiesRepository: this.storiesRepository,
      shotsRepository: this.shotsRepository,
    };

    if (overrides?.promptAssembler) {
      dependencies.promptAssembler = overrides.promptAssembler;
    }

    if (overrides?.speakerAnalyzer) {
      dependencies.speakerAnalyzer = overrides.speakerAnalyzer;
    }

    if (overrides?.geminiClient) {
      dependencies.geminiClient = overrides.geminiClient;
    }

    if (overrides?.audioFileStorage) {
      dependencies.audioFileStorage = overrides.audioFileStorage;
    }

    if (overrides?.mode) {
      dependencies.mode = overrides.mode;
    }

    if (overrides?.targetSceneletId) {
      dependencies.targetSceneletId = overrides.targetSceneletId;
    }

    if (overrides?.targetShotIndex !== undefined) {
      dependencies.targetShotIndex = overrides.targetShotIndex;
    }

    if (overrides?.verbose !== undefined) {
      dependencies.verbose = overrides.verbose;
    }

    const logger = overrides?.logger ?? this.logger;
    if (logger) {
      dependencies.logger = logger;
    }

    return dependencies;
  }

  private buildCharacterModelSheetDependencies(): CharacterModelSheetTaskDependencies {
    const overrides = this.characterModelSheetOptions;
    const dependencies: CharacterModelSheetTaskDependencies = {
      storiesRepository: this.storiesRepository,
    };

    if (overrides?.geminiImageClient) {
      dependencies.geminiImageClient = overrides.geminiImageClient;
    }

    if (overrides?.imageStorage) {
      dependencies.imageStorage = overrides.imageStorage;
    }

    if (overrides?.timeoutMs !== undefined) {
      dependencies.timeoutMs = overrides.timeoutMs;
    }

    if (overrides?.retry) {
      dependencies.retry = overrides.retry;
    }

    if (overrides?.targetCharacterId) {
      dependencies.targetCharacterId = overrides.targetCharacterId;
    }

    if (overrides?.override !== undefined) {
      dependencies.override = overrides.override;
    }

    if (overrides?.resume !== undefined) {
      dependencies.resume = overrides.resume;
    }

    if (overrides?.verbose !== undefined) {
      dependencies.verbose = overrides.verbose;
    }

    const logger = overrides?.logger ?? this.logger;
    if (logger) {
      dependencies.logger = logger;
    }

    return dependencies;
  }

  private buildEnvironmentReferenceDependencies(): EnvironmentReferenceTaskDependencies {
    const overrides = this.environmentReferenceOptions;
    const dependencies: EnvironmentReferenceTaskDependencies = {
      storiesRepository: this.storiesRepository,
    };

    if (overrides?.geminiImageClient) {
      dependencies.geminiImageClient = overrides.geminiImageClient;
    }

    if (overrides?.imageStorage) {
      dependencies.imageStorage = overrides.imageStorage;
    }

    if (overrides?.timeoutMs !== undefined) {
      dependencies.timeoutMs = overrides.timeoutMs;
    }

    if (overrides?.retry) {
      dependencies.retry = overrides.retry;
    }

    if (overrides?.targetEnvironmentId) {
      dependencies.targetEnvironmentId = overrides.targetEnvironmentId;
    }

    if (overrides?.override !== undefined) {
      dependencies.override = overrides.override;
    }

    if (overrides?.resume !== undefined) {
      dependencies.resume = overrides.resume;
    }

    if (overrides?.verbose !== undefined) {
      dependencies.verbose = overrides.verbose;
    }

    const logger = overrides?.logger ?? this.logger;
    if (logger) {
      dependencies.logger = logger;
    }

    return dependencies;
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

  const { storiesRepository, shotsRepository, sceneletPersistence, storyTreeLoader } = options;
  if (!storiesRepository) {
    throw new AgentWorkflowError('Stories repository dependency is required.');
  }

  if (!shotsRepository) {
    throw new AgentWorkflowError('Shots repository dependency is required.');
  }

  if (!sceneletPersistence) {
    throw new AgentWorkflowError('Scenelet persistence dependency is required.');
  }

  if (!storyTreeLoader) {
    throw new AgentWorkflowError('Story tree loader dependency is required.');
  }

  if (typeof sceneletPersistence.hasSceneletsForStory !== 'function') {
    throw new AgentWorkflowError(
      'Scenelet persistence must implement hasSceneletsForStory(storyId).'
    );
  }

  if (typeof sceneletPersistence.listSceneletsByStory !== 'function') {
    throw new AgentWorkflowError(
      'Scenelet persistence must implement listSceneletsByStory(storyId).'
    );
  }

  return {
    ...options,
    storiesRepository,
    shotsRepository,
    sceneletPersistence,
    storyTreeLoader,
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
): { proposedStoryTitle: string; storyConstitutionMarkdown: string; targetSceneletsPerPath: number } | null {
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

  const targetRaw =
    (raw as Record<string, unknown>).targetSceneletsPerPath ??
    (raw as Record<string, unknown>).target_scenelets_per_path;

  if (!proposed || !markdown) {
    return null;
  }

  return {
    proposedStoryTitle: proposed,
    storyConstitutionMarkdown: markdown,
    targetSceneletsPerPath:
      typeof targetRaw === 'number' && Number.isFinite(targetRaw) && targetRaw >= 1
        ? Math.trunc(targetRaw)
        : DEFAULT_TARGET_SCENELETS_PER_PATH,
  };
}
