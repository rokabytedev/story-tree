import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import type { StoryBundle } from '../src/bundle/types.js';
import { createPlayerController, type PlayerEvent } from '../src/player/runtime/index.js';

function createSampleBundle(overrides: Partial<StoryBundle> = {}): StoryBundle {
  const base: StoryBundle = {
    metadata: {
      storyId: 'story-1',
      title: 'Sample Story',
      exportedAt: new Date().toISOString(),
    },
    rootSceneletId: 'scenelet-1',
    scenelets: [
      {
        id: 'scenelet-1',
        description: 'Opening',
        shots: [{ shotIndex: 0, imagePath: '/image-1.png', audioPath: null }],
        branchAudioPath: null,
        next: { type: 'terminal' },
      },
    ],
    music: {
      cues: [],
      sceneletCueMap: {},
    },
  };

  return { ...base, ...overrides };
}

function collectEvents(controller: ReturnType<typeof createPlayerController>): PlayerEvent[] {
  const events: PlayerEvent[] = [];
  const eventTypes: PlayerEvent['type'][] = [
    'story-ready',
    'stage-change',
    'scenelet-enter',
    'shot-enter',
    'audio-start',
    'audio-missing',
    'branch',
    'branch-audio',
    'branch-audio-stop',
    'terminal',
    'incomplete',
    'pause-change',
    'music-change',
  ];

  for (const type of eventTypes) {
    controller.subscribe(type as PlayerEvent['type'], (event) => {
      events.push(event);
    });
  }

  return events;
}

describe('createPlayerController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('throws descriptive errors for invalid bundles', () => {
    expect(() => createPlayerController({} as StoryBundle)).toThrow('Story JSON missing metadata block.');

    const invalidBundle = createSampleBundle({
      scenelets: [
        {
          id: 'scenelet-1',
          description: 'Missing shots',
          shots: [],
          next: { type: 'terminal' },
        },
      ],
    });

    expect(() => createPlayerController(invalidBundle)).toThrow(
      'Scenelet scenelet-1 is missing playable shots.'
    );
  });

  it('emits events with correct ordering for linear stories', () => {
    const bundle = createSampleBundle();
    const controller = createPlayerController(bundle);
    const events = collectEvents(controller);

    controller.start();

    // ramp-up completed
    vi.advanceTimersByTime(500);
    // no audio hold
    vi.advanceTimersByTime(3000);
    // ramp-down
    vi.advanceTimersByTime(500);

    expect(events.filter((event) => event.type === 'scenelet-enter')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'shot-enter')).toHaveLength(1);
    expect(events.some((event) => event.type === 'audio-missing')).toBe(true);
    expect(events.some((event) => event.type === 'terminal')).toBe(true);

    const terminalEvent = events.find((event) => event.type === 'terminal');
    expect(terminalEvent).toBeTruthy();
    expect(controller.getState().stage).toBe('terminal');
    expect(controller.getState().isPaused).toBe(true);
  });

  it('pauses timers and resumes pending actions', () => {
    const bundle = createSampleBundle();
    const controller = createPlayerController(bundle);

    controller.start();
    controller.pause();

    // Timer should not advance while paused.
    vi.advanceTimersByTime(1000);
    expect(controller.getState().stage).toBe('ramp-up');

    controller.resume();
    vi.advanceTimersByTime(500);
    expect(controller.getState().stage).toBe('audio');
  });

  it('exposes branch choices and advances on selection', () => {
    const bundle = createSampleBundle({
      scenelets: [
      {
        id: 'scenelet-1',
        description: 'Branch start',
        shots: [{ shotIndex: 0, imagePath: null, audioPath: null }],
        branchAudioPath: 'assets/branches/scenelet-1/branch_audio.wav',
        next: {
          type: 'branch',
          choicePrompt: 'Choose a path',
          choices: [
            { label: 'Path A', sceneletId: 'scenelet-2' },
            { label: 'Path B', sceneletId: 'scenelet-3' },
          ],
        },
      },
      {
        id: 'scenelet-2',
        description: 'Path A',
        shots: [{ shotIndex: 0, imagePath: null, audioPath: null }],
        branchAudioPath: null,
        next: { type: 'terminal' },
      },
      {
        id: 'scenelet-3',
        description: 'Path B',
        shots: [{ shotIndex: 0, imagePath: null, audioPath: null }],
        branchAudioPath: null,
        next: { type: 'terminal' },
      },
      ],
    });

    const controller = createPlayerController(bundle);
    const events = collectEvents(controller);

    controller.start();
    vi.advanceTimersByTime(500); // ramp-up
    vi.advanceTimersByTime(3000); // no audio hold
    vi.advanceTimersByTime(500); // ramp-down

    const branchEvent = events.find((event) => event.type === 'branch');
    expect(branchEvent).toBeTruthy();
    expect(controller.getState().stage).toBe('choice');

    vi.advanceTimersByTime(500); // branch audio ramp-up

    const branchAudioEvents = events.filter((event) => event.type === 'branch-audio');
    expect(branchAudioEvents).toHaveLength(1);
    expect(branchAudioEvents[0]).toMatchObject({
      type: 'branch-audio',
      sceneletId: 'scenelet-1',
      audioPath: 'assets/branches/scenelet-1/branch_audio.wav',
    });

    controller.chooseBranch('scenelet-2');
    vi.advanceTimersByTime(500);

    const branchAudioStopEvents = events.filter((event) => event.type === 'branch-audio-stop');
    expect(branchAudioStopEvents).toHaveLength(1);

    const sceneletEvents = events.filter((event) => event.type === 'scenelet-enter');
    expect(sceneletEvents.map((event) => event.sceneletId)).toContain('scenelet-2');
  });

  it('emits branch audio stop when restarting during a branch', () => {
    const bundle = createSampleBundle({
      scenelets: [
        {
          id: 'scenelet-1',
          description: 'Branch start',
          shots: [{ shotIndex: 0, imagePath: null, audioPath: null }],
          branchAudioPath: 'assets/branches/scenelet-1/branch_audio.wav',
          next: {
            type: 'branch',
            choicePrompt: 'Choose a door',
            choices: [
              { label: 'Door A', sceneletId: 'scenelet-2' },
              { label: 'Door B', sceneletId: 'scenelet-3' },
            ],
          },
        },
        {
          id: 'scenelet-2',
          description: 'Door A',
          shots: [{ shotIndex: 0, imagePath: null, audioPath: null }],
          branchAudioPath: null,
          next: { type: 'terminal' },
        },
        {
          id: 'scenelet-3',
          description: 'Door B',
          shots: [{ shotIndex: 0, imagePath: null, audioPath: null }],
          branchAudioPath: null,
          next: { type: 'terminal' },
        },
      ],
    });

    const controller = createPlayerController(bundle);
    const events = collectEvents(controller);

    controller.start();
    vi.advanceTimersByTime(500); // ramp-up
    vi.advanceTimersByTime(3000); // no audio hold
    vi.advanceTimersByTime(500); // ramp-down to branch
    vi.advanceTimersByTime(500); // branch audio grace period

    expect(events.some((event) => event.type === 'branch-audio')).toBe(true);

    controller.restart();

    const branchAudioStopEvents = events.filter((event) => event.type === 'branch-audio-stop');
    expect(branchAudioStopEvents).toHaveLength(1);
  });
});
