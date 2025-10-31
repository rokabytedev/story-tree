import { describe, expect, it } from 'vitest';

import { parseAudioDesignResponse } from '../src/audio-design/parseGeminiResponse.js';
import { AudioDesignTaskError } from '../src/audio-design/errors.js';
import type { StoryTreeSnapshot } from '../src/story-storage/types.js';

const STORY_TREE: StoryTreeSnapshot = {
  entries: [
    {
      kind: 'scenelet',
      data: {
        id: 'scenelet-1',
        parentId: null,
        role: 'root',
        choiceLabel: null,
        description: 'Opening',
        dialogue: [
          { character: 'Rhea', line: 'We begin here.' },
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
        choiceLabel: null,
        description: 'Follow up',
        dialogue: [
          { character: 'Narrator', line: 'The story continues.' },
        ],
        shotSuggestions: [],
      },
    },
  ],
  yaml: [
    '- scenelet-1:',
    '    role: root',
    '    description: "Opening"',
    '    dialogue:',
    '      - character: Rhea',
    '        line: "We begin here."',
    '- scenelet-2:',
    '    description: "Follow up"',
    '    dialogue:',
    '      - character: Narrator',
    '        line: "The story continues."',
  ].join('\n'),
};

const VISUAL_DESIGN = {
  character_designs: [
    { character_id: 'rhea' },
    { character_id: 'testing-agent' },
  ],
};

const BASE_AUDIO_DOCUMENT = {
  audio_design_document: {
    sonic_identity: {
      musical_direction: 'Detailed musical direction with at least thirty characters.',
      sound_effect_philosophy: 'Detailed sound effect philosophy with sufficient length.',
    },
    narrator_voice_profile: {
      character_id: 'narrator',
      voice_profile: 'Warm narrator profile text extending well beyond thirty characters for validation.',
      voice_name: 'Kore',
    },
    character_voice_profiles: [
      {
        character_name: 'Rhea',
        voice_profile: 'Rhea voice profile text brimming with expressive qualities and sufficient detail.',
        voice_name: 'Puck',
      },
      {
        character_name: 'Testing Agent',
        voice_profile: 'Testing Agent voice profile highlighting upbeat precision with abundant detail.',
        voice_name: 'Oberon',
      },
    ],
    music_and_ambience_cues: [
      {
        cue_name: 'Opening Cue',
        associated_scenelet_ids: ['scenelet-1'],
        cue_description: 'Cue for opening atmosphere.',
        music_generation_prompt: 'Generate ambient cue for the opening scene with warmth.',
      },
      {
        cue_name: 'Follow Up',
        associated_scenelet_ids: ['scenelet-2'],
        cue_description: 'Cue for continued narrative energy.',
        music_generation_prompt: 'Compose supportive underscore for narrative continuation.',
      },
    ],
  },
};

function buildResponse(overrides: Record<string, unknown> = {}): string {
  const baseClone = JSON.parse(JSON.stringify(BASE_AUDIO_DOCUMENT)) as Record<string, unknown>;
  const merged = {
    ...baseClone,
    ...overrides,
  };
  return JSON.stringify(merged);
}

function cloneBaseAudioDocument(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(BASE_AUDIO_DOCUMENT.audio_design_document)) as Record<string, unknown>;
}

