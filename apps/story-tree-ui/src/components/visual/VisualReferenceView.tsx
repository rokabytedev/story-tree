"use client";

import { useState } from "react";
import { CodeBlock } from "@/components/codeBlock";
import { CharacterSection } from "./CharacterSection";
import { EnvironmentSection } from "./EnvironmentSection";
import { GlobalAestheticSection } from "./GlobalAestheticSection";
import { ImageDetailPanel } from "./ImageDetailPanel";
import type {
  VisualReferencePackage,
  VisualDesignDocument,
  CharacterReferencePlate,
  EnvironmentKeyframe,
  CharacterDesign,
  EnvironmentDesign,
} from "./types";

type SelectedImage = CharacterReferencePlate | EnvironmentKeyframe;

interface VisualReferenceViewProps {
  visualReferencePackage: unknown;
  visualDesignDocument: unknown;
}

function transformImagePath(dbPath: string | undefined): string | undefined {
  if (!dbPath) return undefined;
  const trimmed = dbPath.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("/generated/")) return trimmed;
  if (trimmed.startsWith("generated/")) return `/${trimmed}`;
  return `/generated/${trimmed}`;
}

function parseVisualReferencePackage(
  data: unknown
): VisualReferencePackage | null {
  try {
    if (!data || typeof data !== "object") return null;
    const pkg = data as VisualReferencePackage;

    // Transform image paths
    if (pkg.character_model_sheets) {
      pkg.character_model_sheets = pkg.character_model_sheets.map(sheet => ({
        ...sheet,
        reference_plates: sheet.reference_plates.map(plate => ({
          ...plate,
          image_path: transformImagePath(plate.image_path),
        })),
      }));
    }

    if (pkg.environment_keyframes) {
      pkg.environment_keyframes = pkg.environment_keyframes.map(env => ({
        ...env,
        keyframes: env.keyframes.map(keyframe => ({
          ...keyframe,
          image_path: transformImagePath(keyframe.image_path),
        })),
      }));
    }

    return pkg;
  } catch {
    return null;
  }
}

function parseVisualDesignDocument(data: unknown): VisualDesignDocument | null {
  try {
    if (!data || typeof data !== "object") return null;
    return data as VisualDesignDocument;
  } catch {
    return null;
  }
}

export function VisualReferenceView({
  visualReferencePackage,
  visualDesignDocument,
}: VisualReferenceViewProps) {
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(
    null
  );

  const referencePackage = parseVisualReferencePackage(visualReferencePackage);
  const designDocument = parseVisualDesignDocument(visualDesignDocument);

  // Helper to find character design by ID
  const findCharacterDesign = (
    characterId: string
  ): CharacterDesign | null => {
    if (!designDocument) return null;
    return (
      designDocument.character_designs.find(
        (design) => design.character_id === characterId
      ) ?? null
    );
  };

  // Helper to find environment design by ID
  const findEnvironmentDesign = (
    environmentId: string
  ): EnvironmentDesign | null => {
    if (!designDocument) return null;
    return (
      designDocument.environment_designs.find(
        (design) => design.environment_id === environmentId
      ) ?? null
    );
  };

  return (
    <div className="space-y-8">
      {/* Characters Section */}
      {referencePackage?.character_model_sheets &&
        referencePackage.character_model_sheets.length > 0 && (
          <section className="space-y-6">
            <header className="space-y-2">
              <h1 className="text-sm uppercase tracking-[0.3em] text-text-muted">
                Characters
              </h1>
            </header>
            <div className="space-y-6">
              {referencePackage.character_model_sheets.map((sheet) => (
                <CharacterSection
                  key={sheet.character_id}
                  characterId={sheet.character_id}
                  referencePlates={sheet.reference_plates}
                  characterDesign={findCharacterDesign(sheet.character_id)}
                  onImageClick={(image) => setSelectedImage(image)}
                />
              ))}
            </div>
          </section>
        )}

      {/* Environments Section */}
      {referencePackage?.environment_keyframes &&
        referencePackage.environment_keyframes.length > 0 ? (
          <section className="space-y-6">
            <header className="space-y-2">
              <h1 className="text-sm uppercase tracking-[0.3em] text-text-muted">
                Environments
              </h1>
            </header>
            <div className="space-y-6">
              {referencePackage.environment_keyframes.map((env) => (
                <EnvironmentSection
                  key={env.environment_id}
                  environmentId={env.environment_id}
                  keyframes={env.keyframes}
                  environmentDesign={findEnvironmentDesign(env.environment_id)}
                  onImageClick={(image) => setSelectedImage(image)}
                />
              ))}
            </div>
          </section>
        ) : null}

      {/* Global Aesthetic Section */}
      {designDocument?.global_aesthetic && (
        <section className="space-y-6">
          <header className="space-y-2">
            <h1 className="text-sm uppercase tracking-[0.3em] text-text-muted">
              Global Aesthetic
            </h1>
          </header>
          <GlobalAestheticSection
            globalAesthetic={designDocument.global_aesthetic}
          />
        </section>
      )}

      {/* Visual Reference Package JSON */}
      {visualReferencePackage ? (
        <section className="space-y-6">
          <header className="space-y-2">
            <p className="text-sm uppercase tracking-[0.3em] text-text-muted">
              Visual Reference Package
            </p>
            <p className="text-xs text-text-muted/80">
              Raw JSON of the visual reference package.
            </p>
          </header>
          <CodeBlock
            content={JSON.stringify(visualReferencePackage, null, 2)}
            languageLabel="json"
          />
        </section>
      ) : null}

      {/* Visual Design Document JSON */}
      {visualDesignDocument ? (
        <section className="space-y-6">
          <header className="space-y-2">
            <p className="text-sm uppercase tracking-[0.3em] text-text-muted">
              Visual Design Document
            </p>
            <p className="text-xs text-text-muted/80">
              Raw JSON captured from the visual design Gemini response.
            </p>
          </header>
          <CodeBlock
            content={JSON.stringify(visualDesignDocument, null, 2)}
            languageLabel="json"
          />
        </section>
      ) : null}

      {/* Image Detail Panel */}
      <ImageDetailPanel
        selectedImage={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </div>
  );
}
