import { describe, expect, it, vi } from 'vitest';

import { assembleShotAudioPrompt } from '../src/shot-audio/promptAssembler.js';
import { runShotAudioTask } from '../src/shot-audio/shotAudioTask.js';
import type { ShotAudioTaskDependencies, ShotAudioPrompt } from '../src/shot-audio/types.js';
import { ShotAudioTaskError } from '../src/shot-audio/errors.js';
import type { AgentWorkflowStoryRecord } from '../src/workflow/types.js';
import type { ShotRecord } from '../src/shot-production/types.js';
import { SKIPPED_AUDIO_PLACEHOLDER } from '../src/shot-audio/constants.js';
import type { SceneletRecord } from '../src/interactive-story/types.js';

function createStory(): AgentWorkflowStoryRecord {
  return {
    id: 'story-123',
    displayName: 'Test Story',
    initialPrompt: 'Prompt',
    storyConstitution: null,
    visualDesignDocument: null,
    audioDesignDocument: {
      sonic_identity: {
        musical_direction: 'Direction',
        sound_effect_philosophy: 'Philosophy',
      },
      narrator_voice_profile: {
        character_id: 'narrator',
        voice_profile: 'Narrator profile.',
        voice_name: 'Kore',
      },
      character_voice_profiles: [
        {
          character_id: 'rhea',
          character_name: 'Rhea',
          voice_profile: 'Profile',
          voice_name: 'Puck',
        },
      ],
      music_and_ambience_cues: [],
    },
    visualReferencePackage: null,
  };
}

function createShotRecord(overrides: Partial<ShotRecord> = {}): ShotRecord {
  return {
    sceneletRef: overrides.sceneletRef ?? 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    sceneletId: overrides.sceneletId ?? 'scenelet-1',
    sceneletSequence: overrides.sceneletSequence ?? 1,
    shotIndex: overrides.shotIndex ?? 1,
    storyboardPayload:
      overrides.storyboardPayload ??
      ({
        audioAndNarrative: [
          {
            type: 'monologue',
            source: 'narrator',
            line: 'Narration',
            delivery: 'warm',
          },
        ],
      } as any),
    keyFrameImagePath: overrides.keyFrameImagePath,
    audioFilePath: overrides.audioFilePath,
    createdAt: overrides.createdAt ?? '2025-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2025-01-01T00:00:00.000Z',
} as ShotRecord;
}

function createSceneletRecordStub(overrides: Partial<SceneletRecord> = {}): SceneletRecord {
  return {
    id: overrides.id ?? 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    storyId: overrides.storyId ?? 'story-123',
    parentId: overrides.parentId ?? null,
    choiceLabelFromParent: overrides.choiceLabelFromParent ?? null,
    choicePrompt: overrides.choicePrompt ?? null,
    branchAudioFilePath: overrides.branchAudioFilePath,
    content:
      overrides.content ??
      {
        description: 'Scenelet description',
        dialogue: [],
        shot_suggestions: [],
      },
    isBranchPoint: overrides.isBranchPoint ?? false,
    isTerminalNode: overrides.isTerminalNode ?? false,
    createdAt: overrides.createdAt ?? '2025-01-01T00:00:00.000Z',
  };
}

type DependencyOverrides = Partial<ShotAudioTaskDependencies> & {
  scenelets?: SceneletRecord[];
};

