"use client";

import type { GlobalAesthetic } from "./types";

interface GlobalAestheticSectionProps {
  globalAesthetic: GlobalAesthetic | null;
}

function formatText(text: string): string {
  return text.replace(/\\n/g, "\n");
}

export function GlobalAestheticSection({
  globalAesthetic,
}: GlobalAestheticSectionProps) {
  if (!globalAesthetic) {
    return (
      <div className="rounded-lg border border-border/30 bg-surface p-6">
        <p className="text-sm text-text-muted">
          Global aesthetic information not available
        </p>
      </div>
    );
  }

  const { visual_style, master_color_palette } = globalAesthetic;

  return (
    <div className="space-y-6 rounded-lg border border-border/30 bg-surface p-6">
      {/* Visual Style */}
      <section className="space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
          Visual Style
        </h3>
        <div className="space-y-2">
          <h4 className="text-lg font-semibold text-text">
            {visual_style.name}
          </h4>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
            {formatText(visual_style.description)}
          </p>
        </div>
      </section>

      {/* Master Color Palette */}
      <section className="space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
          Master Color Palette
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {master_color_palette.map((color, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-lg border border-border/30 bg-surface-muted/30"
            >
              <div
                className="h-20 w-full"
                style={{ backgroundColor: color.hex_code }}
                aria-label={`Color swatch for ${color.color_name}`}
              />
              <div className="space-y-1 p-3">
                <p className="font-semibold text-text">{color.color_name}</p>
                <p className="font-mono text-xs text-text-muted">
                  {color.hex_code}
                </p>
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-text-muted">
                  {formatText(color.usage_notes)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
