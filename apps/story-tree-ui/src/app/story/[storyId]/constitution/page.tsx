import { EmptyState } from "@/components/emptyState";
import { MarkdownPreview } from "@/components/markdownPreview";
import { getStoryArtifacts } from "@/data/mockStory";

export default function ConstitutionTab({
  params,
}: {
  params: { storyId: string };
}) {
  const story = getStoryArtifacts(params.storyId);

  if (!story) {
    return (
      <EmptyState
        title="Constitution unavailable"
        message="This mock story does not include constitution data yet. Future milestones will fetch live workflow outputs."
      />
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm uppercase tracking-[0.3em] text-text-muted">
        Constitution Markdown
      </p>
      <MarkdownPreview content={story.constitutionMarkdown} />
    </div>
  );
}
