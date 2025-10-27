import { describe, expect, it } from 'vitest';

import { buildStoryboardUserPrompt } from '../src/storyboard/promptBuilder.js';
import type { StoryTreeSnapshot } from '../src/story-storage/types.js';

const STORY_TREE: StoryTreeSnapshot = {
  entries: [],
  yaml: '- scenelet-1:\n  role: root\n  description: ""\n  dialogue: []\n  shot_suggestions: []',
};

const VISUAL_DESIGN_DOCUMENT = {
  character_designs: [
    { character_name: 'Rhea' },
  ],
};

describe('buildStoryboardUserPrompt', () => {
  it('includes constitution, story tree yaml, and visual design document', () => {
    const prompt = buildStoryboardUserPrompt({
      constitutionMarkdown: '# Constitution',
      storyTree: STORY_TREE,
      visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
    });

    expect(prompt).toContain('# Story Constitution');
    expect(prompt).toContain('# Interactive Script Story Tree (YAML)');
    expect(prompt).toContain('Each scenelet appears in depth-first order');
    expect(prompt).toContain('# Visual Design Document');
    expect(prompt).toContain('character_designs');
  });

  it('throws when constitution is missing', () => {
    expect(() =>
      buildStoryboardUserPrompt({
        constitutionMarkdown: '  ',
        storyTree: STORY_TREE,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/constitution/);
  });

  it('throws when story tree yaml is missing', () => {
    expect(() =>
      buildStoryboardUserPrompt({
        constitutionMarkdown: '# Constitution',
        storyTree: { entries: [], yaml: '   ' },
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/story tree/);
  });

  it('throws when visual design document missing', () => {
    expect(() =>
      buildStoryboardUserPrompt({
        constitutionMarkdown: '# Constitution',
        storyTree: STORY_TREE,
        visualDesignDocument: null,
      })
    ).toThrow(/Visual design document/);
  });
});
