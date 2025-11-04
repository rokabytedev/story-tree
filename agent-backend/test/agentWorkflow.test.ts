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
import type { VisualReferenceTaskRunner } from '../src/visual-reference/types.js';
import type { AudioDesignTaskRunner } from '../src/audio-design/types.js';
import type { ShotProductionTaskRunner, ShotProductionShotsRepository, ShotRecord } from '../src/shot-production/types.js';

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
        audioDesignDocument: null,
        visualReferencePackage: null,
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
      if ((patch as { audioDesignDocument?: unknown }).audioDesignDocument !== undefined) {
        repository.record.audioDesignDocument = (patch as { audioDesignDocument?: unknown }).audioDesignDocument ?? null;
      }
      if ((patch as { visualReferencePackage?: unknown }).visualReferencePackage !== undefined) {
        repository.record.visualReferencePackage = (patch as { visualReferencePackage?: unknown }).visualReferencePackage ?? null;
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
  const records: Array<{
    id: string;
    storyId: string;
    parentId: string | null;
    choiceLabelFromParent: string | null;
    choicePrompt: string | null;
    content: unknown;
    isBranchPoint: boolean;
    isTerminalNode: boolean;
    createdAt: string;
  }> = [];

  return {
    get created() {
      return created;
    },
    async hasSceneletsForStory(storyId: string) {
      return records.some((record) => record.storyId === storyId);
    },
    async listSceneletsByStory(storyId: string) {
      return records.filter((record) => record.storyId === storyId);
    },
    async createScenelet(input) {
      created += 1;
      const record = {
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
      records.push(record);
      return record;
    },
    async markSceneletAsBranchPoint() {},
    async markSceneletAsTerminal() {},
  };
}

function createShotsRepository(): ShotProductionShotsRepository & {
  created: Array<{ storyId: string; sceneletRef: string; sceneletId: string }>;
} {
  const created: Array<{ storyId: string; sceneletRef: string; sceneletId: string }> = [];
  const existing = new Set<string>();
  const shotsByStory = new Map<string, Record<string, ShotRecord[]>>();

  return {
    created,
    async createSceneletShots(storyId, sceneletRef, sceneletId, sequence, shots) {
      const key = `${storyId}:${sceneletId}`;
      if (existing.has(key)) {
        throw new Error('Duplicate shots');
      }
      existing.add(key);
      created.push({ storyId, sceneletRef, sceneletId });

      const records = shots.map<ShotRecord>((shot) => ({
        sceneletRef,
        sceneletId,
        sceneletSequence: sequence,
        shotIndex: shot.shotIndex,
        storyboardPayload: shot.storyboardPayload,
        keyFrameImagePath: undefined,
        audioFilePath: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      const current = shotsByStory.get(storyId) ?? {};
      current[sceneletRef] = records;
      shotsByStory.set(storyId, current);
    },
    async findSceneletIdsMissingShots(storyId, sceneletIds) {
      return sceneletIds.filter((id) => !existing.has(`${storyId}:${id}`));
    },
    async getShotsByStory(storyId) {
      return shotsByStory.get(storyId) ?? {};
    },
    async getShotsBySceneletRef(sceneletRef) {
      for (const storyShots of shotsByStory.values()) {
        if (storyShots[sceneletRef]) {
          return storyShots[sceneletRef];
        }
      }
      return [];
    },
    async findShotsMissingImages(_storyId) {
      return [];
    },
    async findShotsMissingVideos(_storyId, _options) {
      return [];
    },
    async updateShotImagePaths(_storyId, _sceneletId, _shotIndex, _paths) {
      // Mock implementation
    },
    async updateShotAudioPath(storyId, sceneletId, shotIndex, audioPath) {
      const storyShots = shotsByStory.get(storyId);
      if (storyShots) {
        for (const [sceneletRef, records] of Object.entries(storyShots)) {
          for (const record of records) {
            if (record.sceneletId === sceneletId && record.shotIndex === shotIndex) {
              record.audioFilePath = audioPath ?? null;
              record.updatedAt = new Date().toISOString();
              return record;
            }
          }
        }
      }

      return {
        sceneletRef: 'mock-ref',
        sceneletId: sceneletId,
        sceneletSequence: 1,
        shotIndex,
        storyboardPayload: {},
        videoFilePath: undefined,
        audioFilePath: audioPath ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as ShotRecord;
    },
    async updateShotVideoPath(storyId, sceneletId, shotIndex, videoPath) {
      const storyShots = shotsByStory.get(storyId);
      if (storyShots) {
        for (const records of Object.values(storyShots)) {
          for (const record of records) {
            if (record.sceneletId === sceneletId && record.shotIndex === shotIndex) {
              record.videoFilePath = videoPath ?? undefined;
              record.updatedAt = new Date().toISOString();
              return record;
            }
          }
        }
      }

      return {
        sceneletRef: 'mock-ref',
        sceneletId,
        sceneletSequence: 1,
        shotIndex,
        storyboardPayload: {},
        videoFilePath: videoPath ?? undefined,
        audioFilePath: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as ShotRecord;
    },
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
    const shotsRepository = createShotsRepository();
    const storyTreeLoader = async () => VISUAL_STORY_TREE;
    const visualDesignRunner: VisualDesignTaskRunner = async (storyId) => {
      storiesRepository.record!.visualDesignDocument = { stub: true };
      return {
        storyId,
        visualDesignDocument: { stub: true },
      };
    };
    const visualReferenceRunner: VisualReferenceTaskRunner = async (storyId) => {
      storiesRepository.record!.visualReferencePackage = {
        character_model_sheets: [],
        environment_keyframes: []
      };
      return {
        storyId,
        visualReferencePackage: {
          character_model_sheets: [],
          environment_keyframes: []
        },
      };
    };
    const audioRunner: AudioDesignTaskRunner = async (storyId) => {
      const document = {
        audio_design_document: {
          sonic_identity: {},
          narrator_voice_profile: {
            character_id: 'narrator',
            voice_name: 'Kore',
            voice_profile: 'Calm narrative guidance with warm tone and measured pacing.',
          },
          character_voice_profiles: [],
          music_and_ambience_cues: [],
        },
      };
      storiesRepository.record!.audioDesignDocument = document;
      return {
        storyId,
        audioDesignDocument: document,
      };
    };
    const shotProductionRunner: ShotProductionTaskRunner = async (storyId) => {
      await shotsRepository.createSceneletShots(storyId, '11111111-1111-1111-1111-111111111111', 'scenelet-1', 1, [
        {
          shotIndex: 1,
          storyboardPayload: {
            audioAndNarrative: [
              {
                type: 'monologue',
                source: 'narrator',
                line: 'Narration',
                delivery: 'calm',
              },
            ],
          },
        },
      ]);
      return {
        storyId,
        scenelets: [{ sceneletId: 'scenelet-1', shotCount: 1 }],
        totalShots: 1,
      };
    };

    const constitutionGenerator: AgentWorkflowConstitutionGenerator = async (prompt) => {
      expect(prompt).toBe('Galactic explorers');
      return {
        proposedStoryTitle: 'Star Trail',
        storyConstitutionMarkdown: '## Constitution',
        targetSceneletsPerPath: 18,
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
      shotsRepository,
      sceneletPersistence,
      generateStoryConstitution: constitutionGenerator,
      generateInteractiveStoryTree: interactiveGenerator,
      initialDisplayNameFactory: () => 'Draft Story',
      interactiveStoryOptions: { timeoutMs: 60_000 },
      storyTreeLoader,
      runVisualDesignTask: visualDesignRunner,
      runVisualReferenceTask: visualReferenceRunner,
      runAudioDesignTask: audioRunner,
      runShotProductionTask: shotProductionRunner,
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
      runShotAudioTask: async (storyId) => ({
        storyId,
        generatedAudio: 0,
        skippedShots: 0,
        totalShots: 0,
        generatedBranchAudio: 0,
        skippedBranchAudio: 0,
        totalBranchScenelets: 0,
      }),
    });

    expect(result.storyTitle).toBe('Star Trail');
    expect(result.storyConstitutionMarkdown).toBe('## Constitution');
    expect(interactiveOptions).toEqual({
      timeoutMs: 60_000,
      sceneletPersistence,
      targetSceneletsPerPath: 18,
    });
    expect(storiesRepository.record?.storyConstitution).toEqual({
      proposedStoryTitle: 'Star Trail',
      storyConstitutionMarkdown: '## Constitution',
      targetSceneletsPerPath: 18,
    });
    expect(storiesRepository.record?.visualDesignDocument).toEqual({ stub: true });
    expect(storiesRepository.record?.visualReferencePackage).toEqual({
      character_model_sheets: [],
      environment_keyframes: []
    });
    expect(storiesRepository.record?.audioDesignDocument).toEqual({
      audio_design_document: {
        sonic_identity: {},
        narrator_voice_profile: {
          character_id: 'narrator',
          voice_name: 'Kore',
          voice_profile: 'Calm narrative guidance with warm tone and measured pacing.',
        },
        character_voice_profiles: [],
        music_and_ambience_cues: [],
      },
    });
    expect(shotsRepository.created).toEqual([
      {
        storyId: result.storyId,
        sceneletId: 'scenelet-1',
        sceneletRef: '11111111-1111-1111-1111-111111111111',
      },
    ]);
  });

  it('uses default display name when no factory provided', async () => {
    const storiesRepository = createStoriesRepository();
    const sceneletPersistence = createSceneletPersistence();
    const shotsRepository = createShotsRepository();
    const storyTreeLoader = async () => VISUAL_STORY_TREE;
    const visualDesignRunner: VisualDesignTaskRunner = async (storyId) => {
      if (storiesRepository.record) {
        storiesRepository.record.visualDesignDocument = {};
      }
      return {
        storyId,
        visualDesignDocument: {},
      };
    };
    const visualReferenceRunner: VisualReferenceTaskRunner = async (storyId) => {
      storiesRepository.record!.visualReferencePackage = {
        character_model_sheets: [],
        environment_keyframes: []
      };
      return {
        storyId,
        visualReferencePackage: {
          character_model_sheets: [],
          environment_keyframes: []
        },
      };
    };
    const audioRunnerStub: AudioDesignTaskRunner = async (storyId) => {
      const document = {
        audio_design_document: {
          sonic_identity: {},
          narrator_voice_profile: {
            character_id: 'narrator',
            voice_name: 'Kore',
            voice_profile: 'Calm narrative guidance with warm tone and measured pacing.',
          },
          character_voice_profiles: [],
          music_and_ambience_cues: [],
        },
      };
      if (storiesRepository.record) {
        storiesRepository.record.audioDesignDocument = document;
      }
      return {
        storyId,
        audioDesignDocument: document,
      };
    };
    const shotProductionRunner: ShotProductionTaskRunner = async (storyId) => {
      await shotsRepository.createSceneletShots(storyId, '11111111-1111-1111-1111-111111111111', 'scenelet-1', 1, [
        {
          shotIndex: 1,
          storyboardPayload: {
            audioAndNarrative: [
              {
                type: 'monologue',
                source: 'narrator',
                line: 'Narration',
                delivery: 'calm',
              },
            ],
          },
        },
      ]);
      return {
        storyId,
        scenelets: [{ sceneletId: 'scenelet-1', shotCount: 1 }],
        totalShots: 1,
      };
    };

    const constitutionGenerator: AgentWorkflowConstitutionGenerator = async () => ({
      proposedStoryTitle: '',
      storyConstitutionMarkdown: '# Constitution',
      targetSceneletsPerPath: 12,
    });

    const interactiveGenerator: AgentWorkflowInteractiveGenerator = async () => {};

    await runAgentWorkflow('Forest quest', {
      storiesRepository,
      shotsRepository,
      sceneletPersistence,
      generateStoryConstitution: constitutionGenerator,
      generateInteractiveStoryTree: interactiveGenerator,
      storyTreeLoader,
      runVisualDesignTask: visualDesignRunner,
      runVisualReferenceTask: visualReferenceRunner,
      runAudioDesignTask: audioRunnerStub,
      runShotProductionTask: shotProductionRunner,
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
      runShotAudioTask: async (storyId) => ({
        storyId,
        generatedAudio: 0,
        skippedShots: 0,
        totalShots: 0,
        generatedBranchAudio: 0,
        skippedBranchAudio: 0,
        totalBranchScenelets: 0,
      }),
    });

    expect(storiesRepository.record?.displayName).toBe('Untitled Story');
  });

  it('propagates generator failures', async () => {
    const storiesRepository = createStoriesRepository();
    const sceneletPersistence = createSceneletPersistence();
    const shotsRepository = createShotsRepository();
    const storyTreeLoader = async () => VISUAL_STORY_TREE;
    const visualDesignRunner: VisualDesignTaskRunner = async (storyId) => {
      if (storiesRepository.record) {
        storiesRepository.record.visualDesignDocument = {};
      }
      return {
        storyId,
        visualDesignDocument: {},
      };
    };
    const visualReferenceRunner: VisualReferenceTaskRunner = async (storyId) => ({
      storyId,
      visualReferencePackage: { character_model_sheets: [], environment_keyframes: [] },
    });
    const audioRunner: AudioDesignTaskRunner = async (storyId) => {
      if (storiesRepository.record) {
        storiesRepository.record.audioDesignDocument = { audio_design_document: { sonic_identity: {} } };
      }
      return {
        storyId,
        audioDesignDocument: { audio_design_document: { sonic_identity: {} } },
      };
    };
    const shotProductionRunner: ShotProductionTaskRunner = async (storyId) => {
      await shotsRepository.createSceneletShots(storyId, '11111111-1111-1111-1111-111111111111', 'scenelet-1', 1, [
        {
          shotIndex: 1,
          storyboardPayload: {
            audioAndNarrative: [
              {
                type: 'monologue',
                source: 'narrator',
                line: 'Narration',
                delivery: 'calm',
              },
            ],
          },
        },
      ]);
      return {
        storyId,
        scenelets: [{ sceneletId: 'scenelet-1', shotCount: 1 }],
        totalShots: 1,
      };
    };

    await expect(
      runAgentWorkflow('Failure prompt', {
        storiesRepository,
        shotsRepository,
        sceneletPersistence,
        generateStoryConstitution: async () => ({
          proposedStoryTitle: 'Failure Title',
          storyConstitutionMarkdown: '## Failure',
          targetSceneletsPerPath: 12,
        }),
        generateInteractiveStoryTree: async () => {
          throw new Error('Interactive generator failed');
        },
        storyTreeLoader,
        runVisualDesignTask: visualDesignRunner,
        runVisualReferenceTask: visualReferenceRunner,
        runAudioDesignTask: audioRunner,
        runShotProductionTask: shotProductionRunner,
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
        runVisualReferenceTask: async (storyId) => ({
          storyId,
          visualReferencePackage: { character_model_sheets: [], environment_keyframes: [] },
        }),
      })
    ).rejects.toThrow(AgentWorkflowError);

    const storiesRepository = createStoriesRepository();
    const shotsRepository = createShotsRepository();
    const storyTreeLoader = async () => VISUAL_STORY_TREE;
    const visualDesignRunner: VisualDesignTaskRunner = async (storyId) => {
      if (storiesRepository.record) {
        storiesRepository.record.visualDesignDocument = {};
      }
      return {
        storyId,
        visualDesignDocument: {},
      };
    };

    await expect(
      runAgentWorkflow('Prompt', {
        storiesRepository,
        shotsRepository,
        // @ts-expect-error intentionally missing persistence
        sceneletPersistence: undefined,
        storyTreeLoader,
        runVisualDesignTask: visualDesignRunner,
        runVisualReferenceTask: async (storyId) => ({
          storyId,
          visualReferencePackage: { character_model_sheets: [], environment_keyframes: [] },
        }),
      })
    ).rejects.toThrow(AgentWorkflowError);
  });

  it('passes constitution options to generator', async () => {
    const storiesRepository = createStoriesRepository();
    const sceneletPersistence = createSceneletPersistence();
    const shotsRepository = createShotsRepository();
    const constitutionOptions = { promptLoader: async () => 'System prompt' };
    const storyTreeLoader = async () => VISUAL_STORY_TREE;
    const visualDesignRunner: VisualDesignTaskRunner = async (storyId) => {
      if (storiesRepository.record) {
        storiesRepository.record.visualDesignDocument = {};
      }
      return {
        storyId,
        visualDesignDocument: {},
      };
    };
    const visualReferenceRunner: VisualReferenceTaskRunner = async (storyId) => {
      storiesRepository.record!.visualReferencePackage = {
        character_model_sheets: [],
        environment_keyframes: []
      };
      return {
        storyId,
        visualReferencePackage: {
          character_model_sheets: [],
          environment_keyframes: []
        },
      };
    };
    const audioRunnerForOptions: AudioDesignTaskRunner = async (storyId) => {
      if (storiesRepository.record) {
        storiesRepository.record.audioDesignDocument = { audio_design_document: { sonic_identity: {} } };
      }
      return {
        storyId,
        audioDesignDocument: { audio_design_document: { sonic_identity: {} } },
      };
    };
    const shotProductionRunner: ShotProductionTaskRunner = async (storyId) => ({
      storyId,
      scenelets: [{ sceneletId: 'scenelet-1', shotCount: 1 }],
      totalShots: 1,
    });

    let receivedOptions: unknown;
    const constitutionGenerator: AgentWorkflowConstitutionGenerator = async (_prompt, options) => {
      receivedOptions = options;
      return {
        proposedStoryTitle: 'Option',
        storyConstitutionMarkdown: '# Constitution',
        targetSceneletsPerPath: 12,
      };
    };

    const interactiveGenerator: AgentWorkflowInteractiveGenerator = async () => {};

    await runAgentWorkflow('Option prompt', {
      storiesRepository,
      shotsRepository,
      sceneletPersistence,
      generateStoryConstitution: constitutionGenerator,
      generateInteractiveStoryTree: interactiveGenerator,
      constitutionOptions,
      storyTreeLoader,
      runVisualDesignTask: visualDesignRunner,
      runVisualReferenceTask: visualReferenceRunner,
      runAudioDesignTask: audioRunnerForOptions,
      runShotProductionTask: shotProductionRunner,
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
      runShotAudioTask: async (storyId) => ({
        storyId,
        generatedAudio: 0,
        skippedShots: 0,
        totalShots: 0,
        generatedBranchAudio: 0,
        skippedBranchAudio: 0,
        totalBranchScenelets: 0,
      }),
    });

    expect(receivedOptions).toEqual(constitutionOptions);
  });
});
