import { describe, expect, it } from 'vitest';

import { buildAudioDesignUserPrompt } from '../src/audio-design/promptBuilder.js';
import type { StoryTreeSnapshot } from '../src/story-storage/types.js';

const STORY_TREE: StoryTreeSnapshot = {
  entries: [],
  yaml: '- scenelet-1:\n  role: root\n  description: ""\n  dialogue: []\n  shot_suggestions: []',
};

const VISUAL_DESIGN_DOCUMENT = {
  character_designs: [{ character_name: 'Rhea' }],
};

describe('buildAudioDesignUserPrompt', () => {
  it('includes constitution, story tree yaml, visual design, and instructions', () => {
    const prompt = buildAudioDesignUserPrompt({
      constitutionMarkdown: '# Constitution',
      storyTree: STORY_TREE,
      visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
    });

    expect(prompt).toContain('# Story Constitution');
    expect(prompt).toContain('# Interactive Script Story Tree (YAML)');
    expect(prompt).toContain('Each scenelet appears in depth-first order');
    expect(prompt).toContain('# Visual Design Document');
    expect(prompt).toContain('# Task Instructions');
    expect(prompt).toContain('Output MUST be a single JSON object named audio_design_document.');
  });

  it('throws when constitution is missing', () => {
    expect(() =>
      buildAudioDesignUserPrompt({
        constitutionMarkdown: '   ',
        storyTree: STORY_TREE,
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/constitution/);
  });

  it('throws when story tree yaml missing', () => {
    expect(() =>
      buildAudioDesignUserPrompt({
        constitutionMarkdown: '# Constitution',
        storyTree: { entries: [], yaml: '   ' },
        visualDesignDocument: VISUAL_DESIGN_DOCUMENT,
      })
    ).toThrow(/story tree YAML/);
  });

  it('throws when visual design missing', () => {
    expect(() =>
      buildAudioDesignUserPrompt({
        constitutionMarkdown: '# Constitution',
        storyTree: STORY_TREE,
        visualDesignDocument: null,
      })
    ).toThrow(/Visual design document/);
  });
});
