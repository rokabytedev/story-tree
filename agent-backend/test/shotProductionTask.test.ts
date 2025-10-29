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
        character_designs: [{ character_name: 'Narrator' }],
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
    sceneletId: string;
    sequence: number;
    shotIndices: number[];
  }>;
} {
  const inserts: Array<{
    storyId: string;
    sceneletId: string;
    sequence: number;
    shotIndices: number[];
  }> = [];

  return {
    inserts,
    async createSceneletShots(storyId, sceneletId, sequence, shots) {
      const key = `${storyId}:${sceneletId}`;
      if (existingKeys.has(key)) {
        throw new Error('Shots already exist');
      }
      existingKeys.add(key);
      inserts.push({
        storyId,
        sceneletId,
        sequence,
        shotIndices: shots.map((shot) => shot.shotIndex),
      });
    },
    async findSceneletIdsMissingShots(storyId, sceneletIds) {
      return sceneletIds.filter((id) => !existingKeys.has(`${storyId}:${id}`));
    },
  };
}

const STORY_TREE: StoryTreeSnapshot = {
  entries: [
    {
      kind: 'scenelet',
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
      generateJson: vi.fn(async () =>
        JSON.stringify({
          scenelet_id: 'scenelet-1',
          shots: [
            {
              shot_index: 1,
              storyboard_entry: {
                framing_and_angle: 'Wide descriptive framing exceeding eighty characters for validation purposes to ensure compliance.',
                composition_and_content: 'Rich composition details with subject placement clearly articulated beyond the minimum length.',
                character_action_and_emotion: 'Character engages the viewer with expressive emotional cues, articulated thoroughly.',
                dialogue: [
                  { character: 'Narrator', line: 'Welcome.' },
                ],
                camera_dynamics: 'Camera slides forward continuing to describe motion beyond the threshold.',
                lighting_and_atmosphere: 'Atmosphere described with sufficient detail regarding lighting, shadows, and highlights.',
                continuity_notes: 'Continuity notes ensure props, costumes, and placements remain consistent for the scene.',
              },
              generation_prompts: {
                first_frame_prompt: 'Detailed first frame prompt offering color palette, subject arrangement, and context surpassing length requirements.',
                key_frame_storyboard_prompt: 'Key frame prompt elaborating staging, lensing, and camera height while exceeding eighty characters.',
                video_clip_prompt: 'Video prompt referencing pacing, transitions, and camera cues ensuring bright detail. No background music.',
              },
            },
          ],
        })
      ),
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
          dialogue: [
            { character: 'Narrator', line: dialogueLine },
          ],
          camera_dynamics:
            'Camera motion discussed in depth including motivation, start and end beats, and timing nuance beyond minimums.',
          lighting_and_atmosphere:
            'Lighting description elaborating on mood, highlights, and shadows beyond the constraints set by validators.',
          continuity_notes:
            'Continuity notes cover props and staging ensuring textual length requirements are met alongside blocking.',
        },
        generation_prompts: {
          first_frame_prompt:
            'First frame prompt elaborating on composition, materials, and color theory over eighty characters for compliance.',
          key_frame_storyboard_prompt:
            'Storyboard prompt covering blocking, lens, and mise-en-scene across detailed prose beyond the validation limit.',
          video_clip_prompt:
            'Video prompt establishing pacing, transitions, and tonal guidance at sufficient length to pass checks. No background music.',
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
        .mockResolvedValueOnce(
          JSON.stringify({
            scenelet_id: 'scenelet-1',
            shots: [
              {
                shot_index: 1,
                storyboard_entry: {
                  framing_and_angle: 'Detailed framing description over eighty characters to satisfy validation steps successfully.',
                  composition_and_content: 'Richly described composition for the first shot meeting length checks for validation path.',
                  character_action_and_emotion: 'Character expression and action articulated in lengthy prose to clear validations.',
                  dialogue: [
                    { character: 'Narrator', line: 'Welcome.' },
                  ],
                  camera_dynamics: 'Slow tracking motion described thoroughly with more than eighty characters of detail.',
                  lighting_and_atmosphere: 'Lighting description elaborating on mood, highlights, and shadows beyond constraints.',
                  continuity_notes: 'Continuity notes cover props and staging ensuring textual length requirements are met.',
                },
                generation_prompts: {
                  first_frame_prompt: 'First frame prompt elaborating on composition, materials, and color theory over eighty characters.',
                  key_frame_storyboard_prompt: 'Storyboard prompt covering blocking, lens, and mise-en-scene across detailed prose beyond limit.',
                  video_clip_prompt: 'Video prompt establishing pacing, transitions, and tonal guidance at sufficient length. No background music.',
                },
              },
            ],
          })
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            scenelet_id: 'scenelet-2',
            shots: [
              {
                shot_index: 1,
                storyboard_entry: {
                  framing_and_angle: 'Second scenelet framing described in generous detail to exceed the validator minimum threshold.',
                  composition_and_content: 'Composition text for follow-up shot ensuring narrative continuity and exceeding lengths.',
                  character_action_and_emotion: 'Characters engage dynamically with emotional clarity described beyond eighty characters.',
                  dialogue: [
                    { character: 'Narrator', line: 'Continue.' },
                  ],
                  camera_dynamics: 'Camera arcs around the subject across descriptive text ensuring validation success.',
                  lighting_and_atmosphere: 'Lighting for second shot described with nuance including color temperature and shadow interplay.',
                  continuity_notes: 'Continuity details specify prop placements, actor marks, and wardrobe alignment thoroughly.',
                },
                generation_prompts: {
                  first_frame_prompt: 'First frame prompt for scenelet two covered in extended prose covering environment and characters.',
                  key_frame_storyboard_prompt: 'Storyboard prompt continues to detail stage directions, lensing, and movements extensively.',
                  video_clip_prompt: 'Video clip prompt instructs on pacing, transitions, and expression in detail. No background music.',
                },
              },
            ],
          })
        ),
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
      sceneletId: 'scenelet-1',
      sequence: 1,
      shotIndices: [1],
    });
    expect(shotsRepository.inserts[1]).toMatchObject({
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
