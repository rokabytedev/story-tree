import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { SceneletNodeData } from "./types";

function SceneletNodeBase({ data }: NodeProps<SceneletNodeData>) {
  const { scenelet } = data;

  return (
    <div className="w-[320px] overflow-hidden rounded-3xl border border-border bg-surface text-text shadow-sm transition-shadow duration-150 hover:shadow-lg">
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !bg-highlight/60 !border-none"
      />
      <header className="flex items-start justify-between border-b border-border/60 px-4 py-3">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.3em] text-text-muted">Scenelet</p>
          <p className="text-xs font-semibold text-text-primary">{scenelet.id}</p>
        </div>
        {scenelet.choiceLabel && (
          <span className="rounded-full bg-highlight/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-highlight">
            {scenelet.choiceLabel}
          </span>
        )}
      </header>

      <div className="space-y-4 px-4 py-3">
        {scenelet.description && (
          <p className="text-sm leading-relaxed text-text-muted">{scenelet.description}</p>
        )}

        {scenelet.shotSuggestions.length > 0 && (
          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
              Shot Suggestions
            </p>
            <div className="-mx-1 flex gap-3 overflow-x-auto pb-2">
              {scenelet.shotSuggestions.map((shot, index) => (
                <div
                  key={`${scenelet.id}-shot-${index}`}
                  className="flex w-40 min-w-[10rem] flex-col gap-2 rounded-2xl bg-surface-muted/70 p-3 ring-1 ring-border/50"
                >
                  <div className="aspect-video w-full rounded-xl bg-border/40" />
                  <p className="text-xs leading-snug text-text-muted/90">{shot}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {scenelet.dialogue.length > 0 && (
          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
              Dialogue
            </p>
            <ul className="space-y-1.5 text-sm leading-snug text-text-muted">
              {scenelet.dialogue.map((line, index) => (
                <li key={`${scenelet.id}-dialogue-${index}`}>
                  <span className="font-semibold text-highlight">{line.character}:</span>{" "}
                  <span>{line.line}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !bg-highlight/60 !border-none"
      />
    </div>
  );
}

export const SceneletNode = memo(SceneletNodeBase);
