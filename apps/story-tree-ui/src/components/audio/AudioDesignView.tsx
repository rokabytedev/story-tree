"use client";

import {
  PauseIcon,
  PlayIcon,
  MusicalNoteIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CodeBlock } from "@/components/codeBlock";
import type {
  AudioCueViewModel,
  AudioDesignViewModel,
  AudioVoiceProfileViewModel,
  AudioSonicIdentityViewModel,
} from "@/lib/audioDesignDocument";

type AudioDesignViewProps = {
  storyId: string;
  document: AudioDesignViewModel;
};

type AudioHandle = {
  element: HTMLAudioElement;
  onEnded: () => void;
};

export function AudioDesignView({ storyId, document }: AudioDesignViewProps) {
  const rawJson = useMemo(() => {
    if (!document.raw) {
      return null;
    }

    try {
      return JSON.stringify(document.raw, null, 2);
    } catch {
      return null;
    }
  }, [document.raw]);

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-text-muted">
          Sonic Identity
        </h2>
        <SonicIdentityCard identity={document.sonicIdentity} />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-text-muted">
          Voice Profiles
        </h2>
        <VoiceProfilesSection
          narrator={document.narratorProfile}
          characters={document.characterProfiles}
        />
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-text-muted">
              Music & Ambience Cues
            </h2>
            <p className="text-xs text-text-muted/80">
              Play drafts sourced from the audio design workflow.
            </p>
          </div>
        </div>
        <CuePlaylist storyId={storyId} cues={document.musicCues} />
      </section>

      {rawJson ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-text-muted">
              Audio Design Document
            </h2>
            <p className="text-xs text-text-muted/80">
              Raw JSON captured from the audio design task.
            </p>
          </div>
          <CodeBlock content={rawJson} languageLabel="json" />
        </section>
      ) : null}
    </div>
  );
}

