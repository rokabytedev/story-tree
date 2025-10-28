import { describe, expect, it } from 'vitest';

import { buildVisualReferenceUserPrompt } from '../src/visual-reference/promptBuilder.js';
import type { StoryTreeSnapshot } from '../src/story-storage/types.js';

const STORY_TREE: StoryTreeSnapshot = {
  entries: [],
  yaml: '- scenelet-1:\n  role: root\n  description: "Intro"\n  dialogue: []',
};

const VISUAL_DESIGN_DOCUMENT = {
  character_designs: [{ character_name: 'Rhea' }],
  environment_designs: [{ environment_name: 'Choice Clearing' }],
};

describe('buildVisualReferenceUserPrompt', () => {
  it('assembles constitution, story tree, visual design, and task instructions', () => {
    const prompt = buildVisualReferenceUserPrompt({
      constitutionMarkdown: '# Constitution',
      storyTree: STORY_TREE,
      visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
    });

    expect(prompt).toMatchInlineSnapshot(`
"# Story Constitution\n# Constitution\n\n# Interactive Script Story Tree (YAML)\nEach scenelet appears in depth-first order with sequential ids. Branching points list choices referencing the subsequent scenelet ids.\n- scenelet-1:\n  role: root\n  description: \"Intro\"\n  dialogue: []\n\n# Visual Design Document\n{\n  \"character_designs\": [\n    {\n      \"character_name\": \"Rhea\"\n    }\n  ],\n  \"environment_designs\": [\n    {\n      \"environment_name\": \"Choice Clearing\"\n    }\n  ]\n}\n\n# Task Instructions\nProduce a single JSON object named visual_reference_package that matches the schema described in the system prompt. Match character_name and environment_name values exactly (case-sensitive) to those in the visual design document. Provide at least one reference plate with type \"CHARACTER_MODEL_SHEET\" for every character and include optional contextual action shots. Every image_generation_prompt must be richly descriptive (>= 80 characters), reference the exact character or environment name, and avoid empty or placeholder text. Environment keyframes must describe lighting or atmospheric context so downstream renders stay consistent."
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
