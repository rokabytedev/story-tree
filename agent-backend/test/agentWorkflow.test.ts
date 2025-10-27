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
import type { StoryboardTaskRunner } from '../src/storyboard/types.js';
import type { AudioDesignTaskRunner } from '../src/audio-design/types.js';

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
        storyboardBreakdown: null,
        audioDesignDocument: null,
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
      if ((patch as { storyboardBreakdown?: unknown }).storyboardBreakdown !== undefined) {
        repository.record.storyboardBreakdown = (patch as { storyboardBreakdown?: unknown }).storyboardBreakdown ?? null;
      }
      if ((patch as { audioDesignDocument?: unknown }).audioDesignDocument !== undefined) {
        repository.record.audioDesignDocument = (patch as { audioDesignDocument?: unknown }).audioDesignDocument ?? null;
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
    const storyboardRunner: StoryboardTaskRunner = async (storyId) => {
      storiesRepository.record!.storyboardBreakdown = { storyboard_breakdown: [] };
      return {
        storyId,
        storyboardBreakdown: { storyboard_breakdown: [] },
      };
    };
    const audioRunner: AudioDesignTaskRunner = async (storyId) => {
      storiesRepository.record!.audioDesignDocument = {
        audio_design_document: { sonic_identity: {} },
      };
      return {
        storyId,
        audioDesignDocument: { audio_design_document: { sonic_identity: {} } },
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
      runStoryboardTask: storyboardRunner,
      runAudioDesignTask: audioRunner,
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
    expect(storiesRepository.record?.storyboardBreakdown).toEqual({ storyboard_breakdown: [] });
    expect(storiesRepository.record?.audioDesignDocument).toEqual({
      audio_design_document: { sonic_identity: {} },
    });
  });

  it('uses default display name when no factory provided', async () => {
    const storiesRepository = createStoriesRepository();
    const sceneletPersistence = createSceneletPersistence();
    const storyTreeLoader = async () => VISUAL_STORY_TREE;
    const visualDesignRunner: VisualDesignTaskRunner = async (storyId) => ({
      storyId,
      visualDesignDocument: {},
    });
    const storyboardRunner: StoryboardTaskRunner = async (storyId) => ({
      storyId,
      storyboardBreakdown: { storyboard_breakdown: [] },
    });
    const audioRunnerStub: AudioDesignTaskRunner = async (storyId) => ({
      storyId,
      audioDesignDocument: { audio_design_document: { sonic_identity: {} } },
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
      runStoryboardTask: storyboardRunner,
      runAudioDesignTask: audioRunnerStub,
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
    const storyboardRunner: StoryboardTaskRunner = async (storyId) => ({
      storyId,
      storyboardBreakdown: { storyboard_breakdown: [] },
    });
    const audioRunner: AudioDesignTaskRunner = async (storyId) => ({
      storyId,
      audioDesignDocument: { audio_design_document: { sonic_identity: {} } },
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
        runStoryboardTask: storyboardRunner,
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
    const storyboardRunner: StoryboardTaskRunner = async (storyId) => ({
      storyId,
      storyboardBreakdown: { storyboard_breakdown: [] },
    });
    const audioRunnerForOptions: AudioDesignTaskRunner = async (storyId) => ({
      storyId,
      audioDesignDocument: { audio_design_document: { sonic_identity: {} } },
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
      runStoryboardTask: storyboardRunner,
      runAudioDesignTask: audioRunnerForOptions,
    });

    expect(receivedOptions).toEqual(constitutionOptions);
  });
});
