import { CodeBlock } from "@/components/codeBlock";
import { EmptyState } from "@/components/emptyState";
import { getStory } from "@/server/data/stories";

type PageProps = {
  params: Promise<{ storyId: string }>;
};

export default async function VisualTab({ params }: PageProps) {
  const { storyId } = await params;
  try {
    const story = await getStory(storyId);

    if (!story?.visualDesignDocument) {
      return (
        <EmptyState
          title="Visual design unavailable"
          message="Visual design outputs will populate once the workflow runs for this story."
        />
      );
    }

    let formatted: string;
    try {
      formatted = JSON.stringify(story.visualDesignDocument, null, 2);
    } catch {
      return (
        <EmptyState
          title="Visual design unavailable"
          message="Visual design JSON could not be serialized."
        />
      );
    }

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
  } catch (error) {
    const message =
      error instanceof Error && error.name === "SupabaseConfigurationError"
        ? error.message
        : "Visual design data could not be loaded from Supabase.";
    return (
      <EmptyState
        title="Visual design unavailable"
        message={message}
      />
    );
  }
}
