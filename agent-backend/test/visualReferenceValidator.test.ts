import { describe, expect, it } from 'vitest';

import { validateVisualReferenceResponse } from '../src/visual-reference/validateVisualReferenceResponse.js';
import { VisualReferenceTaskError } from '../src/visual-reference/errors.js';

const VISUAL_DESIGN_DOCUMENT = {
  character_designs: [
    { character_name: 'Rhea' },
    { character_name: 'Narrator' },
  ],
  environment_designs: [
    { environment_name: 'Choice Clearing' },
  ],
};

const VALID_RESPONSE = JSON.stringify({
  visual_reference_package: {
    character_model_sheets: [
      {
        character_name: 'Rhea',
        reference_plates: [
          {
            plate_description: 'Rhea model sheet',
            type: 'CHARACTER_MODEL_SHEET',
            image_generation_prompt:
              'Detailed prompt describing Rhea with lighting cues, mentioning Rhea explicitly to satisfy validation requirements that exceed eighty characters in total length.',
          },
        ],
      },
      {
        character_name: 'Narrator',
        reference_plates: [
          {
            plate_description: 'Narrator model sheet',
            type: 'CHARACTER_MODEL_SHEET',
            image_generation_prompt:
              'Extensive prompt referencing the Narrator with glowing ribbon forms and consistent lighting language so the Narrator remains visually defined across renders.',
          },
        ],
      },
    ],
    environment_keyframes: [
      {
        environment_name: 'Choice Clearing',
        keyframes: [
          {
            keyframe_description: 'Dusk ambiance',
            image_generation_prompt:
              'Choice Clearing at dusk with turquoise light threads, warm rim lighting, and misty atmosphere capturing the ethereal mood.',
          },
        ],
      },
    ],
  },
});

describe('validateVisualReferenceResponse', () => {
  it('returns sanitized package for valid response', () => {
    const result = validateVisualReferenceResponse(VALID_RESPONSE, {
      visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      minimumPromptLength: 80,
    });

    expect(result.visualReferencePackage).toMatchObject({
      character_model_sheets: expect.any(Array),
      environment_keyframes: expect.any(Array),
    });
  });

  it('throws when a character is missing a model sheet entry', () => {
    const invalid = JSON.stringify({
      visual_reference_package: {
        character_model_sheets: [
          {
            character_name: 'Rhea',
            reference_plates: [
              {
                plate_description: 'Rhea model sheet',
                type: 'CHARACTER_ACTION_SHOT',
                image_generation_prompt:
                  'Prompt featuring Rhea and lighting but lacking correct type to satisfy the validator requirements fully.',
              },
            ],
          },
        ],
        environment_keyframes: [
          {
            environment_name: 'Choice Clearing',
            keyframes: [
              {
                keyframe_description: 'Nighttime',
                image_generation_prompt:
                  'Choice Clearing under starlight with cool lighting and atmosphere described thoroughly.',
              },
            ],
          },
        ],
      },
    });

    expect(() =>
      validateVisualReferenceResponse(invalid, {
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
        minimumPromptLength: 80,
      })
    ).toThrow(VisualReferenceTaskError);
  });

  it('throws when prompts do not reference recognized names', () => {
    const invalid = JSON.stringify({
      visual_reference_package: {
        character_model_sheets: [
          {
            character_name: 'Rhea',
            reference_plates: [
              {
                plate_description: 'Rhea model sheet',
                type: 'CHARACTER_MODEL_SHEET',
                image_generation_prompt:
                  'Model sheet lacking the correct name reference and therefore should trigger a failure because it omits Rhea entirely despite being long enough to pass the length requirement with lighting notes.',
              },
            ],
          },
        ],
        environment_keyframes: [
          {
            environment_name: 'Choice Clearing',
            keyframes: [
              {
                keyframe_description: 'Atmosphere',
                image_generation_prompt:
                  'This prompt mentions dramatic beams and cinematic composition extensively but forgets to reference the environment by name anywhere which must fail.',
              },
            ],
          },
        ],
      },
    });

    expect(() =>
      validateVisualReferenceResponse(invalid, {
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
        minimumPromptLength: 80,
      })
    ).toThrow(VisualReferenceTaskError);
  });

  it('throws when lighting language is missing for environments', () => {
    const invalid = JSON.stringify({
      visual_reference_package: {
        character_model_sheets: [
          {
            character_name: 'Rhea',
            reference_plates: [
              {
                plate_description: 'Rhea model sheet',
                type: 'CHARACTER_MODEL_SHEET',
                image_generation_prompt:
                  'Rhea model sheet including Rhea by name and lighting callouts so the validator accepts the character entry easily.',
              },
            ],
          },
          {
            character_name: 'Narrator',
            reference_plates: [
              {
                plate_description: 'Narrator model sheet',
                type: 'CHARACTER_MODEL_SHEET',
                image_generation_prompt:
                  'Narrator model sheet describing the luminous ribbon narrator with consistent studio lighting and plenty of descriptive detail referencing the Narrator.',
              },
            ],
          },
        ],
        environment_keyframes: [
          {
            environment_name: 'Choice Clearing',
            keyframes: [
              {
                keyframe_description: 'Neutral view',
                image_generation_prompt:
                  'Choice Clearing overview describing terrain detail and suspended glyphs while focusing purely on geometry and composition, intentionally omitting any discussion of brightness, weather, temporal context, or ambience even though the environment name appears.',
              },
            ],
          },
        ],
      },
    });

    expect(() =>
      validateVisualReferenceResponse(invalid, {
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
        minimumPromptLength: 80,
      })
    ).toThrow(/lighting or atmosphere/i);
  });
});
