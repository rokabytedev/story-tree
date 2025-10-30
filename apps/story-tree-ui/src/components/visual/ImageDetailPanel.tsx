"use client";

import { useEffect } from "react";
import type {
  CharacterReferencePlate,
  EnvironmentKeyframe,
} from "./types";

type ImageDetail = CharacterReferencePlate | EnvironmentKeyframe;

interface ImageDetailPanelProps {
  selectedImage: ImageDetail | null;
  onClose: () => void;
}

function isCharacterPlate(
  image: ImageDetail
): image is CharacterReferencePlate {
  return "type" in image && "plate_description" in image;
}

function formatText(text: string): string {
  return text.replace(/\\n/g, "\n");
}

export function ImageDetailPanel({
  selectedImage,
  onClose,
}: ImageDetailPanelProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (selectedImage) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [selectedImage, onClose]);

  if (!selectedImage) return null;

  const isCharacter = isCharacterPlate(selectedImage);
  const description = isCharacter
    ? selectedImage.plate_description
    : selectedImage.keyframe_description;

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
          <h2 className="text-lg font-semibold text-text">Image Details</h2>
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
          {/* Image */}
          <div className="overflow-hidden rounded-lg bg-border/40">
            {selectedImage.image_path ? (
              <img
                src={selectedImage.image_path}
                alt={description}
                className="aspect-video w-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                  const parent = target.parentElement;
                  if (parent) {
                    parent.classList.add(
                      "flex",
                      "items-center",
                      "justify-center",
                      "aspect-video"
                    );
                    parent.innerHTML = `<span class="text-sm text-text-muted">Image not available</span>`;
                  }
                }}
              />
            ) : (
              <div className="flex aspect-video items-center justify-center">
                <span className="text-sm text-text-muted">
                  No image available
                </span>
              </div>
            )}
          </div>

          {/* Metadata */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
              Details
            </h3>
            <div className="space-y-3">
              {isCharacter && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-text-muted">
                    Type
                  </p>
                  <p className="rounded-lg bg-surface-muted/70 p-3 text-xs leading-relaxed text-text">
                    {selectedImage.type}
                  </p>
                </div>
              )}
              <div>
                <p className="mb-1 text-xs font-semibold text-text-muted">
                  Description
                </p>
                <p className="whitespace-pre-wrap rounded-lg bg-surface-muted/70 p-3 text-xs leading-relaxed text-text">
                  {formatText(description)}
                </p>
              </div>
            </div>
          </section>

          {/* Image Generation Prompt */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
              Image Generation Prompt
            </h3>
            <div className="rounded-lg bg-surface-muted/70 p-4">
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-text">
                {formatText(selectedImage.image_generation_prompt)}
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
