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
  const metadata = [
    { label: "Role", value: character.role },
    { label: "Attire", value: character.attire },
    { label: "Physique", value: character.physique },
    { label: "Facial Features", value: character.facialFeatures },
  ].filter((item) => Boolean(item.value));

  const description = formatMultiline(character.description);

  return (
    <article className="space-y-4 rounded-3xl border border-border bg-page px-6 py-6">
      <div className="flex flex-col gap-3">
        <div
          className="relative w-full overflow-hidden rounded-3xl border border-border bg-page"
          style={{ aspectRatio: "4 / 3" }}
        >
          {character.imagePath ? (
            <Image
              src={character.imagePath}
              alt={`${character.name ?? character.id} model sheet`}
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 320px, 100vw"
            />
          ) : (
            <div
              className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-3xl text-center text-xs font-medium text-text-muted"
              style={{
                backgroundImage: `linear-gradient(135deg, ${storybookPalette.accentMuted} 0%, ${storybookPalette.surfaceMuted} 100%)`,
              }}
            >
              <span className="text-sm font-semibold text-text-primary">
                No model sheet yet
              </span>
              <span className="max-w-[14rem] leading-snug text-text-muted">
                Generate a character model sheet to populate this card.
              </span>
            </div>
          )}
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-semibold leading-tight text-text-primary">
            {character.name ?? character.id}
          </h3>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-text-muted">
            {(character.id || "character").toUpperCase()} · Character
          </p>
        </div>
      </div>

      {description ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-muted">
          {description}
        </p>
      ) : null}

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

      {character.sceneletIds.length > 0 ? (
        <footer className="text-[10px] font-medium uppercase tracking-[0.3em] text-text-muted">
          Scenelets: {character.sceneletIds.join(", ")}
        </footer>
      ) : null}
    </article>
  );
}
