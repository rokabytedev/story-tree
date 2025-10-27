import { describe, expect, it } from 'vitest';

import { parseStoryboardResponse } from '../src/storyboard/parseGeminiResponse.js';
import { StoryboardTaskError } from '../src/storyboard/errors.js';
import type { StoryTreeSnapshot } from '../src/story-storage/types.js';
import fs from 'node:fs';

const STORY_TREE: StoryTreeSnapshot = {
  entries: [
    {
      kind: 'scenelet',
      data: {
        id: 'scenelet-1',
        parentId: null,
        role: 'root',
        description: 'Intro',
        dialogue: [
          { character: 'Rhea', line: 'Hello there.' },
        ],
        shotSuggestions: [],
      },
    },
    {
      kind: 'scenelet',
      data: {
        id: 'scenelet-2',
        parentId: 'scenelet-1',
        role: 'linear',
        description: 'Follow up',
        dialogue: [
          { character: 'Narrator', line: 'Narration continues.' },
        ],
        shotSuggestions: [],
      },
    },
  ],
  yaml: '- scenelet-1:\n  role: root\n  description: "Intro"\n  dialogue: []\n  shot_suggestions: []',
};

const VISUAL_DESIGN = {
  character_designs: [
    { character_name: 'Rhea' },
    { character_name: 'Narrator' },
    { character_name: 'Testing Agent' },
  ],
};

