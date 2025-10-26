import { describe, expect, it } from 'vitest';

import { AgentWorkflowError } from '../src/workflow/errors.js';
import { runAgentWorkflow } from '../src/workflow/runAgentWorkflow.js';
import type {
  AgentWorkflowConstitutionGenerator,
  AgentWorkflowInteractiveGenerator,
  AgentWorkflowStoriesRepository,
} from '../src/workflow/types.js';
import type { SceneletPersistence } from '../src/interactive-story/types.js';

function createSceneletPersistence(): SceneletPersistence {
  return {
    async createScenelet(input) {
      return {
        id: 'scenelet',
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
    async markSceneletAsBranchPoint() {
      /* no-op for tests */
    },
    async markSceneletAsTerminal() {
      /* no-op for tests */
    },
  };
}

describe('runAgentWorkflow', () => {
  it('creates the story, stores the constitution, and launches interactive generation', async () => {
    const storiesRepository: AgentWorkflowStoriesRepository = {
      async createStory({ displayName, initialPrompt }) {
        expect(displayName).toBe('Draft Story');
        expect(initialPrompt).toBe('Galactic explorers');
        return {
          id: 'story-123',
          displayName,
          initialPrompt,
          storyConstitution: null,
        };
      },
      async updateStoryArtifacts(storyId, patch) {
        expect(storyId).toBe('story-123');
        expect(patch.displayName).toBe('Star Trail');
        expect(patch.storyConstitution).toEqual({
          proposedStoryTitle: 'Star Trail',
          storyConstitutionMarkdown: '## Constitution',
        });
        return {
          id: storyId,
          displayName: patch.displayName ?? 'Fallback',
          initialPrompt: 'Galactic explorers',
          storyConstitution: patch.storyConstitution ?? null,
        };
      },
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
      expect(storyId).toBe('story-123');
      expect(markdown).toBe('## Constitution');
    };

    const sceneletPersistence = createSceneletPersistence();

    const result = await runAgentWorkflow('  Galactic explorers  ', {
      storiesRepository,
      sceneletPersistence,
      generateStoryConstitution: constitutionGenerator,
      generateInteractiveStoryTree: interactiveGenerator,
      initialDisplayNameFactory: () => 'Draft Story',
      interactiveStoryOptions: { timeoutMs: 60_000 },
    });

    expect(result).toEqual({
      storyId: 'story-123',
      storyTitle: 'Star Trail',
      storyConstitutionMarkdown: '## Constitution',
    });

    expect(interactiveOptions).toEqual({
      timeoutMs: 60_000,
      sceneletPersistence,
    });
  });

  it('uses the default display name when no factory provided', async () => {
    const storiesRepository: AgentWorkflowStoriesRepository = {
      async createStory({ displayName, initialPrompt }) {
        expect(displayName).toBe('Untitled Story');
        expect(initialPrompt).toBe('Forest quest');
        return {
          id: 'story-999',
          displayName,
          initialPrompt,
          storyConstitution: null,
        };
      },
      async updateStoryArtifacts(storyId, patch) {
        return {
          id: storyId,
          displayName: patch.displayName ?? 'Untitled Story',
          initialPrompt: 'Forest quest',
          storyConstitution: patch.storyConstitution ?? null,
        };
      },
    };

    const constitutionGenerator: AgentWorkflowConstitutionGenerator = async () => ({
      proposedStoryTitle: 'Forest Quest',
      storyConstitutionMarkdown: '## Forest Constitution',
    });

    const interactiveGenerator: AgentWorkflowInteractiveGenerator = async () => {};

    const result = await runAgentWorkflow('Forest quest', {
      storiesRepository,
      sceneletPersistence: createSceneletPersistence(),
      generateStoryConstitution: constitutionGenerator,
      generateInteractiveStoryTree: interactiveGenerator,
    });

    expect(result.storyTitle).toBe('Forest Quest');
  });

  it('throws AgentWorkflowError when prompt is empty', async () => {
    await expect(
      runAgentWorkflow('   ', {
        storiesRepository: {
          async createStory() {
            throw new Error('should not be called');
          },
          async updateStoryArtifacts() {
            throw new Error('should not be called');
          },
        },
        sceneletPersistence: createSceneletPersistence(),
      })
    ).rejects.toBeInstanceOf(AgentWorkflowError);
  });

  it('propagates constitution generator failures', async () => {
    const storiesRepository: AgentWorkflowStoriesRepository = {
      async createStory() {
        return {
          id: 'story-xyz',
          displayName: 'Untitled Story',
          initialPrompt: 'Danger prompt',
          storyConstitution: null,
        };
      },
      async updateStoryArtifacts() {
        throw new Error('Should not update when constitution fails');
      },
    };

    const interactiveGenerator: AgentWorkflowInteractiveGenerator = async () => {
      throw new Error('Should not execute when constitution fails');
    };

    await expect(
      runAgentWorkflow('Danger prompt', {
        storiesRepository,
        sceneletPersistence: createSceneletPersistence(),
        generateStoryConstitution: async () => {
          throw new Error('Gemini failed');
        },
        generateInteractiveStoryTree: interactiveGenerator,
      })
    ).rejects.toThrow('Gemini failed');
  });

  it('passes constitution options through to the generator', async () => {
    let receivedOptions: unknown;
    const storiesRepository: AgentWorkflowStoriesRepository = {
      async createStory() {
        return {
          id: 'story-opts',
          displayName: 'Untitled Story',
          initialPrompt: 'Option prompt',
          storyConstitution: null,
        };
      },
      async updateStoryArtifacts() {
        return {
          id: 'story-opts',
          displayName: 'Option Title',
          initialPrompt: 'Option prompt',
          storyConstitution: null,
        };
      },
    };

    const constitutionOptions = { promptLoader: async () => 'System prompt' };

    const constitutionGenerator: AgentWorkflowConstitutionGenerator = async (_prompt, opts) => {
      receivedOptions = opts;
      return {
        proposedStoryTitle: 'Option Title',
        storyConstitutionMarkdown: '## Options',
      };
    };

    const interactiveGenerator: AgentWorkflowInteractiveGenerator = async () => {};

    await runAgentWorkflow('Option prompt', {
      storiesRepository,
      sceneletPersistence: createSceneletPersistence(),
      generateStoryConstitution: constitutionGenerator,
      generateInteractiveStoryTree: interactiveGenerator,
      constitutionOptions,
    });

    expect(receivedOptions).toEqual(constitutionOptions);
  });

  it('propagates interactive generator failures', async () => {
    const storiesRepository: AgentWorkflowStoriesRepository = {
      async createStory() {
        return {
          id: 'story-fail',
          displayName: 'Untitled Story',
          initialPrompt: 'Failure prompt',
          storyConstitution: null,
        };
      },
      async updateStoryArtifacts() {
        return {
          id: 'story-fail',
          displayName: 'Failure Title',
          initialPrompt: 'Failure prompt',
          storyConstitution: null,
        };
      },
    };

    await expect(
      runAgentWorkflow('Failure prompt', {
        storiesRepository,
        sceneletPersistence: createSceneletPersistence(),
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

  it('requires stories repository and scenelet persistence', async () => {
    await expect(
      runAgentWorkflow('Prompt', {
        // @ts-expect-error Intentionally omitting repository to verify error handling.
        storiesRepository: undefined,
        sceneletPersistence: createSceneletPersistence(),
      })
    ).rejects.toThrow('Stories repository dependency is required.');

    const storiesRepository: AgentWorkflowStoriesRepository = {
      async createStory() {
        return {
          id: 'story',
          displayName: 'Untitled Story',
          initialPrompt: 'Prompt',
          storyConstitution: null,
        };
      },
      async updateStoryArtifacts() {
        return {
          id: 'story',
          displayName: 'Updated',
          initialPrompt: 'Prompt',
          storyConstitution: null,
        };
      },
    };

    await expect(
      runAgentWorkflow('Prompt', {
        storiesRepository,
        // @ts-expect-error verify error when persistence missing
        sceneletPersistence: undefined,
      })
    ).rejects.toThrow('Scenelet persistence dependency is required.');
  });
});
