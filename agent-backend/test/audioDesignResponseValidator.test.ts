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
    { character_name: 'Rhea' },
    { character_name: 'Narrator' },
  ],
};

const BASE_AUDIO_DOCUMENT = {
  audio_design_document: {
    sonic_identity: {
      musical_direction: 'Detailed musical direction with at least thirty characters.',
      sound_effect_philosophy: 'Detailed sound effect philosophy with sufficient length.',
    },
    character_voice_profiles: [
      {
        character_name: 'Rhea',
        voice_description: 'Rhea voice description with more than thirty characters included.',
        tts_generation_prompt: 'Prompt for Rhea voice that clearly exceeds thirty characters.',
      },
      {
        character_name: 'Narrator',
        voice_description: 'Narrator voice description beyond thirty characters for validation.',
        tts_generation_prompt: 'Narrator TTS prompt that absolutely surpasses thirty characters.',
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
    expect(result.audioDesignDocument.character_voice_profiles).toHaveLength(2);
    expect(result.audioDesignDocument.music_and_ambience_cues).toHaveLength(2);
  });

  it('throws when character names do not match visual design', () => {
    const response = buildResponse({
      audio_design_document: {
        ...cloneBaseAudioDocument(),
        character_voice_profiles: [
          {
            character_name: 'Rhea',
            voice_description: 'Valid voice description with thirty plus characters.',
            tts_generation_prompt: 'Valid TTS prompt exceeding thirty characters easily.',
          },
          {
            character_name: 'Unknown',
            voice_description: 'Another valid voice description with plenty of detail present.',
            tts_generation_prompt: 'Another valid TTS prompt with more than thirty characters.',
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
            voice_description: 'Too short',
            tts_generation_prompt: 'Prompt that is long enough for validation to pass easily.',
          },
          {
            character_name: 'Narrator',
            voice_description: 'Narrator voice description beyond thirty characters for validation.',
            tts_generation_prompt: 'Narrator TTS prompt that absolutely surpasses thirty characters.',
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
});
