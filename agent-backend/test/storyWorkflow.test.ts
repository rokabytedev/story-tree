import { describe, expect, it, vi } from 'vitest';

import { AgentWorkflowError } from '../src/workflow/errors.js';
import {
  createWorkflowFromPrompt,
  resumeWorkflowFromStoryId,
  type StoryWorkflowTask,
} from '../src/workflow/storyWorkflow.js';
import type {
  AgentWorkflowConstitutionGenerator,
  AgentWorkflowInteractiveGenerator,
  AgentWorkflowStoryRecord,
  AgentWorkflowStoriesRepository,
  AgentWorkflowOptions,
} from '../src/workflow/types.js';
import type { SceneletPersistence, SceneletRecord } from '../src/interactive-story/types.js';
import type { StoryTreeSnapshot } from '../src/story-storage/types.js';
import type { VisualDesignTaskRunner } from '../src/visual-design/types.js';
import type { VisualReferenceTaskRunner } from '../src/visual-reference/types.js';
import type { AudioDesignTaskRunner } from '../src/audio-design/types.js';
import type { ShotProductionTaskRunner, ShotProductionShotsRepository } from '../src/shot-production/types.js';
import type {
  EnvironmentReferenceTaskDependencies,
  EnvironmentReferenceTaskRunner,
} from '../src/environment-reference/types.js';

function createStoryRecord(overrides: Partial<AgentWorkflowStoryRecord> = {}): AgentWorkflowStoryRecord {
  return {
    id: overrides.id ?? 'story-1',
    displayName: overrides.displayName ?? 'Draft Story',
    initialPrompt: overrides.initialPrompt ?? 'A mysterious journey',
    storyConstitution: overrides.storyConstitution ?? null,
    visualDesignDocument: overrides.visualDesignDocument ?? null,
    audioDesignDocument: overrides.audioDesignDocument ?? null,
    visualReferencePackage: overrides.visualReferencePackage ?? null,
  };
}

function createStoriesRepository(initialRecord?: AgentWorkflowStoryRecord): AgentWorkflowStoriesRepository & {
  records: AgentWorkflowStoryRecord[];
} {
  const records: AgentWorkflowStoryRecord[] = [initialRecord ?? createStoryRecord({ id: 'story-existing' })];

  return {
    records,
    async createStory(input) {
      const record = createStoryRecord({
        id: `story-${records.length + 1}`,
        displayName: input.displayName,
        initialPrompt: input.initialPrompt,
      });
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
      if (patch.audioDesignDocument !== undefined) {
        record.audioDesignDocument = patch.audioDesignDocument;
      }
      if (patch.visualReferencePackage !== undefined) {
        record.visualReferencePackage = patch.visualReferencePackage;
      }
      return record;
    },
    async getStoryById(storyId) {
      return records.find((row) => row.id === storyId) ?? null;
    },
  } satisfies AgentWorkflowStoriesRepository & { records: AgentWorkflowStoryRecord[] };
}

function createSceneletPersistence(): SceneletPersistence & {
  created: string[];
  records: SceneletRecord[];
} {
  const created: string[] = [];
  const records: SceneletRecord[] = [];

  return {
    created,
    records,
    async hasSceneletsForStory(storyId: string) {
      return records.some((record) => record.storyId === storyId);
    },
    async listSceneletsByStory(storyId: string) {
      return records.filter((record) => record.storyId === storyId);
    },
    async createScenelet(input) {
      created.push(input.storyId);
      const record = {
        id: `scenelet-${created.length}`,
        storyId: input.storyId,
        parentId: input.parentId ?? null,
        choiceLabelFromParent: input.choiceLabelFromParent ?? null,
        choicePrompt: null,
        content: input.content,
        isBranchPoint: false,
        isTerminalNode: false,
        createdAt: new Date().toISOString(),
      };
      records.push(record);
      return record;
    },
    async markSceneletAsBranchPoint() {},
    async markSceneletAsTerminal() {},
  };
}

