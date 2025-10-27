import { describe, expect, it, vi } from 'vitest';

import { AgentWorkflowError } from '../src/workflow/errors.js';
import {
  createWorkflowFromPrompt,
  resumeWorkflowFromStoryId,
  StoryWorkflowTask,
} from '../src/workflow/storyWorkflow.js';
import type {
  AgentWorkflowConstitutionGenerator,
  AgentWorkflowInteractiveGenerator,
  AgentWorkflowStoryRecord,
  AgentWorkflowStoriesRepository,
} from '../src/workflow/types.js';
import type { SceneletPersistence } from '../src/interactive-story/types.js';
import type { StoryTreeSnapshot } from '../src/story-storage/types.js';
import type { VisualDesignTaskRunner } from '../src/visual-design/types.js';
import type { StoryboardTaskRunner } from '../src/storyboard/types.js';

function createTestStoriesRepository(initial?: Partial<AgentWorkflowStoryRecord>): AgentWorkflowStoriesRepository & {
  records: AgentWorkflowStoryRecord[];
} {
  const baseRecord: AgentWorkflowStoryRecord = {
    id: 'story-existing',
    displayName: 'Existing Story',
    initialPrompt: 'Existing prompt',
    storyConstitution: null,
    visualDesignDocument: null,
    storyboardBreakdown: null,
  };

  const records: AgentWorkflowStoryRecord[] = [{ ...baseRecord, ...(initial ?? {}) }];

  return {
    records,
    async createStory(input) {
      const record: AgentWorkflowStoryRecord = {
        id: `story-${records.length + 1}`,
        displayName: input.displayName,
        initialPrompt: input.initialPrompt,
        storyConstitution: null,
        visualDesignDocument: null,
        storyboardBreakdown: null,
      };
      records.push(record);
      return record;
    },
    async updateStoryArtifacts(storyId, patch) {
      const record = records.find((row) => row.id === storyId);
      if (!record) {
        throw new Error(`Story ${storyId} not found.`);
      }
      if (patch.displayName !== undefined) {
        record.displayName = patch.displayName;
      }
      if (patch.storyConstitution !== undefined) {
        record.storyConstitution = patch.storyConstitution;
      }
      if (patch.visualDesignDocument !== undefined) {
        record.visualDesignDocument = patch.visualDesignDocument;
      }
      if ((patch as { storyboardBreakdown?: unknown }).storyboardBreakdown !== undefined) {
        record.storyboardBreakdown = (patch as { storyboardBreakdown?: unknown }).storyboardBreakdown ?? null;
      }
      return record;
    },
    async getStoryById(storyId) {
      return records.find((row) => row.id === storyId) ?? null;
    },
  };
}

