"use client";

import { ReferenceImageCard } from "./ReferenceImageCard";
import type { EnvironmentKeyframe, EnvironmentDesign } from "./types";

interface EnvironmentSectionProps {
  environmentId: string;
  keyframes: EnvironmentKeyframe[];
  environmentDesign: EnvironmentDesign | null;
  onImageClick: (image: EnvironmentKeyframe) => void;
}

function formatText(text: string): string {
  return text.replace(/\\n/g, "\n");
}

export function EnvironmentSection({
  environmentId,
  keyframes,
  environmentDesign,
  onImageClick,
}: EnvironmentSectionProps) {
  return (
    <div className="space-y-6 rounded-lg border border-border/30 bg-surface p-6">
      <h2 className="text-xl font-semibold text-text">
        Environment: {environmentId}
      </h2>

      {/* Keyframe Images Grid */}
      {keyframes.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {keyframes.map((keyframe, index) => (
            <ReferenceImageCard
              key={index}
              imagePath={keyframe.image_path}
              description={keyframe.keyframe_description}
              onClick={() => onImageClick(keyframe)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border/20 bg-surface-muted/30 p-6 text-center">
          <p className="text-sm text-text-muted">
            No keyframes available for this environment
          </p>
        </div>
      )}

      {/* Environment Design Details */}
      {environmentDesign && (
        <section className="space-y-4 border-t border-border/20 pt-6">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
            Environment Design Details
          </h3>
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-semibold text-text-muted">
                Overall Description
              </p>
              <p className="whitespace-pre-wrap rounded-lg bg-surface-muted/70 p-3 text-sm leading-relaxed text-text">
                {formatText(
                  environmentDesign.detailed_description.overall_description
                )}
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-text-muted">
                Lighting and Atmosphere
              </p>
              <p className="whitespace-pre-wrap rounded-lg bg-surface-muted/70 p-3 text-sm leading-relaxed text-text">
                {formatText(
                  environmentDesign.detailed_description.lighting_and_atmosphere
                )}
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-text-muted">
                Color Tones
              </p>
              <p className="whitespace-pre-wrap rounded-lg bg-surface-muted/70 p-3 text-sm leading-relaxed text-text">
                {formatText(environmentDesign.detailed_description.color_tones)}
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-text-muted">
                Key Elements
              </p>
              <p className="whitespace-pre-wrap rounded-lg bg-surface-muted/70 p-3 text-sm leading-relaxed text-text">
                {formatText(environmentDesign.detailed_description.key_elements)}
              </p>
            </div>
            {environmentDesign.associated_scenelet_ids.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold text-text-muted">
                  Associated Scenelets
                </p>
                <div className="rounded-lg bg-surface-muted/70 p-3">
                  <ul className="list-inside list-disc text-sm text-text">
                    {environmentDesign.associated_scenelet_ids.map((id) => (
                      <li key={id} className="font-mono text-xs">
                        {id}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
