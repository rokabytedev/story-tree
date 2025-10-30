"use client";

import { ReferenceImageCard } from "./ReferenceImageCard";
import type { CharacterReferencePlate, CharacterDesign } from "./types";

interface CharacterSectionProps {
  characterId: string;
  referencePlates: CharacterReferencePlate[];
  characterDesign: CharacterDesign | null;
  onImageClick: (image: CharacterReferencePlate) => void;
}

function formatText(text: string): string {
  return text.replace(/\\n/g, "\n");
}

export function CharacterSection({
  characterId,
  referencePlates,
  characterDesign,
  onImageClick,
}: CharacterSectionProps) {
  return (
    <div className="space-y-6 rounded-lg border border-border/30 bg-surface p-6">
      <h2 className="text-xl font-semibold text-text">
        Character: {characterId}
      </h2>

      {/* Reference Images Grid */}
      {referencePlates.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {referencePlates.map((plate, index) => (
            <ReferenceImageCard
              key={index}
              imagePath={plate.image_path}
              description={plate.plate_description}
              onClick={() => onImageClick(plate)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border/20 bg-surface-muted/30 p-6 text-center">
          <p className="text-sm text-text-muted">
            No reference images available for this character
          </p>
        </div>
      )}

      {/* Character Design Details */}
      {characterDesign && (
        <section className="space-y-4 border-t border-border/20 pt-6">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
            Character Design Details
          </h3>
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-semibold text-text-muted">
                Role
              </p>
              <p className="rounded-lg bg-surface-muted/70 p-3 text-sm leading-relaxed text-text">
                {characterDesign.role}
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-text-muted">
                Attire
              </p>
              <p className="whitespace-pre-wrap rounded-lg bg-surface-muted/70 p-3 text-sm leading-relaxed text-text">
                {formatText(characterDesign.detailed_description.attire)}
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-text-muted">
                Physique
              </p>
              <p className="whitespace-pre-wrap rounded-lg bg-surface-muted/70 p-3 text-sm leading-relaxed text-text">
                {formatText(characterDesign.detailed_description.physique)}
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-text-muted">
                Facial Features
              </p>
              <p className="whitespace-pre-wrap rounded-lg bg-surface-muted/70 p-3 text-sm leading-relaxed text-text">
                {formatText(
                  characterDesign.detailed_description.facial_features
                )}
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
