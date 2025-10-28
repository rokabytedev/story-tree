import { CodeBlock } from "@/components/codeBlock";
import { EmptyState } from "@/components/emptyState";
import { getStoryTreeScript } from "@/server/data/stories";

type PageProps = {
  params: Promise<{ storyId: string }>;
};

export default async function ScriptTab({ params }: PageProps) {
  const { storyId } = await params;
  try {
    const scriptYaml = await getStoryTreeScript(storyId);

    if (!scriptYaml) {
      return (
        <EmptyState
          title="Interactive script pending"
          message="No interactive script has been generated for this story yet."
        />
      );
    }

    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-text-muted">
            Interactive Script Snapshot
          </p>
          <p className="text-xs text-text-muted/80">
            Raw YAML output from the interactive script generator.
          </p>
        </header>
        <CodeBlock content={scriptYaml} languageLabel="yaml" />
      </div>
    );
  } catch (error) {
    const message =
      error instanceof Error && error.name === "SupabaseConfigurationError"
        ? error.message
        : "Interactive script data could not be loaded from Supabase.";
    return (
      <EmptyState title="Interactive script unavailable" message={message} />
    );
  }
}
