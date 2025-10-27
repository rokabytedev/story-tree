import { describe, expect, it, vi } from 'vitest';

import { generateInteractiveStoryTree } from '../src/interactive-story/generateInteractiveStory.js';
import { InteractiveStoryError } from '../src/interactive-story/errors.js';
import { ScriptwriterScenelet, SceneletPersistence } from '../src/interactive-story/types.js';
import type { GeminiJsonClient } from '../src/gemini/types.js';

type GeminiRequest = {
  systemInstruction: string;
  userContent: string;
};

type GeminiResponseFactory = () => string | Promise<string>;

class StubGeminiClient implements GeminiJsonClient {
  public readonly requests: GeminiRequest[] = [];

  constructor(private readonly responses: GeminiResponseFactory[]) {}

  async generateJson(params: GeminiRequest, _options?: unknown): Promise<string> {
    this.requests.push(params);
    if (this.responses.length === 0) {
      throw new Error('No more Gemini responses configured.');
    }

    const factory = this.responses.shift() as GeminiResponseFactory;
    return await factory();
  }
}

interface RecordedCreate {
  input: {
    storyId: string;
    parentId: string | null;
    choiceLabelFromParent: string | null;
    content: ScriptwriterScenelet;
  };
  recordId: string;
}

class StubSceneletPersistence implements SceneletPersistence {
  public readonly creates: RecordedCreate[] = [];
  public readonly branchMarks: Array<{ id: string; prompt: string }> = [];
  public readonly terminalMarks: string[] = [];
  private counter = 0;

  async createScenelet(input: {
    storyId: string;
    parentId: string | null;
    choiceLabelFromParent?: string | null;
    content: ScriptwriterScenelet;
  }) {
    this.counter += 1;
    const recordId = `scenelet-${this.counter}`;
    this.creates.push({
      input: {
        storyId: input.storyId,
        parentId: input.parentId ?? null,
        choiceLabelFromParent: input.choiceLabelFromParent ?? null,
        content: input.content,
      },
      recordId,
    });
    return {
      id: recordId,
      storyId: input.storyId,
      parentId: input.parentId ?? null,
      choiceLabelFromParent: input.choiceLabelFromParent ?? null,
      choicePrompt: null,
      content: input.content,
      isBranchPoint: false,
      isTerminalNode: false,
      createdAt: new Date().toISOString(),
    };
  }

  async markSceneletAsBranchPoint(sceneletId: string, choicePrompt: string): Promise<void> {
    this.branchMarks.push({ id: sceneletId, prompt: choicePrompt });
  }

  async markSceneletAsTerminal(sceneletId: string): Promise<void> {
    this.terminalMarks.push(sceneletId);
  }
}

