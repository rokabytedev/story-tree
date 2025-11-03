"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "@heroicons/react/24/solid";
import type { BranchChoice, ShotNode, StoryBundle } from "../../../../../agent-backend/src/bundle/types.js";
import {
  createPlayerController,
  type PlayerController,
  type PlayerStage,
} from "../../../../../agent-backend/src/player/runtime/index.js";

type PlayerViewState = {
  stage: PlayerStage;
  currentSceneletId: string | null;
  currentShot: ShotNode | null;
  isPaused: boolean;
  choices: BranchChoice[] | null;
  choicePrompt: string | null;
  reachedTerminal: boolean;
  reachedIncomplete: boolean;
};

type EmbeddedPlayerProps = {
  bundle: StoryBundle;
};

const INITIAL_VIEW_STATE: PlayerViewState = {
  stage: "idle",
  currentSceneletId: null,
  currentShot: null,
  isPaused: true,
  choices: null,
  choicePrompt: null,
  reachedTerminal: false,
  reachedIncomplete: false,
};

const MUSIC_VOLUME = 0.25;
const MUSIC_CROSSFADE_MS = 500;
const MUSIC_FADE_INTERVAL_MS = 50;

type MusicState = {
  activeElement: HTMLAudioElement | null;
  pendingElement: HTMLAudioElement | null;
  pendingCue: string | null;
  fadeTimer: number | null;
  pausedElements: HTMLAudioElement[];
  currentCue: string | null;
};

