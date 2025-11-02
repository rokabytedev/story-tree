import Image from "next/image";

import type { VisualEnvironmentSummary } from "@/lib/visualDesignDocument";
import { storybookPalette } from "@/theme/palette";

type VisualEnvironmentCardProps = {
  environment: VisualEnvironmentSummary;
};

function formatMultiline(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  return value.replace(/\\n/g, "\n");
}

export function VisualEnvironmentCard({ environment }: VisualEnvironmentCardProps) {
  const detailItems = [
    { label: "Overview", value: environment.overallDescription },
    { label: "Lighting & Atmosphere", value: environment.lighting },
    { label: "Color Tones", value: environment.colorTones },
    { label: "Key Elements", value: environment.keyElements },
  ].filter((item) => Boolean(item.value));

  return (
    <article className="space-y-5 rounded-3xl border border-border bg-surface-elevated px-6 py-6 shadow-panel">
      <header className="flex flex-col gap-4 sm:flex-row">
        <div className="relative h-40 overflow-hidden rounded-2xl border border-border bg-surface sm:w-40">
          {environment.referenceImagePath ? (
            <Image
              src={environment.referenceImagePath}
              alt={`${environment.name ?? environment.id} reference`}
              fill
              className="object-cover"
              sizes="(min-width: 640px) 160px, 100vw"
            />
          ) : (
            <div
              className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-accent-muted/50 text-center text-xs font-medium text-text-muted"
              style={{
                backgroundImage: `linear-gradient(135deg, ${storybookPalette.surfaceMuted} 0%, ${storybookPalette.accentMuted} 100%)`,
              }}
            >
              <span className="text-sm font-semibold text-text-primary">
                No reference art yet
              </span>
              <span className="max-w-[10rem] leading-snug text-text-muted">
                Generate environment reference art to display here.
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold leading-tight text-text-primary">
              {environment.name ?? environment.id}
            </h3>
            <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-medium text-text-muted">
              Environment
            </span>
          </div>
          {environment.sceneletIds.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {environment.sceneletIds.map((sceneletId) => (
                <span
                  key={sceneletId}
                  className="rounded-full border border-border/50 bg-accent-muted/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.15em] text-text-primary"
                >
                  {sceneletId}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      {detailItems.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {detailItems.map(({ label, value }) => (
            <div
              key={label}
              className="rounded-2xl border border-border/60 bg-surface px-4 py-3"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-text-muted">
                {label}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-muted">
                {formatMultiline(value)}
              </p>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
