import { describe, expect, it, vi } from 'vitest';

import { runAudioDesignTask } from '../src/audio-design/audioDesignTask.js';
import { AudioDesignTaskError } from '../src/audio-design/errors.js';
import type { AudioDesignTaskDependencies } from '../src/audio-design/types.js';
import type { AgentWorkflowStoryRecord, AgentWorkflowStoriesRepository } from '../src/workflow/types.js';
import type { StoryTreeSnapshot } from '../src/story-storage/types.js';
import { StoryTreeAssemblyError } from '../src/story-storage/errors.js';

function createStory(): AgentWorkflowStoryRecord {
  return {
    id: 'story-1',
    displayName: 'Stub Story',
    initialPrompt: 'An unforgettable journey',
    storyConstitution: {
      proposedStoryTitle: 'Stub Story',
      storyConstitutionMarkdown: '# Constitution',
      targetSceneletsPerPath: 12,
    },
    visualDesignDocument: {
      character_designs: [
        { character_id: 'rhea' },
        { character_id: 'narrator' },
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
      throw new Error('Not implemented');
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
        dialogue: [{ character: 'Rhea', line: 'Welcome to the lab.' }],
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
        description: 'Follow-up',
        dialogue: [{ character: 'Narrator', line: 'And so we begin.' }],
        shotSuggestions: [],
      },
    },
  ],
  yaml: '- scenelet-1:\n  description: "Opening"\n  dialogue:\n    - character: Rhea\n      line: "Welcome to the lab."\n- scenelet-2:\n  description: "Follow-up"\n  dialogue:\n    - character: Narrator\n      line: "And so we begin."',
};

const GEMINI_RESPONSE = JSON.stringify({
  audio_design_document: {
    sonic_identity: {
      musical_direction: 'Detailed musical direction that easily exceeds thirty characters in length.',
      sound_effect_philosophy: 'Philosophy on sound effects that more than satisfies the character requirement.',
    },
    character_voice_profiles: [
      {
        character_name: 'Rhea',
        voice_description: 'Rhea voice description that is rich with detail beyond the minimum requirement.',
        tts_generation_prompt: 'Rhea prompt text that clearly communicates tone and exceeds thirty characters.',
      },
      {
        character_name: 'Narrator',
        voice_description: 'Narrator description that conveys calm authority with more than thirty characters.',
        tts_generation_prompt: 'Narrator prompt that ensures measured pacing and warmth beyond thirty characters.',
      },
    ],
    music_and_ambience_cues: [
      {
        cue_name: 'Opening Atmosphere',
        associated_scenelet_ids: ['scenelet-1'],
        cue_description: 'Ambient shimmer with soft pulses to underscore inspiration.',
        music_generation_prompt: 'Compose a 68 BPM ambient cue with glassy pads and subtle percussion.',
      },
      {
        cue_name: 'Narrative Momentum',
        associated_scenelet_ids: ['scenelet-2'],
        cue_description: 'Gentle rhythmic texture that keeps the team engaged while narration flows.',
        music_generation_prompt: 'Produce a 92 BPM track with airy strings, muted percussion, and warm bass swells.',
      },
    ],
  },
});

function createDependencies(
  overrides: Partial<AudioDesignTaskDependencies> = {}
): AudioDesignTaskDependencies {
  return {
    storiesRepository: overrides.storiesRepository!,
    storyTreeLoader: overrides.storyTreeLoader!,
    promptLoader: overrides.promptLoader,
    geminiClient: overrides.geminiClient,
    geminiOptions: overrides.geminiOptions,
    logger: overrides.logger,
  };
}

describe('runAudioDesignTask', () => {
  it('generates audio design and persists response', async () => {
    const story = createStory();
    const repository = createStoriesRepository(story);
    const geminiClient = {
      generateJson: vi.fn(async () => GEMINI_RESPONSE),
    };

    const result = await runAudioDesignTask('story-1', createDependencies({
      storiesRepository: repository,
      storyTreeLoader: async () => STORY_TREE,
      promptLoader: async () => 'System prompt',
      geminiClient: geminiClient as any,
    }));

    expect(result.audioDesignDocument).toEqual({
      audio_design_document: expect.any(Object),
    });
    expect(repository.updates[0]).toMatchObject({
      storyId: 'story-1',
      patch: {
        audioDesignDocument: {
          audio_design_document: expect.any(Object),
        },
      },
    });
    expect(story.audioDesignDocument).toBeTruthy();
    expect(geminiClient.generateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        systemInstruction: 'System prompt',
      }),
      undefined
    );
  });

  it('logs Gemini request when logger provided', async () => {
    const story = createStory();
    const repository = createStoriesRepository(story);
    const geminiClient = {
      generateJson: vi.fn(async () => GEMINI_RESPONSE),
    };
    const logger = { debug: vi.fn() };

    await runAudioDesignTask('story-1', createDependencies({
      storiesRepository: repository,
      storyTreeLoader: async () => STORY_TREE,
      promptLoader: async () => 'System prompt',
      geminiClient: geminiClient as any,
      logger: logger as any,
    }));

    expect(logger.debug).toHaveBeenCalledWith(
      'Invoking Gemini for audio design task',
      expect.objectContaining({
        storyId: 'story-1',
        geminiRequest: expect.objectContaining({
          systemInstruction: 'System prompt',
        }),
      })
    );
  });

  it('throws when story lacks constitution', async () => {
    const story = createStory();
    story.storyConstitution = null;
    const repository = createStoriesRepository(story);

    await expect(
      runAudioDesignTask('story-1', createDependencies({
        storiesRepository: repository,
        storyTreeLoader: async () => STORY_TREE,
        promptLoader: async () => 'System prompt',
        geminiClient: { generateJson: vi.fn() } as any,
      }))
    ).rejects.toBeInstanceOf(AudioDesignTaskError);
  });

  it('throws when interactive script data missing', async () => {
    const story = createStory();
    const repository = createStoriesRepository(story);

    await expect(
      runAudioDesignTask('story-1', createDependencies({
        storiesRepository: repository,
        storyTreeLoader: async () => {
          throw new StoryTreeAssemblyError('Interactive script missing.');
        },
        promptLoader: async () => 'System prompt',
        geminiClient: { generateJson: vi.fn() } as any,
      }))
    ).rejects.toBeInstanceOf(AudioDesignTaskError);
  });

  it('throws when visual design missing', async () => {
    const story = createStory();
    story.visualDesignDocument = null;
    const repository = createStoriesRepository(story);

    await expect(
      runAudioDesignTask('story-1', createDependencies({
        storiesRepository: repository,
        storyTreeLoader: async () => STORY_TREE,
        promptLoader: async () => 'System prompt',
        geminiClient: { generateJson: vi.fn() } as any,
      }))
    ).rejects.toBeInstanceOf(AudioDesignTaskError);
  });

  it('throws when audio design already exists', async () => {
    const story = createStory();
    story.audioDesignDocument = { audio_design_document: {} };
    const repository = createStoriesRepository(story);

    await expect(
      runAudioDesignTask('story-1', createDependencies({
        storiesRepository: repository,
        storyTreeLoader: async () => STORY_TREE,
        promptLoader: async () => 'System prompt',
        geminiClient: { generateJson: vi.fn() } as any,
      }))
    ).rejects.toBeInstanceOf(AudioDesignTaskError);
  });
});
