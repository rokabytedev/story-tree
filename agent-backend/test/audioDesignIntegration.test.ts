import { describe, expect, it, vi } from 'vitest';

import { loadStoryTreeSnapshot } from '../src/story-storage/storyTreeSnapshot.js';
import type { StoryTreeSceneletSource } from '../src/story-storage/types.js';
import { runAudioDesignTask } from '../src/audio-design/audioDesignTask.js';
import { AudioDesignTaskError } from '../src/audio-design/errors.js';
import type { AgentWorkflowStoryRecord, AgentWorkflowStoriesRepository } from '../src/workflow/types.js';

function createStoryRecord(): AgentWorkflowStoryRecord {
  return {
    id: 'story-1',
    displayName: 'Integration Story',
    initialPrompt: 'An integration story',
    storyConstitution: {
      proposedStoryTitle: 'Integration Story',
      storyConstitutionMarkdown: '# Constitution',
    },
    visualDesignDocument: {
      character_designs: [
        { character_name: 'Rhea' },
        { character_name: 'Narrator' },
      ],
    },
    audioDesignDocument: null,
    visualReferencePackage: null,
  };
}

function createStoriesRepository(story: AgentWorkflowStoryRecord): AgentWorkflowStoriesRepository & {
  updates: Array<{ storyId: string; patch: unknown }>;
} {
  const updates: Array<{ storyId: string; patch: unknown }> = [];

  return {
    updates,
    async createStory() {
      throw new Error('Not implemented in integration tests.');
    },
    async updateStoryArtifacts(storyId, patch) {
      updates.push({ storyId, patch });
      if ((patch as { audioDesignDocument?: unknown }).audioDesignDocument !== undefined) {
        story.audioDesignDocument = (patch as { audioDesignDocument?: unknown }).audioDesignDocument ?? null;
      }
      return story;
    },
    async getStoryById(storyId) {
      return storyId === story.id ? story : null;
    },
  } satisfies AgentWorkflowStoriesRepository & { updates: Array<{ storyId: string; patch: unknown }> };
}

function createStoryTreeLoader(scenelets: StoryTreeSceneletSource[]) {
  return (storyId: string) =>
    loadStoryTreeSnapshot(storyId, {
      sceneletsRepository: {
        async listSceneletsByStory(requestedStoryId: string) {
          if (requestedStoryId !== storyId) {
            return [] as StoryTreeSceneletSource[];
          }
          return scenelets;
        },
      },
    });
}

const GEMINI_RESPONSE = JSON.stringify({
  audio_design_document: {
    sonic_identity: {
      musical_direction: 'Integration musical direction long enough to satisfy validation requirements.',
      sound_effect_philosophy: 'Integration sound philosophy with detailed description beyond minimum length.',
    },
    character_voice_profiles: [
      {
        character_name: 'Rhea',
        voice_description: 'Rhea description crafted for integration tests surpassing length requirements easily.',
        tts_generation_prompt: 'Integration prompt for Rhea providing detailed direction above thirty characters.',
      },
      {
        character_name: 'Narrator',
        voice_description: 'Narrator integration description emphasising calm authority with sufficient length.',
        tts_generation_prompt: 'Narrator integration prompt ensuring steady pacing and warmth beyond threshold.',
      },
    ],
    music_and_ambience_cues: [
      {
        cue_name: 'Integration Cue One',
        associated_scenelet_ids: ['scenelet-1'],
        cue_description: 'Integration cue for opening environment with ambient pads.',
        music_generation_prompt: 'Create a 70 BPM ambient cue with gentle pulses supporting narration.',
      },
      {
        cue_name: 'Integration Cue Two',
        associated_scenelet_ids: ['scenelet-2'],
        cue_description: 'Integration cue for continuation with light percussion.',
        music_generation_prompt: 'Generate a 96 BPM track blending marimba accents and soft bass swells.',
      },
    ],
  },
});

