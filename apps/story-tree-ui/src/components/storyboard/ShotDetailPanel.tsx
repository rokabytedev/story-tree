"use client";

import { useEffect } from "react";
import type { ShotImage } from "./types";

interface ShotDetailPanelProps {
  shot: ShotImage | null;
  onClose: () => void;
}

export function ShotDetailPanel({ shot, onClose }: ShotDetailPanelProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (shot) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [shot, onClose]);

  if (!shot) return null;

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const formatJSON = (value: unknown) => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "Error formatting JSON";
    }
  };

  const referencedDesigns = extractReferencedDesigns(shot.storyboardPayload);
  const audioNarrative = extractAudioNarrative(shot.storyboardPayload);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-[480px] overflow-y-auto bg-surface shadow-2xl transition-transform duration-300 sm:w-[480px]"
        style={{ transform: "translateX(0)" }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/20 bg-surface px-6 py-4">
          <h2 className="text-lg font-semibold text-text">Shot Details</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
            aria-label="Close panel"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* Key Frame Image */}
          <div className="overflow-hidden rounded-lg bg-border/40">
            {shot.keyFrameImagePath ? (
              <img
                src={shot.keyFrameImagePath}
                alt={`Shot ${shot.shotIndex} key frame`}
                className="aspect-video w-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                  const parent = target.parentElement;
                  if (parent) {
                    parent.classList.add("flex", "items-center", "justify-center", "aspect-video");
                    parent.innerHTML = `<span class="text-sm text-text-muted">Image not available</span>`;
                  }
                }}
              />
            ) : (
              <div className="flex aspect-video items-center justify-center">
                <span className="text-sm text-text-muted">No image available</span>
              </div>
            )}
          </div>

          {/* Shot Metadata */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
              Shot Details
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Shot Index:</span>
                <span className="font-semibold text-text">{shot.shotIndex}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Created:</span>
                <span className="text-text">{formatDate(shot.createdAt)}</span>
              </div>
            </div>
          </section>

          {/* Referenced Designs */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
              Referenced Designs
            </h3>
            {referencedDesigns ? (
              <div className="space-y-2 text-xs leading-relaxed text-text">
                <div>
                  <p className="font-semibold text-text-muted">Characters</p>
                  {referencedDesigns.characters.length > 0 ? (
                    <ul className="mt-1 space-y-1 text-text">
                      {referencedDesigns.characters.map((id) => (
                        <li key={`character-${id}`} className="rounded bg-surface-muted/60 px-2 py-1">
                          {id}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-text-muted">None referenced</p>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-text-muted">Environments</p>
                  {referencedDesigns.environments.length > 0 ? (
                    <ul className="mt-1 space-y-1 text-text">
                      {referencedDesigns.environments.map((id) => (
                        <li key={`environment-${id}`} className="rounded bg-surface-muted/60 px-2 py-1">
                          {id}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-text-muted">None referenced</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-text-muted">No referenced designs recorded.</p>
            )}
          </section>

          {/* Audio & Narrative */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
              Audio & Narrative
            </h3>
            {audioNarrative.length > 0 ? (
              <div className="space-y-2">
                {audioNarrative.map((entry, index) => (
                  <div key={`audio-${index}`} className="rounded-lg bg-surface-muted/70 p-3 text-xs text-text">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-text-muted">
                      <span>{entry.type}</span>
                      <span>{entry.source}</span>
                    </div>
                    <p className="mt-2 leading-relaxed">{entry.line}</p>
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                      Delivery
                    </p>
                    <p className="mt-1 leading-relaxed text-text-muted">{entry.delivery}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted">No narration entries recorded.</p>
            )}
          </section>

          {/* Storyboard Payload */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
              Storyboard Payload
            </h3>
            <pre className="overflow-x-auto rounded-lg bg-surface-muted/70 p-4 text-xs leading-relaxed text-text">
              <code className="whitespace-pre-wrap break-words">
                {formatJSON(shot.storyboardPayload)}
              </code>
            </pre>
          </section>
        </div>
      </div>
    </>
  );
}

function extractReferencedDesigns(payload: unknown): { characters: string[]; environments: string[] } | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const raw = record.referencedDesigns ?? record.referenced_designs;
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const { characters, environments } = raw as Record<string, unknown>;

  const characterIds = Array.isArray(characters)
    ? characters.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];

  const environmentIds = Array.isArray(environments)
    ? environments.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];

  return {
    characters: characterIds.map((id) => id.trim()),
    environments: environmentIds.map((id) => id.trim()),
  };
}

function extractAudioNarrative(
  payload: unknown
): Array<{ type: string; source: string; line: string; delivery: string }> {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const raw = record.audioAndNarrative ?? record.audio_and_narrative;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
    .map((entry) => {
      const type = typeof entry.type === "string" ? entry.type.toLowerCase() : "unknown";
      const source = typeof entry.source === "string" ? entry.source : "unknown";
      const line = typeof entry.line === "string" ? entry.line : "";
      const delivery = typeof entry.delivery === "string" ? entry.delivery : "";
      return {
        type,
        source,
        line,
        delivery,
      };
    })
    .filter((entry) => entry.line.trim().length > 0 && entry.delivery.trim().length > 0);
}
