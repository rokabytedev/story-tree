    const response = JSON.stringify({
      scenelet_id: 'scenelet-control',
      shots: [
        {
          shot_index: 1,
          storyboard_entry: {
            framing_and_angle: LONG_STORYBOARD,
            composition_and_content: LONG_STORYBOARD,
            character_action_and_emotion: LONG_STORYBOARD,
            dialogue: [
              { character: 'Finn', line: 'Invented dialogue not in the script.' },
            ],
            camera_dynamics: LONG_STORYBOARD,
            lighting_and_atmosphere: LONG_STORYBOARD,
            continuity_notes: LONG_STORYBOARD,
          },
          generation_prompts: {
            first_frame_prompt: LONG_PROMPT,
            key_frame_storyboard_prompt: LONG_PROMPT,
            video_clip_prompt: LONG_VIDEO_PROMPT,
          },
        },
      ],
    });

    expect(() =>
      parseShotProductionResponse(response, {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/does not exist/i);
  });

  it('throws when prompts are too short or missing the required phrase', () => {
    const response = JSON.stringify({
      scenelet_id: 'scenelet-control',
      shots: [
        {
          shot_index: 1,
          storyboard_entry: {
            framing_and_angle: LONG_STORYBOARD,
            composition_and_content: LONG_STORYBOARD,
            character_action_and_emotion: LONG_STORYBOARD,
            camera_dynamics: LONG_STORYBOARD,
            lighting_and_atmosphere: LONG_STORYBOARD,
            continuity_notes: LONG_STORYBOARD,
          },
          generation_prompts: {
            first_frame_prompt: 'too short',
            key_frame_storyboard_prompt: LONG_PROMPT,
            video_clip_prompt: 'A long enough prompt but missing the magic phrase entirely. '
              + 'This line still exceeds eighty characters yet omits the instruction.',
          },
        },
      ],
    });

    expect(() =>
      parseShotProductionResponse(response, {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(ShotProductionTaskError);
  });

  it('throws when the response payload is not valid JSON', () => {
    expect(() =>
      parseShotProductionResponse('not-json', {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/invalid json/i);
  });

  it('throws when storyboard entry omits required fields', () => {
    const response = JSON.stringify({
      scenelet_id: 'scenelet-control',
      shots: [
        {
          shot_index: 1,
          storyboard_entry: {
            composition_and_content: LONG_STORYBOARD,
            character_action_and_emotion: LONG_STORYBOARD,
            camera_dynamics: LONG_STORYBOARD,
            lighting_and_atmosphere: LONG_STORYBOARD,
            continuity_notes: LONG_STORYBOARD,
          },
          generation_prompts: {
            first_frame_prompt: LONG_PROMPT,
            key_frame_storyboard_prompt: LONG_PROMPT,
            video_clip_prompt: LONG_VIDEO_PROMPT,
          },
        },
      ],
    });

    expect(() =>
      parseShotProductionResponse(response, {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/framing_and_angle/i);
  });

  it('preserves referenced_designs when provided', () => {
    const response = JSON.stringify({
      scenelet_id: 'scenelet-control',
      shots: [
        {
          shot_index: 1,
          storyboard_entry: {
            framing_and_angle: LONG_STORYBOARD,
            composition_and_content: LONG_STORYBOARD,
            character_action_and_emotion: LONG_STORYBOARD,
            camera_dynamics: LONG_STORYBOARD,
            lighting_and_atmosphere: LONG_STORYBOARD,
            continuity_notes: LONG_STORYBOARD,
            referenced_designs: {
              characters: ['finn', 'rhea'],
              environments: ['control-room'],
            },
          },
          generation_prompts: {
            first_frame_prompt: LONG_PROMPT,
            key_frame_storyboard_prompt: LONG_PROMPT,
            video_clip_prompt: LONG_VIDEO_PROMPT,
          },
        },
      ],
    });

    const result = parseShotProductionResponse(response, {
      scenelet: TARGET_SCENELET,
      visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
    });

    expect(result.shots[0]?.storyboard.referencedDesigns).toEqual({
      characters: ['finn', 'rhea'],
      environments: ['control-room'],
    });
  });

  it('handles missing referenced_designs gracefully (backward compatibility)', () => {
    const response = JSON.stringify({
      scenelet_id: 'scenelet-control',
      shots: [
        {
          shot_index: 1,
          storyboard_entry: {
            framing_and_angle: LONG_STORYBOARD,
            composition_and_content: LONG_STORYBOARD,
            character_action_and_emotion: LONG_STORYBOARD,
            camera_dynamics: LONG_STORYBOARD,
            lighting_and_atmosphere: LONG_STORYBOARD,
            continuity_notes: LONG_STORYBOARD,
          },
          generation_prompts: {
            first_frame_prompt: LONG_PROMPT,
            key_frame_storyboard_prompt: LONG_PROMPT,
            video_clip_prompt: LONG_VIDEO_PROMPT,
          },
        },
      ],
    });

    const result = parseShotProductionResponse(response, {
      scenelet: TARGET_SCENELET,
      visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
    });

    expect(result.shots[0]?.storyboard.referencedDesigns).toBeUndefined();
  });

  it('validates referenced_designs.characters is a string array', () => {
    const response = JSON.stringify({
      scenelet_id: 'scenelet-control',
      shots: [
        {
          shot_index: 1,
          storyboard_entry: {
            framing_and_angle: LONG_STORYBOARD,
            composition_and_content: LONG_STORYBOARD,
            character_action_and_emotion: LONG_STORYBOARD,
            camera_dynamics: LONG_STORYBOARD,
            lighting_and_atmosphere: LONG_STORYBOARD,
            continuity_notes: LONG_STORYBOARD,
            referenced_designs: {
              characters: 'not-an-array',
              environments: [],
            },
          },
          generation_prompts: {
            first_frame_prompt: LONG_PROMPT,
            key_frame_storyboard_prompt: LONG_PROMPT,
            video_clip_prompt: LONG_VIDEO_PROMPT,
          },
        },
      ],
    });

    expect(() =>
      parseShotProductionResponse(response, {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/must be an array/i);
  });

  it('validates referenced_designs.environments is a string array', () => {
    const response = JSON.stringify({
      scenelet_id: 'scenelet-control',
      shots: [
        {
          shot_index: 1,
          storyboard_entry: {
            framing_and_angle: LONG_STORYBOARD,
            composition_and_content: LONG_STORYBOARD,
            character_action_and_emotion: LONG_STORYBOARD,
            camera_dynamics: LONG_STORYBOARD,
            lighting_and_atmosphere: LONG_STORYBOARD,
            continuity_notes: LONG_STORYBOARD,
            referenced_designs: {
              characters: [],
              environments: ['valid-id', 123],
            },
          },
          generation_prompts: {
            first_frame_prompt: LONG_PROMPT,
            key_frame_storyboard_prompt: LONG_PROMPT,
            video_clip_prompt: LONG_VIDEO_PROMPT,
          },
        },
      ],
    });

    expect(() =>
      parseShotProductionResponse(response, {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/must be non-empty strings/i);
  });
});
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
  'A richly detailed account of composition, camera language, and emotional stakes that exceeds the minimum length requirement.';

describe('parseShotProductionResponse', () => {
  it('parses a valid response with structured storyboard fields', () => {
    const response = JSON.stringify({
      scenelet_id: 'scenelet-control',
      shots: [
        {
          shot_index: '1',
          storyboard_entry: {
            framing_and_angle: `  ${LONG_STORYBOARD}  `,
            composition_and_content: LONG_STORYBOARD,
            character_action_and_emotion: LONG_STORYBOARD,
            camera_dynamics: LONG_STORYBOARD,
            lighting_and_atmosphere: LONG_STORYBOARD,
            continuity_notes: LONG_STORYBOARD,
            referenced_designs: {
              characters: ['finn', 'rhea'],
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
                line: 'The shot lingers on the silent hangar.',
              },
            ],
          },
        },
      ],
    });

    const result = parseShotProductionResponse(response, {
      scenelet: TARGET_SCENELET,
      visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
    });

    expect(result.sceneletId).toBe('scenelet-control');
    expect(result.shots).toHaveLength(2);
    expect(result.shots[0]?.shotIndex).toBe(1);
    expect(result.shots[0]?.storyboard.framingAndAngle).toBe(LONG_STORYBOARD);
    expect(result.shots[0]?.storyboard.referencedDesigns).toEqual({
      characters: ['finn', 'rhea'],
      environments: ['control-room'],
    });
    expect(result.shots[0]?.storyboard.audioAndNarrative).toEqual([
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
    expect(result.shots[1]?.storyboard.referencedDesigns).toEqual({
      characters: [],
      environments: ['hanger-bay'],
    });
    expect(result.shots[1]?.storyboard.audioAndNarrative).toEqual([
      {
        type: 'monologue',
        source: 'narrator',
        line: 'The shot lingers on the silent hangar.',
      },
    ]);
  });

  it('throws when scenelet id does not match the requested target', () => {
    const response = JSON.stringify({
      scenelet_id: 'scenelet-other',
      shots: [
        {
          shot_index: 1,
          storyboard_entry: {
            framing_and_angle: LONG_STORYBOARD,
            composition_and_content: LONG_STORYBOARD,
            character_action_and_emotion: LONG_STORYBOARD,
            camera_dynamics: LONG_STORYBOARD,
            lighting_and_atmosphere: LONG_STORYBOARD,
            continuity_notes: LONG_STORYBOARD,
            referenced_designs: { characters: ['finn'], environments: ['control-room'] },
            audio_and_narrative: [
              { type: 'monologue', source: 'narrator', line: 'A mismatch occurs.' },
            ],
          },
        },
      ],
    });

    expect(() =>
      parseShotProductionResponse(response, {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/does not match requested/i);
  });

  it('throws when shot indices skip numbers', () => {
    const response = JSON.stringify({
      scenelet_id: 'scenelet-control',
      shots: [
        {
          shot_index: 2,
          storyboard_entry: {
            framing_and_angle: LONG_STORYBOARD,
            composition_and_content: LONG_STORYBOARD,
            character_action_and_emotion: LONG_STORYBOARD,
            camera_dynamics: LONG_STORYBOARD,
            lighting_and_atmosphere: LONG_STORYBOARD,
            continuity_notes: LONG_STORYBOARD,
            referenced_designs: { characters: ['finn'], environments: ['control-room'] },
            audio_and_narrative: [
              { type: 'monologue', source: 'narrator', line: 'Sequence skipped.' },
            ],
          },
        },
      ],
    });

    expect(() =>
      parseShotProductionResponse(response, {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/sequential/i);
  });

  it('throws when referenced designs include unknown ids', () => {
    const response = JSON.stringify({
      scenelet_id: 'scenelet-control',
      shots: [
        {
          shot_index: 1,
          storyboard_entry: {
            framing_and_angle: LONG_STORYBOARD,
            composition_and_content: LONG_STORYBOARD,
            character_action_and_emotion: LONG_STORYBOARD,
            camera_dynamics: LONG_STORYBOARD,
            lighting_and_atmosphere: LONG_STORYBOARD,
            continuity_notes: LONG_STORYBOARD,
            referenced_designs: { characters: ['unknown-character'], environments: [] },
            audio_and_narrative: [
              { type: 'monologue', source: 'narrator', line: 'Unknown character reference.' },
            ],
          },
        },
      ],
    });

    expect(() =>
      parseShotProductionResponse(response, {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/unknown design ids/i);
  });

  it('throws when audio_and_narrative entries use invalid types', () => {
    const response = JSON.stringify({
      scenelet_id: 'scenelet-control',
      shots: [
        {
          shot_index: 1,
          storyboard_entry: {
            framing_and_angle: LONG_STORYBOARD,
            composition_and_content: LONG_STORYBOARD,
            character_action_and_emotion: LONG_STORYBOARD,
            camera_dynamics: LONG_STORYBOARD,
            lighting_and_atmosphere: LONG_STORYBOARD,
            continuity_notes: LONG_STORYBOARD,
            referenced_designs: { characters: ['finn'], environments: ['control-room'] },
            audio_and_narrative: [
              { type: 'speech', source: 'narrator', line: 'Invalid type.' },
            ],
          },
        },
      ],
    });

    expect(() =>
      parseShotProductionResponse(response, {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/either "monologue" or "dialogue"/i);
  });

  it('throws when dialogue entry references an unknown character id', () => {
    const response = JSON.stringify({
      scenelet_id: 'scenelet-control',
      shots: [
        {
          shot_index: 1,
          storyboard_entry: {
            framing_and_angle: LONG_STORYBOARD,
            composition_and_content: LONG_STORYBOARD,
            character_action_and_emotion: LONG_STORYBOARD,
            camera_dynamics: LONG_STORYBOARD,
            lighting_and_atmosphere: LONG_STORYBOARD,
            continuity_notes: LONG_STORYBOARD,
            referenced_designs: { characters: ['finn'], environments: ['control-room'] },
            audio_and_narrative: [
              {
                type: 'dialogue',
                source: 'unknown',
                line: 'Diagnostics online. Something corrupted the guidance array.',
              },
            ],
          },
        },
      ],
    });

    expect(() =>
      parseShotProductionResponse(response, {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/unknown character design id/i);
  });

  it('throws when dialogue line is not present in the scenelet transcript', () => {
    const response = JSON.stringify({
      scenelet_id: 'scenelet-control',
      shots: [
        {
          shot_index: 1,
          storyboard_entry: {
            framing_and_angle: LONG_STORYBOARD,
            composition_and_content: LONG_STORYBOARD,
            character_action_and_emotion: LONG_STORYBOARD,
            camera_dynamics: LONG_STORYBOARD,
            lighting_and_atmosphere: LONG_STORYBOARD,
            continuity_notes: LONG_STORYBOARD,
            referenced_designs: { characters: ['rhea'], environments: ['control-room'] },
            audio_and_narrative: [
              {
                type: 'dialogue',
                source: 'rhea',
                line: 'An unscripted line that does not exist.',
              },
            ],
          },
        },
      ],
    });

    expect(() =>
      parseShotProductionResponse(response, {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/does not exist in the target scenelet/i);
  });

  it('throws when monologue entry uses a non-narrator source', () => {
    const response = JSON.stringify({
      scenelet_id: 'scenelet-control',
      shots: [
        {
          shot_index: 1,
          storyboard_entry: {
            framing_and_angle: LONG_STORYBOARD,
            composition_and_content: LONG_STORYBOARD,
            character_action_and_emotion: LONG_STORYBOARD,
            camera_dynamics: LONG_STORYBOARD,
            lighting_and_atmosphere: LONG_STORYBOARD,
            continuity_notes: LONG_STORYBOARD,
            referenced_designs: { characters: ['finn'], environments: ['control-room'] },
            audio_and_narrative: [
              { type: 'monologue', source: 'finn', line: 'Misclassified monologue.' },
            ],
          },
        },
      ],
    });

    expect(() =>
      parseShotProductionResponse(response, {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/must use source "narrator"/i);
  });

  it('throws when audio_and_narrative is missing', () => {
    const response = JSON.stringify({
      scenelet_id: 'scenelet-control',
      shots: [
        {
          shot_index: 1,
          storyboard_entry: {
            framing_and_angle: LONG_STORYBOARD,
            composition_and_content: LONG_STORYBOARD,
            character_action_and_emotion: LONG_STORYBOARD,
            camera_dynamics: LONG_STORYBOARD,
            lighting_and_atmosphere: LONG_STORYBOARD,
            continuity_notes: LONG_STORYBOARD,
            referenced_designs: { characters: ['finn'], environments: ['control-room'] },
          },
        },
      ],
    });

    expect(() =>
      parseShotProductionResponse(response, {
        scenelet: TARGET_SCENELET,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(ShotProductionTaskError);
  });
});
