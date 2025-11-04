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
      SAMPLE_DOCUMENT.environment_designs[0]!,
      'INSTRUCTIONS'
    );

    expect(prompt.startsWith('INSTRUCTIONS')).toBe(true);
    expect(prompt.includes('\n\n{')).toBe(true);
    const jsonPayload = prompt.slice('INSTRUCTIONS'.length).trimStart();
    const parsed = JSON.parse(jsonPayload);

    expect(parsed).toEqual({
      global_aesthetic: SAMPLE_DOCUMENT.global_aesthetic,
      environment_design: {
        environment_id: 'crystal-cavern',
        environment_name: 'Crystal Cavern',
        detailed_description: {
          overall_description:
            'A massive subterranean chamber filled with luminous crystals.',
          lighting_and_atmosphere:
            'Soft bioluminescent glow with drifting particulates.',
          color_tones: 'Deep blues with teal highlights and amber rim light.',
          key_elements:
            'Multi-tier crystal clusters, reflective water pools, carved walkways.',
        },
      },
    });
  });
});
