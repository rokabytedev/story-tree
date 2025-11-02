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
  const metadata = [
    { label: "Overview", value: environment.overallDescription },
    { label: "Lighting & Atmosphere", value: environment.lighting },
    { label: "Color Tones", value: environment.colorTones },
    { label: "Key Elements", value: environment.keyElements },
  ].filter((item) => Boolean(item.value));

  return (
    <article className="space-y-4 rounded-3xl border border-border bg-surface-elevated px-6 py-6 shadow-panel">
      <div className="flex flex-col gap-3">
        <div
          className="relative w-full overflow-hidden rounded-3xl border border-border bg-surface"
          style={{ aspectRatio: "16 / 9" }}
        >
          {environment.referenceImagePath ? (
            <Image
              src={environment.referenceImagePath}
              alt={`${environment.name ?? environment.id} reference`}
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 320px, 100vw"
            />
          ) : (
            <div
              className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-3xl text-center text-xs font-medium text-text-muted"
              style={{
                backgroundImage: `linear-gradient(135deg, ${storybookPalette.surfaceMuted} 0%, ${storybookPalette.accentMuted} 100%)`,
              }}
            >
              <span className="text-sm font-semibold text-text-primary">
                No reference art yet
              </span>
              <span className="max-w-[14rem] leading-snug text-text-muted">
                Generate environment reference art to display here.
              </span>
            </div>
          )}
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-semibold leading-tight text-text-primary">
            {environment.name ?? environment.id}
          </h3>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-text-muted">
            {(environment.id || "environment").toUpperCase()} · Environment
          </p>
        </div>
      </div>

      {metadata.length > 0 && (
        <dl className="space-y-2">
          {metadata.map(({ label, value }) => {
            const formatted = formatMultiline(value);
            if (!formatted) {
              return null;
            }
            return (
              <div key={label} className="space-y-1">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.25em] text-text-muted">
                  {label}
                </dt>
                <dd className="whitespace-pre-wrap text-sm leading-relaxed text-text-muted">
                  {formatted}
                </dd>
              </div>
            );
          })}
        </dl>
      )}

      {environment.sceneletIds.length > 0 ? (
        <footer className="text-[10px] font-medium uppercase tracking-[0.3em] text-text-muted">
          Scenelets: {environment.sceneletIds.join(", ")}
        </footer>
      ) : null}
    </article>
  );
}