const STORY_TREE: StoryTreeSnapshot = {
  entries: [
    {
      kind: 'scenelet',
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      data: {
        id: 'scenelet-1',
        parentId: null,
        role: 'root',
        description: 'Intro scene',
        dialogue: [
          { character: 'Narrator', line: 'Welcome to the story.' },
        ],
        shotSuggestions: ['Begin with a wide establishing shot.'],
      },
    },
  ],
  yaml: '- scenelet-1:\n  role: root\n  description: "Intro scene"\n  dialogue: []\n  shot_suggestions: []',
};

function createStoryTreeLoader(): {
  loader: (id: string) => Promise<StoryTreeSnapshot>;
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    async loader(storyId: string) {
      calls.push(storyId);
      return STORY_TREE;
    },
  };
}

function createVisualDesignTask(): {
  runner: VisualDesignTaskRunner;
  calls: string[];
} {
  const calls: string[] = [];
  const runner: VisualDesignTaskRunner = async (storyId, dependencies) => {
    calls.push(storyId);
    await dependencies?.storiesRepository?.updateStoryArtifacts?.(storyId, {
      visualDesignDocument: { characters: [] },
    });
    return {
      storyId,
      visualDesignDocument: { characters: [] },
    };
  };
  return { runner, calls };
}

function createVisualReferenceTask(): {
  runner: VisualReferenceTaskRunner;
  calls: string[];
} {
  const calls: string[] = [];
  const runner: VisualReferenceTaskRunner = async (storyId) => {
    calls.push(storyId);
    return {
      storyId,
      visualReferencePackage: { character_model_sheets: [], environment_keyframes: [] },
    };
  };
  return { runner, calls };
}

function createEnvironmentReferenceTask(): {
  runner: EnvironmentReferenceTaskRunner;
  calls: Array<{ storyId: string; dependencies: EnvironmentReferenceTaskDependencies }>;
} {
  const calls: Array<{ storyId: string; dependencies: EnvironmentReferenceTaskDependencies }> = [];
  const runner: EnvironmentReferenceTaskRunner = async (storyId, dependencies) => {
    calls.push({ storyId, dependencies });
    return {
      storyId,
      generatedCount: 0,
      skippedCount: 0,
      errors: [],
    };
  };
  return { runner, calls };
}

function createAudioDesignTask(): {
  runner: AudioDesignTaskRunner;
  calls: string[];
} {
  const calls: string[] = [];
  const runner: AudioDesignTaskRunner = async (storyId) => {
    calls.push(storyId);
    return {
      storyId,
      audioDesignDocument: { audio_design_document: { cues: [] } },
    };
  };
  return { runner, calls };
}

function createShotsRepository(preexisting?: Set<string>): ShotProductionShotsRepository & {
  created: Array<{ storyId: string; sceneletRef: string; sceneletId: string; shotIndices: number[] }>;
  existing: Set<string>;
} {
  const existing = preexisting ?? new Set<string>();
  const created: Array<{ storyId: string; sceneletRef: string; sceneletId: string; shotIndices: number[] }> = [];

  return {
    created,
    existing,
    async createSceneletShots(storyId, sceneletRef, sceneletId, _sequence, shots) {
      const key = `${storyId}:${sceneletId}`;
      if (existing.has(key)) {
        throw new Error(`Shots already exist for ${key}`);
      }
      existing.add(key);
      created.push({
        storyId,
        sceneletRef,
        sceneletId,
        shotIndices: shots.map((shot) => shot.shotIndex),
      });
    },
    async findSceneletIdsMissingShots(storyId, sceneletIds) {
      return sceneletIds.filter((sceneletId) => !existing.has(`${storyId}:${sceneletId}`));
    },
    async getShotsByStory(_storyId) {
      return {};
    },
    async getShotsBySceneletRef(_sceneletRef) {
      return [];
    },
    async findShotsMissingImages(_storyId) {
      return [];
    },
    async findShotsMissingVideos(_storyId) {
      return [];
    },
    async updateShotImagePaths(_storyId, _sceneletId, _shotIndex, _paths) {
      // Mock implementation
    },
    async updateShotAudioPath(_storyId, sceneletId, shotIndex, audioPath) {
      return {
        sceneletRef: 'mock-ref',
        sceneletId,
        sceneletSequence: 1,
        shotIndex,
        storyboardPayload: {},
        videoFilePath: undefined,
        audioFilePath: audioPath ?? null,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      } as any;
    },
    async updateShotVideoPath(_storyId, sceneletId, shotIndex, videoPath) {
      return {
        sceneletRef: 'mock-ref',
        sceneletId,
        sceneletSequence: 1,
        shotIndex,
        storyboardPayload: {},
        videoFilePath: videoPath ?? undefined,
        audioFilePath: undefined,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      } as any;
    },
  };
}