function createDependencies(shot: ShotRecord, overrides: DependencyOverrides = {}) {
  const story = createStory();
  const savedPaths: string[] = [];
  const savedBranchPaths: string[] = [];
  const synthesize = vi.fn<[], Promise<Buffer>>().mockResolvedValue(Buffer.from('fake-wav'));
  const saveShotAudio = vi.fn().mockImplementation(async () => {
    const path = `generated/story-123/shots/${shot.sceneletId}/1_audio.wav`;
    savedPaths.push(path);
    return {
      relativePath: path,
      absolutePath: `/abs/${path}`,
    };
  });

  const updateShotAudioPath = vi.fn(async (_storyId: string, _sceneletId: string, _shotIndex: number, audioPath: string | null) => {
    shot.audioFilePath = audioPath ?? null;
    return shot;
  });

  const scenelets: SceneletRecord[] = overrides.scenelets
    ? overrides.scenelets.map((scenelet) => ({ ...scenelet }))
    : [];

  const updateBranchAudioPath = vi.fn(
    async (_storyId: string, sceneletId: string, audioPath: string | null) => {
      const target = scenelets.find((entry) => entry.id === sceneletId);
      if (target) {
        target.branchAudioFilePath = audioPath ?? undefined;
      }
      return (
        target ?? {
          id: sceneletId,
          storyId: _storyId,
          parentId: null,
          choiceLabelFromParent: null,
          choicePrompt: null,
          branchAudioFilePath: audioPath ?? undefined,
          content: {},
          isBranchPoint: false,
          isTerminalNode: false,
          createdAt: new Date().toISOString(),
        }
      );
    }
  );

  const sceneletPersistence =
    overrides.sceneletPersistence ??
    ({
      createScenelet: vi.fn(),
      markSceneletAsBranchPoint: vi.fn(),
      markSceneletAsTerminal: vi.fn(),
      hasSceneletsForStory: vi.fn(async () => scenelets.length > 0),
      listSceneletsByStory: vi.fn(async () => scenelets),
      updateBranchAudioPath,
    } as any);

  const saveBranchAudio = vi.fn().mockImplementation(async ({ sceneletId }) => {
    const path = `generated/story-123/branches/${sceneletId}/branch_audio.wav`;
    savedBranchPaths.push(path);
    return {
      relativePath: path,
      absolutePath: `/abs/${path}`,
    };
  });

  const dependencies: ShotAudioTaskDependencies = {
    storiesRepository: overrides.storiesRepository ?? ({
      getStoryById: vi.fn(async () => story),
      createStory: vi.fn(),
      updateStoryArtifacts: vi.fn(),
    } as any),
    shotsRepository: overrides.shotsRepository ?? ({
      getShotsByStory: vi.fn(async () => ({
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': [shot],
      })),
      getShotsBySceneletRef: vi.fn(async () => [shot]),
      createSceneletShots: vi.fn(),
      findSceneletIdsMissingShots: vi.fn(),
      findShotsMissingImages: vi.fn(),
      updateShotImagePaths: vi.fn(),
      updateShotAudioPath,
    } as any),
    sceneletPersistence,
    promptAssembler: overrides.promptAssembler ?? (() => ({
      prompt: '{}',
      speakers: [{ speaker: 'narrator', voiceName: 'Kore' }],
      mode: 'single',
    } as ShotAudioPrompt)),
    speakerAnalyzer: overrides.speakerAnalyzer ?? (() => ({
      mode: 'single',
      speakers: ['narrator'],
    })),
    geminiClient: overrides.geminiClient ?? ({
      synthesize,
    }) as any,
    audioFileStorage: overrides.audioFileStorage ?? ({
      saveShotAudio,
      saveBranchAudio,
    }) as any,
    mode: overrides.mode,
    targetSceneletId: overrides.targetSceneletId,
    targetShotIndex: overrides.targetShotIndex,
    verbose: overrides.verbose,
    logger: overrides.logger,
  };

  return {
    dependencies,
    synthesize,
    saveShotAudio,
    saveBranchAudio,
    updateShotAudioPath,
    updateBranchAudioPath,
    savedPaths,
    savedBranchPaths,
    scenelets,
  };
}

