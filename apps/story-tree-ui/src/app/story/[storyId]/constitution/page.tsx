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
      <section className="rounded-3xl border border-border bg-page px-6 py-8">
        <MarkdownPreview content={story.constitutionMarkdown} />
      </section>
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
