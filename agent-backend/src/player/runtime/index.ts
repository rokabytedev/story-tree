import type { StoryBundle, SceneletNode, BranchChoice, ShotNode } from '../../bundle/types.js';

const RAMP_UP_MS = 500;
const RAMP_DOWN_MS = 500;
const NO_AUDIO_HOLD_MS = 3000;

export type PlayerStage =
  | 'idle'
  | 'ramp-up'
  | 'audio'
  | 'ramp-down'
  | 'choice'
  | 'terminal'
  | 'incomplete';

type EventListener<TEvent extends PlayerEvent> = (event: TEvent) => void;

export type PlayerEvent =
  | { type: 'story-ready'; metadata: StoryBundle['metadata'] }
  | { type: 'stage-change'; stage: PlayerStage }
  | { type: 'scenelet-enter'; sceneletId: string; scenelet: SceneletNode }
  | {
      type: 'shot-enter';
      sceneletId: string;
      shotIndex: number;
      shot: ShotNode;
    }
  | {
      type: 'audio-start';
      sceneletId: string;
      shotIndex: number;
      shot: ShotNode;
      audioPath: string;
      requiresUserInteraction: boolean;
    }
  | {
      type: 'audio-missing';
      sceneletId: string;
      shotIndex: number;
      shot: ShotNode;
    }
  | {
      type: 'branch';
      sceneletId: string;
      prompt: string;
      choices: BranchChoice[];
    }
  | { type: 'terminal'; sceneletId: string }
  | { type: 'incomplete'; sceneletId: string }
  | { type: 'pause-change'; isPaused: boolean }
  | {
      type: 'music-change';
      cueName: string | null;
      audioPath: string | null;
    }
  | { type: 'branch-audio'; sceneletId: string; audioPath: string }
  | { type: 'branch-audio-stop'; sceneletId: string };

export interface PlayerState {
  stage: PlayerStage;
  isPaused: boolean;
  currentSceneletId: string | null;
  currentShotIndex: number;
  pendingChoices: BranchChoice[] | null;
  currentCue: string | null;
}

export interface PlayerController {
  start(): void;
  restart(): void;
  pause(): void;
  resume(): void;
  chooseBranch(sceneletId: string): void;
  notifyShotAudioComplete(): void;
  notifyShotAudioError(): void;
  getState(): PlayerState;
  subscribe<TType extends PlayerEvent['type']>(
    type: TType,
    listener: EventListener<Extract<PlayerEvent, { type: TType }>>
  ): () => void;
}

interface InternalState {
  story: StoryBundle;
  scenelets: Map<string, SceneletNode>;
  stage: PlayerStage;
  isPaused: boolean;
  currentSceneletId: string | null;
  currentShotIndex: number;
  currentTimer: ReturnType<typeof setTimeout> | null;
  pendingAction: (() => void) | null;
  pendingChoices: BranchChoice[] | null;
  initialAudioUnlockPending: boolean;
  currentCue: string | null;
  branchAudioTimer: ReturnType<typeof setTimeout> | null;
  activeBranchAudioSceneletId: string | null;
}

type ListenerMap = {
  [TType in PlayerEvent['type']]?: Set<EventListener<Extract<PlayerEvent, { type: TType }>>>;
};

export interface PlayerRuntimeOptions {
  /**
   * Optional override for scheduling logic, primarily used for testing.
   */
  schedule?(callback: () => void, delay: number): ReturnType<typeof setTimeout>;
  clearTimer?(handle: ReturnType<typeof setTimeout> | null): void;
}