describe('runShotAudioTask', () => {
  it('generates audio for shots without existing paths', async () => {
    const shot = createShotRecord({ audioFilePath: undefined });
    const { dependencies, synthesize, saveShotAudio, updateShotAudioPath, savedPaths } = createDependencies(shot);

    const result = await runShotAudioTask('story-123', dependencies);

    expect(result).toEqual({
      generatedAudio: 1,
      skippedShots: 0,
      totalShots: 1,
      generatedBranchAudio: 0,
      skippedBranchAudio: 0,
      totalBranchScenelets: 0,
    });
    expect(synthesize).toHaveBeenCalledTimes(1);
    expect(saveShotAudio).toHaveBeenCalledTimes(1);
    expect(updateShotAudioPath).toHaveBeenCalledWith(
      'story-123',
      'scenelet-1',
      1,
      savedPaths[0]
    );
    expect(shot.audioFilePath).toBe(savedPaths[0]);
  });

  it('skips shots that have empty audioAndNarrative arrays', async () => {
    const shot = createShotRecord({
      audioFilePath: undefined,
      storyboardPayload: {
        audioAndNarrative: [],
      } as any,
    });

    const speakerAnalyzer = vi.fn();
    const promptAssembler = vi.fn();
    const logger = { debug: vi.fn() };

    const { dependencies, synthesize, saveShotAudio, updateShotAudioPath } = createDependencies(shot, {
      speakerAnalyzer: speakerAnalyzer as any,
      promptAssembler: promptAssembler as any,
      logger,
    });

    const result = await runShotAudioTask('story-123', dependencies);

    expect(result.generatedAudio).toBe(0);
    expect(result.skippedShots).toBe(1);
    expect(result.totalShots).toBe(1);
    expect(result.generatedBranchAudio).toBe(0);
    expect(result.skippedBranchAudio).toBe(0);
    expect(result.totalBranchScenelets).toBe(0);
    expect(speakerAnalyzer).not.toHaveBeenCalled();
    expect(promptAssembler).not.toHaveBeenCalled();
    expect(synthesize).not.toHaveBeenCalled();
    expect(saveShotAudio).not.toHaveBeenCalled();
    expect(updateShotAudioPath).toHaveBeenCalledWith('story-123', 'scenelet-1', 1, SKIPPED_AUDIO_PLACEHOLDER);
    expect(shot.audioFilePath).toBe(SKIPPED_AUDIO_PLACEHOLDER);
    expect(logger.debug).toHaveBeenCalledWith('Skipping shot audio generation: no audio entries in storyboard.', {
      storyId: 'story-123',
      sceneletId: 'scenelet-1',
      shotIndex: 1,
    });
  });

  it('throws in default mode when audio already exists', async () => {
    const shot = createShotRecord({ audioFilePath: 'generated/story-123/shots/scenelet-1/1_audio.wav' });
    const { dependencies } = createDependencies(shot);

    await expect(runShotAudioTask('story-123', dependencies)).rejects.toBeInstanceOf(ShotAudioTaskError);
  });

  it('skips shots in resume mode when audio exists', async () => {
    const shot = createShotRecord({ audioFilePath: 'generated/story-123/shots/scenelet-1/1_audio.wav' });
    const { dependencies, synthesize, saveShotAudio, updateShotAudioPath } = createDependencies(shot, {
      mode: 'resume',
    });

    const result = await runShotAudioTask('story-123', dependencies);

    expect(result.generatedAudio).toBe(0);
    expect(result.skippedShots).toBe(1);
    expect(result.totalShots).toBe(1);
    expect(result.generatedBranchAudio).toBe(0);
    expect(result.skippedBranchAudio).toBe(0);
    expect(result.totalBranchScenelets).toBe(0);
    expect(synthesize).not.toHaveBeenCalled();
    expect(saveShotAudio).not.toHaveBeenCalled();
    expect(updateShotAudioPath).not.toHaveBeenCalled();
  });

  it('regenerates audio in override mode', async () => {
    const shot = createShotRecord({ audioFilePath: 'generated/story-123/shots/scenelet-1/1_audio.wav' });
    const { dependencies, synthesize, saveShotAudio, updateShotAudioPath } = createDependencies(shot, {
      mode: 'override',
    });

    const result = await runShotAudioTask('story-123', dependencies);

    expect(result).toEqual({
      generatedAudio: 1,
      skippedShots: 0,
      totalShots: 1,
      generatedBranchAudio: 0,
      skippedBranchAudio: 0,
      totalBranchScenelets: 0,
    });
    expect(synthesize).toHaveBeenCalledTimes(1);
    expect(saveShotAudio).toHaveBeenCalledTimes(1);
    expect(updateShotAudioPath).toHaveBeenCalledTimes(1);
  });

  it('handles audio design documents persisted under audio_design_document wrapper', async () => {
    const shot = createShotRecord({ audioFilePath: undefined });
    const story = createStory();
    const nestedAudioDesign = story.audioDesignDocument;
    story.audioDesignDocument = {
      audio_design_document: nestedAudioDesign,
    } as any;

    const { dependencies, synthesize, saveShotAudio, updateShotAudioPath, savedPaths } = createDependencies(shot, {
      storiesRepository: {
        getStoryById: vi.fn(async () => story),
        createStory: vi.fn(),
        updateStoryArtifacts: vi.fn(),
      } as any,
      promptAssembler: assembleShotAudioPrompt,
    });

    const result = await runShotAudioTask('story-123', dependencies);

    expect(result).toEqual({
      generatedAudio: 1,
      skippedShots: 0,
      totalShots: 1,
      generatedBranchAudio: 0,
      skippedBranchAudio: 0,
      totalBranchScenelets: 0,
    });
    expect(synthesize).toHaveBeenCalledTimes(1);
    expect(saveShotAudio).toHaveBeenCalledTimes(1);
    expect(updateShotAudioPath).toHaveBeenCalledWith(
      'story-123',
      'scenelet-1',
      1,
      savedPaths[0]
    );
    expect(shot.audioFilePath).toBe(savedPaths[0]);
  });

  it('generates branch audio for branching scenelets', async () => {
    const shot = createShotRecord({ audioFilePath: undefined });
    const branchSceneletId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const branchScenelet = createSceneletRecordStub({
      id: branchSceneletId,
      isBranchPoint: true,
      choicePrompt: 'Where should we explore next?',
      createdAt: '2025-01-01T00:00:00.000Z',
    });
    const choiceA = createSceneletRecordStub({
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      parentId: branchSceneletId,
      choiceLabelFromParent: 'Enter the cave',
      createdAt: '2025-01-02T00:00:00.000Z',
    });
    const choiceB = createSceneletRecordStub({
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      parentId: branchSceneletId,
      choiceLabelFromParent: 'Follow the river',
      createdAt: '2025-01-03T00:00:00.000Z',
    });

    const { dependencies, synthesize, saveBranchAudio, updateBranchAudioPath, scenelets, savedBranchPaths } =
      createDependencies(shot, {
        scenelets: [branchScenelet, choiceA, choiceB],
      });

    const result = await runShotAudioTask('story-123', dependencies);

    expect(result).toEqual({
      generatedAudio: 1,
      skippedShots: 0,
      totalShots: 1,
      generatedBranchAudio: 1,
      skippedBranchAudio: 0,
      totalBranchScenelets: 1,
    });
    expect(synthesize).toHaveBeenCalledTimes(2);
    expect(saveBranchAudio).toHaveBeenCalledTimes(1);
    expect(saveBranchAudio.mock.calls[0]?.[0]).toMatchObject({
      storyId: 'story-123',
      sceneletId: 'scenelet-1',
    });
    expect(updateBranchAudioPath).toHaveBeenCalledWith(
      'story-123',
      branchSceneletId,
      'generated/story-123/branches/scenelet-1/branch_audio.wav'
    );
    expect(scenelets[0]?.branchAudioFilePath).toBe(
      'generated/story-123/branches/scenelet-1/branch_audio.wav'
    );
    expect(savedBranchPaths).toContain(
      'generated/story-123/branches/scenelet-1/branch_audio.wav'
    );
  });

  it('skips branch audio generation when prompt or choices are incomplete', async () => {
    const shot = createShotRecord({ audioFilePath: undefined });
    const branchSceneletId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const branchScenelet = createSceneletRecordStub({
      id: branchSceneletId,
      isBranchPoint: true,
      choicePrompt: null,
      createdAt: '2025-01-01T00:00:00.000Z',
    });
    const incompleteChoice = createSceneletRecordStub({
      id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      parentId: branchSceneletId,
      choiceLabelFromParent: null,
      createdAt: '2025-01-02T00:00:00.000Z',
    });

    const logger = { debug: vi.fn() };

    const { dependencies, saveBranchAudio, updateBranchAudioPath, scenelets } = createDependencies(shot, {
      scenelets: [branchScenelet, incompleteChoice],
      logger,
    });

    const result = await runShotAudioTask('story-123', dependencies);

    expect(result).toEqual({
      generatedAudio: 1,
      skippedShots: 0,
      totalShots: 1,
      generatedBranchAudio: 0,
      skippedBranchAudio: 1,
      totalBranchScenelets: 1,
    });
    expect(saveBranchAudio).not.toHaveBeenCalled();
    expect(updateBranchAudioPath).toHaveBeenCalledWith(
      'story-123',
      branchSceneletId,
      SKIPPED_AUDIO_PLACEHOLDER
    );
    expect(scenelets[0]?.branchAudioFilePath).toBe(SKIPPED_AUDIO_PLACEHOLDER);
    expect(logger.debug).toHaveBeenCalledWith(
      'Skipping branch audio generation: missing prompt or choice labels.',
      expect.objectContaining({
        storyId: 'story-123',
        sceneletId: 'scenelet-1',
        branchSceneletId,
      })
    );
  });

  it('throws in default mode when branch audio already exists', async () => {
    const shot = createShotRecord({ audioFilePath: undefined });
    const branchSceneletId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const branchScenelet = createSceneletRecordStub({
      id: branchSceneletId,
      isBranchPoint: true,
      choicePrompt: 'Choose wisely',
      branchAudioFilePath: 'generated/story-123/branches/scenelet-1/branch_audio.wav',
    });
    const choiceA = createSceneletRecordStub({
      id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      parentId: branchSceneletId,
      choiceLabelFromParent: 'Option A',
    });
    const choiceB = createSceneletRecordStub({
      id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      parentId: branchSceneletId,
      choiceLabelFromParent: 'Option B',
    });

    const { dependencies } = createDependencies(shot, {
      scenelets: [branchScenelet, choiceA, choiceB],
    });

    await expect(runShotAudioTask('story-123', dependencies)).rejects.toBeInstanceOf(
      ShotAudioTaskError
    );
  });

  it('skips branch audio in resume mode when audio already exists or was previously skipped', async () => {
    const shot = createShotRecord({ audioFilePath: undefined });
    const branchSceneletId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const branchScenelet = createSceneletRecordStub({
      id: branchSceneletId,
      isBranchPoint: true,
      choicePrompt: 'What now?',
      branchAudioFilePath: 'generated/story-123/branches/scenelet-1/branch_audio.wav',
    });
    const placeholderScenelet = createSceneletRecordStub({
      id: 'gggggggg-gggg-gggg-gggg-gggggggggggg',
      isBranchPoint: true,
      choicePrompt: 'Pick a path',
      branchAudioFilePath: SKIPPED_AUDIO_PLACEHOLDER,
    });

    const { dependencies, saveBranchAudio, updateBranchAudioPath } = createDependencies(shot, {
      scenelets: [branchScenelet, placeholderScenelet],
      mode: 'resume',
    });

    const result = await runShotAudioTask('story-123', dependencies);

    expect(result).toEqual({
      generatedAudio: 1,
      skippedShots: 0,
      totalShots: 1,
      generatedBranchAudio: 0,
      skippedBranchAudio: 2,
      totalBranchScenelets: 2,
    });
    expect(saveBranchAudio).not.toHaveBeenCalled();
    expect(updateBranchAudioPath).not.toHaveBeenCalled();
  });
});
