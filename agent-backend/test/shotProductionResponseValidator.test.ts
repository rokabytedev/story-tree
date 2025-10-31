import { describe, expect, it } from 'vitest';

import { parseShotProductionResponse } from '../src/shot-production/parseGeminiResponse.js';
import { ShotProductionTaskError } from '../src/shot-production/errors.js';
import type { SceneletDigest } from '../src/story-storage/types.js';

const TARGET_SCENELET: SceneletDigest = {
  id: 'scenelet-control',
  parentId: 'scenelet-root',
  role: 'linear',
  choiceLabel: 'Inspect the control room',
  description: 'Finn boots the ancient control deck and scans diagnostics.',
  dialogue: [
    { character: 'Finn', line: 'Diagnostics online. Something corrupted the guidance array.' },
    { character: 'Rhea', line: "Focus on the anomaly. I'll prep the response." },
    { character: 'Narrator', line: 'The hangar falls silent around them.' },
  ],
  shotSuggestions: [
    "Begin on Finn's hands flying across the console with holographic readouts.",
    'Cut to Rhea pacing, lit by the warning strobes.',
  ],
};

const VISUAL_DESIGN_DOCUMENT = {
  character_designs: [
    { character_id: 'finn' },
    { character_id: 'rhea' },
  ],
  environment_designs: [
    { environment_id: 'control-room' },
    { environment_id: 'hanger-bay' },
  ],
};

const LONG_STORYBOARD =
  'A richly detailed narration of framing, composition, emotion, and continuity that comfortably exceeds any minimum requirement set for storyboard prose.';

function createValidPayload() {
  return {
    scenelet_id: 'scenelet-control',
    shots: [
      {
        shot_index: ' 1 ',
        storyboard_entry: {
          framing_and_angle: `  ${LONG_STORYBOARD}  `,
          composition_and_content: LONG_STORYBOARD,
          character_action_and_emotion: LONG_STORYBOARD,
          camera_dynamics: LONG_STORYBOARD,
          lighting_and_atmosphere: LONG_STORYBOARD,
          continuity_notes: LONG_STORYBOARD,
          referenced_designs: {
            characters: [' finn ', 'rhea'],
            environments: ['control-room'],
          },
          audio_and_narrative: [
            {
              type: 'MONOLOGUE',
              source: 'narrator',
              line: '  The alarm klaxons echo through the control deck. ',
            },
            {
              type: 'dialogue',
              source: 'finn',
              line: 'Diagnostics online. Something corrupted the guidance array.',
            },
          ],
        },
      },
      {
        shot_index: 2,
        storyboard_entry: {
          framingAndAngle: LONG_STORYBOARD,
          compositionAndContent: LONG_STORYBOARD,
          characterActionAndEmotion: LONG_STORYBOARD,
          cameraDynamics: LONG_STORYBOARD,
          lightingAndAtmosphere: LONG_STORYBOARD,
          continuityNotes: LONG_STORYBOARD,
          referencedDesigns: {
            characters: [],
            environments: ['hanger-bay'],
          },
          audioAndNarrative: [
            {
              type: 'monologue',
              source: 'narrator',
              line: 'The hangar falls silent around them.',
            },
          ],
        },
      },
    ],
  };
}