export function createPlayerController(
  bundle: StoryBundle,
  options: PlayerRuntimeOptions = {}
): PlayerController {
  validateBundle(bundle);

  const scenelets = new Map<string, SceneletNode>();
  for (const scenelet of bundle.scenelets) {
    scenelets.set(scenelet.id, scenelet);
  }

  const listeners: ListenerMap = {};
  const schedule = options.schedule ?? ((callback, delay) => setTimeout(callback, delay));
  const clearTimer = options.clearTimer ?? ((handle) => {
    if (handle) {
      clearTimeout(handle);
    }
  });

  const state: InternalState = {
    story: bundle,
    scenelets,
    stage: 'idle',
    isPaused: false,
    currentSceneletId: null,
    currentShotIndex: 0,
    currentTimer: null,
    pendingAction: null,
    pendingChoices: null,
    initialAudioUnlockPending: true,
    currentCue: null,
    branchAudioTimer: null,
    activeBranchAudioSceneletId: null,
  };

  emit({ type: 'story-ready', metadata: bundle.metadata });

  return {
    start,
    restart,
    pause,
    resume,
    chooseBranch,
    notifyShotAudioComplete,
    notifyShotAudioError,
    getState,
    subscribe,
  };

  function subscribe<TType extends PlayerEvent['type']>(
    type: TType,
    listener: EventListener<Extract<PlayerEvent, { type: TType }>>
  ): () => void {
    const bucket =
      (listeners[type] as Set<EventListener<Extract<PlayerEvent, { type: TType }>>>) ??
      new Set<EventListener<Extract<PlayerEvent, { type: TType }>>>();
    bucket.add(listener);
    listeners[type] = bucket as ListenerMap[TType];
    return () => {
      bucket.delete(listener);
    };
  }

  function emit<TEvent extends PlayerEvent>(event: TEvent): void {
    const bucket = listeners[event.type];
    if (!bucket || bucket.size === 0) {
      return;
    }
    for (const listener of bucket) {
      listener(event as never);
    }
  }

  function start(): void {
    resetPlaybackState();
    const rootScenelet = state.story.rootSceneletId;
    playScenelet(rootScenelet);
  }

  function restart(): void {
    start();
  }

  function pause(): void {
    if (state.isPaused) {
      return;
    }
    state.isPaused = true;
    clearCurrentTimer();
    emit({ type: 'pause-change', isPaused: true });
  }

  function resume(): void {
    if (!state.isPaused) {
      return;
    }
    state.isPaused = false;
    emit({ type: 'pause-change', isPaused: false });
    if (state.pendingAction) {
      const action = state.pendingAction;
      state.pendingAction = null;
      action();
    }
  }

  function chooseBranch(sceneletId: string): void {
    if (state.stage !== 'choice') {
      throw new Error('Cannot choose a branch when no branching options are active.');
    }
    const targetId = sceneletId.trim();
    if (!targetId) {
      throw new Error('Branch selection requires a valid scenelet id.');
    }
    if (!state.scenelets.has(targetId)) {
      throw new Error(`Branch selection references unknown scenelet ${targetId}.`);
    }
    stopBranchAudio();
    state.pendingChoices = null;
    state.isPaused = false;
    playScenelet(targetId);
  }

  function notifyShotAudioComplete(): void {
    if (!state.currentSceneletId) {
      return;
    }
    if (state.stage !== 'audio' && state.stage !== 'ramp-up') {
      return;
    }
    if (state.stage === 'ramp-up') {
      state.pendingAction = () => notifyShotAudioComplete();
      return;
    }
    setStage('ramp-down');
    scheduleAction(advanceAfterShot, RAMP_DOWN_MS);
  }

  function notifyShotAudioError(): void {
    notifyShotAudioComplete();
  }

  function getState(): PlayerState {
    return {
      stage: state.stage,
      isPaused: state.isPaused,
      currentSceneletId: state.currentSceneletId,
      currentShotIndex: state.currentShotIndex,
      pendingChoices: state.pendingChoices ? [...state.pendingChoices] : null,
      currentCue: state.currentCue,
    };
  }

  function playScenelet(sceneletId: string): void {
    stopBranchAudio();
    const scenelet = state.scenelets.get(sceneletId);
    if (!scenelet) {
      throw new Error(`Scenelet ${sceneletId} is missing from story data.`);
    }
    state.currentSceneletId = sceneletId;
    state.currentShotIndex = 0;
    emitMusicCueForScenelet(sceneletId);
    emit({ type: 'scenelet-enter', sceneletId, scenelet });
    playShot(scenelet, scenelet.shots[0]);
  }

  function playShot(scenelet: SceneletNode, shot: ShotNode): void {
    state.currentSceneletId = scenelet.id;
    const shotIndex = scenelet.shots.indexOf(shot);
    state.currentShotIndex = shotIndex;
    state.isPaused = false;
    state.pendingChoices = null;
    setStage('ramp-up');
    emit({
      type: 'shot-enter',
      sceneletId: scenelet.id,
      shotIndex,
      shot,
    });
    scheduleAction(() => onShotRampUpComplete(scenelet, shot), RAMP_UP_MS);
  }

  function onShotRampUpComplete(scenelet: SceneletNode, shot: ShotNode): void {
    if (shot.audioPath) {
      setStage('audio');
      emit({
        type: 'audio-start',
        sceneletId: scenelet.id,
        shotIndex: state.currentShotIndex,
        shot,
        audioPath: shot.audioPath,
        requiresUserInteraction: state.initialAudioUnlockPending,
      });
      state.initialAudioUnlockPending = false;
      return;
    }

    setStage('audio');
    emit({
      type: 'audio-missing',
      sceneletId: scenelet.id,
      shotIndex: state.currentShotIndex,
      shot,
    });
    scheduleAction(notifyShotAudioComplete, NO_AUDIO_HOLD_MS);
  }

  function advanceAfterShot(): void {
    if (!state.currentSceneletId) {
      return;
    }
    const scenelet = state.scenelets.get(state.currentSceneletId);
    if (!scenelet) {
      return;
    }

    const nextShot = scenelet.shots[state.currentShotIndex + 1];
    if (nextShot) {
      playShot(scenelet, nextShot);
      return;
    }

    const next = scenelet.next;
    switch (next.type) {
      case 'linear': {
        playScenelet(next.sceneletId);
        return;
      }
      case 'branch': {
        state.stage = 'choice';
        state.isPaused = true;
        state.pendingChoices = [...next.choices];
        emit({ type: 'pause-change', isPaused: true });
        emit({
          type: 'branch',
          sceneletId: scenelet.id,
          prompt: next.choicePrompt,
          choices: next.choices,
        });
        emit({ type: 'stage-change', stage: 'choice' });
        scheduleBranchAudioPlayback(scenelet);
        return;
      }
      case 'terminal': {
        state.stage = 'terminal';
        state.isPaused = true;
        emit({ type: 'pause-change', isPaused: true });
        emit({ type: 'terminal', sceneletId: scenelet.id });
        emit({ type: 'stage-change', stage: 'terminal' });
        return;
      }
      case 'incomplete': {
        state.stage = 'incomplete';
        state.isPaused = true;
        emit({ type: 'pause-change', isPaused: true });
        emit({ type: 'incomplete', sceneletId: scenelet.id });
        emit({ type: 'stage-change', stage: 'incomplete' });
        return;
      }
      default:
        return;
    }
  }

  function emitMusicCueForScenelet(sceneletId: string): void {
    const cueMap = state.story.music?.sceneletCueMap ?? {};
    const cueName = cueMap[sceneletId] ?? null;
    if (cueName === state.currentCue) {
      return;
    }

    const cueEntry = state.story.music?.cues?.find((cue) => cue.cueName === cueName) ?? null;
    const audioPath = cueEntry?.audioPath ?? null;
    state.currentCue = cueName ?? null;
    emit({
      type: 'music-change',
      cueName: cueName ?? null,
      audioPath,
    });
  }

  function scheduleBranchAudioPlayback(scenelet: SceneletNode): void {
    clearBranchAudioTimer();
    if (!scenelet.branchAudioPath) {
      state.activeBranchAudioSceneletId = null;
      return;
    }

    state.branchAudioTimer = schedule(() => {
      state.activeBranchAudioSceneletId = scenelet.id;
      emit({
        type: 'branch-audio',
        sceneletId: scenelet.id,
        audioPath: scenelet.branchAudioPath!,
      });
    }, RAMP_UP_MS);
  }

  function clearBranchAudioTimer(): void {
    if (state.branchAudioTimer) {
      clearTimer(state.branchAudioTimer);
      state.branchAudioTimer = null;
    }
  }

  function stopBranchAudio(): void {
    clearBranchAudioTimer();
    if (state.activeBranchAudioSceneletId) {
      emit({
        type: 'branch-audio-stop',
        sceneletId: state.activeBranchAudioSceneletId,
      });
      state.activeBranchAudioSceneletId = null;
    }
  }

  function resetPlaybackState(): void {
    clearCurrentTimer();
    stopBranchAudio();
    state.pendingAction = null;
    state.currentSceneletId = null;
    state.currentShotIndex = 0;
    state.isPaused = false;
    state.stage = 'idle';
    state.pendingChoices = null;
    state.initialAudioUnlockPending = true;
    state.currentCue = null;
    emit({ type: 'stage-change', stage: 'idle' });
    emit({ type: 'pause-change', isPaused: false });
    emit({
      type: 'music-change',
      cueName: null,
      audioPath: null,
    });
  }

  function scheduleAction(callback: () => void, delay: number): void {
    clearCurrentTimer();
    state.pendingAction = callback;
    if (state.isPaused) {
      return;
    }
    state.currentTimer = schedule(() => {
      state.currentTimer = null;
      const action = state.pendingAction;
      state.pendingAction = null;
      if (typeof action === 'function') {
        action();
      }
    }, delay);
  }

  function clearCurrentTimer(): void {
    if (state.currentTimer !== null) {
      clearTimer(state.currentTimer);
      state.currentTimer = null;
    }
  }

  function setStage(stage: PlayerStage): void {
    if (state.stage === stage) {
      return;
    }
    state.stage = stage;
    emit({ type: 'stage-change', stage });
  }
}

