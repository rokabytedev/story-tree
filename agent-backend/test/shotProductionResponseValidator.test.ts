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
    { character_name: 'Finn' },
    { character_name: 'Rhea' },
  ],
};

const LONG_STORYBOARD =
  'A richly detailed account of composition, camera language, and emotional stakes that easily exceeds eighty characters.';

const LONG_PROMPT =
  'Detailed prompt describing mood, motion, lensing, and lighting choices to guide generation in no fewer than eighty five characters.';

const LONG_VIDEO_PROMPT =
  'Extended cinematic direction that highlights pacing, transitions, and emotional beats. No background music. Continue describing texture.';

describe('parseShotProductionResponse', () => {
  it('normalizes a valid response and enforces trimming, prompts, and dialogue constraints', () => {
    const response = JSON.stringify({
      scenelet_id: 'scenelet-control',
      shots: [
        {
          shot_index: '1',
          storyboard_entry: {
            framing_and_angle: `  ${LONG_STORYBOARD}  `,
            composition_and_content: LONG_STORYBOARD,
            character_action_and_emotion: LONG_STORYBOARD,
            dialogue: [
              {
                character: 'Finn',
                line: 'Diagnostics online. Something corrupted the guidance array.',
              },
            ],
            camera_dynamics: LONG_STORYBOARD,
            lighting_and_atmosphere: LONG_STORYBOARD,
            continuity_notes: LONG_STORYBOARD,
          },
          generation_prompts: {
            first_frame_prompt: `  ${LONG_PROMPT}  `,
            keyFramePrompt: `${LONG_PROMPT} extra detail for key frame guidance.`,
            video_clip_prompt: `${LONG_VIDEO_PROMPT} Additional padding to ensure sufficient length.`,
          },
        },
        {
          shot_index: 2,
          storyboard_entry: {
            framing_and_angle: LONG_STORYBOARD,
            composition_and_content: LONG_STORYBOARD,
            character_action_and_emotion: LONG_STORYBOARD,
            camera_dynamics: LONG_STORYBOARD,
            lighting_and_atmosphere: LONG_STORYBOARD,
            continuity_notes: LONG_STORYBOARD,
          },
          generation_prompts: {
            firstFramePrompt: LONG_PROMPT,
            key_frame_storyboard_prompt: `${LONG_PROMPT} with storyboard specifics included.`,
            videoClipPrompt: LONG_VIDEO_PROMPT,
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
    expect(result.shots[0]?.storyboard.dialogue).toEqual([
      {
        character: 'Finn',
        line: 'Diagnostics online. Something corrupted the guidance array.',
      },
    ]);
    expect(result.shots[0]?.prompts.videoClipPrompt).toContain('No background music.');
    expect(result.shots[1]?.storyboard.dialogue).toEqual([]);
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
    ).toThrow(/sequential/);
  });

  it('throws when dialogue references an unknown character', () => {
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
              { character: 'Unknown', line: 'Diagnostics online. Something corrupted the guidance array.' },
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
    ).toThrow(/unknown character/i);
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
});
