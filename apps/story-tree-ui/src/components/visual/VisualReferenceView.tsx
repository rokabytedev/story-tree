import { CodeBlock } from "@/components/codeBlock";
import { GlobalAestheticSection } from "@/components/visual/GlobalAestheticSection";
import { VisualCharacterCard } from "@/components/visual/VisualCharacterCard";
import { VisualEnvironmentCard } from "@/components/visual/VisualEnvironmentCard";
import type { VisualDesignDocumentResult } from "@/lib/visualDesignDocument";

type VisualReferenceViewProps = {
  document: VisualDesignDocumentResult;
};

export function VisualReferenceView({ document }: VisualReferenceViewProps) {
  const { globalAesthetic, characters, environments, raw } = document;

  const hasCharacters = characters.length > 0;
  const hasEnvironments = environments.length > 0;

  return (
    <div className="space-y-10">
      {globalAesthetic ? (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-text-muted">
            Global Aesthetic
          </h2>
          <GlobalAestheticSection globalAesthetic={globalAesthetic} />
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-text-muted">
              Characters
            </h2>
            <p className="text-xs text-text-muted/80">
              Model sheets and design notes for the story roster.
            </p>
          </div>
        </div>
        {hasCharacters ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {characters.map((character) => (
              <VisualCharacterCard key={character.id} character={character} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-border/60 bg-surface-elevated px-6 py-8 text-sm text-text-muted">
            Character design data has not been generated yet.
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-text-muted">
            Environments
          </h2>
          <p className="text-xs text-text-muted/80">
            Primary environment reference art and scenelet coverage.
          </p>
        </div>
        {hasEnvironments ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {environments.map((environment) => (
              <VisualEnvironmentCard
                key={environment.id}
                environment={environment}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-border/60 bg-surface-elevated px-6 py-8 text-sm text-text-muted">
            Environment reference art has not been produced yet.
          </div>
        )}
      </section>

      {raw ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-text-muted">
              Visual Design Document
            </h2>
            <p className="text-xs text-text-muted/80">
              Raw JSON captured from the visual design workflow.
            </p>
          </div>
          <CodeBlock
            content={JSON.stringify(raw, null, 2)}
            languageLabel="json"
          />
        </section>
      ) : null}
    </div>
  );
}