function validateBundle(bundle: StoryBundle): void {
  if (!bundle || typeof bundle !== 'object') {
    throw new Error('Story JSON must contain an object.');
  }

  if (!bundle.metadata || typeof bundle.metadata !== 'object') {
    throw new Error('Story JSON missing metadata block.');
  }

  if (!bundle.rootSceneletId || typeof bundle.rootSceneletId !== 'string') {
    throw new Error('Story JSON missing rootSceneletId.');
  }

  if (!Array.isArray(bundle.scenelets) || bundle.scenelets.length === 0) {
    throw new Error('Story JSON missing scenelets array.');
  }

  const sceneletIds = new Set<string>();

  for (const entry of bundle.scenelets) {
    if (!entry || typeof entry !== 'object') {
      throw new Error('Each scenelet must be an object.');
    }
    const sceneletId = entry.id;
    if (typeof sceneletId !== 'string' || !sceneletId.trim()) {
      throw new Error('Scenelet missing id field.');
    }
    if (sceneletIds.has(sceneletId)) {
      throw new Error(`Duplicate scenelet id detected: ${sceneletId}`);
    }
    sceneletIds.add(sceneletId);

    if (!Array.isArray(entry.shots) || entry.shots.length === 0) {
      throw new Error(`Scenelet ${sceneletId} is missing playable shots.`);
    }
    for (const shot of entry.shots) {
      if (!shot || typeof shot !== 'object') {
        throw new Error(`Scenelet ${sceneletId} contains an invalid shot.`);
      }
      if (!Number.isInteger(shot.shotIndex)) {
        throw new Error(`Scenelet ${sceneletId} shot is missing shotIndex.`);
      }
    }

    if (!entry.next || typeof entry.next !== 'object' || typeof entry.next.type !== 'string') {
      throw new Error(`Scenelet ${sceneletId} missing next transition configuration.`);
    }
  }

  if (!sceneletIds.has(bundle.rootSceneletId)) {
    throw new Error(`Story root scenelet ${bundle.rootSceneletId} does not exist in scenelets array.`);
  }

  for (const entry of bundle.scenelets) {
    switch (entry.next.type) {
      case 'linear': {
        const target = entry.next.sceneletId;
        if (typeof target !== 'string' || !sceneletIds.has(target)) {
          throw new Error(
            `Scenelet ${entry.id} references missing scenelet ${target ?? '(unknown)'}.`
          );
        }
        break;
      }
      case 'branch': {
        const choices = entry.next.choices;
        if (!Array.isArray(choices) || choices.length === 0) {
          throw new Error(`Scenelet ${entry.id} has a branch without choices.`);
        }
        for (const choice of choices) {
          if (!choice || typeof choice !== 'object') {
            throw new Error(`Scenelet ${entry.id} contains an invalid branch choice.`);
          }
          if (typeof choice.sceneletId !== 'string' || !sceneletIds.has(choice.sceneletId)) {
            throw new Error(
              `Scenelet ${entry.id} choice references missing scenelet ${choice.sceneletId ?? '(unknown)'}.`
            );
          }
        }
        break;
      }
      default:
        break;
    }
  }
}
