import { describe, expect, it } from 'vitest';

import { runAgentWorkflow } from '../src/workflow/runAgentWorkflow.js';
import { AgentWorkflowError } from '../src/workflow/errors.js';
import type {
  AgentWorkflowConstitutionGenerator,
  AgentWorkflowInteractiveGenerator,
  AgentWorkflowStoriesRepository,
  AgentWorkflowStoryRecord,
} from '../src/workflow/types.js';
import type { SceneletPersistence } from '../src/interactive-story/types.js';

function createStoriesRepository(): AgentWorkflowStoriesRepository & {
  record: AgentWorkflowStoryRecord | null;
} {
  let counter = 0;
  const repository: AgentWorkflowStoriesRepository & { record: AgentWorkflowStoryRecord | null } = {
    record: null,
    async createStory({ displayName, initialPrompt }) {
      counter += 1;
      repository.record = {
        id: `story-${counter}`,
        displayName,
        initialPrompt,
        storyConstitution: null,
      };
      return repository.record;
    },
    async updateStoryArtifacts(storyId, patch) {
      if (!repository.record || repository.record.id !== storyId) {
        throw new Error(`Story ${storyId} not found.`);
      }
      if (patch.displayName !== undefined) {
        repository.record.displayName = patch.displayName;
      }
      if (patch.storyConstitution !== undefined) {
        repository.record.storyConstitution = patch.storyConstitution;
      }
      return repository.record;
    },
    async getStoryById(storyId) {
      if (repository.record && repository.record.id === storyId) {
        return repository.record;
      }
      return null;
    },
  };

  return repository;
}

function createSceneletPersistence(): SceneletPersistence & {
  created: number;
} {
  let created = 0;

  return {
    created,
    async hasSceneletsForStory() {
      return created > 0;
    },
    async createScenelet(input) {
      created += 1;
      return {
        id: `scenelet-${created}`,
        storyId: input.storyId,
        parentId: input.parentId ?? null,
        choiceLabelFromParent: input.choiceLabelFromParent ?? null,
        choicePrompt: null,
        content: input.content,
        isBranchPoint: false,
        isTerminalNode: false,
        createdAt: new Date().toISOString(),
      };
    },
    async markSceneletAsBranchPoint() {},
    async markSceneletAsTerminal() {},
  };
}

describe('runAgentWorkflow', () => {
  it('creates the story, stores constitution, and launches interactive generation', async () => {
    const storiesRepository = createStoriesRepository();
    const sceneletPersistence = createSceneletPersistence();

    const constitutionGenerator: AgentWorkflowConstitutionGenerator = async (prompt) => {
      expect(prompt).toBe('Galactic explorers');
      return {
        proposedStoryTitle: 'Star Trail',
        storyConstitutionMarkdown: '## Constitution',
      };
    };

    let interactiveOptions: unknown;
    const interactiveGenerator: AgentWorkflowInteractiveGenerator = async (storyId, markdown, options) => {
      interactiveOptions = options;
      expect(storyId).toMatch(/^story-/);
      expect(markdown).toBe('## Constitution');
    };

    const result = await runAgentWorkflow('  Galactic explorers  ', {
      storiesRepository,
      sceneletPersistence,
      generateStoryConstitution: constitutionGenerator,
      generateInteractiveStoryTree: interactiveGenerator,
      initialDisplayNameFactory: () => 'Draft Story',
      interactiveStoryOptions: { timeoutMs: 60_000 },
    });

    expect(result.storyTitle).toBe('Star Trail');
    expect(result.storyConstitutionMarkdown).toBe('## Constitution');
    expect(interactiveOptions).toEqual({
      timeoutMs: 60_000,
      sceneletPersistence,
    });
    expect(storiesRepository.record?.storyConstitution).toEqual({
      proposedStoryTitle: 'Star Trail',
      storyConstitutionMarkdown: '## Constitution',
    });
  });

  it('uses default display name when no factory provided', async () => {
    const storiesRepository = createStoriesRepository();
    const sceneletPersistence = createSceneletPersistence();

    const constitutionGenerator: AgentWorkflowConstitutionGenerator = async () => ({
      proposedStoryTitle: '',
      storyConstitutionMarkdown: '# Constitution',
    });

    const interactiveGenerator: AgentWorkflowInteractiveGenerator = async () => {};

    await runAgentWorkflow('Forest quest', {
      storiesRepository,
      sceneletPersistence,
      generateStoryConstitution: constitutionGenerator,
      generateInteractiveStoryTree: interactiveGenerator,
    });

    expect(storiesRepository.record?.displayName).toBe('Untitled Story');
  });

  it('propagates generator failures', async () => {
    const storiesRepository = createStoriesRepository();
    const sceneletPersistence = createSceneletPersistence();

    await expect(
      runAgentWorkflow('Failure prompt', {
        storiesRepository,
        sceneletPersistence,
        generateStoryConstitution: async () => ({
          proposedStoryTitle: 'Failure Title',
          storyConstitutionMarkdown: '## Failure',
        }),
        generateInteractiveStoryTree: async () => {
          throw new Error('Interactive generator failed');
        },
      })
    ).rejects.toThrow('Interactive generator failed');
  });

  it('requires stories repository and persistence', async () => {
    await expect(
      runAgentWorkflow('Prompt', {
        // @ts-expect-error intentionally missing repository
        storiesRepository: undefined,
        sceneletPersistence: createSceneletPersistence(),
      })
    ).rejects.toThrow(AgentWorkflowError);

    const storiesRepository = createStoriesRepository();

    await expect(
      runAgentWorkflow('Prompt', {
        storiesRepository,
        // @ts-expect-error intentionally missing persistence
        sceneletPersistence: undefined,
      })
    ).rejects.toThrow(AgentWorkflowError);
  });

  it('passes constitution options to generator', async () => {
    const storiesRepository = createStoriesRepository();
    const sceneletPersistence = createSceneletPersistence();
    const constitutionOptions = { promptLoader: async () => 'System prompt' };

    let receivedOptions: unknown;
    const constitutionGenerator: AgentWorkflowConstitutionGenerator = async (_prompt, options) => {
      receivedOptions = options;
      return {
        proposedStoryTitle: 'Option',
        storyConstitutionMarkdown: '# Constitution',
      };
    };

    const interactiveGenerator: AgentWorkflowInteractiveGenerator = async () => {};

    await runAgentWorkflow('Option prompt', {
      storiesRepository,
      sceneletPersistence,
      generateStoryConstitution: constitutionGenerator,
      generateInteractiveStoryTree: interactiveGenerator,
      constitutionOptions,
    });

    expect(receivedOptions).toEqual(constitutionOptions);
  });
});
