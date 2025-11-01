import { describe, expect, it, vi } from 'vitest';

import { runShotProductionTask } from '../src/shot-production/shotProductionTask.js';
import { ShotProductionTaskError } from '../src/shot-production/errors.js';
import type {
  ShotProductionShotsRepository,
  ShotProductionTaskDependencies,
  ShotProductionTaskResult,
} from '../src/shot-production/types.js';
import type { AgentWorkflowStoryRecord, AgentWorkflowStoriesRepository } from '../src/workflow/types.js';
import type { StoryTreeSnapshot } from '../src/story-storage/types.js';
import { StoryTreeAssemblyError } from '../src/story-storage/errors.js';

function createStory(overrides: Partial<AgentWorkflowStoryRecord> = {}): AgentWorkflowStoryRecord {
  return {
    id: overrides.id ?? 'story-1',
    displayName: overrides.displayName ?? 'Draft Story',
    initialPrompt: overrides.initialPrompt ?? 'Prompt',
    storyConstitution:
      overrides.storyConstitution ?? {
        proposedStoryTitle: 'Draft Story',
        storyConstitutionMarkdown: '# Constitution',
        targetSceneletsPerPath: 12,
      },
    visualDesignDocument:
      overrides.visualDesignDocument ?? {
        character_designs: [{ character_id: 'narrator' }],
        environment_designs: [{ environment_id: 'control-lab' }],
      },
    audioDesignDocument:
      overrides.audioDesignDocument ?? { audio_design_document: { cues: [] } },
    visualReferencePackage: overrides.visualReferencePackage ?? null,
  };
}

function createStoriesRepository(record: AgentWorkflowStoryRecord): AgentWorkflowStoriesRepository {
  return {
    async createStory() {
      throw new Error('not implemented');
    },
    async updateStoryArtifacts() {
      throw new Error('not implemented');
    },
    async getStoryById(storyId) {
      return storyId === record.id ? record : null;
    },
  };
}