describe('generateInteractiveStoryTree', () => {
  it('explores branches depth-first and persists scenelets', async () => {
    const responses: GeminiResponseFactory[] = [
      () =>
        JSON.stringify({
          branch_point: false,
          is_concluding_scene: false,
          next_scenelets: [
            {
              description: 'Opening scene',
              dialogue: [{ character: 'Narrator', line: 'Hello there!' }],
              shot_suggestions: ['Wide shot'],
            },
          ],
        }),
      () =>
        JSON.stringify({
          branch_point: true,
          is_concluding_scene: false,
          choice_prompt: 'Which path?',
          next_scenelets: [
            {
              choice_label: 'Forest Path',
              description: 'Into the forest',
              dialogue: [{ character: 'Hero', line: "Let\'s go." }],
              shot_suggestions: ['Pan into trees'],
            },
            {
              choice_label: 'River Path',
              description: 'Follow the river',
              dialogue: [{ character: 'Hero', line: 'Water looks calm.' }],
              shot_suggestions: ['Track along river'],
            },
          ],
        }),
      () =>
        JSON.stringify({
          branch_point: false,
          is_concluding_scene: true,
          next_scenelets: [
            {
              description: 'Forest ending',
              dialogue: [{ character: 'Narrator', line: 'A peaceful grove.' }],
              shot_suggestions: ['Sunset through canopy'],
            },
          ],
        }),
      () =>
        JSON.stringify({
          branch_point: false,
          is_concluding_scene: true,
          next_scenelets: [
            {
              description: 'River ending',
              dialogue: [{ character: 'Narrator', line: 'A shimmering river.' }],
              shot_suggestions: ['Sparkling water'],
            },
          ],
        }),
    ];

    const geminiClient = new StubGeminiClient(responses);
    const persistence = new StubSceneletPersistence();

    await generateInteractiveStoryTree('story-123', '# Story Constitution', {
      geminiClient,
      promptLoader: async () => 'System prompt',
      sceneletPersistence: persistence,
    });

    expect(persistence.creates).toHaveLength(5);
    expect(persistence.creates[0].input.parentId).toBeNull();
    expect(persistence.creates[1].input.parentId).toBe('scenelet-1');
    expect(persistence.creates[2].input.parentId).toBe('scenelet-1');
    expect(persistence.creates[3].input.parentId).toBe('scenelet-3');
    expect(persistence.creates[4].input.parentId).toBe('scenelet-2');
    expect(persistence.branchMarks).toEqual([
      { id: 'scenelet-1', prompt: 'Which path?' },
    ]);
    expect(persistence.terminalMarks).toEqual(['scenelet-4', 'scenelet-5']);

    expect(geminiClient.requests[1].userContent).toContain('## Current Narrative Path');
  });

  it('logs Gemini request payload when logger is provided', async () => {
    const geminiClient = new StubGeminiClient([
      () =>
        JSON.stringify({
          branch_point: false,
          is_concluding_scene: true,
          next_scenelets: [
            {
              description: 'Closing scene',
              dialogue: [{ character: 'Narrator', line: 'The end.' }],
              shot_suggestions: ['Fade out'],
            },
          ],
        }),
    ]);
    const persistence = new StubSceneletPersistence();
    const logger = { debug: vi.fn() };

    await generateInteractiveStoryTree('story-logging', '# Constitution', {
      geminiClient,
      promptLoader: async () => 'interactive system prompt',
      sceneletPersistence: persistence,
      logger: logger as any,
    });

    expect(logger.debug).toHaveBeenCalledWith(
      'Interactive story Gemini request',
      expect.objectContaining({
        storyId: 'story-logging',
        geminiRequest: expect.objectContaining({
          systemInstruction: 'interactive system prompt',
          userContent: expect.stringContaining('# Constitution'),
        }),
      })
    );
  });

  it('throws when Gemini returns malformed JSON', async () => {
    const geminiClient = new StubGeminiClient([
      () => 'not json',
    ]);
    const persistence = new StubSceneletPersistence();

    await expect(
      generateInteractiveStoryTree('story-123', '# Constitution', {
        geminiClient,
        promptLoader: async () => 'System prompt',
        sceneletPersistence: persistence,
      })
    ).rejects.toThrowError();
  });

  it('rejects branch responses without parent id', async () => {
    const geminiClient = new StubGeminiClient([
      () =>
        JSON.stringify({
          branch_point: true,
          is_concluding_scene: false,
          choice_prompt: 'Choose wisely',
          next_scenelets: [
            {
              choice_label: 'Option A',
              description: 'Path A',
              dialogue: [{ character: 'Guide', line: 'A' }],
              shot_suggestions: ['Shot'],
            },
            {
              choice_label: 'Option B',
              description: 'Path B',
              dialogue: [{ character: 'Guide', line: 'B' }],
              shot_suggestions: ['Shot'],
            },
          ],
        }),
    ]);

    const persistence = new StubSceneletPersistence();

    await expect(
      generateInteractiveStoryTree('story-123', '# Constitution', {
        geminiClient,
        promptLoader: async () => 'System prompt',
        sceneletPersistence: persistence,
      })
    ).rejects.toBeInstanceOf(InteractiveStoryError);
  });

  it('requires non-empty identifiers and constitution', async () => {
    const persistence = new StubSceneletPersistence();

    await expect(
      generateInteractiveStoryTree('', '# Constitution', {
        geminiClient: new StubGeminiClient([]),
        promptLoader: async () => 'System prompt',
        sceneletPersistence: persistence,
      })
    ).rejects.toBeInstanceOf(InteractiveStoryError);

    await expect(
      generateInteractiveStoryTree('story-123', '  ', {
        geminiClient: new StubGeminiClient([]),
        promptLoader: async () => 'System prompt',
        sceneletPersistence: persistence,
      })
    ).rejects.toBeInstanceOf(InteractiveStoryError);
  });
});
