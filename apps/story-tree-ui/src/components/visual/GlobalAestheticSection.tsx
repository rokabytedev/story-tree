import { storybookPalette } from "@/theme/palette";
import type { VisualGlobalAestheticViewModel } from "@/lib/visualDesignDocument";

type GlobalAestheticSectionProps = {
  globalAesthetic: VisualGlobalAestheticViewModel | null;
};

function formatMultiline(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  return value.replace(/\\n/g, "\n");
}

export function GlobalAestheticSection({
  globalAesthetic,
}: GlobalAestheticSectionProps) {
  if (!globalAesthetic) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-page px-6 py-8 text-sm text-text-muted">
        Global aesthetic information is not yet available for this story.
      </div>
    );
  }

  const { visualStyleName, visualStyleDescription, palette } = globalAesthetic;

  return (
    <div className="space-y-6 rounded-3xl border border-border bg-page px-6 py-8">
      {(visualStyleName || visualStyleDescription) && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
            Visual Style
          </h3>
          {visualStyleName ? (
            <h4 className="text-xl font-semibold leading-tight text-text-primary">
              {visualStyleName}
            </h4>
          ) : null}
          {visualStyleDescription ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-muted">
              {formatMultiline(visualStyleDescription)}
            </p>
          ) : null}
        </section>
      )}

      {palette.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
            Master Color Palette
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {palette.map(({ name, hex, usageNotes }, index) => (
              <article
                key={`${name}-${index}`}
                className="overflow-hidden rounded-2xl border border-border bg-page"
              >
                <div
                  className="h-20 w-full"
                  style={{
                    backgroundColor: hex,
                    borderBottom: `1px solid ${storybookPalette.border}`,
                  }}
                  aria-label={`Color swatch for ${name}`}
                />
                <div className="space-y-1 p-4">
                  <p className="text-sm font-semibold text-text-primary">{name}</p>
                  <p className="font-mono text-xs text-text-muted">{hex}</p>
                  {usageNotes ? (
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-text-muted">
                      {formatMultiline(usageNotes)}
                    </p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