function SonicIdentityCard({ identity }: { identity: AudioSonicIdentityViewModel | null }) {
  if (!identity) {
    return (
      <div className="rounded-3xl border border-dashed border-border/60 bg-surface-elevated px-6 py-8 text-sm text-text-muted">
        Sonic identity details are not available yet.
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-3xl border border-border bg-surface-elevated px-6 py-6 shadow-panel">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-highlight/10 text-highlight">
          <MusicalNoteIcon className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
            Palette & FX Philosophy
          </p>
          <p className="text-xs text-text-muted/70">
            Guidance for composers and sound designers
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {identity.musicalDirection ? (
          <div className="rounded-2xl border border-border/60 bg-surface px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-text-muted">
              Musical direction
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-muted">
              {identity.musicalDirection}
            </p>
          </div>
        ) : null}
        {identity.soundEffectPhilosophy ? (
          <div className="rounded-2xl border border-border/60 bg-surface px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-text-muted">
              Sound effect philosophy
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-muted">
              {identity.soundEffectPhilosophy}
            </p>
          </div>
        ) : null}
        {identity.additionalNotes ? (
          <div className="rounded-2xl border border-border/60 bg-surface px-4 py-3 md:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-text-muted">
              Additional notes
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-muted">
              {identity.additionalNotes}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function VoiceProfilesSection({
  narrator,
  characters,
}: {
  narrator: AudioVoiceProfileViewModel | null;
  characters: AudioVoiceProfileViewModel[];
}) {
  if (!narrator && characters.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border/60 bg-surface-elevated px-6 py-8 text-sm text-text-muted">
        Voice casting notes will appear once the audio design workflow runs.
      </div>
    );
  }

  const profiles = [
    ...(narrator ? [narrator] : []),
    ...characters,
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {profiles.map((profile) => (
        <VoiceProfileCard key={`${profile.characterId}-${profile.voiceName ?? "voice"}`} profile={profile} />
      ))}
    </div>
  );
}

function VoiceProfileCard({ profile }: { profile: AudioVoiceProfileViewModel }) {
  const badgeLabel = profile.isNarrator ? "Narrator" : "Character";
  const initials = useMemo(() => {
    if (profile.isNarrator) {
      return "N";
    }
    const source = profile.characterName ?? profile.characterId;
    return source
      .split(/[\s_-]+/)
      .map((segment) => segment.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("") || profile.characterId.slice(0, 2).toUpperCase();
  }, [profile.characterId, profile.characterName, profile.isNarrator]);

  return (
    <article className="space-y-4 rounded-3xl border border-border bg-surface-elevated px-5 py-5 shadow-panel">
      <header className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-surface text-lg font-semibold text-text-primary">
          {profile.voiceName ? (
            <span>{initials}</span>
          ) : (
            <UserCircleIcon className="h-8 w-8 text-text-muted" aria-hidden />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold leading-tight text-text-primary">
              {profile.characterName ?? profile.characterId}
            </h3>
            <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted">
              {badgeLabel}
            </span>
          </div>
          {profile.voiceName ? (
            <p className="text-xs text-text-muted/80">Voice: {profile.voiceName}</p>
          ) : null}
        </div>
      </header>
      {profile.voiceProfile ? (
        <div className="rounded-2xl border border-border/60 bg-surface px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-text-muted">
            Voice profile
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-muted">
            {profile.voiceProfile}
          </p>
        </div>
      ) : null}
      {profile.usageNotes ? (
        <div className="rounded-2xl border border-border/60 bg-surface px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-text-muted">
            Usage
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-muted">
            {profile.usageNotes}
          </p>
        </div>
      ) : null}
    </article>
  );
}

function CuePlaylist({ storyId, cues }: { storyId: string; cues: AudioCueViewModel[] }) {
  const [currentCue, setCurrentCue] = useState<string | null>(null);
  const audioHandles = useRef<Map<string, AudioHandle>>(new Map());

  const registerAudio = useCallback(
    (cueName: string, element: HTMLAudioElement | null) => {
      const existing = audioHandles.current.get(cueName);
      if (existing) {
        existing.element.removeEventListener("ended", existing.onEnded);
        audioHandles.current.delete(cueName);
      }

      if (element) {
        const onEnded = () => {
          setCurrentCue((previous) => (previous === cueName ? null : previous));
        };
        element.addEventListener("ended", onEnded);
        audioHandles.current.set(cueName, { element, onEnded });
      }
    },
    []
  );

  const stopCue = useCallback((cueName: string) => {
    const handle = audioHandles.current.get(cueName);
    if (!handle) {
      return;
    }
    handle.element.pause();
    handle.element.currentTime = 0;
    setCurrentCue((previous) => (previous === cueName ? null : previous));
  }, []);

  const playCue = useCallback(
    async (cueName: string) => {
      const handle = audioHandles.current.get(cueName);
      if (!handle) {
        return;
      }

      for (const [name, candidate] of audioHandles.current.entries()) {
        if (name === cueName) {
          continue;
        }
        candidate.element.pause();
        candidate.element.currentTime = 0;
      }

      try {
        await handle.element.play();
        setCurrentCue(cueName);
      } catch (error) {
        console.warn(`Failed to play cue "${cueName}"`, error);
        setCurrentCue(null);
      }
    },
    []
  );

  useEffect(() => {
    const handles = audioHandles.current;
    return () => {
      for (const { element, onEnded } of handles.values()) {
        element.removeEventListener("ended", onEnded);
      }
      handles.clear();
    };
  }, []);

  if (cues.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border/60 bg-surface-elevated px-6 py-8 text-sm text-text-muted">
        Music cues have not been generated yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {cues.map((cue) => (
        <AudioCueCard
          key={cue.cueName}
          storyId={storyId}
          cue={cue}
          isActive={currentCue === cue.cueName}
          onPlay={playCue}
          onStop={stopCue}
          registerAudio={registerAudio}
        />
      ))}
    </div>
  );
}

function AudioCueCard({
  storyId,
  cue,
  isActive,
  onPlay,
  onStop,
  registerAudio,
}: {
  storyId: string;
  cue: AudioCueViewModel;
  isActive: boolean;
  onPlay: (cueName: string) => void;
  onStop: (cueName: string) => void;
  registerAudio: (cueName: string, element: HTMLAudioElement | null) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [hasError, setHasError] = useState(false);

  const resolvedSource = useMemo(() => {
    if (cue.audioFilePath) {
      return normalizeAudioPath(cue.audioFilePath);
    }
    const slug = cue.cueName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!slug) {
      return null;
    }
    const trimmedStoryId = storyId.trim();
    if (!trimmedStoryId) {
      return null;
    }
    return `/generated/${trimmedStoryId}/music/${slug}.m4a`;
  }, [cue.audioFilePath, cue.cueName, storyId]);

  useEffect(() => {
    if (!resolvedSource) {
      setHasError(true);
      registerAudio(cue.cueName, null);
      return () => registerAudio(cue.cueName, null);
    }

    const element = audioRef.current;
    if (!element) {
      registerAudio(cue.cueName, null);
      return () => registerAudio(cue.cueName, null);
    }

    registerAudio(cue.cueName, element);
    return () => {
      registerAudio(cue.cueName, null);
    };
  }, [cue.cueName, registerAudio, resolvedSource]);

  const handleError = useCallback(() => {
    setHasError(true);
    registerAudio(cue.cueName, null);
    onStop(cue.cueName);
  }, [cue.cueName, onStop, registerAudio]);

  const handleLoadedData = useCallback(() => {
    setHasError(false);
    const element = audioRef.current;
    if (element) {
      registerAudio(cue.cueName, element);
    }
  }, [cue.cueName, registerAudio]);

  const canPlay = Boolean(resolvedSource) && !hasError;

  return (
    <article className="space-y-4 rounded-3xl border border-border bg-surface-elevated px-5 py-5 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold leading-tight text-text-primary">
              {cue.cueName}
            </h3>
            {isActive ? (
              <span className="rounded-full border border-highlight bg-highlight/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.2em] text-highlight">
                Now playing
              </span>
            ) : null}
          </div>
          {cue.sceneletIds.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {cue.sceneletIds.map((sceneletId) => (
                <span
                  key={sceneletId}
                  className="rounded-full border border-border/60 bg-surface px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted"
                >
                  {sceneletId}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => (isActive ? onStop(cue.cueName) : onPlay(cue.cueName))}
          disabled={!canPlay}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-text-primary transition hover:bg-highlight/10 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={isActive ? `Pause ${cue.cueName}` : `Play ${cue.cueName}`}
        >
          {isActive ? <PauseIcon className="h-5 w-5" aria-hidden /> : <PlayIcon className="h-5 w-5" aria-hidden />}
        </button>
      </div>

      {cue.description ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-muted">
          {cue.description}
        </p>
      ) : null}

      {cue.prompt ? (
        <div className="rounded-2xl border border-border/60 bg-surface px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-text-muted">
            Generation prompt
          </p>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-text-muted">
            {cue.prompt}
          </p>
        </div>
      ) : null}

      {!canPlay ? (
        <p className="text-xs italic text-text-muted">
          {resolvedSource
            ? `Audio file missing at ${resolvedSource}. Upload the cue to public/generated/${storyId}/music/`
            : "Cue does not have an associated audio file yet."}
        </p>
      ) : null}

      <audio
        ref={audioRef}
        src={resolvedSource ?? ""}
        preload="none"
        onLoadedData={handleLoadedData}
        onError={handleError}
        className="hidden"
      />
    </article>
  );
}

function normalizeAudioPath(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const trimmed = path.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed.replace(/^\/+/, "")}`;
}
