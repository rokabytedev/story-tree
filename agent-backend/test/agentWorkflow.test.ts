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
import type { StoryTreeSnapshot } from '../src/story-storage/types.js';
import type { VisualDesignTaskRunner } from '../src/visual-design/types.js';

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
        visualDesignDocument: null,
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
      if (patch.visualDesignDocument !== undefined) {
        repository.record.visualDesignDocument = patch.visualDesignDocument;
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

const VISUAL_STORY_TREE: StoryTreeSnapshot = {
  entries: [],
  yaml: '- scenelet-1:\n  role: root\n  description: ""\n  dialogue: []\n  shot_suggestions: []',
};

describe('runAgentWorkflow', () => {
  it('creates the story, stores constitution, and launches interactive generation', async () => {
    const storiesRepository = createStoriesRepository();
    const sceneletPersistence = createSceneletPersistence();
    const storyTreeLoader = async () => VISUAL_STORY_TREE;
    const visualDesignRunner: VisualDesignTaskRunner = async (storyId) => {
      storiesRepository.record!.visualDesignDocument = { stub: true };
      return {
        storyId,
        visualDesignDocument: { stub: true },
      };
    };

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
      storyTreeLoader,
      runVisualDesignTask: visualDesignRunner,
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
    expect(storiesRepository.record?.visualDesignDocument).toEqual({ stub: true });
  });

  it('uses default display name when no factory provided', async () => {
    const storiesRepository = createStoriesRepository();
    const sceneletPersistence = createSceneletPersistence();
    const storyTreeLoader = async () => VISUAL_STORY_TREE;
    const visualDesignRunner: VisualDesignTaskRunner = async (storyId) => ({
      storyId,
      visualDesignDocument: {},
    });

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
      storyTreeLoader,
      runVisualDesignTask: visualDesignRunner,
    });

    expect(storiesRepository.record?.displayName).toBe('Untitled Story');
  });

  it('propagates generator failures', async () => {
    const storiesRepository = createStoriesRepository();
    const sceneletPersistence = createSceneletPersistence();
    const storyTreeLoader = async () => VISUAL_STORY_TREE;
    const visualDesignRunner: VisualDesignTaskRunner = async (storyId) => ({
      storyId,
      visualDesignDocument: {},
    });

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
        storyTreeLoader,
        runVisualDesignTask: visualDesignRunner,
      })
    ).rejects.toThrow('Interactive generator failed');
  });

  it('requires stories repository and persistence', async () => {
    await expect(
      runAgentWorkflow('Prompt', {
        // @ts-expect-error intentionally missing repository
        storiesRepository: undefined,
        sceneletPersistence: createSceneletPersistence(),
        storyTreeLoader: async () => VISUAL_STORY_TREE,
        runVisualDesignTask: async (storyId) => ({
          storyId,
          visualDesignDocument: {},
        }),
      })
    ).rejects.toThrow(AgentWorkflowError);

    const storiesRepository = createStoriesRepository();
    const storyTreeLoader = async () => VISUAL_STORY_TREE;
    const visualDesignRunner: VisualDesignTaskRunner = async (storyId) => ({
      storyId,
      visualDesignDocument: {},
    });

    await expect(
      runAgentWorkflow('Prompt', {
        storiesRepository,
        // @ts-expect-error intentionally missing persistence
        sceneletPersistence: undefined,
        storyTreeLoader,
        runVisualDesignTask: visualDesignRunner,
      })
    ).rejects.toThrow(AgentWorkflowError);
  });

  it('passes constitution options to generator', async () => {
    const storiesRepository = createStoriesRepository();
    const sceneletPersistence = createSceneletPersistence();
    const constitutionOptions = { promptLoader: async () => 'System prompt' };
    const storyTreeLoader = async () => VISUAL_STORY_TREE;
    const visualDesignRunner: VisualDesignTaskRunner = async (storyId) => ({
      storyId,
      visualDesignDocument: {},
    });

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
      storyTreeLoader,
      runVisualDesignTask: visualDesignRunner,
    });

    expect(receivedOptions).toEqual(constitutionOptions);
  });
});
