import { describe, expect, it } from 'vitest';

import { assembleShotAudioPrompt } from '../src/shot-audio/promptAssembler.js';
import type { ShotRecord } from '../src/shot-production/types.js';
import type { AudioDesignDocument } from '../src/audio-design/types.js';

function createShot(overrides: Partial<ShotRecord> = {}): ShotRecord {
  const storyboardPayload =
    overrides.storyboardPayload ??
    ({
      audioAndNarrative: [
        {
          type: 'monologue',
          source: 'narrator',
          line: 'The adventure begins.',
          delivery: 'warm',
        },
      ],
    } as any);

  return {
    sceneletSequence: overrides.sceneletSequence ?? 1,
    shotIndex: overrides.shotIndex ?? 1,
    storyboardPayload,
    keyFrameImagePath: overrides.keyFrameImagePath,
    audioFilePath: overrides.audioFilePath,
    createdAt: overrides.createdAt ?? '2025-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2025-01-01T00:00:00.000Z',
  } as ShotRecord;
}

const AUDIO_DESIGN: AudioDesignDocument = {
  sonic_identity: {
    musical_direction: 'Test direction',
    sound_effect_philosophy: 'Test philosophy',
  },
  narrator_voice_profile: {
    character_id: 'narrator',
    voice_profile: 'Narrator voice rich with detail for tests.',
    voice_name: 'Kore',
  },
  character_voice_profiles: [
    {
      character_id: 'rhea',
      character_name: 'Rhea',
      voice_profile: 'Rhea profile text that exceeds requirements.',
      voice_name: 'Puck',
    },
    {
      character_id: 'mentor-guide',
      character_name: 'Mentor Guide',
      voice_profile: 'Mentor profile text with ample detail.',
      voice_name: 'Deneb',
    },
  ],
  music_and_ambience_cues: [],
};

describe('assembleShotAudioPrompt', () => {
  it('builds prompt including narrator and relevant character profiles', () => {
    const shot = createShot({
      storyboardPayload: {
        audioAndNarrative: [
          {
            type: 'monologue',
            source: 'narrator',
            line: 'Welcome back to the lab.',
            delivery: 'warm',
          },
          {
            type: 'dialogue',
            source: 'rhea',
            line: 'Systems are online and ready.',
            delivery: 'confident',
          },
        ],
      },
    });

    const prompt = assembleShotAudioPrompt({
      shot,
      audioDesign: AUDIO_DESIGN,
      analysis: {
        mode: 'multi',
        speakers: ['narrator', 'rhea'],
      },
    });

    expect(prompt.mode).toBe('multi');
    expect(prompt.speakers).toEqual([
      { speaker: 'narrator', voiceName: 'Kore' },
      { speaker: 'rhea', voiceName: 'Puck' },
    ]);
    expect(prompt.prompt).toContain('narrator_voice_profile');
    expect(prompt.prompt).toContain('character_voice_profiles');
    expect(prompt.prompt).toContain('audio_and_narrative');
    expect(prompt.prompt).not.toContain('mentor-guide');
  });

  it('throws when required character voice profile is missing', () => {
    const shot = createShot({
      storyboardPayload: {
        audioAndNarrative: [
          {
            type: 'dialogue',
            source: 'missing-character',
            line: 'Who am I?',
            delivery: 'curious',
          },
        ],
      },
    });

    expect(() =>
      assembleShotAudioPrompt({
        shot,
        audioDesign: AUDIO_DESIGN,
        analysis: {
          mode: 'single',
          speakers: ['missing-character'],
        },
      })
    ).toThrow(/missing voice profiles/i);
  });
});