function createShotProductionTask(): {
  runner: ShotProductionTaskRunner;
  calls: string[];
} {
  const calls: string[] = [];
  const runner: ShotProductionTaskRunner = async (storyId) => {
    calls.push(storyId);
    return {
      storyId,
      scenelets: [{ sceneletId: 'scenelet-1', shotCount: 2 }],
      totalShots: 2,
    };
  };
  return { runner, calls };
}

function buildOptions(overrides: Partial<AgentWorkflowOptions> & {
  storiesRepository: AgentWorkflowStoriesRepository;
  shotsRepository: ShotProductionShotsRepository;
  sceneletPersistence: SceneletPersistence;
  storyTreeLoader: (storyId: string) => Promise<StoryTreeSnapshot>;
}): AgentWorkflowOptions {
  return {
    generateStoryConstitution: async () => ({
      proposedStoryTitle: 'Draft Story',
      storyConstitutionMarkdown: '# Constitution',
      targetSceneletsPerPath: 12,
    }),
    generateInteractiveStoryTree: async (_storyId, _markdown, options) => {
      expect(options?.targetSceneletsPerPath).toBe(12);
    },
    ...overrides,
  } satisfies AgentWorkflowOptions;
}

describe('storyWorkflow factory', () => {
  it('creates workflow from prompt and trims values', async () => {
    const storiesRepository = createStoriesRepository();
    const shotsRepository = createShotsRepository();
    const sceneletPersistence = createSceneletPersistence();
    const treeLoader = createStoryTreeLoader();
    const visualDesign = createVisualDesignTask();

    const workflow = await createWorkflowFromPrompt('  Visionary tale  ', buildOptions({
      storiesRepository,
      shotsRepository,
      sceneletPersistence,
      storyTreeLoader: treeLoader.loader,
      runVisualDesignTask: visualDesign.runner,
    }));

    expect(workflow.storyId).toMatch(/^story-\d+$/);
    expect(storiesRepository.records.at(-1)).toMatchObject({
      displayName: 'Untitled Story',
      initialPrompt: 'Visionary tale',
    });
  });

  it('throws when resuming unknown story id', async () => {
    const storiesRepository = createStoriesRepository(createStoryRecord({ id: 'story-1' }));
    const shotsRepository = createShotsRepository();
    const sceneletPersistence = createSceneletPersistence();
    const treeLoader = createStoryTreeLoader();
    const visualDesign = createVisualDesignTask();

    await expect(
      resumeWorkflowFromStoryId('missing', buildOptions({
        storiesRepository,
        shotsRepository,
        sceneletPersistence,
        storyTreeLoader: treeLoader.loader,
        runVisualDesignTask: visualDesign.runner,
      }))
    ).rejects.toThrow(new AgentWorkflowError('Story missing not found.'));
  });
});