describe('audio design task integration', () => {
  it('generates and persists document using assembled story tree', async () => {
    const story = createStoryRecord();
    const repository = createStoriesRepository(story);
    const scenelets: StoryTreeSceneletSource[] = [
      {
        id: 'scenelet-root',
        storyId: 'story-1',
        parentId: null,
        choiceLabelFromParent: null,
        choicePrompt: null,
        content: {
          description: 'Opening scene',
          dialogue: [{ character: 'Rhea', line: 'We are live.' }],
          shot_suggestions: [],
        },
        isBranchPoint: false,
        isTerminalNode: false,
        createdAt: '2025-01-01T00:00:00.000Z',
      },
      {
        id: 'scenelet-branch',
        storyId: 'story-1',
        parentId: 'scenelet-root',
        choiceLabelFromParent: null,
        choicePrompt: null,
        content: {
          description: 'Continuation',
          dialogue: [{ character: 'Narrator', line: 'Continuation line.' }],
          shot_suggestions: [],
        },
        isBranchPoint: false,
        isTerminalNode: true,
        createdAt: '2025-01-01T00:00:02.000Z',
      },
    ];
    const storyTreeLoader = createStoryTreeLoader(scenelets);
    const geminiClient = {
      generateJson: vi.fn(async () => GEMINI_RESPONSE),
    };

    const result = await runAudioDesignTask('story-1', {
      storiesRepository: repository,
      storyTreeLoader,
      promptLoader: async () => 'Audio prompt',
      geminiClient: geminiClient as any,
    });

    expect(result.audioDesignDocument).toEqual({
      audio_design_document: expect.any(Object),
    });
    expect(repository.updates).toHaveLength(1);
    expect(story.audioDesignDocument).toBeTruthy();
    expect(geminiClient.generateJson).toHaveBeenCalled();
  });

  it('throws when scenelets missing for coverage', async () => {
    const story = createStoryRecord();
    const repository = createStoriesRepository(story);
    const storyTreeLoader = createStoryTreeLoader([]);

    await expect(
      runAudioDesignTask('story-1', {
        storiesRepository: repository,
        storyTreeLoader,
        promptLoader: async () => 'Audio prompt',
        geminiClient: { generateJson: vi.fn() } as any,
      })
    ).rejects.toBeInstanceOf(AudioDesignTaskError);
  });

  it('surfaces Gemini validation failures', async () => {
    const story = createStoryRecord();
    const repository = createStoriesRepository(story);
    const scenelets: StoryTreeSceneletSource[] = [
      {
        id: 'scenelet-root',
        storyId: 'story-1',
        parentId: null,
        choiceLabelFromParent: null,
        choicePrompt: null,
        content: {
          description: 'Opening scene',
          dialogue: [{ character: 'Rhea', line: 'We are live.' }],
          shot_suggestions: [],
        },
        isBranchPoint: false,
        isTerminalNode: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      },
      {
        id: 'scenelet-branch',
        storyId: 'story-1',
        parentId: 'scenelet-root',
        choiceLabelFromParent: null,
        choicePrompt: null,
        content: {
          description: 'Continuation',
          dialogue: [{ character: 'Narrator', line: 'Continuation line.' }],
          shot_suggestions: [],
        },
        isBranchPoint: false,
        isTerminalNode: true,
        createdAt: '2025-01-01T00:00:02.000Z',
      },
    ];
    const storyTreeLoader = createStoryTreeLoader(scenelets);
    const geminiClient = {
      generateJson: vi.fn(async () =>
        JSON.stringify({
          audio_design_document: {
            sonic_identity: {},
            character_voice_profiles: [],
            music_and_ambience_cues: [],
          },
        })
      ),
    };

    await expect(
      runAudioDesignTask('story-1', {
        storiesRepository: repository,
        storyTreeLoader,
        promptLoader: async () => 'Audio prompt',
        geminiClient: geminiClient as any,
      })
    ).rejects.toBeInstanceOf(AudioDesignTaskError);
  });

  it('prevents repeated execution when document already exists', async () => {
    const story = createStoryRecord();
    story.audioDesignDocument = { audio_design_document: { persisted: true } };
    const repository = createStoriesRepository(story);
    const scenelets: StoryTreeSceneletSource[] = [
      {
        id: 'scenelet-root',
        storyId: 'story-1',
        parentId: null,
        choiceLabelFromParent: null,
        choicePrompt: null,
        content: {
          description: 'Opening scene',
          dialogue: [{ character: 'Rhea', line: 'We are live.' }],
          shot_suggestions: [],
        },
        isBranchPoint: false,
        isTerminalNode: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    ];
    const storyTreeLoader = createStoryTreeLoader(scenelets);
    const geminiClient = {
      generateJson: vi.fn(async () => GEMINI_RESPONSE),
    };

    await expect(
      runAudioDesignTask('story-1', {
        storiesRepository: repository,
        storyTreeLoader,
        promptLoader: async () => 'Audio prompt',
      })
    ).rejects.toThrow('already has an audio design document');
  });
});
