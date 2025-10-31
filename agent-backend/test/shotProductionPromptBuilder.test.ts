import { describe, expect, it } from 'vitest';

import { buildShotProductionUserPrompt } from '../src/shot-production/promptBuilder.js';
import type { StoryTreeEntry, StoryTreeSnapshot } from '../src/story-storage/types.js';

const ROOT_SCENELET_ENTRY: StoryTreeEntry = {
  kind: 'scenelet',
  data: {
    id: 'scenelet-root',
    parentId: null,
    role: 'root',
    description: 'Opening beats inside the observatory.',
    dialogue: [
      { character: 'Narrator', line: 'The lights of Rhea City flicker awake.' },
    ],
    shotSuggestions: ['Wide establishing shot of the observatory exterior.'],
  },
};

const BRANCH_ENTRY: StoryTreeEntry = {
  kind: 'branching-point',
  data: {
    id: 'branch-1',
    sourceSceneletId: 'scenelet-root',
    choicePrompt: 'Where does Finn investigate first?',
    choices: [
      { label: 'Follow the magnetic trail', leadsTo: 'scenelet-trail' },
      { label: 'Inspect the control room', leadsTo: 'scenelet-control' },
    ],
  },
};

const TARGET_SCENELET_ENTRY: StoryTreeEntry = {
  kind: 'scenelet',
  data: {
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
  },
};

const STORY_TREE: StoryTreeSnapshot = {
  entries: [ROOT_SCENELET_ENTRY, BRANCH_ENTRY, TARGET_SCENELET_ENTRY],
  yaml: `
- scenelet-root:
    role: root
    description: Opening beats inside the observatory.
    dialogue:
      - character: Narrator
        line: The lights of Rhea City flicker awake.
    shot_suggestions:
      - Wide establishing shot of the observatory exterior.
- branching-point-branch-1:
    source_scenelet_id: scenelet-root
    choice_prompt: Where does Finn investigate first?
    choices:
      - label: Follow the magnetic trail
        leads_to: scenelet-trail
      - label: Inspect the control room
        leads_to: scenelet-control
- scenelet-control:
    role: linear
    description: Finn boots the ancient control deck and scans diagnostics.
    dialogue:
      - character: Finn
        line: Diagnostics online. Something corrupted the guidance array.
      - character: Rhea
        line: "Focus on the anomaly. I'll prep the response."
    shot_suggestions:
      - Begin on Finn's hands flying across the console with holographic readouts.
      - Cut to Rhea pacing, lit by the warning strobes.
`.trim(),
};

const VISUAL_DESIGN = {
  character_designs: [
    { character_name: 'Finn' },
    { character_id: 'rhea' },
  ],
};

const AUDIO_DESIGN = {
  ambient_palettes: [
    { scenelet_id: 'scenelet-control', description: 'Low mechanical hums with intermittent alarms.' },
  ],
};

describe('buildShotProductionUserPrompt', () => {
  it('assembles all required sections with scenelet context and directives', () => {
    const prompt = buildShotProductionUserPrompt({
      constitutionMarkdown: '# Constitution\nThe story follows Rhea and Finn.',
      storyTree: STORY_TREE,
      visualDesignDocument: VISUAL_DESIGN,
      audioDesignDocument: AUDIO_DESIGN,
      scenelet: TARGET_SCENELET_ENTRY.data,
    });

    expect(prompt).toContain('# Story Constitution');
    expect(prompt).toContain('# Interactive Script Story Tree (YAML)');
    expect(prompt).toContain('Each scenelet appears in depth-first order');
    expect(prompt).toContain('# Visual Design Bible');
    expect(prompt).toContain('# Audio Design Bible');
    expect(prompt).toContain('# Target Scenelet');
    expect(prompt).toContain('scenelet_sequence: 2');
    expect(prompt).toContain('path_from_root: scenelet-root (role: root)');
    expect(prompt).toContain('downstream_choices:');
    expect(prompt).toContain("Begin on Finn's hands flying across the console with holographic readouts.");
    expect(prompt).not.toContain('No director shot_suggestions were provided.');
    expect(prompt).toContain('# Task Directives');
    expect(prompt).not.toContain('No background music.');
  });

  it('throws when constitution markdown is missing', () => {
    expect(() =>
      buildShotProductionUserPrompt({
        constitutionMarkdown: '   ',
        storyTree: STORY_TREE,
        visualDesignDocument: VISUAL_DESIGN,
        audioDesignDocument: AUDIO_DESIGN,
        scenelet: TARGET_SCENELET_ENTRY.data,
      })
    ).toThrow(/constitution/i);
  });

  it('throws when story tree yaml is blank', () => {
    expect(() =>
      buildShotProductionUserPrompt({
        constitutionMarkdown: '# Constitution',
        storyTree: { ...STORY_TREE, yaml: '  ' },
        visualDesignDocument: VISUAL_DESIGN,
        audioDesignDocument: AUDIO_DESIGN,
        scenelet: TARGET_SCENELET_ENTRY.data,
      })
    ).toThrow(/story tree/i);
  });

  it('throws when visual design document is missing', () => {
    expect(() =>
      buildShotProductionUserPrompt({
        constitutionMarkdown: '# Constitution',
        storyTree: STORY_TREE,
        visualDesignDocument: null,
        audioDesignDocument: AUDIO_DESIGN,
        scenelet: TARGET_SCENELET_ENTRY.data,
      })
    ).toThrow(/visual design/i);
  });

  it('throws when audio design document is missing', () => {
    expect(() =>
      buildShotProductionUserPrompt({
        constitutionMarkdown: '# Constitution',
        storyTree: STORY_TREE,
        visualDesignDocument: VISUAL_DESIGN,
        audioDesignDocument: undefined,
        scenelet: TARGET_SCENELET_ENTRY.data,
      })
    ).toThrow(/audio design/i);
  });

  it('throws when the scenelet is absent from the tree', () => {
    expect(() =>
      buildShotProductionUserPrompt({
        constitutionMarkdown: '# Constitution',
        storyTree: STORY_TREE,
        visualDesignDocument: VISUAL_DESIGN,
        audioDesignDocument: AUDIO_DESIGN,
        scenelet: {
          ...TARGET_SCENELET_ENTRY.data,
          id: 'scenelet-missing',
        },
      })
    ).toThrow(/target scenelet scenelet-missing was not found/i);
  });
});