describe('parseStoryboardResponse', () => {
  it('normalizes storyboard shots and enforces dialogue coverage', () => {
    const response = JSON.stringify({
      storyboard_breakdown: [
        {
          scenelet_id: 'scenelet-1',
          shot_index: '1',
          framing_and_angle: 'Medium',
          composition_and_content: 'Rhea greets the viewer.',
          character_action_and_emotion: 'Rhea smiles.',
          dialogue: [
            { character: 'Rhea', line: 'Hello there.' },
          ],
          camera_dynamics: 'Static',
          lighting_and_atmosphere: 'Bright',
        },
        {
          scenelet_id: 'scenelet-2',
          shot_index: 1,
          framing_and_angle: 'Wide',
          composition_and_content: 'Narrative overlay on the scene.',
          character_action_and_emotion: 'Narration illustrates the setting.',
          dialogue: [
            { character: 'Narrator', line: 'Narration continues.' },
          ],
          camera_dynamics: 'Pan left',
          lighting_and_atmosphere: 'Moody',
        },
      ],
    });

    const result = parseStoryboardResponse(response, {
      storyTree: STORY_TREE,
      visualDesignDocument: VISUAL_DESIGN,
    });

    expect(result.storyboardBreakdown).toHaveLength(2);
    expect(result.storyboardBreakdown[0]?.shot_index).toBe(1);
    expect(result.storyboardBreakdown[1]?.scenelet_id).toBe('scenelet-2');
  });

  it('throws when dialogue line is unassigned', () => {
    const response = JSON.stringify({
      storyboard_breakdown: [
        {
          scenelet_id: 'scenelet-1',
          shot_index: 1,
          framing_and_angle: 'Medium',
          composition_and_content: 'Rhea greets the viewer.',
          character_action_and_emotion: 'Rhea smiles.',
          dialogue: [],
          camera_dynamics: 'Static',
          lighting_and_atmosphere: 'Bright',
        },
        {
          scenelet_id: 'scenelet-2',
          shot_index: 1,
          framing_and_angle: 'Wide',
          composition_and_content: 'Narration overlay on the scene.',
          character_action_and_emotion: 'Narration illustrates the setting.',
          dialogue: [
            { character: 'Narrator', line: 'Narration continues.' },
          ],
          camera_dynamics: 'Pan left',
          lighting_and_atmosphere: 'Moody',
        },
      ],
    });

    expect(() =>
      parseStoryboardResponse(response, {
        storyTree: STORY_TREE,
        visualDesignDocument: VISUAL_DESIGN,
      })
    ).toThrow(StoryboardTaskError);
  });

  it('throws when unknown character is used', () => {
    const response = JSON.stringify({
      storyboard_breakdown: [
        {
          scenelet_id: 'scenelet-1',
          shot_index: 1,
          framing_and_angle: 'Medium',
          composition_and_content: 'Rhea greets the viewer.',
          character_action_and_emotion: 'Rhea smiles.',
          dialogue: [
            { character: 'Unknown', line: 'Hello there.' },
          ],
          camera_dynamics: 'Static',
          lighting_and_atmosphere: 'Bright',
        },
        {
          scenelet_id: 'scenelet-2',
          shot_index: 1,
          framing_and_angle: 'Wide',
          composition_and_content: 'Narration overlay on the scene.',
          character_action_and_emotion: 'Narration illustrates the setting.',
          dialogue: [
            { character: 'Narrator', line: 'Narration continues.' },
          ],
          camera_dynamics: 'Pan left',
          lighting_and_atmosphere: 'Moody',
        },
      ],
    });

    expect(() =>
      parseStoryboardResponse(response, {
        storyTree: STORY_TREE,
        visualDesignDocument: VISUAL_DESIGN,
      })
    ).toThrow(/unknown character/i);
  });

  it('throws when raw response is invalid JSON', () => {
    expect(() =>
      parseStoryboardResponse('not-json', {
        storyTree: STORY_TREE,
        visualDesignDocument: VISUAL_DESIGN,
      })
    ).toThrow(StoryboardTaskError);
  });

  it('accepts storyboard fixture response with matching story tree', () => {
    const raw = fs.readFileSync('agent-backend/fixtures/storyboard/stub-gemini-response.json', 'utf8');

    const snapshot: StoryTreeSnapshot = {
      entries: [
        {
          kind: 'scenelet',
          data: {
            id: 'scenelet-1',
            parentId: null,
            role: 'root',
            description: 'In the glowing sandbox studio, Rhea calibrates the narrative tree before kickoff.',
            dialogue: [
              {
                character: 'Narrator',
                line: 'Rhea powers up the story simulator, ready to stress-test the new constitution.',
              },
              {
                character: 'Rhea',
                line: "Let's see if this scriptwriter mode can keep up with our testers.",
              },
            ],
            shotSuggestions: [],
          },
        },
        {
          kind: 'scenelet',
          data: {
            id: 'scenelet-2',
            parentId: 'scenelet-1',
            role: 'branch',
            choiceLabel: 'Pilot a playful tutorial',
            description: 'Rhea maps a lighthearted tutorial path where the reader experiments safely.',
            dialogue: [
              { character: 'Rhea', line: "We'll lead with a welcoming tutorial, keep things breezy." },
              { character: 'Testing Agent', line: 'Logging: tutorial tone, comedic beats, zero peril.' },
            ],
            shotSuggestions: [],
          },
        },
        {
          kind: 'scenelet',
          data: {
            id: 'scenelet-3',
            parentId: 'scenelet-2',
            role: 'terminal',
            description: 'The tutorial path concludes with Rhea watching testers laugh as they master the tools.',
            dialogue: [
              { character: 'Narrator', line: 'Minutes later, testers confidently remix the tutorial scenelets.' },
              { character: 'Rhea', line: "Perfect. Friendly tone achieved, and they're already riffing." },
            ],
            shotSuggestions: [],
          },
        },
        {
          kind: 'scenelet',
          data: {
            id: 'scenelet-4',
            parentId: 'scenelet-1',
            role: 'branch',
            choiceLabel: 'Jump to a high-stakes trial',
            description: 'Rhea sketches a tense branch that drops players straight into a creative challenge.',
            dialogue: [
              { character: 'Rhea', line: 'Or we launch with a challenge to jolt them awake.' },
              { character: 'Testing Agent', line: 'Noted. Tracking elevated tension and time pressure cues.' },
            ],
            shotSuggestions: [],
          },
        },
        {
          kind: 'scenelet',
          data: {
            id: 'scenelet-5',
            parentId: 'scenelet-4',
            role: 'terminal',
            description: 'The high-stakes branch ends with Rhea recording lessons from the intense trial run.',
            dialogue: [
              { character: 'Narrator', line: 'The room hums as players sprint through puzzles, breathless but exhilarated.' },
              { character: 'Rhea', line: "We kept them on their toes. Let's capture this momentum for iteration two." },
            ],
            shotSuggestions: [],
          },
        },
      ],
      yaml: '',
    };

    expect(() =>
      parseStoryboardResponse(raw, {
        storyTree: snapshot,
        visualDesignDocument: VISUAL_DESIGN,
      })
    ).not.toThrow();
  });
});
