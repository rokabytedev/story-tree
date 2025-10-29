import { describe, expect, it } from 'vitest';

import { buildVisualReferenceUserPrompt } from '../src/visual-reference/promptBuilder.js';
import type { StoryTreeSnapshot } from '../src/story-storage/types.js';

const STORY_TREE: StoryTreeSnapshot = {
  entries: [],
  yaml: '- scenelet-1:\n  role: root\n  description: "Intro"\n  dialogue: []',
};

const VISUAL_DESIGN_DOCUMENT = {
  character_designs: [{ character_id: 'rhea' }],
  environment_designs: [{ environment_id: 'choice-clearing' }],
};

describe('buildVisualReferenceUserPrompt', () => {
  it('assembles constitution, story tree, visual design, and task instructions', () => {
    const prompt = buildVisualReferenceUserPrompt({
      constitutionMarkdown: '# Constitution',
      storyTree: STORY_TREE,
      visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
    });

    expect(prompt).toMatchInlineSnapshot(`
      "# Story Constitution
      # Constitution

      # Interactive Script Story Tree (YAML)
      Each scenelet appears in depth-first order with sequential ids. Branching points list choices referencing the subsequent scenelet ids.
      - scenelet-1:
        role: root
        description: "Intro"
        dialogue: []

      # Visual Design Document
      {
        "character_designs": [
          {
            "character_id": "rhea"
          }
        ],
        "environment_designs": [
          {
            "environment_id": "choice-clearing"
          }
        ]
      }

      # Task Instructions
      Produce a single JSON object named visual_reference_package that matches the schema described in the system prompt. The visual design document contains character_id and environment_id fields (normalized slug-style identifiers). Use these exact IDs in your response for character_id and environment_id fields in the visual_reference_package. Provide at least one reference plate with type "CHARACTER_MODEL_SHEET" for every character and include optional contextual action shots. Every image_generation_prompt must be richly descriptive (>= 80 characters) and clearly reference the character or environment by a recognizable name or description. Environment keyframes must describe lighting or atmospheric context so downstream renders stay consistent."
    `);
  });

  it('throws when constitution markdown missing', () => {
    expect(() =>
      buildVisualReferenceUserPrompt({
        constitutionMarkdown: '   ',
        storyTree: STORY_TREE,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/constitution/i);
  });

  it('throws when story tree yaml missing', () => {
    expect(() =>
      buildVisualReferenceUserPrompt({
        constitutionMarkdown: '# Constitution',
        storyTree: { entries: [], yaml: '   ' },
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/story tree YAML/i);
  });

  it('throws when visual design document missing', () => {
    expect(() =>
      buildVisualReferenceUserPrompt({
        constitutionMarkdown: '# Constitution',
        storyTree: STORY_TREE,
        visualDesignDocument: null,
      })
    ).toThrow(/Visual design document/i);
  });
});
