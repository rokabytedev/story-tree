import { describe, expect, it } from 'vitest';

import {
  buildEnvironmentReferencePrompt,
  extractEnvironmentDesign,
  extractGlobalAesthetic,
  parseVisualDesignDocument,
} from '../src/environment-reference/promptBuilder.js';
import { EnvironmentReferenceTaskError } from '../src/environment-reference/errors.js';

const SAMPLE_DOCUMENT = {
  global_aesthetic: {
    visual_style: {
      name: 'Moody Cinematic',
      description: 'High-contrast lighting with rich color accents',
    },
    master_color_palette: [
      { hex_code: '#1b1f3b', color_name: 'Midnight Indigo', usage_notes: 'Dominant shadows' },
      { hex_code: '#f2a900', color_name: 'Amber Glow', usage_notes: 'Practical lighting' },
    ],
  },
  environment_designs: [
    {
      environment_id: 'crystal-cavern',
      environment_name: 'Crystal Cavern',
      detailed_description: {
        overall_description: 'A massive subterranean chamber filled with luminous crystals.',
        lighting_and_atmosphere: 'Soft bioluminescent glow with drifting particulates.',
        color_tones: 'Deep blues with teal highlights and amber rim light.',
        key_elements: 'Multi-tier crystal clusters, reflective water pools, carved walkways.',
      },
    },
  ],
} satisfies Record<string, unknown>;

describe('environment reference prompt builder', () => {
  it('parses visual design document from JSON string', () => {
    const doc = parseVisualDesignDocument(JSON.stringify(SAMPLE_DOCUMENT));
    expect(doc).toEqual(SAMPLE_DOCUMENT);
  });

  it('throws when visual design document string is invalid JSON', () => {
    expect(() => parseVisualDesignDocument('{invalid json')).toThrow(
      EnvironmentReferenceTaskError
    );
  });

  it('extracts global aesthetic section', () => {
    const aesthetic = extractGlobalAesthetic(SAMPLE_DOCUMENT);
    expect(aesthetic).toEqual(SAMPLE_DOCUMENT.global_aesthetic);
  });

  it('extracts specific environment design by id', () => {
    const design = extractEnvironmentDesign(SAMPLE_DOCUMENT, 'crystal-cavern');
    expect(design.environment_id).toBe('crystal-cavern');
  });

  it('throws when environment id is missing', () => {
    expect(() => extractEnvironmentDesign(SAMPLE_DOCUMENT, 'unknown-id')).toThrow(
      EnvironmentReferenceTaskError
    );
  });

  it('builds structured environment reference prompt', () => {
    const prompt = buildEnvironmentReferencePrompt(
      SAMPLE_DOCUMENT.global_aesthetic,
      SAMPLE_DOCUMENT.environment_designs[0]!
    );

    expect(prompt).toMatchInlineSnapshot(`
"# Role: Environment Concept Artist

Your purpose is to generate high-fidelity environment reference images for film, animation, and game production. The output must serve as a precise visual guide for a specific scene.

# Core Directive: Strict Adherence to the User's Prompt

Your most critical function is to create an image that is a direct and literal visualization of the user's request.

*   **Analyze:** Deconstruct the user's prompt to identify every specified element: objects, lighting, atmosphere, color palette, camera angle, and composition.
*   **Construct:** Build the scene using *only* the elements explicitly mentioned.
*   **Omit:** Do not add, invent, or infer any objects, characters, animals, or environmental details that are not described in the prompt. Your role is to be a precise tool, not an interpretive artist.

{
  "global_aesthetic": {
    "visual_style": {
      "name": "Moody Cinematic",
      "description": "High-contrast lighting with rich color accents"
    },
    "master_color_palette": [
      {
        "hex_code": "#1b1f3b",
        "color_name": "Midnight Indigo",
        "usage_notes": "Dominant shadows"
      },
      {
        "hex_code": "#f2a900",
        "color_name": "Amber Glow",
        "usage_notes": "Practical lighting"
      }
    ]
  },
  "environment_design": {
    "environment_id": "crystal-cavern",
    "environment_name": "Crystal Cavern",
    "detailed_description": {
      "overall_description": "A massive subterranean chamber filled with luminous crystals.",
      "lighting_and_atmosphere": "Soft bioluminescent glow with drifting particulates.",
      "color_tones": "Deep blues with teal highlights and amber rim light.",
      "key_elements": "Multi-tier crystal clusters, reflective water pools, carved walkways."
    }
  }
}"
    `);
  });
});