export function EmbeddedPlayer({ bundle }: EmbeddedPlayerProps) {
  const [viewState, setViewState] = useState<PlayerViewState>({
    ...INITIAL_VIEW_STATE,
    currentSceneletId: bundle.rootSceneletId ?? null,
  });
  const [title] = useState(() => bundle.metadata.title ?? "Untitled Story");

  const controllerRef = useRef<PlayerController | null>(null);
  const shotAudioRef = useRef<HTMLAudioElement | null>(null);
  const musicPrimaryRef = useRef<HTMLAudioElement | null>(null);
  const musicSecondaryRef = useRef<HTMLAudioElement | null>(null);
  const musicStateRef = useRef<MusicState>({
    activeElement: null,
    pendingElement: null,
    pendingCue: null,
    fadeTimer: null,
    pausedElements: [],
    currentCue: null,
  });
  const audioShouldResumeRef = useRef(false);
  const branchAudioActiveRef = useRef(false);
  const failedMusicCuesRef = useRef<Set<string>>(new Set());

  const sceneletLookup = useMemo(() => {
    const map = new Map<string, StoryBundle["scenelets"][number]>();
    for (const scenelet of bundle.scenelets) {
      map.set(scenelet.id, scenelet);
    }
    return map;
  }, [bundle.scenelets]);

  const startVisualImage = useMemo(() => {
    const root = sceneletLookup.get(bundle.rootSceneletId);
    if (!root) {
      return null;
    }
    const shot = root.shots.find((entry) => typeof entry.imagePath === "string" && entry.imagePath.trim().length > 0);
    return shot?.imagePath ?? null;
  }, [bundle.rootSceneletId, sceneletLookup]);

  const initialShot = useMemo(() => {
    const root = sceneletLookup.get(bundle.rootSceneletId);
    if (!root) {
      return null;
    }
    const shotWithImage = root.shots.find((entry) => entry.imagePath);
    return (shotWithImage as ShotNode | undefined) ?? root.shots[0] ?? null;
  }, [bundle.rootSceneletId, sceneletLookup]);

  const getChoicePreviewImage = useCallback(
    (sceneletId: string) => {
      const target = sceneletLookup.get(sceneletId);
      if (!target) {
        return null;
      }
      const shotWithImage = target.shots.find((entry) => entry.imagePath);
      return shotWithImage?.imagePath ?? null;
    },
    [sceneletLookup]
  );

  useEffect(() => {
    const controller = createPlayerController(bundle);
    controllerRef.current = controller;
    const subscriptions = createRuntimeSubscriptions(controller);
    setViewState({
      ...INITIAL_VIEW_STATE,
      currentSceneletId: bundle.rootSceneletId ?? null,
      currentShot: initialShot,
    });
    return () => {
      subscriptions.forEach((unsubscribe) => unsubscribe());
      controllerRef.current = null;
    };
  }, [bundle, initialShot]);

  useEffect(() => {
    const audio = shotAudioRef.current;
    const controller = controllerRef.current;
    if (!audio || !controller) {
      return;
    }
    const handleEnded = () => {
      if (branchAudioActiveRef.current) {
        branchAudioActiveRef.current = false;
        stopShotAudio();
        return;
      }
      controller.notifyShotAudioComplete();
    };
    const handleError = (event: Event) => {
      if (branchAudioActiveRef.current) {
        branchAudioActiveRef.current = false;
        console.warn("Branch audio failed due to an element error.", event);
        stopShotAudio();
        return;
      }
      controller.notifyShotAudioError();
    };
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [bundle]);

  function createRuntimeSubscriptions(controller: PlayerController) {
    const unsubscriptions: Array<() => void> = [];

    unsubscriptions.push(
      controller.subscribe("stage-change", ({ stage }) => {
        setViewState((prev) => ({
          ...prev,
          stage,
          isPaused: controller.getState().isPaused,
          choices: stage === "choice" ? prev.choices : null,
          choicePrompt: stage === "choice" ? prev.choicePrompt : null,
          reachedTerminal: stage === "terminal" ? prev.reachedTerminal : false,
          reachedIncomplete: stage === "incomplete" ? prev.reachedIncomplete : false,
        }));
      })
    );

    unsubscriptions.push(
      controller.subscribe("scenelet-enter", ({ sceneletId }) => {
        setViewState((prev) => ({
          ...prev,
          currentSceneletId: sceneletId,
          reachedTerminal: false,
          reachedIncomplete: false,
        }));
      })
    );

    unsubscriptions.push(
      controller.subscribe("shot-enter", ({ shot }) => {
        setViewState((prev) => ({
          ...prev,
          currentShot: shot,
        }));
      })
    );

    unsubscriptions.push(
      controller.subscribe("audio-start", ({ audioPath, requiresUserInteraction }) => {
        const audio = shotAudioRef.current;
        if (!audio) {
          return;
        }

        branchAudioActiveRef.current = false;
        audio.pause();
        audio.src = audioPath;
        audio.currentTime = 0;
        audioShouldResumeRef.current = false;
        audio.play().catch((error) => {
          console.warn("Shot audio failed to play.", error);
          if (requiresUserInteraction) {
            controller.notifyShotAudioError();
          }
        });
      })
    );

    unsubscriptions.push(
      controller.subscribe("audio-missing", () => {
        branchAudioActiveRef.current = false;
        stopShotAudio();
      })
    );

    unsubscriptions.push(
      controller.subscribe("branch", ({ choices, prompt }) => {
        setViewState((prev) => ({
          ...prev,
          choices,
          choicePrompt: prompt,
        }));
      })
    );

    unsubscriptions.push(
      controller.subscribe("branch-audio", ({ audioPath }) => {
        const audio = shotAudioRef.current;
        if (!audio) {
          return;
        }
        stopShotAudio();
        branchAudioActiveRef.current = true;
        audio.src = audioPath;
        audio.currentTime = 0;
        audioShouldResumeRef.current = false;
        audio.play().catch((error) => {
          stopShotAudio();
          branchAudioActiveRef.current = false;
          console.warn("Branch audio failed to play.", error);
        });
      })
    );

    unsubscriptions.push(
      controller.subscribe("branch-audio-stop", () => {
        if (branchAudioActiveRef.current) {
          stopShotAudio();
        }
      })
    );

    unsubscriptions.push(
      controller.subscribe("terminal", () => {
        setViewState((prev) => ({
          ...prev,
          reachedTerminal: true,
        }));
      })
    );

    unsubscriptions.push(
      controller.subscribe("incomplete", () => {
        setViewState((prev) => ({
          ...prev,
          reachedIncomplete: true,
        }));
      })
    );

    unsubscriptions.push(
      controller.subscribe("pause-change", ({ isPaused }) => {
        const audio = shotAudioRef.current;
        const currentStage = controllerRef.current?.getState().stage ?? undefined;
        const shouldControlMusic = currentStage !== "choice";
        if (isPaused) {
          if (audio && !audio.paused && !audio.ended && audio.currentTime > 0) {
            audioShouldResumeRef.current = true;
            audio.pause();
          } else {
            audioShouldResumeRef.current = false;
          }
          if (shouldControlMusic) {
            pauseBackgroundMusic();
          }
        } else {
          if (audioShouldResumeRef.current && audio) {
            audioShouldResumeRef.current = false;
            audio.play().catch(() => controller.notifyShotAudioError());
          }
          if (shouldControlMusic) {
            resumeBackgroundMusic();
          }
        }

        setViewState((prev) => ({
          ...prev,
          isPaused,
        }));
      })
    );

    unsubscriptions.push(
      controller.subscribe("music-change", ({ cueName, audioPath }) => {
        if (!audioPath || !cueName) {
          fadeOutMusic();
          return;
        }

        if (failedMusicCuesRef.current.has(cueName)) {
          return;
        }

        crossfadeToCue(cueName, audioPath);
      })
    );

    return unsubscriptions;
  }

  function stopShotAudio() {
    const audio = shotAudioRef.current;
    if (!audio) {
      return;
    }
    audio.pause();
    if (audio.hasAttribute("src")) {
      audio.removeAttribute("src");
      audio.load();
    }
    audioShouldResumeRef.current = false;
    branchAudioActiveRef.current = false;
  }

  function handleRestartPlayback() {
    setViewState((prev) => ({
      ...prev,
      reachedTerminal: false,
      reachedIncomplete: false,
      choices: null,
      choicePrompt: null,
      isPaused: false,
    }));
    stopShotAudio();
    controllerRef.current?.restart();
  }

  function handleTogglePause() {
    const controller = controllerRef.current;
    if (!controller) {
      return;
    }
    const { stage, isPaused } = controller.getState();
    if (stage === "idle") {
      controller.start();
      setViewState((prev) => ({
        ...prev,
        isPaused: false,
      }));
      return;
    }
    if (stage === "choice" || stage === "terminal" || stage === "incomplete") {
      return;
    }
    if (isPaused) {
      controller.resume();
    } else {
      controller.pause();
    }
  }

  function handleChoiceSelect(choice: BranchChoice) {
    controllerRef.current?.chooseBranch(choice.sceneletId);
    setViewState((prev) => ({
      ...prev,
      choices: null,
      choicePrompt: null,
      reachedTerminal: false,
      reachedIncomplete: false,
    }));
  }

  function pauseBackgroundMusic() {
    const musicState = musicStateRef.current;
    musicState.pausedElements = [];
    [musicPrimaryRef.current, musicSecondaryRef.current].forEach((element) => {
      if (element && !element.paused && element.currentTime > 0) {
        element.pause();
        musicState.pausedElements.push(element);
      }
    });
  }

  function resumeBackgroundMusic() {
    const musicState = musicStateRef.current;
    const toResume = Array.isArray(musicState.pausedElements) ? musicState.pausedElements : [];
    musicState.pausedElements = [];
    toResume.forEach((element) => {
      element.play().catch((error) => {
        const cueName = element.dataset?.cueName ?? musicState.currentCue ?? "";
        if (cueName) {
          failedMusicCuesRef.current.add(cueName);
        }
        console.warn("Background music failed to resume after pause.", { cueName, error });
        fadeOutMusic(true);
      });
    });
  }

  function crossfadeToCue(cueName: string, audioPath: string) {
    const musicState = musicStateRef.current;
    const incoming = getInactiveMusicElement();
    if (!incoming) {
      console.warn("No audio element available for background music playback.");
      return;
    }

    clearMusicFadeTimer();
    musicState.pendingCue = cueName;
    musicState.pendingElement = incoming;

    resetMusicElement(incoming);
    incoming.dataset.cueName = cueName;
    incoming.src = audioPath;
    incoming.currentTime = 0;
    incoming.volume = 0;

    const playPromise = incoming.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((error) => {
        console.warn("Unable to start background music cue.", { cueName, error });
        failedMusicCuesRef.current.add(cueName);
        if (musicState.pendingCue === cueName) {
          musicState.pendingCue = null;
          musicState.pendingElement = null;
        }
        fadeOutMusic(true);
      });
    }

    const outgoing =
      musicState.activeElement && musicState.activeElement !== incoming ? musicState.activeElement : null;

    if (!outgoing || MUSIC_CROSSFADE_MS === 0) {
      if (outgoing) {
        resetMusicElement(outgoing);
      }
      incoming.volume = MUSIC_VOLUME;
      musicState.activeElement = incoming;
      musicState.currentCue = cueName;
      musicState.pendingCue = null;
      musicState.pendingElement = null;
      return;
    }

    const startTime = performance.now();
    musicState.fadeTimer = window.setInterval(() => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / MUSIC_CROSSFADE_MS, 1);
      incoming.volume = MUSIC_VOLUME * progress;
      outgoing.volume = MUSIC_VOLUME * (1 - progress);

      if (progress >= 1) {
        clearMusicFadeTimer();
        resetMusicElement(outgoing);
        incoming.volume = MUSIC_VOLUME;
        musicState.activeElement = incoming;
        musicState.currentCue = cueName;
        musicState.pendingCue = null;
        musicState.pendingElement = null;
      }
    }, Math.max(MUSIC_FADE_INTERVAL_MS, 16));
  }

  function fadeOutMusic(stopImmediately = false) {
    const musicState = musicStateRef.current;
    const active = musicState.activeElement;

    if (!active) {
      clearPendingMusicCue();
      musicState.currentCue = null;
      return;
    }

    if (stopImmediately || MUSIC_CROSSFADE_MS === 0) {
      clearMusicFadeTimer();
      resetMusicElement(active);
      musicState.activeElement = null;
      musicState.currentCue = null;
      clearPendingMusicCue();
      return;
    }

    clearMusicFadeTimer();
    const startTime = performance.now();
    musicState.fadeTimer = window.setInterval(() => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / MUSIC_CROSSFADE_MS, 1);
      active.volume = MUSIC_VOLUME * (1 - progress);

      if (progress >= 1) {
        clearMusicFadeTimer();
        resetMusicElement(active);
        musicState.activeElement = null;
        musicState.currentCue = null;
        clearPendingMusicCue();
      }
    }, Math.max(MUSIC_FADE_INTERVAL_MS, 16));
  }

  function clearPendingMusicCue() {
    const musicState = musicStateRef.current;
    if (musicState.pendingElement) {
      resetMusicElement(musicState.pendingElement);
    }
    musicState.pendingElement = null;
    musicState.pendingCue = null;
  }

  function clearMusicFadeTimer() {
    const musicState = musicStateRef.current;
    if (musicState.fadeTimer !== null) {
      clearInterval(musicState.fadeTimer);
      musicState.fadeTimer = null;
    }
  }

  function getInactiveMusicElement(): HTMLAudioElement | null {
    const primary = musicPrimaryRef.current;
    const secondary = musicSecondaryRef.current;
    if (!primary && !secondary) {
      return null;
    }

    const active = musicStateRef.current.activeElement;
    if (!active) {
      return primary ?? secondary;
    }

    if (active === primary) {
      return secondary ?? primary;
    }
    return primary ?? secondary;
  }

  function resetMusicElement(element: HTMLAudioElement | null) {
    if (!element) {
      return;
    }
    element.pause();
    if (element.hasAttribute("src")) {
      element.removeAttribute("src");
      element.load();
    }
    element.volume = 0;
    if (element.dataset) {
      element.dataset.cueName = "";
    }
  }

  const showChoiceOverlay = viewState.stage === "choice" && Array.isArray(viewState.choices);
  const showTerminalOverlay = viewState.stage === "terminal" && viewState.reachedTerminal;
  const showIncompleteOverlay = viewState.stage === "incomplete" && viewState.reachedIncomplete;

  return (
    <div className="relative flex w-full flex-col gap-6">
      <PlayerSurface
        title={title}
        shot={viewState.currentShot}
        isPaused={viewState.isPaused}
        onTogglePause={handleTogglePause}
        onRestart={handleRestartPlayback}
        showChoiceOverlay={showChoiceOverlay}
        choicePrompt={viewState.choicePrompt}
        choices={viewState.choices}
        onChoiceSelect={handleChoiceSelect}
        showTerminalOverlay={showTerminalOverlay}
        showIncompleteOverlay={showIncompleteOverlay}
        getChoicePreviewImage={getChoicePreviewImage}
        startImage={startVisualImage}
        stage={viewState.stage}
      />
      <audio ref={shotAudioRef} preload="auto" data-testid="shot-audio" />
      <audio ref={musicPrimaryRef} preload="auto" loop />
      <audio ref={musicSecondaryRef} preload="auto" loop />
    </div>
  );
}

