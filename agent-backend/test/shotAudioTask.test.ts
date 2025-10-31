import { describe, expect, it, vi } from 'vitest';

import { assembleShotAudioPrompt } from '../src/shot-audio/promptAssembler.js';
import { runShotAudioTask } from '../src/shot-audio/shotAudioTask.js';
import type { ShotAudioTaskDependencies, ShotAudioPrompt } from '../src/shot-audio/types.js';
import { ShotAudioTaskError } from '../src/shot-audio/errors.js';
import type { AgentWorkflowStoryRecord } from '../src/workflow/types.js';
import type { ShotRecord } from '../src/shot-production/types.js';

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

function createDependencies(shot: ShotRecord, overrides: Partial<ShotAudioTaskDependencies> = {}) {
  const story = createStory();
  const savedPaths: string[] = [];
  const synthesize = vi.fn<[], Promise<Buffer>>().mockResolvedValue(Buffer.from('fake-wav'));
  const saveShotAudio = vi.fn().mockImplementation(async () => {
    const path = 'generated/story-123/shots/scenelet-1/1_audio.wav';
    savedPaths.push(path);
    return {
      relativePath: path,
      absolutePath: `/abs/${path}`,
    };
  });

  const updateShotAudioPath = vi.fn(async (_storyId: string, _sceneletId: string, _shotIndex: number) => {
    shot.audioFilePath = 'generated/story-123/shots/scenelet-1/1_audio.wav';
    return shot;
  });

  const dependencies: ShotAudioTaskDependencies = {
    storiesRepository: overrides.storiesRepository ?? ({
      getStoryById: vi.fn(async () => story),
      createStory: vi.fn(),
      updateStoryArtifacts: vi.fn(),
    } as any),
    shotsRepository: overrides.shotsRepository ?? ({
      getShotsByStory: vi.fn(async () => ({
        'scenelet-1': [shot],
      })),
      createSceneletShots: vi.fn(),
      findSceneletIdsMissingShots: vi.fn(),
      findShotsMissingImages: vi.fn(),
      updateShotImagePaths: vi.fn(),
      updateShotAudioPath,
    } as any),
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
    updateShotAudioPath,
    savedPaths,
  };
}

describe('runShotAudioTask', () => {
  it('generates audio for shots without existing paths', async () => {
    const shot = createShotRecord({ audioFilePath: undefined });
    const { dependencies, synthesize, saveShotAudio, updateShotAudioPath, savedPaths } = createDependencies(shot);

    const result = await runShotAudioTask('story-123', dependencies);

    expect(result).toEqual({ generatedAudio: 1, skippedShots: 0, totalShots: 1 });
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

    expect(result).toEqual({ generatedAudio: 0, skippedShots: 1, totalShots: 1 });
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

    expect(result).toEqual({ generatedAudio: 1, skippedShots: 0, totalShots: 1 });
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

    expect(result).toEqual({ generatedAudio: 1, skippedShots: 0, totalShots: 1 });
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
});
