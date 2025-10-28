import { EmptyState } from "@/components/emptyState";
import { MarkdownPreview } from "@/components/markdownPreview";
import { getStory } from "@/server/data/stories";

export default async function ConstitutionTab({
  params,
}: {
  params: Promise<{ storyId: string }>;
}) {
  const { storyId } = await params;
  try {
    const story = await getStory(storyId);

    if (!story?.constitutionMarkdown) {
      return (
        <EmptyState
          title="Constitution unavailable"
          message="This story does not have a stored constitution yet. Run the Story Tree workflow to generate one."
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
  } catch (error) {
    const message =
      error instanceof Error && error.name === "SupabaseConfigurationError"
        ? error.message
        : "Story constitution could not be loaded from Supabase.";
    return (
      <EmptyState
        title="Constitution unavailable"
        message={message}
      />
    );
  }
}
