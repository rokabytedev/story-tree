import Image from "next/image";

import type { VisualCharacterSummary } from "@/lib/visualDesignDocument";
import { storybookPalette } from "@/theme/palette";

type VisualCharacterCardProps = {
  character: VisualCharacterSummary;
};

function formatMultiline(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  return value.replace(/\\n/g, "\n");
}

export function VisualCharacterCard({ character }: VisualCharacterCardProps) {
  const detailItems = [
    { label: "Attire", value: character.attire },
    { label: "Physique", value: character.physique },
    { label: "Facial Features", value: character.facialFeatures },
  ].filter((item) => Boolean(item.value));

  return (
    <article className="space-y-5 rounded-3xl border border-border bg-surface-elevated px-6 py-6 shadow-panel">
      <header className="flex flex-col gap-4 sm:flex-row">
        <div className="relative h-40 overflow-hidden rounded-2xl border border-border bg-surface sm:w-40">
          {character.imagePath ? (
            <Image
              src={character.imagePath}
              alt={`${character.name ?? character.id} model sheet`}
              fill
              className="object-cover"
              sizes="(min-width: 640px) 160px, 100vw"
            />
          ) : (
            <div
              className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-accent-muted/50 text-center text-xs font-medium text-text-muted"
              style={{
                backgroundImage: `linear-gradient(135deg, ${storybookPalette.accentMuted} 0%, ${storybookPalette.surfaceMuted} 100%)`,
              }}
            >
              <span className="text-sm font-semibold text-text-primary">
                No model sheet yet
              </span>
              <span className="max-w-[10rem] leading-snug text-text-muted">
                Generate a character model sheet to populate this card.
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold leading-tight text-text-primary">
              {character.name ?? character.id}
            </h3>
            <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-medium text-text-muted">
              Character
            </span>
          </div>
          {character.role ? (
            <p className="text-sm font-medium text-text-muted">Role: {character.role}</p>
          ) : null}
          {character.description ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-muted">
              {formatMultiline(character.description)}
            </p>
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
