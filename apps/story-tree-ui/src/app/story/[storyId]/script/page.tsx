import { CodeBlock } from "@/components/codeBlock";
import { EmptyState } from "@/components/emptyState";
import { getStoryArtifacts } from "@/data/mockStory";

export default function ScriptTab({
  params,
}: {
  params: { storyId: string };
}) {
  const story = getStoryArtifacts(params.storyId);

  if (!story) {
    return (
      <EmptyState
        title="Interactive script pending"
        message="We have not generated a script tree for this placeholder story yet."
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
      <CodeBlock content={story.scriptYaml} languageLabel="yaml" />
    </div>
  );
}
