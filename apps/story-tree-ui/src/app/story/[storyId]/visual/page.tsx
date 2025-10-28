import { CodeBlock } from "@/components/codeBlock";
import { EmptyState } from "@/components/emptyState";
import { getStoryArtifacts } from "@/data/mockStory";

export default function VisualTab({
  params,
}: {
  params: { storyId: string };
}) {
  const story = getStoryArtifacts(params.storyId);

  if (!story) {
    return (
      <EmptyState
        title="Visual design unavailable"
        message="Visual design outputs will populate once the workflow runs for this story."
      />
    );
  }

  const formatted = JSON.stringify(story.visualDesignJson, null, 2);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.3em] text-text-muted">
          Visual Design Document
        </p>
        <p className="text-xs text-text-muted/80">
          Raw JSON captured from the visual design Gemini response.
        </p>
      </header>
      <CodeBlock content={formatted} languageLabel="json" />
    </div>
  );
}