describe('parseShotProductionResponse', () => {
  it('parses a valid response with mixed key styles and trims fields', () => {
    const payload = createValidPayload();

    const result = parseShotProductionResponse(JSON.stringify(payload), {
      scenelet: TARGET_SCENELET,
      visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
    });

    expect(result.sceneletId).toBe('scenelet-control');
    expect(result.shots).toHaveLength(2);

    const first = result.shots[0];
    expect(first?.shotIndex).toBe(1);
    expect(first?.storyboard.framingAndAngle).toBe(LONG_STORYBOARD);
    expect(first?.storyboard.referencedDesigns).toEqual({
      characters: ['finn', 'rhea'],
      environments: ['control-room'],
    });
    expect(first?.storyboard.audioAndNarrative).toEqual([
      {
        type: 'monologue',
        source: 'narrator',
        line: 'The alarm klaxons echo through the control deck.',
      },
      {
        type: 'dialogue',
        source: 'finn',
        line: 'Diagnostics online. Something corrupted the guidance array.',
      },
    ]);

    const second = result.shots[1];
    expect(second?.shotIndex).toBe(2);
    expect(second?.storyboard.framingAndAngle).toBe(LONG_STORYBOARD);
    expect(second?.storyboard.referencedDesigns).toEqual({
      characters: [],
      environments: ['hanger-bay'],
    });
    expect(second?.storyboard.audioAndNarrative).toEqual([
      {
        type: 'monologue',
        source: 'narrator',
        line: 'The hangar falls silent around them.',
      },
    ]);
  });

  it('throws when the response payload is invalid JSON', () => {
    expect(() =>
      parseShotProductionResponse('not-json', {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/invalid json/i);
  });

  it('throws when the parsed payload is not an object', () => {
    expect(() =>
      parseShotProductionResponse('null', {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/must be a JSON object/i);
  });

  it('throws when the target scenelet is missing in the context', () => {
    expect(() =>
      parseShotProductionResponse(JSON.stringify(createValidPayload()), {
        scenelet: undefined as unknown as SceneletDigest,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/requires a target scenelet/i);
  });

  it('throws when scenelet_id is missing or blank', () => {
    const payload = createValidPayload();
    delete payload.scenelet_id;

    expect(() =>
      parseShotProductionResponse(JSON.stringify(payload), {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/scenelet_id/i);
  });

  it('throws when scenelet_id does not match the requested scenelet', () => {
    const payload = createValidPayload();
    payload.scenelet_id = 'scenelet-trail';

    expect(() =>
      parseShotProductionResponse(JSON.stringify(payload), {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/does not match/i);
  });

  it('throws when shots are missing or empty', () => {
    const payload = createValidPayload();
    payload.shots = [];

    expect(() =>
      parseShotProductionResponse(JSON.stringify(payload), {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/must include at least one shot/i);
  });

  it('throws when a shot entry is not an object', () => {
    const payload = createValidPayload();
    payload.shots[0] = 'invalid' as unknown as Record<string, unknown>;

    expect(() =>
      parseShotProductionResponse(JSON.stringify(payload), {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/non-object shot entry/i);
  });

  it('throws when shot indices are not sequential starting at 1', () => {
    const payload = createValidPayload();
    payload.shots[0].shot_index = 2;

    expect(() =>
      parseShotProductionResponse(JSON.stringify(payload), {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/Shot indices must be sequential/i);
  });

  it('throws when a shot lacks a numeric shot_index', () => {
    const payload = createValidPayload();
    payload.shots[0].shot_index = 'abc';

    expect(() =>
      parseShotProductionResponse(JSON.stringify(payload), {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/shot_index/i);
  });

  it('throws when a shot omits the storyboard_entry object', () => {
    const payload = createValidPayload();
    payload.shots[0].storyboard_entry = null as unknown as Record<string, unknown>;

    expect(() =>
      parseShotProductionResponse(JSON.stringify(payload), {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/must include a storyboard_entry object/i);
  });

  it('throws when required storyboard fields are missing', () => {
    const payload = createValidPayload();
    delete payload.shots[0].storyboard_entry.framing_and_angle;

    expect(() =>
      parseShotProductionResponse(JSON.stringify(payload), {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/framing_and_angle/i);
  });

  it('throws when referenced_designs is missing', () => {
    const payload = createValidPayload();
    delete payload.shots[0].storyboard_entry.referenced_designs;

    expect(() =>
      parseShotProductionResponse(JSON.stringify(payload), {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/referenced_designs must be an object/i);
  });

  it('throws when referenced_designs.characters is not an array', () => {
    const payload = createValidPayload();
    payload.shots[0].storyboard_entry.referenced_designs.characters = 'finn' as unknown as string[];

    expect(() =>
      parseShotProductionResponse(JSON.stringify(payload), {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/characters must be an array/i);
  });

  it('throws when referenced_designs characters contain invalid entries', () => {
    const payload = createValidPayload();
    payload.shots[0].storyboard_entry.referenced_designs.characters = [123 as unknown as string];

    expect(() =>
      parseShotProductionResponse(JSON.stringify(payload), {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/array entries must be non-empty strings/i);
  });

  it('throws when referenced_designs includes unknown character ids', () => {
    const payload = createValidPayload();
    payload.shots[0].storyboard_entry.referenced_designs.characters = ['unknown'];

    expect(() =>
      parseShotProductionResponse(JSON.stringify(payload), {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/includes unknown design ids/i);
  });

  it('throws when referenced_designs environments include unknown ids', () => {
    const payload = createValidPayload();
    payload.shots[0].storyboard_entry.referenced_designs.environments = ['unknown-env'];

    expect(() =>
      parseShotProductionResponse(JSON.stringify(payload), {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/includes unknown design ids/i);
  });

  it('throws when audio_and_narrative is missing or not an array', () => {
    const payload = createValidPayload();
    delete payload.shots[0].storyboard_entry.audio_and_narrative;

    expect(() =>
      parseShotProductionResponse(JSON.stringify(payload), {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/audio_and_narrative must be an array/i);
  });

  it('throws when audio entries are not objects', () => {
    const payload = createValidPayload();
    payload.shots[0].storyboard_entry.audio_and_narrative = ['not-object'] as unknown as Record<string, unknown>[];

    expect(() =>
      parseShotProductionResponse(JSON.stringify(payload), {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/audio_and_narrative entries must be objects/i);
  });

  it('throws when audio entries are missing the type field', () => {
    const payload = createValidPayload();
    payload.shots[0].storyboard_entry.audio_and_narrative[0].type = '   ';

    expect(() =>
      parseShotProductionResponse(JSON.stringify(payload), {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/type must be provided/i);
  });

  it('throws when audio entries use an unsupported type', () => {
    const payload = createValidPayload();
    payload.shots[0].storyboard_entry.audio_and_narrative[0].type = 'soundscape';

    expect(() =>
      parseShotProductionResponse(JSON.stringify(payload), {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/must be either "monologue" or "dialogue"/i);
  });

  it('throws when monologue entries use a non-narrator source', () => {
    const payload = createValidPayload();
    payload.shots[0].storyboard_entry.audio_and_narrative[0].source = 'voice-over';

    expect(() =>
      parseShotProductionResponse(JSON.stringify(payload), {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/Monologue entries must use source "narrator"/i);
  });

  it('throws when audio entries omit the source field', () => {
    const payload = createValidPayload();
    payload.shots[0].storyboard_entry.audio_and_narrative[0].source = '   ';

    expect(() =>
      parseShotProductionResponse(JSON.stringify(payload), {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/source must be a non-empty string/i);
  });

  it('throws when audio entries omit the line field', () => {
    const payload = createValidPayload();
    payload.shots[0].storyboard_entry.audio_and_narrative[0].line = '  ';

    expect(() =>
      parseShotProductionResponse(JSON.stringify(payload), {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/line must be a non-empty string/i);
  });

  it('throws when dialogue entries use an unknown character id', () => {
    const payload = createValidPayload();
    payload.shots[0].storyboard_entry.audio_and_narrative[1].source = 'cosmo';

    expect(() =>
      parseShotProductionResponse(JSON.stringify(payload), {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/unknown character design id cosmo/i);
  });

  it('throws when dialogue lines are not present in the target scenelet', () => {
    const payload = createValidPayload();
    payload.shots[0].storyboard_entry.audio_and_narrative[1].line =
      'This dialogue does not appear within the target scenelet.';

    expect(() =>
      parseShotProductionResponse(JSON.stringify(payload), {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/does not exist in the target scenelet/i);
  });

  it('throws when the visual design document is missing', () => {
    expect(() =>
      parseShotProductionResponse(JSON.stringify(createValidPayload()), {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: null,
      })
    ).toThrow(/Visual design document is required/i);
  });
});
