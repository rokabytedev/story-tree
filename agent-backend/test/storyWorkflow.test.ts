import { describe, expect, it } from 'vitest';

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

function createTestStoriesRepository(initial?: Partial<AgentWorkflowStoryRecord>): AgentWorkflowStoriesRepository & {
  records: AgentWorkflowStoryRecord[];
} {
  const records: AgentWorkflowStoryRecord[] = [
    initial ??
      ({
        id: 'story-existing',
        displayName: 'Existing Story',
        initialPrompt: 'Existing prompt',
        storyConstitution: null,
      } satisfies AgentWorkflowStoryRecord),
  ];

  return {
    records,
    async createStory(input) {
      const record: AgentWorkflowStoryRecord = {
        id: `story-${records.length + 1}`,
        displayName: input.displayName,
        initialPrompt: input.initialPrompt,
        storyConstitution: null,
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

describe('StoryWorkflow factories', () => {
  it('creates a workflow from prompt and persists story', async () => {
    const repository = createTestStoriesRepository();
    const sceneletPersistence = createSceneletPersistence();

    const workflow = await createWorkflowFromPrompt('  Brave new world ', {
      storiesRepository: repository,
      sceneletPersistence,
      generateStoryConstitution: async () => ({
        proposedStoryTitle: 'Brave New World',
        storyConstitutionMarkdown: '# Constitution',
      }),
      generateInteractiveStoryTree: async () => {},
      initialDisplayNameFactory: () => 'Draft',
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

    await expect(
      createWorkflowFromPrompt('   ', {
        storiesRepository: repository,
        sceneletPersistence,
        generateStoryConstitution: async () => ({
          proposedStoryTitle: 'Title',
          storyConstitutionMarkdown: '# Constitution',
        }),
        generateInteractiveStoryTree: async () => {},
      })
    ).rejects.toThrow(AgentWorkflowError);
  });

  it('resumes workflow and errors when story missing', async () => {
    const repository = createTestStoriesRepository();
    const sceneletPersistence = createSceneletPersistence();

    await expect(
      resumeWorkflowFromStoryId('missing', {
        storiesRepository: repository,
        sceneletPersistence,
        generateStoryConstitution: async () => ({
          proposedStoryTitle: 'Missing',
          storyConstitutionMarkdown: '# Constitution',
        }),
        generateInteractiveStoryTree: async () => {},
      })
    ).rejects.toThrow('Story missing not found.');
  });
});

describe('StoryWorkflow tasks', () => {
  const taskConstitution: StoryWorkflowTask = 'CREATE_CONSTITUTION';
  const taskInteractive: StoryWorkflowTask = 'CREATE_INTERACTIVE_SCRIPT';

  it('runs constitution task and prevents reruns', async () => {
    const repository = createTestStoriesRepository({
      id: 'story-1',
      displayName: 'Draft Story',
      initialPrompt: 'Space opera',
      storyConstitution: null,
    });
    const sceneletPersistence = createSceneletPersistence();

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

    const workflow = await resumeWorkflowFromStoryId('story-2', {
      storiesRepository: repository,
      sceneletPersistence,
      generateStoryConstitution: async () => ({
        proposedStoryTitle: 'Jungle',
        storyConstitutionMarkdown: '# Constitution',
      }),
      generateInteractiveStoryTree: async () => {},
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
    });

    const result = await workflow.runAllTasks();

    expect(result).toEqual({
      storyId: 'story-4',
      storyTitle: 'Mountain Tale',
      storyConstitutionMarkdown: '# Constitution',
    });
    expect(sceneletPersistence.createCalls.length).toBeGreaterThan(0);
  });
});