describe('parseAudioDesignResponse', () => {
  it('sanitizes audio design document', () => {
    const result = parseAudioDesignResponse(buildResponse(), {
      storyTree: STORY_TREE,
      visualDesignDocument: VISUAL_DESIGN,
    });

    expect(result.audioDesignDocument.sonic_identity.musical_direction).toContain('Detailed musical direction');
    expect(result.audioDesignDocument.narrator_voice_profile.voice_name).toBe('Kore');
    expect(result.audioDesignDocument.narrator_voice_profile.character_id).toBe('narrator');
    expect(result.audioDesignDocument.character_voice_profiles).toHaveLength(2);
    expect(result.audioDesignDocument.character_voice_profiles[0]?.character_id).toBe('rhea');
    expect(result.audioDesignDocument.character_voice_profiles[0]?.voice_name).toBe('Puck');
    expect(result.audioDesignDocument.music_and_ambience_cues).toHaveLength(2);
  });

  it('throws when character names do not match visual design', () => {
    const response = buildResponse({
      audio_design_document: {
        ...cloneBaseAudioDocument(),
        character_voice_profiles: [
          {
            character_name: 'Rhea',
            voice_profile: 'Valid profile text with ample descriptive content for testing.',
            voice_name: 'Lyra',
          },
          {
            character_name: 'Unknown',
            voice_profile: 'Unknown profile text supplied purely for validation failure coverage.',
            voice_name: 'Deneb',
          },
        ],
      },
    });

    expect(() =>
      parseAudioDesignResponse(response, {
        storyTree: STORY_TREE,
        visualDesignDocument: VISUAL_DESIGN,
      })
    ).toThrow(AudioDesignTaskError);
  });

  it('throws when scenelet coverage is incomplete', () => {
    const response = buildResponse({
      audio_design_document: {
        ...cloneBaseAudioDocument(),
        music_and_ambience_cues: [
          {
            cue_name: 'Only First',
            associated_scenelet_ids: ['scenelet-1'],
            cue_description: 'Cue covering only first scene.',
            music_generation_prompt: 'Prompt for first cue with enough characters to pass.',
          },
        ],
      },
    });

    expect(() =>
      parseAudioDesignResponse(response, {
        storyTree: STORY_TREE,
        visualDesignDocument: VISUAL_DESIGN,
      })
    ).toThrow(/scenelets/i);
  });

  it('throws when voice description is too short', () => {
    const response = buildResponse({
      audio_design_document: {
        ...cloneBaseAudioDocument(),
        character_voice_profiles: [
          {
            character_name: 'Rhea',
            voice_profile: 'Voice profile for Rhea packed with descriptive flourishes and nuances.',
            voice_name: 'Lyra',
          },
          {
            character_name: 'Testing Agent',
            voice_profile: 'Testing Agent voice profile elaborating upbeat efficiency with ample detail.',
            voice_name: 'Deneb',
          },
        ],
      },
    });

    expect(() =>
      parseAudioDesignResponse(response, {
        storyTree: STORY_TREE,
        visualDesignDocument: VISUAL_DESIGN,
      })
    ).toThrow(/voice_description/);
  });

  it('throws when narrator voice profile is missing', () => {
    const response = buildResponse({
      audio_design_document: {
        ...cloneBaseAudioDocument(),
        narrator_voice_profile: undefined,
      },
    });

    expect(() =>
      parseAudioDesignResponse(response, {
        storyTree: STORY_TREE,
        visualDesignDocument: VISUAL_DESIGN,
      })
    ).toThrow(/narrator_voice_profile/i);
  });

  it('throws when narrator voice profile has wrong character id', () => {
    const response = buildResponse({
      audio_design_document: {
        ...cloneBaseAudioDocument(),
        narrator_voice_profile: {
          character_id: 'not-narrator',
          voice_profile: 'Narrator voice profile elaborating calm delivery with abundant details.',
          voice_name: 'Deneb',
        },
      },
    });

    expect(() =>
      parseAudioDesignResponse(response, {
        storyTree: STORY_TREE,
        visualDesignDocument: VISUAL_DESIGN,
      })
    ).toThrow(/character_id must be "narrator"/i);
  });

  it('throws when character voice profile is missing voice_name', () => {
    const response = buildResponse({
      audio_design_document: {
        ...cloneBaseAudioDocument(),
        character_voice_profiles: [
          {
            character_name: 'Rhea',
            voice_profile: 'Voice profile for Rhea packed with descriptive flourishes and nuances.',
          },
        ],
      },
    });

    expect(() =>
      parseAudioDesignResponse(response, {
        storyTree: STORY_TREE,
        visualDesignDocument: VISUAL_DESIGN,
      })
    ).toThrow(/voice_name/i);
  });
});
