import { CodeBlock } from "@/components/codeBlock";
import { EmptyState } from "@/components/emptyState";
import { getStoryArtifacts } from "@/data/mockStory";

export default function AudioTab({
  params,
}: {
  params: { storyId: string };
}) {
  const story = getStoryArtifacts(params.storyId);

  if (!story) {
    return (
      <EmptyState
        title="Audio design unavailable"
        message="Audio design artifacts will populate after the workflow completes for this story."
      />
    );
  }

  const formatted = JSON.stringify(story.audioDesignJson, null, 2);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.3em] text-text-muted">
          Audio Design Document
        </p>
        <p className="text-xs text-text-muted/80">
          Raw JSON captured from the audio design task.
        </p>
      </header>
      <CodeBlock content={formatted} languageLabel="json" />
    </div>
  );
}