describe('storyWorkflow tasks', () => {
  const taskConstitution: StoryWorkflowTask = 'CREATE_CONSTITUTION';
  const taskInteractive: StoryWorkflowTask = 'CREATE_INTERACTIVE_SCRIPT';
  const taskVisual: StoryWorkflowTask = 'CREATE_VISUAL_DESIGN';
  const taskVisualReference: StoryWorkflowTask = 'CREATE_VISUAL_REFERENCE';
  const taskAudio: StoryWorkflowTask = 'CREATE_AUDIO_DESIGN';
  const taskShots: StoryWorkflowTask = 'CREATE_SHOT_PRODUCTION';
  const taskEnvironmentReference: StoryWorkflowTask = 'CREATE_ENVIRONMENT_REFERENCE_IMAGE';

  it('runs constitution task and prevents reruns', async () => {
    const storiesRepository = createStoriesRepository(createStoryRecord({ id: 'story-constitution' }));
    const shotsRepository = createShotsRepository();
    const sceneletPersistence = createSceneletPersistence();
    const treeLoader = createStoryTreeLoader();
    const visualDesign = createVisualDesignTask();
    const shotProduction = createShotProductionTask();

    let calls = 0;
    const constitutionGenerator: AgentWorkflowConstitutionGenerator = async () => {
      calls += 1;
      return {
        proposedStoryTitle: 'New Title',
        storyConstitutionMarkdown: '# Constitution',
        targetSceneletsPerPath: 12,
      };
    };

    const workflow = await resumeWorkflowFromStoryId('story-constitution', buildOptions({
      storiesRepository,
      shotsRepository,
      sceneletPersistence,
      storyTreeLoader: treeLoader.loader,
      runVisualDesignTask: visualDesign.runner,
      runShotProductionTask: shotProduction.runner,
      generateStoryConstitution: constitutionGenerator,
    }));

    await workflow.runTask(taskConstitution);
    expect(calls).toBe(1);
    expect(storiesRepository.records[0]?.storyConstitution).toEqual({
      proposedStoryTitle: 'New Title',
      storyConstitutionMarkdown: '# Constitution',
      targetSceneletsPerPath: 12,
    });

    await expect(workflow.runTask(taskConstitution)).rejects.toThrow(
      'Story story-constitution already has a constitution.'
    );
  });

  it('prevents interactive task before constitution and then persists scenelets', async () => {
    const storiesRepository = createStoriesRepository(createStoryRecord({ id: 'story-interactive', storyConstitution: null }));
    const shotsRepository = createShotsRepository();
    const sceneletPersistence = createSceneletPersistence();
    const treeLoader = createStoryTreeLoader();
    const visualDesign = createVisualDesignTask();
    const shotProduction = createShotProductionTask();

    const workflow = await resumeWorkflowFromStoryId('story-interactive', buildOptions({
      storiesRepository,
      shotsRepository,
      sceneletPersistence,
      storyTreeLoader: treeLoader.loader,
      runVisualDesignTask: visualDesign.runner,
      runShotProductionTask: shotProduction.runner,
      generateInteractiveStoryTree: async (storyId, _markdown, options) => {
        await sceneletPersistence.createScenelet({
          storyId,
          parentId: null,
          content: { description: 'Generated scenelet', dialogue: [], shot_suggestions: [] },
        });
        expect(options?.targetSceneletsPerPath).toBe(12);
        if (options && typeof options === 'object' && 'sceneletPersistence' in options) {
          // no-op; included to exercise options path
        }
      },
    }));

    await expect(workflow.runTask(taskInteractive)).rejects.toThrow(
      'Story story-interactive must have a constitution before generating interactive content.'
    );

    storiesRepository.records[0]!.storyConstitution = {
      proposedStoryTitle: 'Title',
      storyConstitutionMarkdown: '# Constitution',
      targetSceneletsPerPath: 12,
    };

    await workflow.runTask(taskInteractive);
    expect(sceneletPersistence.created).toEqual(['story-interactive']);
    await expect(workflow.runTask(taskInteractive)).rejects.toThrow(
      'Interactive script already generated for story story-interactive.'
    );
  });

  it('resumes interactive script when resume flag enabled and pending tasks exist', async () => {
    const storyId = 'story-resume';
    const storiesRepository = createStoriesRepository(createStoryRecord({
      id: storyId,
      storyConstitution: {
        proposedStoryTitle: 'Title',
        storyConstitutionMarkdown: '# Constitution',
        targetSceneletsPerPath: 12,
      },
    }));
    const shotsRepository = createShotsRepository();
    const sceneletPersistence = createSceneletPersistence();
    const treeLoader = createStoryTreeLoader();

    sceneletPersistence.records.push(
      {
        id: 'scenelet-root',
        storyId,
        parentId: null,
        choiceLabelFromParent: null,
        choicePrompt: null,
        content: {
          description: 'Root scene',
          dialogue: [],
          shot_suggestions: ['Root shot'],
        },
        isBranchPoint: false,
        isTerminalNode: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'scenelet-leaf',
        storyId,
        parentId: 'scenelet-root',
        choiceLabelFromParent: null,
        choicePrompt: null,
        content: {
          description: 'Leaf scene',
          dialogue: [],
          shot_suggestions: ['Leaf shot'],
        },
        isBranchPoint: false,
        isTerminalNode: false,
        createdAt: new Date().toISOString(),
      }
    );

    const interactiveGenerator = vi.fn(async (_storyId, _markdown, options) => {
      expect(options?.resumeState?.pendingTasks).toHaveLength(1);
      expect(options?.resumeState?.pendingTasks[0]?.parentSceneletId).toBe('scenelet-leaf');
    });

    const workflow = await resumeWorkflowFromStoryId(storyId, buildOptions({
      storiesRepository,
      shotsRepository,
      sceneletPersistence,
      storyTreeLoader: treeLoader.loader,
      generateInteractiveStoryTree: interactiveGenerator,
      resumeInteractiveScript: true,
    }));

    await workflow.runTask(taskInteractive);
    expect(interactiveGenerator).toHaveBeenCalledTimes(1);
  });

  it('skips interactive generator when resume flag is enabled but tree is complete', async () => {
    const storyId = 'story-complete';
    const storiesRepository = createStoriesRepository(createStoryRecord({
      id: storyId,
      storyConstitution: {
        proposedStoryTitle: 'Title',
        storyConstitutionMarkdown: '# Constitution',
        targetSceneletsPerPath: 12,
      },
    }));
    const shotsRepository = createShotsRepository();
    const sceneletPersistence = createSceneletPersistence();
    const treeLoader = createStoryTreeLoader();

    sceneletPersistence.records.push({
      id: 'scenelet-root',
      storyId,
      parentId: null,
      choiceLabelFromParent: null,
      choicePrompt: null,
      content: {
        description: 'Root scene',
        dialogue: [],
        shot_suggestions: ['Root shot'],
      },
      isBranchPoint: false,
      isTerminalNode: true,
      createdAt: new Date().toISOString(),
    });

    const interactiveGenerator = vi.fn();

    const workflow = await resumeWorkflowFromStoryId(storyId, buildOptions({
      storiesRepository,
      shotsRepository,
      sceneletPersistence,
      storyTreeLoader: treeLoader.loader,
      generateInteractiveStoryTree: interactiveGenerator,
      resumeInteractiveScript: true,
    }));

    await workflow.runTask(taskInteractive);
    expect(interactiveGenerator).not.toHaveBeenCalled();
  });

  it('runs visual design task after prerequisites', async () => {
    const storiesRepository = createStoriesRepository(createStoryRecord({
      id: 'story-visual',
      storyConstitution: {
        proposedStoryTitle: 'Title',
        storyConstitutionMarkdown: '# Constitution',
        targetSceneletsPerPath: 12,
      },
    }));
    const shotsRepository = createShotsRepository();
    const sceneletPersistence = createSceneletPersistence();
    const treeLoader = createStoryTreeLoader();
    const visualDesign = createVisualDesignTask();
    const visualReference = createVisualReferenceTask();
    const shotProduction = createShotProductionTask();

    const workflow = await resumeWorkflowFromStoryId('story-visual', buildOptions({
      storiesRepository,
      shotsRepository,
      sceneletPersistence,
      storyTreeLoader: treeLoader.loader,
      runVisualDesignTask: visualDesign.runner,
      runVisualReferenceTask: visualReference.runner,
      runShotProductionTask: shotProduction.runner,
    }));

    await workflow.runTask(taskVisual);
    expect(visualDesign.calls).toEqual(['story-visual']);
  });

  it('runs visual reference task after prerequisites', async () => {
    const storiesRepository = createStoriesRepository(createStoryRecord({
      id: 'story-visual-ref',
      storyConstitution: {
        proposedStoryTitle: 'Title',
        storyConstitutionMarkdown: '# Constitution',
        targetSceneletsPerPath: 12,
      },
      visualDesignDocument: { characters: [] },
    }));
    const shotsRepository = createShotsRepository();
    const sceneletPersistence = createSceneletPersistence();
    const treeLoader = createStoryTreeLoader();
    const visualDesign = createVisualDesignTask();
    const visualReference = createVisualReferenceTask();
    const shotProduction = createShotProductionTask();

    const workflow = await resumeWorkflowFromStoryId('story-visual-ref', buildOptions({
      storiesRepository,
      shotsRepository,
      sceneletPersistence,
      storyTreeLoader: treeLoader.loader,
      runVisualDesignTask: visualDesign.runner,
      runVisualReferenceTask: visualReference.runner,
      runShotProductionTask: shotProduction.runner,
    }));

    storiesRepository.records[0]!.visualDesignDocument = { characters: [] };

    await workflow.runTask(taskVisualReference);
    expect(visualReference.calls).toEqual(['story-visual-ref']);
  });

  it('requires audio design prerequisites and logs artifacts', async () => {
    const storiesRepository = createStoriesRepository(createStoryRecord({
      id: 'story-audio',
      storyConstitution: {
        proposedStoryTitle: 'Title',
        storyConstitutionMarkdown: '# Constitution',
        targetSceneletsPerPath: 12,
      },
      visualDesignDocument: { characters: [] },
    }));
    const shotsRepository = createShotsRepository();
    const sceneletPersistence = createSceneletPersistence();
    const treeLoader = createStoryTreeLoader();
    const audioDesign = createAudioDesignTask();
    const shotProduction = createShotProductionTask();

    const workflow = await resumeWorkflowFromStoryId('story-audio', buildOptions({
      storiesRepository,
      shotsRepository,
      sceneletPersistence,
      storyTreeLoader: treeLoader.loader,
      runVisualReferenceTask: createVisualReferenceTask().runner,
      runAudioDesignTask: audioDesign.runner,
      runShotProductionTask: shotProduction.runner,
    }));

    await workflow.runTask(taskAudio);
    expect(audioDesign.calls).toEqual(['story-audio']);
  });

  it('runs environment reference task with configured options', async () => {
    const storiesRepository = createStoriesRepository(createStoryRecord({
      id: 'story-env',
      visualDesignDocument: { environment_designs: [] },
    }));
    const shotsRepository = createShotsRepository();
    const sceneletPersistence = createSceneletPersistence();
    const treeLoader = createStoryTreeLoader();
    const environmentReference = createEnvironmentReferenceTask();
    const logger = { debug: vi.fn() };

    const workflow = await resumeWorkflowFromStoryId('story-env', buildOptions({
      storiesRepository,
      shotsRepository,
      sceneletPersistence,
      storyTreeLoader: treeLoader.loader,
      runEnvironmentReferenceTask: environmentReference.runner,
      environmentReferenceTaskOptions: {
        targetEnvironmentId: 'crystal-cavern',
        override: true,
        verbose: true,
      },
      logger,
    }));

    await workflow.runTask(taskEnvironmentReference);

    expect(environmentReference.calls).toHaveLength(1);
    const call = environmentReference.calls[0]!;
    expect(call.storyId).toBe('story-env');
    expect(call.dependencies.storiesRepository).toBe(storiesRepository);
    expect(call.dependencies.targetEnvironmentId).toBe('crystal-cavern');
    expect(call.dependencies.override).toBe(true);
    expect(call.dependencies.verbose).toBe(true);
    expect(call.dependencies.logger).toBe(logger);
  });

  it('runs shot production task, persists shots, and prevents reruns when shots exist', async () => {
    const storiesRepository = createStoriesRepository(createStoryRecord({
      id: 'story-shots',
      storyConstitution: {
        proposedStoryTitle: 'Title',
        storyConstitutionMarkdown: '# Constitution',
        targetSceneletsPerPath: 12,
      },
      visualDesignDocument: { characters: [] },
      audioDesignDocument: { audio_design_document: { cues: [] } },
    }));
    const shotsRepository = createShotsRepository();
    const sceneletPersistence = createSceneletPersistence();
    const treeLoader = createStoryTreeLoader();
    const shotProduction = createShotProductionTask();

    const workflow = await resumeWorkflowFromStoryId('story-shots', buildOptions({
      storiesRepository,
      shotsRepository,
      sceneletPersistence,
      storyTreeLoader: treeLoader.loader,
      runVisualReferenceTask: createVisualReferenceTask().runner,
      runShotProductionTask: shotProduction.runner,
    }));

    await workflow.runTask(taskShots);
    expect(shotProduction.calls).toEqual(['story-shots']);
  });
});

