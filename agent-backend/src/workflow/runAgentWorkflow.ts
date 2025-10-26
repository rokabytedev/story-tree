import { generateStoryConstitution } from '../story-constitution/generateStoryConstitution.js';
import type { StoryConstitutionOptions } from '../story-constitution/types.js';
import { generateInteractiveStoryTree } from '../interactive-story/generateInteractiveStory.js';
import type { InteractiveStoryGeneratorOptions } from '../interactive-story/types.js';
import { AgentWorkflowError } from './errors.js';
import type {
  AgentWorkflowConstitutionGenerator,
  AgentWorkflowInteractiveGenerator,
  AgentWorkflowOptions,
  AgentWorkflowResult,
} from './types.js';

const DEFAULT_DISPLAY_NAME = 'Untitled Story';

export async function runAgentWorkflow(
  prompt: string,
  options: AgentWorkflowOptions
): Promise<AgentWorkflowResult> {
  const trimmedPrompt = prompt?.trim() ?? '';
  if (!trimmedPrompt) {
    throw new AgentWorkflowError('Story prompt must not be empty.');
  }

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

  const constitutionGenerator: AgentWorkflowConstitutionGenerator =
    options.generateStoryConstitution ?? generateStoryConstitution;
  const interactiveGenerator: AgentWorkflowInteractiveGenerator =
    options.generateInteractiveStoryTree ?? generateInteractiveStoryTree;

  const displayNameFactory = options.initialDisplayNameFactory ?? defaultDisplayNameFactory;
  const initialDisplayName = normalizeDisplayName(displayNameFactory(trimmedPrompt));

  options.logger?.debug?.('Creating story record', {
    displayName: initialDisplayName,
  });

  const createdStory = await storiesRepository.createStory({
    displayName: initialDisplayName,
    initialPrompt: trimmedPrompt,
  });

  options.logger?.debug?.('Generating story constitution', {
    storyId: createdStory.id,
  });

  const constitution = await constitutionGenerator(
    trimmedPrompt,
    normalizeConstitutionOptions(options.constitutionOptions)
  );

  const storyTitle = constitution.proposedStoryTitle.trim();
  const constitutionPayload = {
    proposedStoryTitle: storyTitle,
    storyConstitutionMarkdown: constitution.storyConstitutionMarkdown,
  };

  options.logger?.debug?.('Persisting constitution', {
    storyId: createdStory.id,
    storyTitle,
  });

  await storiesRepository.updateStoryArtifacts(createdStory.id, {
    displayName: storyTitle,
    storyConstitution: constitutionPayload,
  });

  const interactiveOptions: InteractiveStoryGeneratorOptions = {
    ...options.interactiveStoryOptions,
    sceneletPersistence,
  };

  options.logger?.debug?.('Launching interactive script generation', {
    storyId: createdStory.id,
  });

  await interactiveGenerator(
    createdStory.id,
    constitution.storyConstitutionMarkdown,
    interactiveOptions
  );

  return {
    storyId: createdStory.id,
    storyTitle,
    storyConstitutionMarkdown: constitution.storyConstitutionMarkdown,
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

function normalizeConstitutionOptions(
  options?: StoryConstitutionOptions
): StoryConstitutionOptions | undefined {
  if (!options) {
    return undefined;
  }

  return { ...options };
}
