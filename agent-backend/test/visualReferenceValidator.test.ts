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

  describe('normalized ID matching', () => {
    it('accepts environment names with apostrophes when prompt uses similar variations', () => {
      const visualDesign = {
        character_designs: [{ character_name: 'Cosmo' }],
        environment_designs: [{ environment_name: "Cosmo's Jungle Workshop" }],
      };

      const response = JSON.stringify({
        visual_reference_package: {
          character_model_sheets: [
            {
              character_name: 'Cosmo',
              reference_plates: [
                {
                  plate_description: 'Cosmo model sheet',
                  type: 'CHARACTER_MODEL_SHEET',
                  image_generation_prompt:
                    'Cosmo character design with vibrant lighting, showing the inventor in their natural habitat with glowing details.',
                },
              ],
            },
          ],
          environment_keyframes: [
            {
              environment_name: "Cosmo's Jungle Workshop",
              keyframes: [
                {
                  keyframe_description: 'Main workshop view',
                  // Prompt uses "Cosmos" instead of "Cosmo's" - should still match via normalization
                  image_generation_prompt:
                    'Cosmos Jungle Workshop interior with warm ambient lighting, tropical vines, and mechanical contraptions illuminated by sunset rays.',
                },
              ],
            },
          ],
        },
      });

      expect(() =>
        validateVisualReferenceResponse(response, {
          visualDesignDocument: visualDesign,
          minimumPromptLength: 80,
        })
      ).not.toThrow();
    });

    it('accepts character names with case variations', () => {
      const visualDesign = {
        character_designs: [{ character_name: 'Rhea the Explorer' }],
        environment_designs: [{ environment_name: 'Test Zone' }],
      };

      const response = JSON.stringify({
        visual_reference_package: {
          character_model_sheets: [
            {
              character_name: 'Rhea the Explorer',
              reference_plates: [
                {
                  plate_description: 'Rhea model sheet',
                  type: 'CHARACTER_MODEL_SHEET',
                  // Uses "RHEA THE EXPLORER" in caps - should still match
                  image_generation_prompt:
                    'RHEA THE EXPLORER character model sheet, full body view with dramatic studio lighting and confident pose.',
                },
              ],
            },
          ],
          environment_keyframes: [
            {
              environment_name: 'Test Zone',
              keyframes: [
                {
                  keyframe_description: 'Zone overview',
                  image_generation_prompt:
                    'test zone environment with bright daylight illumination and clear atmospheric conditions for testing purposes.',
                },
              ],
            },
          ],
        },
      });

      expect(() =>
        validateVisualReferenceResponse(response, {
          visualDesignDocument: visualDesign,
          minimumPromptLength: 80,
        })
      ).not.toThrow();
    });

    it('accepts names with special characters when prompt uses normalized versions', () => {
      const visualDesign = {
        character_designs: [{ character_name: 'Agent-007' }],
        environment_designs: [{ environment_name: 'Level @2 Hub' }],
      };

      const response = JSON.stringify({
        visual_reference_package: {
          character_model_sheets: [
            {
              character_name: 'Agent-007',
              reference_plates: [
                {
                  plate_description: 'Agent model sheet',
                  type: 'CHARACTER_MODEL_SHEET',
                  // Uses "Agent 007" without hyphen - should match
                  image_generation_prompt:
                    'Agent 007 character design showing sleek tactical gear with moody dramatic lighting and action-ready stance.',
                },
              ],
            },
          ],
          environment_keyframes: [
            {
              environment_name: 'Level @2 Hub',
              keyframes: [
                {
                  keyframe_description: 'Hub entrance',
                  // Uses "Level 2 Hub" without @ symbol - should match
                  image_generation_prompt:
                    'Level 2 Hub entrance area with neon lighting and futuristic atmosphere, glowing panels and cool blue illumination.',
                },
              ],
            },
          ],
        },
      });

      expect(() =>
        validateVisualReferenceResponse(response, {
          visualDesignDocument: visualDesign,
          minimumPromptLength: 80,
        })
      ).not.toThrow();
    });

    it('works with pre-normalized IDs in visual design document', () => {
      const visualDesign = {
        character_designs: [
          {
            character_name: "Cosmo's Helper",
            character_id: 'cosmos-helper', // Pre-normalized ID
          },
        ],
        environment_designs: [
          {
            environment_name: 'The Workshop',
            environment_id: 'the-workshop', // Pre-normalized ID
          },
        ],
      };

      const response = JSON.stringify({
        visual_reference_package: {
          character_model_sheets: [
            {
              character_name: "Cosmo's Helper",
              reference_plates: [
                {
                  plate_description: 'Helper model sheet',
                  type: 'CHARACTER_MODEL_SHEET',
                  image_generation_prompt:
                    'Cosmos Helper character showing a friendly robotic companion with glowing circuits and soft ambient lighting effects.',
                },
              ],
            },
          ],
          environment_keyframes: [
            {
              environment_name: 'The Workshop',
              keyframes: [
                {
                  keyframe_description: 'Workshop interior',
                  image_generation_prompt:
                    'the workshop interior space with industrial lighting, workbenches, and tools scattered about in warm atmosphere.',
                },
              ],
            },
          ],
        },
      });

      expect(() =>
        validateVisualReferenceResponse(response, {
          visualDesignDocument: visualDesign,
          minimumPromptLength: 80,
        })
      ).not.toThrow();
    });
  });
});