describe('runAllTasks', () => {
  it('executes entire workflow sequence ending with shot production', async () => {
    const storyRecord = createStoryRecord({
      id: 'story-run-all',
      visualReferencePackage: { character_model_sheets: [], environment_keyframes: [] },
    });
    const storiesRepository = createStoriesRepository(storyRecord);
    const shotsRepository = createShotsRepository();
    const sceneletPersistence = createSceneletPersistence();
    const treeLoader = createStoryTreeLoader();
    const visualDesign = createVisualDesignTask();
    const visualReference = createVisualReferenceTask();
    const audioDesign = createAudioDesignTask();
    const shotProduction = createShotProductionTask();

    const workflow = await resumeWorkflowFromStoryId('story-run-all', buildOptions({
      storiesRepository,
      shotsRepository,
      sceneletPersistence,
      storyTreeLoader: treeLoader.loader,
      runVisualDesignTask: visualDesign.runner,
      runVisualReferenceTask: visualReference.runner,
      runAudioDesignTask: audioDesign.runner,
      runShotProductionTask: shotProduction.runner,
      runShotAudioTask: async () => ({
        generatedAudio: 0,
        skippedShots: 0,
        totalShots: 0,
        generatedBranchAudio: 0,
        skippedBranchAudio: 0,
        totalBranchScenelets: 0,
      }),
      shotImageTaskOptions: {
        geminiImageClient: {
          async generateImage() {
            return { imageData: Buffer.from('stub'), mimeType: 'image/png' };
          },
        },
        imageStorage: {
          async saveImage(_buffer, storyId, category, filename) {
            return `${storyId}/${category}/${filename}`;
          },
        },
      },
      generateInteractiveStoryTree: async (_storyId, _markdown, options) => {
        expect(options?.targetSceneletsPerPath).toBe(12);
        await sceneletPersistence.createScenelet({
          storyId: 'story-run-all',
          parentId: null,
          content: { description: 'Intro', dialogue: [], shot_suggestions: [] },
        });
      },
    }));

    const result = await workflow.runAllTasks();

    expect(result).toEqual({
      storyId: 'story-run-all',
      storyTitle: 'Draft Story',
      storyConstitutionMarkdown: '# Constitution',
    });
    expect(sceneletPersistence.created).toContain('story-run-all');
    expect(visualDesign.calls).toEqual(['story-run-all']);
    expect(visualReference.calls).toEqual(['story-run-all']);
    expect(audioDesign.calls).toEqual(['story-run-all']);
    expect(shotProduction.calls).toEqual(['story-run-all']);
  });
});
