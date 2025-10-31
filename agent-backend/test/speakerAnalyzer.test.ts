import { describe, expect, it } from 'vitest';

import { analyzeSpeakers } from '../src/shot-audio/speakerAnalyzer.js';
import { UnsupportedSpeakerCountError, ShotAudioValidationError } from '../src/shot-audio/errors.js';

describe('speakerAnalyzer', () => {
  it('detects single-speaker mode for narrator monologue', () => {
    const analysis = analyzeSpeakers([
      {
        type: 'monologue',
        source: 'narrator',
        line: 'Once upon a time...',
        delivery: 'gentle',
      } as any,
    ]);

    expect(analysis).toEqual({
      mode: 'single',
      speakers: ['narrator'],
    });
  });

  it('detects multi-speaker mode preserving order', () => {
    const analysis = analyzeSpeakers([
      {
        type: 'dialogue',
        source: 'rhea',
        line: 'We should explore the next path.',
        delivery: 'confident',
      } as any,
      {
        type: 'dialogue',
        source: 'mentor-guide',
        line: 'Stay focused on the objective.',
        delivery: 'measured',
      } as any,
      {
        type: 'dialogue',
        source: 'rhea',
        line: 'Absolutely, ready when you are.',
        delivery: 'upbeat',
      } as any,
    ]);

    expect(analysis).toEqual({
      mode: 'multi',
      speakers: ['rhea', 'mentor-guide'],
    });
  });

  it('throws when more than two speakers appear', () => {
    expect(() =>
      analyzeSpeakers([
        { type: 'dialogue', source: 'rhea', line: 'a', delivery: 'b' } as any,
        { type: 'dialogue', source: 'mentor-guide', line: 'b', delivery: 'c' } as any,
        { type: 'dialogue', source: 'testing-agent', line: 'c', delivery: 'd' } as any,
      ])
    ).toThrow(UnsupportedSpeakerCountError);
  });

  it('throws when audioAndNarrative is empty', () => {
    expect(() => analyzeSpeakers([])).toThrow(ShotAudioValidationError);
  });
});