type PlayerSurfaceProps = {
  title: string;
  shot: ShotNode | null;
  isPaused: boolean;
  onTogglePause: () => void;
  onRestart: () => void;
  showChoiceOverlay: boolean;
  choicePrompt: string | null;
  choices: BranchChoice[] | null;
  onChoiceSelect: (choice: BranchChoice) => void;
  showTerminalOverlay: boolean;
  showIncompleteOverlay: boolean;
  getChoicePreviewImage: (sceneletId: string) => string | null;
  startImage: string | null;
  stage: PlayerStage;
};

function PlayerSurface({
  title,
  shot,
  isPaused,
  onTogglePause,
  onRestart,
  showChoiceOverlay,
  choicePrompt,
  choices,
  onChoiceSelect,
  showTerminalOverlay,
  showIncompleteOverlay,
  getChoicePreviewImage,
  startImage,
  stage,
}: PlayerSurfaceProps) {
  const VisualIcon = isPaused ? PlayIcon : PauseIcon;
  const displayImage = shot?.imagePath ?? startImage ?? null;
  const disablePlayToggle =
    showChoiceOverlay || showTerminalOverlay || showIncompleteOverlay || !displayImage;

  return (
    <div className="relative flex min-h-[480px] flex-col overflow-hidden rounded-3xl border border-border bg-surface">
      <header className="flex items-center justify-between border-b border-border/60 bg-surface px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-text-muted">Interactive Story</p>
          <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onTogglePause}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-transparent px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-text-primary transition hover:bg-page focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={isPaused ? "Play story" : "Pause story"}
          disabled={disablePlayToggle}
        >
          <VisualIcon className="h-4 w-4" aria-hidden="true" />
          <span>{isPaused ? "Play" : "Pause"}</span>
        </button>
      </header>
      <main className="relative flex flex-1 justify-center bg-page">
        {displayImage ? (
          <img
            src={displayImage}
            alt="Current story shot"
            className="h-full w-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-page text-sm text-text-muted">
            Visual not available for this moment.
          </div>
        )}

        {showChoiceOverlay && choices && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/75 backdrop-blur">
            <div className="flex w-full max-w-3xl flex-col gap-6 rounded-3xl border border-border bg-surface p-8 text-center">
              <div className="px-2">
                <h3 className="text-base font-semibold text-text-primary">
                  {choicePrompt ?? "Choose a path"}
                </h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {choices.map((choice) => {
                  const previewImage = getChoicePreviewImage(choice.sceneletId);
                  return (
                    <button
                      key={choice.sceneletId}
                      type="button"
                      onClick={() => onChoiceSelect(choice)}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-highlight bg-surface text-center transition hover:bg-page focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
                    >
                      {previewImage ? (
                        <img src={previewImage} alt="" className="w-full object-cover" draggable={false} />
                      ) : (
                        <div className="flex items-center justify-center bg-page/60 px-4 py-12 text-xs text-text-muted">
                          Preview unavailable
                        </div>
                      )}
                      <span className="px-4 py-3 text-sm font-medium text-text-primary group-hover:text-highlight">
                        {choice.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {showTerminalOverlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/75 backdrop-blur">
            <div className="flex w-full max-w-md flex-col gap-4 rounded-3xl border border-border bg-surface p-8 text-center">
              <p className="text-sm text-text-primary">
                You reached an ending. Restart to explore alternate paths.
              </p>
              <button
                type="button"
                onClick={onRestart}
                className="rounded-full bg-highlight px-6 py-2 text-sm font-semibold text-highlight-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
              >
                Start Over
              </button>
            </div>
          </div>
        )}

        {showIncompleteOverlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/75 backdrop-blur">
            <div className="flex w-full max-w-md flex-col gap-4 rounded-3xl border border-border bg-surface p-8 text-center">
              <p className="text-sm text-text-primary">
                This path is under construction. Check back once new scenelets have been generated.
              </p>
            </div>
          </div>
        )}
      </main>
      <footer className="flex items-center justify-end border-t border-border/60 bg-surface px-6 py-4">
        <button
          type="button"
          onClick={onRestart}
          className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted transition hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
        >
          Restart Story
        </button>
      </footer>
    </div>
  );
}
