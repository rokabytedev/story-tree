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
          <div className="overflow-hidden rounded-xl bg-border/40">
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

          {/* Prompts */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
              Prompts
            </h3>
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs font-semibold text-text-muted">First Frame</p>
                <p className="rounded-lg bg-surface-muted/70 p-3 text-xs leading-relaxed text-text">
                  {shot.firstFramePrompt}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-text-muted">Key Frame</p>
                <p className="rounded-lg bg-surface-muted/70 p-3 text-xs leading-relaxed text-text">
                  {shot.keyFramePrompt}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-text-muted">Video Clip</p>
                <p className="rounded-lg bg-surface-muted/70 p-3 text-xs leading-relaxed text-text">
                  {shot.videoClipPrompt}
                </p>
              </div>
            </div>
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