function createShotsRepository(existingKeys: Set<string> = new Set<string>()): ShotProductionShotsRepository & {
  inserts: Array<{
    storyId: string;
    sceneletRef: string;
    sceneletId: string;
    sequence: number;
    shotIndices: number[];
  }>;
} {
  const inserts: Array<{
    storyId: string;
    sceneletRef: string;
    sceneletId: string;
    sequence: number;
    shotIndices: number[];
  }> = [];

  return {
    inserts,
    async createSceneletShots(storyId, sceneletRef, sceneletId, sequence, shots) {
      const key = `${storyId}:${sceneletId}`;
      if (existingKeys.has(key)) {
        throw new Error('Shots already exist');
      }
      existingKeys.add(key);
      inserts.push({
        storyId,
        sceneletRef,
        sceneletId,
        sequence,
        shotIndices: shots.map((shot) => shot.shotIndex),
      });
    },
    async findSceneletIdsMissingShots(storyId, sceneletIds) {
      return sceneletIds.filter((id) => !existingKeys.has(`${storyId}:${id}`));
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
    async updateShotImagePaths(_storyId, _sceneletId, _shotIndex, _paths) {
      // Mock implementation
    },
  };
}

const STORY_TREE: StoryTreeSnapshot = {
  entries: [
    {
      kind: 'scenelet',
      id: '11111111-1111-1111-1111-111111111111',
      data: {
        id: 'scenelet-1',
        parentId: null,
        role: 'root',
        description: 'Intro',
        dialogue: [
          { character: 'Narrator', line: 'Welcome.' },
        ],
        shotSuggestions: ['Wide establishing shot'],
      },
    },
    {
      kind: 'scenelet',
      id: '22222222-2222-2222-2222-222222222222',
      data: {
        id: 'scenelet-2',
        parentId: 'scenelet-1',
        role: 'linear',
        description: 'Follow up',
        dialogue: [
          { character: 'Narrator', line: 'Continue.' },
        ],
        shotSuggestions: [],
      },
    },
  ],
  yaml: '- scenelet-1:\n  role: root\n  description: "Intro"\n  dialogue: []\n  shot_suggestions: []',
};

function createDependencies(overrides: Partial<ShotProductionTaskDependencies> = {}): ShotProductionTaskDependencies {
  if (!overrides.storiesRepository) {
    throw new Error('storiesRepository must be provided.');
  }
  if (!overrides.shotsRepository) {
    throw new Error('shotsRepository must be provided.');
  }

  const dependencies: ShotProductionTaskDependencies = {
    shotsRepository: overrides.shotsRepository,
    storiesRepository: overrides.storiesRepository,
    storyTreeLoader: overrides.storyTreeLoader ?? (async () => STORY_TREE),
    promptLoader: overrides.promptLoader ?? (async () => 'Shot production system prompt'),
    geminiClient: overrides.geminiClient ?? {
      generateJson: vi.fn(async () => buildValidShotResponse('scenelet-1', 'Welcome.')),
    },
    geminiOptions: overrides.geminiOptions,
    logger: overrides.logger,
  } satisfies ShotProductionTaskDependencies;

  if (overrides.resumeExisting !== undefined) {
    dependencies.resumeExisting = overrides.resumeExisting;
  }

  return dependencies;
}

function buildValidShotResponse(sceneletId: string, dialogueLine: string): string {
  return JSON.stringify({
    scenelet_id: sceneletId,
    shots: [
      {
        shot_index: 1,
        storyboard_entry: {
          framing_and_angle:
            'Detailed framing description over eighty characters to satisfy validation steps successfully.',
          composition_and_content:
            'Richly described composition for the shot meeting length checks for validation path requirements.',
          character_action_and_emotion:
            'Character expression and action articulated in lengthy prose to clear validations consistently throughout.',
          camera_dynamics:
            'Camera motion discussed in depth including motivation, start and end beats, and timing nuance beyond minimums.',
          lighting_and_atmosphere:
            'Lighting description elaborating on mood, highlights, and shadows beyond the constraints set by validators.',
          continuity_notes:
            'Continuity notes cover props and staging ensuring textual length requirements are met alongside blocking.',
          referenced_designs: {
            characters: ['narrator'],
            environments: ['control-lab'],
          },
          audio_and_narrative: [
            {
              type: 'dialogue',
              source: 'narrator',
              line: dialogueLine,
              delivery: 'Warm and inviting, drawing listeners in with calm assurance.',
            },
          ],
        },
      },
    ],
  });
}

describe('runShotProductionTask', () => {
  it('persists shots for each scenelet and returns summary', async () => {
    const story = createStory();
    const storiesRepository = createStoriesRepository(story);
    const shotsRepository = createShotsRepository();
    const geminiClient = {
      generateJson: vi
        .fn()
        .mockResolvedValueOnce(buildValidShotResponse('scenelet-1', 'Welcome.'))
        .mockResolvedValueOnce(buildValidShotResponse('scenelet-2', 'Continue.')),
    };

    const result = await runShotProductionTask('story-1', createDependencies({
      storiesRepository,
      shotsRepository,
      geminiClient,
    }));

    expect(result).toEqual<ShotProductionTaskResult>({
      storyId: 'story-1',
      scenelets: [
        { sceneletId: 'scenelet-1', shotCount: 1 },
        { sceneletId: 'scenelet-2', shotCount: 1 },
      ],
      totalShots: 2,
    });
    expect(shotsRepository.inserts).toHaveLength(2);
    expect(shotsRepository.inserts[0]).toMatchObject({
      sceneletRef: '11111111-1111-1111-1111-111111111111',
      sceneletId: 'scenelet-1',
      sequence: 1,
      shotIndices: [1],
    });
    expect(shotsRepository.inserts[1]).toMatchObject({
      sceneletRef: '22222222-2222-2222-2222-222222222222',
      sceneletId: 'scenelet-2',
      sequence: 2,
      shotIndices: [1],
    });
    expect(geminiClient.generateJson).toHaveBeenCalledTimes(2);
  });

  it('resumes remaining scenelets when resumeExisting enabled', async () => {
    const story = createStory();
    const storiesRepository = createStoriesRepository(story);
    const existing = new Set<string>(['story-1:scenelet-1']);
    const shotsRepository = createShotsRepository(existing);
    const geminiClient = {
      generateJson: vi
        .fn()
        .mockResolvedValueOnce(buildValidShotResponse('scenelet-2', 'Continue.')),
    };

    const result = await runShotProductionTask(
      'story-1',
      createDependencies({
        storiesRepository,
        shotsRepository,
        geminiClient,
        resumeExisting: true,
      })
    );

    expect(result).toEqual<ShotProductionTaskResult>({
      storyId: 'story-1',
      scenelets: [{ sceneletId: 'scenelet-2', shotCount: 1 }],
      totalShots: 1,
    });
    expect(shotsRepository.inserts).toHaveLength(1);
    expect(shotsRepository.inserts[0]).toMatchObject({
      sceneletRef: '22222222-2222-2222-2222-222222222222',
      sceneletId: 'scenelet-2',
      sequence: 2,
      shotIndices: [1],
    });
    expect(geminiClient.generateJson).toHaveBeenCalledTimes(1);
  });

  it('retries Gemini validation failures before succeeding', async () => {
    const story = createStory();
    const storiesRepository = createStoriesRepository(story);
    const shotsRepository = createShotsRepository();
    const geminiClient = {
      generateJson: vi
        .fn()
        .mockResolvedValueOnce('{}')
        .mockResolvedValueOnce(buildValidShotResponse('scenelet-1', 'Welcome.'))
        .mockResolvedValueOnce(buildValidShotResponse('scenelet-2', 'Continue.')),
    };

    const result = await runShotProductionTask(
      'story-1',
      createDependencies({
        storiesRepository,
        shotsRepository,
        geminiClient,
      })
    );

    expect(result.totalShots).toBe(2);
    expect(shotsRepository.inserts).toHaveLength(2);
    expect(geminiClient.generateJson).toHaveBeenCalledTimes(3);
  });

  it('skips generation when resumeExisting is true and all scenelets covered', async () => {
    const story = createStory();
    const storiesRepository = createStoriesRepository(story);
    const existing = new Set<string>(['story-1:scenelet-1', 'story-1:scenelet-2']);
    const shotsRepository = createShotsRepository(existing);
    const geminiClient = {
      generateJson: vi.fn(),
    };

    const result = await runShotProductionTask(
      'story-1',
      createDependencies({
        storiesRepository,
        shotsRepository,
        geminiClient,
        resumeExisting: true,
      })
    );

    expect(result).toEqual<ShotProductionTaskResult>({
      storyId: 'story-1',
      scenelets: [],
      totalShots: 0,
    });
    expect(shotsRepository.inserts).toHaveLength(0);
    expect(geminiClient.generateJson).not.toHaveBeenCalled();
  });

  it('throws when constitution is missing', async () => {
    const story = createStory({ storyConstitution: null });
    const storiesRepository = createStoriesRepository(story);
    const shotsRepository = createShotsRepository();

    await expect(
      runShotProductionTask('story-1', createDependencies({ storiesRepository, shotsRepository }))
    ).rejects.toThrow(ShotProductionTaskError);
  });

  it('throws when shots already exist for all scenelets', async () => {
    const story = createStory();
    const storiesRepository = createStoriesRepository(story);
    const existing = new Set<string>(['story-1:scenelet-1', 'story-1:scenelet-2']);
    const shotsRepository = createShotsRepository(existing);

    await expect(
      runShotProductionTask('story-1', createDependencies({ storiesRepository, shotsRepository }))
    ).rejects.toThrow(/already has stored shots/i);
  });

  it('converts StoryTreeAssemblyError into task failure', async () => {
    const story = createStory();
    const storiesRepository = createStoriesRepository(story);
    const shotsRepository = createShotsRepository();

    await expect(
      runShotProductionTask('story-1', createDependencies({
        storiesRepository,
        shotsRepository,
        storyTreeLoader: async () => {
          throw new StoryTreeAssemblyError('No scenelets');
        },
      }))
    ).rejects.toThrow(/Interactive script must be generated before shot production/);
  });
});
