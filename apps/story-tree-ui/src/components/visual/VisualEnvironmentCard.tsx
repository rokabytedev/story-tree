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
    <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-page transition hover:bg-surface">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-3xl bg-page">
        {environment.referenceImagePath ? (
          <Image
            src={environment.referenceImagePath}
            alt={`${environment.name ?? environment.id} reference`}
            fill
            className="object-cover"
            sizes="(min-width: 1280px) 540px, 100vw"
          />
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-center text-xs font-medium text-text-muted"
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
      <div className="flex flex-1 flex-col gap-4 px-6 py-5">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold leading-tight text-text-primary">
            {environment.name ?? environment.id}
          </h3>
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
          <footer className="mt-auto text-[10px] font-medium uppercase tracking-[0.3em] text-text-muted">
            Scenelets: {environment.sceneletIds.join(", ")}
          </footer>
        ) : null}
      </div>
    </article>
  );
}