function createSceneletPersistence(): SceneletPersistence & {
  createCalls: Array<{ storyId: string }>;
  hasScenelets: Set<string>;
} {
  const createCalls: Array<{ storyId: string }> = [];
  const hasScenelets = new Set<string>();

  return {
    createCalls,
    hasScenelets,
    async hasSceneletsForStory(storyId: string) {
      return hasScenelets.has(storyId);
    },
    async createScenelet(input) {
      createCalls.push({ storyId: input.storyId });
      hasScenelets.add(input.storyId);
      return {
        id: `scenelet-${createCalls.length}`,
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

const STORY_TREE_SNAPSHOT: StoryTreeSnapshot = {
  entries: [],
  yaml: '- scenelet-1:\n  role: root\n  description: ""\n  dialogue: []\n  shot_suggestions: []',
};

function createStoryTreeLoaderStub(): {
  loader: (storyId: string) => Promise<StoryTreeSnapshot>;
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    async loader(storyId: string) {
      calls.push(storyId);
      return STORY_TREE_SNAPSHOT;
    },
  };
}

function createVisualDesignTaskStub(): {
  runner: VisualDesignTaskRunner;
  calls: Array<{ storyId: string }>;
} {
  const calls: Array<{ storyId: string }> = [];
  const runner: VisualDesignTaskRunner = async (storyId) => {
    calls.push({ storyId });
    return {
      storyId,
      visualDesignDocument: { stub: true },
    };
  };
  return { runner, calls };
}

function createStoryboardTaskStub(): {
  runner: StoryboardTaskRunner;
  calls: Array<{ storyId: string }>;
} {
  const calls: Array<{ storyId: string }> = [];
  const runner: StoryboardTaskRunner = async (storyId) => {
    calls.push({ storyId });
    return {
      storyId,
      storyboardBreakdown: { storyboard_breakdown: [] },
    };
  };
  return { runner, calls };
}

describe('StoryWorkflow factories', () => {
  it('creates a workflow from prompt and persists story', async () => {
    const repository = createTestStoriesRepository();
    const sceneletPersistence = createSceneletPersistence();
    const treeLoader = createStoryTreeLoaderStub();
    const visualDesign = createVisualDesignTaskStub();

    const workflow = await createWorkflowFromPrompt('  Brave new world ', {
      storiesRepository: repository,
      sceneletPersistence,
      generateStoryConstitution: async () => ({
        proposedStoryTitle: 'Brave New World',
        storyConstitutionMarkdown: '# Constitution',
      }),
      generateInteractiveStoryTree: async () => {},
      initialDisplayNameFactory: () => 'Draft',
      storyTreeLoader: treeLoader.loader,
      runVisualDesignTask: visualDesign.runner,
    });

    expect(workflow.storyId).toMatch(/^story-/);
    expect(repository.records.at(-1)).toMatchObject({
      initialPrompt: 'Brave new world',
      displayName: 'Draft',
    });
  });

  it('throws when prompt is missing', async () => {
    const repository = createTestStoriesRepository();
    const sceneletPersistence = createSceneletPersistence();
    const treeLoader = createStoryTreeLoaderStub();
    const visualDesign = createVisualDesignTaskStub();

    await expect(
      createWorkflowFromPrompt('   ', {
        storiesRepository: repository,
        sceneletPersistence,
        generateStoryConstitution: async () => ({
          proposedStoryTitle: 'Title',
          storyConstitutionMarkdown: '# Constitution',
        }),
        generateInteractiveStoryTree: async () => {},
        storyTreeLoader: treeLoader.loader,
        runVisualDesignTask: visualDesign.runner,
      })
    ).rejects.toThrow(AgentWorkflowError);
  });

  it('resumes workflow and errors when story missing', async () => {
    const repository = createTestStoriesRepository();
    const sceneletPersistence = createSceneletPersistence();
    const treeLoader = createStoryTreeLoaderStub();
    const visualDesign = createVisualDesignTaskStub();

    await expect(
      resumeWorkflowFromStoryId('missing', {
        storiesRepository: repository,
        sceneletPersistence,
        generateStoryConstitution: async () => ({
          proposedStoryTitle: 'Missing',
          storyConstitutionMarkdown: '# Constitution',
        }),
        generateInteractiveStoryTree: async () => {},
        storyTreeLoader: treeLoader.loader,
        runVisualDesignTask: visualDesign.runner,
      })
    ).rejects.toThrow('Story missing not found.');
  });
});

describe('StoryWorkflow tasks', () => {
  const taskConstitution: StoryWorkflowTask = 'CREATE_CONSTITUTION';
  const taskInteractive: StoryWorkflowTask = 'CREATE_INTERACTIVE_SCRIPT';
  const taskVisual: StoryWorkflowTask = 'CREATE_VISUAL_DESIGN';
  const taskStoryboard: StoryWorkflowTask = 'CREATE_STORYBOARD';

  it('runs constitution task and prevents reruns', async () => {
    const repository = createTestStoriesRepository({
      id: 'story-1',
      displayName: 'Draft Story',
      initialPrompt: 'Space opera',
      storyConstitution: null,
    });
    const sceneletPersistence = createSceneletPersistence();
    const treeLoader = createStoryTreeLoaderStub();
    const visualDesign = createVisualDesignTaskStub();
    const storyboard = createStoryboardTaskStub();

    let constitutionCalls = 0;
    const generateStoryConstitution: AgentWorkflowConstitutionGenerator = async () => {
      constitutionCalls += 1;
      return {
        proposedStoryTitle: 'Space Opera',
        storyConstitutionMarkdown: '# Constitution',
      };
    };

    const workflow = await resumeWorkflowFromStoryId('story-1', {
      storiesRepository: repository,
      sceneletPersistence,
      generateStoryConstitution,
      generateInteractiveStoryTree: async () => {},
      storyTreeLoader: treeLoader.loader,
      runVisualDesignTask: visualDesign.runner,
      runStoryboardTask: storyboard.runner,
    });

    await workflow.runTask(taskConstitution);

    expect(constitutionCalls).toBe(1);
    expect(repository.records[0]?.storyConstitution).toEqual({
      proposedStoryTitle: 'Space Opera',
      storyConstitutionMarkdown: '# Constitution',
    });

    await expect(workflow.runTask(taskConstitution)).rejects.toThrow(
      'Story story-1 already has a constitution.'
    );
  });

  it('requires constitution before interactive script task', async () => {
    const repository = createTestStoriesRepository({
      id: 'story-2',
      displayName: 'Draft',
      initialPrompt: 'Jungle journey',
      storyConstitution: null,
    });
    const sceneletPersistence = createSceneletPersistence();
    const treeLoader = createStoryTreeLoaderStub();
    const visualDesign = createVisualDesignTaskStub();
    const storyboard = createStoryboardTaskStub();

    const workflow = await resumeWorkflowFromStoryId('story-2', {
      storiesRepository: repository,
      sceneletPersistence,
      generateStoryConstitution: async () => ({
        proposedStoryTitle: 'Jungle',
        storyConstitutionMarkdown: '# Constitution',
      }),
      generateInteractiveStoryTree: async () => {},
      storyTreeLoader: treeLoader.loader,
      runVisualDesignTask: visualDesign.runner,
      runStoryboardTask: storyboard.runner,
    });

    await expect(workflow.runTask(taskInteractive)).rejects.toThrow(
      'Story story-2 must have a constitution before generating interactive content.'
    );
  });

  it('runs interactive script task and prevents reruns', async () => {
    const repository = createTestStoriesRepository({
      id: 'story-3',
      displayName: 'Draft',
      initialPrompt: 'Ocean quest',
      storyConstitution: {
        proposedStoryTitle: 'Ocean Quest',
        storyConstitutionMarkdown: '# Constitution',
      },
    });
    const sceneletPersistence = createSceneletPersistence();
    const treeLoader = createStoryTreeLoaderStub();
    const visualDesign = createVisualDesignTaskStub();
    const storyboard = createStoryboardTaskStub();

    let interactiveCalls = 0;
    const generateInteractiveStoryTree: AgentWorkflowInteractiveGenerator = async () => {
      interactiveCalls += 1;
      await sceneletPersistence.createScenelet({
        storyId: 'story-3',
        parentId: null,
        content: { description: 'Intro', dialogue: [], shot_suggestions: [] },
      });
    };

    const workflow = await resumeWorkflowFromStoryId('story-3', {
      storiesRepository: repository,
      sceneletPersistence,
      generateStoryConstitution: async () => ({
        proposedStoryTitle: 'Ocean Quest',
        storyConstitutionMarkdown: '# Constitution',
      }),
      generateInteractiveStoryTree,
      storyTreeLoader: treeLoader.loader,
      runVisualDesignTask: visualDesign.runner,
      runStoryboardTask: storyboard.runner,
    });

    await workflow.runTask(taskInteractive);
    expect(interactiveCalls).toBe(1);

    await expect(workflow.runTask(taskInteractive)).rejects.toThrow(
      'Interactive script already generated for story story-3.'
    );
  });

  it('runAllTasks executes both tasks and returns constitution metadata', async () => {
    const repository = createTestStoriesRepository({
      id: 'story-4',
      displayName: 'Draft',
      initialPrompt: 'Mountain tale',
      storyConstitution: null,
    });
    const sceneletPersistence = createSceneletPersistence();
    sceneletPersistence.hasScenelets.clear(); // ensure clean slate
    const treeLoader = createStoryTreeLoaderStub();
    const visualDesign = createVisualDesignTaskStub();
    const storyboard = createStoryboardTaskStub();

    const workflow = await resumeWorkflowFromStoryId('story-4', {
      storiesRepository: repository,
      sceneletPersistence,
      generateStoryConstitution: async () => ({
        proposedStoryTitle: 'Mountain Tale',
        storyConstitutionMarkdown: '# Constitution',
      }),
      generateInteractiveStoryTree: async () => {
        await sceneletPersistence.createScenelet({
          storyId: 'story-4',
          parentId: null,
          content: { description: 'Intro', dialogue: [], shot_suggestions: [] },
        });
      },
      storyTreeLoader: treeLoader.loader,
      runVisualDesignTask: visualDesign.runner,
      runStoryboardTask: storyboard.runner,
    });

    const result = await workflow.runAllTasks();

    expect(result).toEqual({
      storyId: 'story-4',
      storyTitle: 'Mountain Tale',
      storyConstitutionMarkdown: '# Constitution',
    });
    expect(sceneletPersistence.createCalls.length).toBeGreaterThan(0);
    expect(visualDesign.calls).toEqual([{ storyId: 'story-4' }]);
    expect(storyboard.calls).toEqual([{ storyId: 'story-4' }]);
  });

  it('runs visual design task using injected runner', async () => {
    const repository = createTestStoriesRepository({
      id: 'story-visual',
      displayName: 'Draft',
      initialPrompt: 'Mountain tale',
      storyConstitution: {
        proposedStoryTitle: 'Mountain Tale',
        storyConstitutionMarkdown: '# Constitution',
      },
      visualDesignDocument: null,
    });
    const sceneletPersistence = createSceneletPersistence();
    const treeLoader = createStoryTreeLoaderStub();
    const runnerCalls: Array<{ storyId: string }> = [];
    const visualDesignRunner: VisualDesignTaskRunner = async (storyId) => {
      runnerCalls.push({ storyId });
      repository.records[0]!.visualDesignDocument = { stub: true };
      return {
        storyId,
        visualDesignDocument: { stub: true },
      };
    };
    const storyboard = createStoryboardTaskStub();

    const workflow = await resumeWorkflowFromStoryId('story-visual', {
      storiesRepository: repository,
      sceneletPersistence,
      generateStoryConstitution: async () => ({
        proposedStoryTitle: 'Mountain Tale',
        storyConstitutionMarkdown: '# Constitution',
      }),
      generateInteractiveStoryTree: async () => {},
      storyTreeLoader: treeLoader.loader,
      runVisualDesignTask: visualDesignRunner,
      runStoryboardTask: storyboard.runner,
    });

    await workflow.runTask(taskVisual);

    expect(runnerCalls).toEqual([{ storyId: 'story-visual' }]);
    expect(repository.records[0]?.visualDesignDocument).toEqual({ stub: true });
  });

  it('runs storyboard task using injected runner', async () => {
    const repository = createTestStoriesRepository({
      id: 'story-storyboard',
      displayName: 'Draft',
      initialPrompt: 'Mountain tale',
      storyConstitution: {
        proposedStoryTitle: 'Mountain Tale',
        storyConstitutionMarkdown: '# Constitution',
      },
      visualDesignDocument: { character_designs: [{ character_name: 'Rhea' }] },
      storyboardBreakdown: null,
    });
    const sceneletPersistence = createSceneletPersistence();
    const treeLoader = createStoryTreeLoaderStub();
    const storyboardCalls: Array<{ storyId: string }> = [];
    const storyboardRunner: StoryboardTaskRunner = async (storyId) => {
      storyboardCalls.push({ storyId });
      repository.records[0]!.storyboardBreakdown = { storyboard_breakdown: [] };
      return {
        storyId,
        storyboardBreakdown: { storyboard_breakdown: [] },
      };
    };

    const workflow = await resumeWorkflowFromStoryId('story-storyboard', {
      storiesRepository: repository,
      sceneletPersistence,
      generateStoryConstitution: async () => ({
        proposedStoryTitle: 'Mountain Tale',
        storyConstitutionMarkdown: '# Constitution',
      }),
      generateInteractiveStoryTree: async () => {},
      storyTreeLoader: treeLoader.loader,
      runVisualDesignTask: createVisualDesignTaskStub().runner,
      runStoryboardTask: storyboardRunner,
    });

    await workflow.runTask(taskStoryboard);

    expect(storyboardCalls).toEqual([{ storyId: 'story-storyboard' }]);
    expect(repository.records[0]?.storyboardBreakdown).toEqual({ storyboard_breakdown: [] });
  });

  it('requires visual design before storyboard task', async () => {
    const repository = createTestStoriesRepository({
      id: 'story-missing-visual',
      displayName: 'Draft',
      initialPrompt: 'Mountain tale',
      storyConstitution: {
        proposedStoryTitle: 'Mountain Tale',
        storyConstitutionMarkdown: '# Constitution',
      },
      visualDesignDocument: null,
      storyboardBreakdown: null,
    });
    const sceneletPersistence = createSceneletPersistence();
    const treeLoader = createStoryTreeLoaderStub();

    const workflow = await resumeWorkflowFromStoryId('story-missing-visual', {
      storiesRepository: repository,
      sceneletPersistence,
      generateStoryConstitution: async () => ({
        proposedStoryTitle: 'Mountain Tale',
        storyConstitutionMarkdown: '# Constitution',
      }),
      generateInteractiveStoryTree: async () => {},
      storyTreeLoader: treeLoader.loader,
      runVisualDesignTask: createVisualDesignTaskStub().runner,
      storyboardTaskOptions: {
        promptLoader: async () => 'Storyboard prompt',
        geminiClient: { generateJson: vi.fn() },
      },
    });

    await expect(workflow.runTask(taskStoryboard)).rejects.toThrow('visual design document');
  });

  it('rejects storyboard task when storyboard already exists', async () => {
    const repository = createTestStoriesRepository({
      id: 'story-has-storyboard',
      displayName: 'Draft',
      initialPrompt: 'Mountain tale',
      storyConstitution: {
        proposedStoryTitle: 'Mountain Tale',
        storyConstitutionMarkdown: '# Constitution',
      },
      visualDesignDocument: { character_designs: [{ character_name: 'Rhea' }] },
      storyboardBreakdown: { storyboard_breakdown: [] },
    });
    const sceneletPersistence = createSceneletPersistence();
    const treeLoader = createStoryTreeLoaderStub();

    const workflow = await resumeWorkflowFromStoryId('story-has-storyboard', {
      storiesRepository: repository,
      sceneletPersistence,
      generateStoryConstitution: async () => ({
        proposedStoryTitle: 'Mountain Tale',
        storyConstitutionMarkdown: '# Constitution',
      }),
      generateInteractiveStoryTree: async () => {},
      storyTreeLoader: treeLoader.loader,
      runVisualDesignTask: createVisualDesignTaskStub().runner,
      storyboardTaskOptions: {
        promptLoader: async () => 'Storyboard prompt',
        geminiClient: { generateJson: vi.fn() },
      },
    });

    await expect(workflow.runTask(taskStoryboard)).rejects.toThrow('already has a storyboard breakdown');
  });
});
